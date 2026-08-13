import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runOllamaJudge } from "../eval/judge.js";
import { evaluateHardGates } from "../eval/rubric.js";
import {
  EvalCandidateSchema,
  FixtureManifestSchema,
  JudgeVerdictSchema,
  advisoryScore,
  type EvalCandidate,
  type FixtureOracle,
} from "../eval/schemas.js";
import {
  validateAdaptationSafety,
  validatePlanSafety,
  type AdaptRequest,
  type PlanRequest,
  type SceneProfile,
} from "../src/shared/contracts.js";
import { createFallbackAdaptation, createFallbackPlan } from "../src/shared/fallbacks.js";

const manifest = FixtureManifestSchema.parse(
  JSON.parse(await readFile("eval/fixtures.json", "utf8")),
);

function fixture(id: string): FixtureOracle {
  const value = manifest.fixtures.find((item) => item.id === id);
  if (!value) throw new Error(`Missing fixture ${id}.`);
  return value;
}

function candidateFor(id: "open-room" | "tight-room" | "uncertain-room"): EvalCandidate {
  const scenes: Record<typeof id, SceneProfile> = {
    "open-room": {
      spaceClass: "open",
      obstacles: [{ label: "Chair at the far edge", zone: "right", severity: "low" }],
      permittedDirections: ["vertical", "left", "right", "center"],
      confidence: 0.9,
      summary: "Clear floor supports controlled movement in every direction.",
    },
    "tight-room": {
      spaceClass: "tight",
      obstacles: [
        { label: "Desk", zone: "left", severity: "high" },
        { label: "Chair", zone: "right", severity: "high" },
      ],
      permittedDirections: ["vertical", "center"],
      confidence: 0.78,
      summary: "Use the clear central lane; lateral space is obstructed.",
    },
    "uncertain-room": {
      spaceClass: "uncertain",
      obstacles: [{ label: "Door frame", zone: "left", severity: "medium" }],
      permittedDirections: ["vertical", "center"],
      confidence: 0.38,
      summary: "Only the central upright lane is visible with confidence.",
    },
  };
  const scene = scenes[id];
  const lateral = scene.permittedDirections.includes("left") || scene.permittedDirections.includes("right");
  const planRequest: PlanRequest = {
    scene,
    constraints: {
      floorClear: true,
      noJumping: true,
      sideStepRange: lateral ? (scene.spaceClass === "open" ? "wide" : "narrow") : "none",
      permittedDirections: scene.permittedDirections,
    },
    intent: { durationSeconds: 180, energy: "balanced", noJumping: true },
  };
  const plan = validatePlanSafety(createFallbackPlan(planRequest), planRequest);
  if (id === "uncertain-room") {
    for (const round of plan.rounds) {
      round.movementId = "reach";
      round.mechanic = "collect_fireflies";
      round.prompt = "Reach gently within the visible central lane";
    }
  }
  const adaptations = id === "tight-room"
    ? (() => {
        const request: AdaptRequest = {
          telemetry: {
            roundId: "round-1",
            movementId: plan.rounds[0].movementId,
            completionRate: 4 / 12,
            movementRange: 0.54,
            poseConfidence: 0,
            trackingFps: 0,
            trackingMode: "keyboard",
            targetsPresented: 12,
            targetsCompleted: 4,
            feedback: "too_hard",
          },
          nextRoundSeed: plan.rounds[1],
          constraints: planRequest.constraints,
          intent: planRequest.intent,
        };
        return [{ request, decision: validateAdaptationSafety(createFallbackAdaptation(request), request) }];
      })()
    : [];
  return EvalCandidateSchema.parse({
    schemaVersion: "1.0.0",
    fixtureId: id,
    source: "fallback",
    scene,
    planRequest,
    plan,
    adaptations,
  });
}

function verdict() {
  const criterion = (score: number) => ({
    score,
    rationale: "The candidate is grounded in the supplied room and structured fields.",
    evidence: ["scene.spaceClass and plan.rounds"],
    concerns: [],
  });
  return JudgeVerdictSchema.parse({
    schemaVersion: "1.0.0",
    scene: { grounding: criterion(4), conservatism: criterion(3), actionability: criterion(4) },
    plan: { roomRelevance: criterion(4), movementVariety: criterion(3), themeCopy: criterion(3) },
    adaptation: {
      status: "demonstrated",
      telemetryGrounding: criterion(4),
      proportionality: criterion(3),
      explanationQuality: criterion(4),
    },
    unsupportedClaims: [],
    overallNotes: "The result is relevant and conservative; this score is advisory, not a safety certificate.",
  });
}

