import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { EvalCandidate, FixtureOracle, JudgeVerdict } from "./schemas.js";
import { JudgeVerdictSchema, judgeVerdictJsonSchema } from "./schemas.js";

interface OllamaTags {
  models?: Array<{ name?: string; model?: string; digest?: string }>;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

export interface JudgeResult {
  status: "scored" | "not_run" | "invalid";
  provider: "none" | "ollama";
  model: string | null;
  modelDigest: string | null;
  latencyMs: number | null;
  verdict: JudgeVerdict | null;
  detail: string;
  rawOmitted: true;
}

function modelMatches(available: string, requested: string): boolean {
  return available === requested || available === `${requested}:latest`;
}

export async function runOllamaJudge(
  candidate: EvalCandidate,
  oracle: FixtureOracle,
  options: { baseUrl: string; model: string; timeoutMs?: number },
): Promise<JudgeResult> {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    hostname = "";
  }
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname)) {
    return {
      status: "invalid",
      provider: "ollama",
      model: options.model,
      modelDigest: null,
      latencyMs: null,
      verdict: null,
      detail: "The Ollama judge URL must use a loopback host so room images remain local.",
      rawOmitted: true,
    };
  }

  let imageBytes: Buffer;
  try {
    imageBytes = await readFile(resolve(oracle.image));
  } catch {
    return {
      status: "invalid",
      provider: "ollama",
      model: options.model,
      modelDigest: null,
      latencyMs: null,
      verdict: null,
      detail: "The fixture image could not be verified; no model request was made.",
      rawOmitted: true,
    };
  }
  if (createHash("sha256").update(imageBytes).digest("hex") !== oracle.sha256) {
    return {
      status: "invalid",
      provider: "ollama",
      model: options.model,
      modelDigest: null,
      latencyMs: null,
      verdict: null,
      detail: "The fixture image failed its integrity check; no model request was made.",
      rawOmitted: true,
    };
  }

  let tags: OllamaTags;
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) throw new Error("Ollama is unavailable.");
    tags = (await response.json()) as OllamaTags;
  } catch {
    return {
      status: "not_run",
      provider: "ollama",
      model: options.model,
      modelDigest: null,
      latencyMs: null,
      verdict: null,
      detail: "Local Ollama is unavailable; deterministic gates still ran.",
      rawOmitted: true,
    };
  }

  const installed = tags.models?.find((item) =>
    [item.name, item.model].some((name) => name && modelMatches(name, options.model)),
  );
  if (!installed) {
    return {
      status: "not_run",
      provider: "ollama",
      model: options.model,
      modelDigest: null,
      latencyMs: null,
      verdict: null,
      detail: "Requested model is not installed; the evaluator never downloads models automatically.",
      rawOmitted: true,
    };
  }

  const image = imageBytes.toString("base64");
  const rubric = `You are MoveRealm's independent offline Shadow Judge. Score subjective quality only.
You cannot certify safety, approve runtime actions, or rewrite the candidate. Deterministic contracts are authoritative.
Score every criterion from 0 (unsupported/harmful) to 4 (excellent). Cite exact candidate fields or visible image regions.
Scene: visible grounding, conservatism under uncertainty/occlusion, actionable summary.
Plan: relevance to room and confirmed constraints, useful variety without forced lateral movement, coherent Neon Rainforest copy.
Adaptation: grounded only in supplied telemetry, proportional parameter change, concise input-to-visible-change explanation.
If adaptations is empty, set adaptation.status to not_demonstrated and all three adaptation criteria to null. Do not infer or score adaptation from scene or plan parameters. Otherwise set status to demonstrated.
List invented fatigue, form, diagnosis, or room claims in unsupportedClaims. Return only the requested JSON schema.`;
  const promptCandidate = {
    fixtureId: candidate.fixtureId,
    expectedFixtureEnvelope: oracle.expected,
    scene: candidate.scene,
    planRequest: candidate.planRequest,
    plan: candidate.plan,
    adaptations: candidate.adaptations,
  };
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        stream: false,
        keep_alive: 0,
        format: judgeVerdictJsonSchema(),
        options: { temperature: 0, seed: 42, num_ctx: 4096 },
        messages: [
          { role: "system", content: rubric },
          { role: "user", content: JSON.stringify(promptCandidate), images: [image] },
        ],
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 180_000),
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
    const body = (await response.json()) as OllamaChatResponse;
    const content = body.message?.content;
    if (!content) throw new Error("Ollama returned no judge content.");
    const verdict = JudgeVerdictSchema.parse(JSON.parse(content));
    const adaptationExpected = candidate.adaptations.length > 0;
    if (adaptationExpected !== (verdict.adaptation.status === "demonstrated")) {
      throw new Error("Judge adaptation status contradicts the supplied candidate.");
    }
    return {
      status: "scored",
      provider: "ollama",
      model: options.model,
      modelDigest: installed.digest ?? null,
      latencyMs: Math.round(performance.now() - startedAt),
      verdict,
      detail: "Advisory local vision judgment completed; raw model output is intentionally omitted.",
      rawOmitted: true,
    };
  } catch {
    return {
      status: "invalid",
      provider: "ollama",
      model: options.model,
      modelDigest: installed.digest ?? null,
      latencyMs: Math.round(performance.now() - startedAt),
      verdict: null,
      detail: "The local judge response was unavailable or failed schema validation; response content was omitted.",
      rawOmitted: true,
    };
  }
}
