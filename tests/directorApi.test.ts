import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAdaptation, requestPlan } from "../src/lib/directorApi.js";
import type { AdaptRequest, PlanRequest } from "../src/shared/contracts.js";
import { createFallbackPlan, DEMO_SCENES } from "../src/shared/fallbacks.js";

const responseMeta = {
  source: "codebuddy",
  latencyMs: 12,
  label: "Live CodeBuddy",
} as const;

const horizontalOnlyRequest: PlanRequest = {
  scene: DEMO_SCENES.tight,
  constraints: {
    floorClear: true,
    noJumping: true,
    sideStepRange: "wide",
    permittedDirections: ["left", "right", "center"],
  },
  intent: { durationSeconds: 180, energy: "balanced", noJumping: true },
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data, meta: responseMeta }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser Movement Director boundary", () => {
  it("catches an asynchronously rejected unsafe plan and returns a validated fallback", async () => {
    const unsafe = createFallbackPlan({
      ...horizontalOnlyRequest,
      constraints: {
        ...horizontalOnlyRequest.constraints,
        permittedDirections: ["vertical", "center"],
        sideStepRange: "none",
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(unsafe)));

    const response = await requestPlan(horizontalOnlyRequest);

    expect(response.meta.source).toBe("fallback");
    expect(response.data.rounds.every((round) => round.movementId !== "squat")).toBe(true);
    expect(
      response.data.rounds
        .filter((round) => round.movementId === "reach")
        .every((round) => round.rangeScale <= 0.62),
    ).toBe(true);
  });

  it("catches an asynchronously rejected unsafe adaptation and returns a validated fallback", async () => {
    const plan = createFallbackPlan(horizontalOnlyRequest);
    const request: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: plan.rounds[0].movementId,
        completionRate: 0.25,
        movementRange: 0.5,
        poseConfidence: 0,
        trackingFps: 0,
        trackingMode: "keyboard",
        targetsPresented: 12,
        targetsCompleted: 3,
        feedback: "too_hard",
      },
      nextRoundSeed: plan.rounds[1],
      constraints: horizontalOnlyRequest.constraints,
      intent: horizontalOnlyRequest.intent,
    };
    const unsafe = {
      nextRound: { ...request.nextRoundSeed, movementId: "squat", mechanic: "shelter_seedlings" },
      reason: "Replace the movement.",
      adjustments: ["tempo"],
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(unsafe)));

    const response = await requestAdaptation(request);

    expect(response.meta.source).toBe("fallback");
    expect(response.data.nextRound.id).toBe(request.nextRoundSeed.id);
    expect(response.data.nextRound.movementId).toBe(request.nextRoundSeed.movementId);
    expect(response.data.nextRound.rangeScale).toBeLessThanOrEqual(request.nextRoundSeed.rangeScale);
  });
});