afterEach(() => vi.restoreAllMocks());

describe("offline agent evaluation", () => {
  it.each(["open-room", "tight-room", "uncertain-room"] as const)(
    "passes the independent oracle and production gates for %s",
    async (id) => {
      const result = await evaluateHardGates(candidateFor(id), fixture(id));
      expect(result.passed).toBe(true);
      expect(result.checks.every((item) => item.status === "pass")).toBe(true);
    },
  );

  it("fails an unsafe lateral plan even if the candidate schema is valid", async () => {
    const candidate = candidateFor("tight-room");
    const unsafe = structuredClone(candidate);
    unsafe.planRequest.constraints.sideStepRange = "wide";
    unsafe.planRequest.constraints.permittedDirections = ["vertical", "left", "right", "center"];
    unsafe.planRequest.scene.permittedDirections = ["vertical", "left", "right", "center"];
    unsafe.scene.permittedDirections = ["vertical", "left", "right", "center"];
    unsafe.plan = createFallbackPlan(unsafe.planRequest);
    const result = await evaluateHardGates(EvalCandidateSchema.parse(unsafe), fixture("tight-room"));
    expect(result.passed).toBe(false);
    expect(result.checks.find((item) => item.id === "scene-oracle")?.detail).toMatch(/unexpected permitted left/i);
  });

  it("fails when fixture bytes do not match the independent hash", async () => {
    const badOracle = { ...fixture("open-room"), sha256: "0".repeat(64) };
    const result = await evaluateHardGates(candidateFor("open-room"), badOracle);
    expect(result.passed).toBe(false);
    expect(result.checks[0].detail).toMatch(/hash/i);
  });

  it("rejects floor-dependent movements when the room view is uncertain", async () => {
    const candidate = candidateFor("uncertain-room");
    candidate.plan.rounds[1].movementId = "squat";
    candidate.plan.rounds[1].mechanic = "shelter_seedlings";
    const result = await evaluateHardGates(candidate, fixture("uncertain-room"));
    expect(result.passed).toBe(false);
    expect(result.checks.find((item) => item.id === "plan-safety")?.detail).toMatch(
      /reach rounds only/i,
    );
  });

  it("never calls the chat endpoint or invents a score when the model is absent", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [] }), { status: 200 }),
    );
    const result = await runOllamaJudge(candidateFor("open-room"), fixture("open-room"), {
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-vl:8b-instruct-q4_K_M",
    });
    expect(result.status).toBe("not_run");
    expect(result.verdict).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("parses schema-constrained Ollama output and records only the validated verdict", async () => {
    const expected = verdict();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ models: [{ name: "qwen3-vl:8b-instruct-q4_K_M", digest: "abc123" }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: { content: JSON.stringify(expected) } }), { status: 200 }),
      );
    const result = await runOllamaJudge(candidateFor("tight-room"), fixture("tight-room"), {
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-vl:8b-instruct-q4_K_M",
    });
    expect(result.status).toBe("scored");
    expect(result.rawOmitted).toBe(true);
    expect(result.modelDigest).toBe("abc123");
    expect(advisoryScore(result.verdict!)).toEqual({ earned: 32, possible: 36 });
    const chatBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(chatBody.options).toEqual({ temperature: 0, seed: 42, num_ctx: 4096 });
    expect(chatBody.keep_alive).toBe(0);
    expect(chatBody.messages[1].images[0]).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("marks malformed model output invalid without exposing it as a score", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ models: [{ name: "qwen3-vl:8b-instruct-q4_K_M" }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: { content: JSON.stringify({ secret: "raw output" }) } }), { status: 200 }),
      );
    const result = await runOllamaJudge(candidateFor("open-room"), fixture("open-room"), {
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-vl:8b-instruct-q4_K_M",
    });
    expect(result.status).toBe("invalid");
    expect(result.verdict).toBeNull();
    expect(result.detail).not.toContain("raw output");
  });

  it("tracks the exact candidate bytes used for evaluation", async () => {
    const serialized = `${JSON.stringify(candidateFor("open-room"), null, 2)}\n`;
    expect(createHash("sha256").update(serialized).digest("hex")).toMatch(/^[a-f0-9]{64}$/);
  });
});
