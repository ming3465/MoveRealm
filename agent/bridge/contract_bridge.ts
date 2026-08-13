/**
 * MoveRealm contract bridge.
 *
 * A newline-delimited JSON request/response service over stdio that exposes the *real*
 * production safety gates to the Python safety-probe agent. The agent never re-implements
 * `validatePlanSafety` and friends; it calls them here so every verdict comes from the same
 * code path the Express adapter uses.
 *
 * Protocol: one JSON object per stdin line, one JSON object per stdout line.
 *   -> {"id":"1","op":"plan.validate","payload":{"request":{...},"candidate":{...}}}
 *   <- {"id":"1","ok":false,"kind":"safety","error":"...","issues":[]}
 *
 * Nothing is written to stdout except responses, so stdout stays a clean channel.
 */
import { createInterface } from "node:readline";
import { z } from "zod";
import {
  AdaptRequestSchema,
  PlanRequestSchema,
  validateAdaptationSafety,
  validatePlanSafety,
  validateSceneSafety,
} from "../../src/shared/contracts.js";
import {
  DEMO_SCENES,
  createFallbackAdaptation,
  createFallbackPlan,
  createFallbackSceneProfile,
} from "../../src/shared/fallbacks.js";

const BRIDGE_VERSION = "1.0.0";

type FailureKind = "schema" | "safety" | "request_invalid" | "unknown_op" | "internal";

interface BridgeRequest {
  id?: unknown;
  op?: unknown;
  payload?: Record<string, unknown>;
}

interface BridgeIssue {
  path: string[];
  code: string;
  message: string;
}

class RequestInvalid extends Error {
  constructor(readonly cause: unknown) {
    super("The bridge request envelope failed its own schema.");
  }
}

function issuesOf(error: unknown): BridgeIssue[] {
  if (!(error instanceof z.ZodError)) return [];
  return error.issues.slice(0, 12).map((issue) => ({
    path: issue.path.map((segment) => String(segment)),
    code: String(issue.code),
    message: issue.message,
  }));
}

function messageOf(error: unknown): string {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    const where = first?.path.length ? ` at ${first.path.map(String).join(".")}` : "";
    return `${first?.message ?? "Schema validation failed."}${where}`;
  }
  if (error instanceof Error) return error.message.slice(0, 400);
  return "Unknown validation failure.";
}

function kindOf(error: unknown): FailureKind {
  if (error instanceof RequestInvalid) return "request_invalid";
  if (error instanceof z.ZodError) return "schema";
  if (error instanceof Error) return "safety";
  return "internal";
}

/** Parse the caller-supplied request envelope; failures are the agent's fault, not the gate's. */
function parseRequest<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    throw new RequestInvalid(error);
  }
}

function handle(op: string, payload: Record<string, unknown>): unknown {
  switch (op) {
    case "ping":
      return { bridgeVersion: BRIDGE_VERSION, node: process.version };

    case "scene.validate":
      return { data: validateSceneSafety(payload.candidate) };

    case "plan.validate": {
      const request = parseRequest(PlanRequestSchema, payload.request);
      return { data: validatePlanSafety(payload.candidate, request) };
    }

    case "adapt.validate": {
      const request = parseRequest(AdaptRequestSchema, payload.request);
      return { data: validateAdaptationSafety(payload.candidate, request) };
    }

    case "plan.fallback": {
      const request = parseRequest(PlanRequestSchema, payload.request);
      return { data: createFallbackPlan(request) };
    }

    case "adapt.fallback": {
      const request = parseRequest(AdaptRequestSchema, payload.request);
      return { data: createFallbackAdaptation(request) };
    }

    case "scene.fallback":
      return { data: createFallbackSceneProfile((payload.hints ?? {}) as Record<string, number>) };

    case "scene.demo":
      return { data: DEMO_SCENES };

    default: {
      const error = new Error(`Unsupported bridge operation: ${op}`);
      (error as Error & { kind?: FailureKind }).kind = "unknown_op";
      throw error;
    }
  }
}

function respond(payload: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });

reader.on("line", (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request: BridgeRequest;
  try {
    request = JSON.parse(trimmed) as BridgeRequest;
  } catch {
    respond({ id: null, ok: false, kind: "internal", error: "Bridge received malformed JSON." });
    return;
  }

  const id = typeof request.id === "string" ? request.id : null;
  const op = typeof request.op === "string" ? request.op : "";
  const payload = (request.payload ?? {}) as Record<string, unknown>;

  try {
    respond({ id, ok: true, kind: "accepted", ...(handle(op, payload) as object) });
  } catch (error) {
    const declared = (error as { kind?: FailureKind }).kind;
    const inner = error instanceof RequestInvalid ? error.cause : error;
    respond({
      id,
      ok: false,
      kind: declared ?? kindOf(error),
      error: messageOf(inner),
      issues: issuesOf(inner),
    });
  }
});

reader.on("close", () => {
  process.exit(0);
});
