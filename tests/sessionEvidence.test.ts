import { describe, expect, it } from "vitest";
import {
  buildSessionEvidence,
  summarizeMetricSamples,
  type SessionResult,
} from "../src/lib/sessionEvidence.js";
import type {
  AdaptationDecision,
  DirectorMeta,
  QuestPlan,
  QuestRound,
  RoundTelemetry,
} from "../src/shared/contracts.js";
import { createFallbackPlan, DEMO_SCENES } from "../src/shared/fallbacks.js";

const planRequest = {
  scene: DEMO_SCENES.open,
  constraints: {
    floorClear: true,
    noJumping: true as const,
    sideStepRange: "wide" as const,
    permittedDirections: DEMO_SCENES.open.permittedDirections,
  },
  intent: { durationSeconds: 180 as const, energy: "balanced" as const, noJumping: true as const },
};

function telemetry(plan: QuestPlan, mode: "pose" | "keyboard" = "pose"): RoundTelemetry[] {
  return plan.rounds.map((round, index) => ({
    roundId: round.id,
    movementId: round.movementId,
    completionRate: [0.5, 0.75, 1][index],
    movementRange: 0.713 + index * 0.01,
    poseConfidence: mode === "pose" ? 0.873 + index * 0.01 : 0,
    trackingFps: mode === "pose" ? 24.26 + index : 0,
    trackingMode: mode,
    targetsPresented: 8,
    targetsCompleted: [4, 6, 8][index],
    feedback: index === 0 ? "too_hard" : "just_right",
  }));
}

function adaptations(plan: QuestPlan): AdaptationDecision[] {
  return plan.rounds.slice(1).map((round, index) => ({
    nextRound: {
      ...round,
      rangeScale: Math.max(0.4, round.rangeScale - 0.1),
      tempo: Math.max(0.55, round.tempo - 0.1),
      targetRate: round.targetRate - 1,
    },
    reason: index === 0
      ? "Alice missed targets in /Users/alice/private-room.jpg."
      : "The next round changed.",
    adjustments: ["target_envelope", "tempo", "target_rate"],
  }));
}

function meta(source: DirectorMeta["source"], latencyMs: number): DirectorMeta {
  return {
    source,
    latencyMs,
    label: "Alice's private director",
    detail: "Bearer secret-token at /Users/alice/private-room.jpg",
  };
}

function resultFor(mode: "pose" | "keyboard" = "pose"): SessionResult {
  const initialPlan = createFallbackPlan(planRequest);
  const decisions = adaptations(initialPlan);
  const plan = {
    ...initialPlan,
    rounds: initialPlan.rounds.map((round, index) =>
      index === 0 ? round : decisions[index - 1].nextRound),
  };
  const rounds = telemetry(plan, mode);
  const planMeta = meta("fallback", 2_045.2);
  const adaptationMetas = [meta("codebuddy", 650.4), meta("fallback", 420.1)];
  return {
    // This free-form title is intentionally sensitive-looking; the builder must not copy it.
    plan: { ...plan, title: "Alice's bedroom adventure" },
    telemetry: rounds,
    adaptations: decisions,
    activeSeconds: 156,
    totalTargets: 24,
    completedTargets: 18,
    timeToFirstMovementMs: 31_249.6,
    directorLatencyMs: planMeta.latencyMs + adaptationMetas.reduce(
      (sum, item) => sum + item.latencyMs,
      0,
    ),
    poseMetricSummaries: {},
    directorMetas: {
      plan: planMeta,
      adaptations: adaptationMetas,
    },
    journeyDurationMs: 205_555,
  };
}

describe("privacy-safe session evidence", () => {
  it("exports deterministic aggregate pose evidence and director provenance", () => {
    const result = resultFor("pose");
    result.poseMetricSummaries = {
      trackingFps: {
        mean: 25.234,
        sampleCount: 420,
        min: 20.1,
        max: 30.2,
        p05: 21.1,
        p95: 29.8,
      },
      inferenceMs: { mean: 31.56, sampleCount: 420, min: 20.1, max: 48.2, p95: 44.4 },
      visibleResponseLatencyMs: {
        mean: 73.68,
        sampleCount: 18,
        min: 51,
        max: 110,
        p95: 96.2,
      },
    };
    const input = {
      trialId: "trial-1",
      roomSpaceClass: "open" as const,
      result,
      sceneDirector: meta("codebuddy", 1_204.6),
      build: { buildId: "build-123456", commitSha: "a".repeat(40) },
    };

    const first = buildSessionEvidence(input);
    const second = buildSessionEvidence(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.product).toEqual({
      name: "MoveRealm",
      appVersion: "0.1.0",
      buildId: "build-123456",
      commitSha: "a".repeat(40),
    });
    expect(first.context).toEqual({ roomSpaceClass: "open", trackingMode: "pose" });
    expect(first.duration).toEqual({
      plannedAdventureSeconds: 180,
      plannedActiveSeconds: 156,
      plannedRestSeconds: 24,
      completedActiveSeconds: 156,
      observedAdventureSeconds: 205.6,
    });
    expect(first.metrics).toEqual({
      completionRate: 0.75,
      timeToFirstMovementMs: 31_250,
      trackingFps: 25.2,
      inferenceMs: 31.6,
      visibleResponseLatencyMs: 73.7,
    });
    expect(first.measurementEvidence.trackingFps).toMatchObject({
      summary: { sampleCount: 420, mean: 25.2 },
      threshold: { status: "pass", basis: "p05", evaluatedValue: 21.1 },
    });
    expect(first.measurementEvidence.timeToFirstMovementMs.threshold).toMatchObject({
      status: "pass",
      basis: "mean",
      evaluatedValue: 31_250,
      target: 45_000,
    });
    expect(first.measurementEvidence.inferenceMs.threshold).toMatchObject({
      status: "pass",
      basis: "p95",
      evaluatedValue: 44.4,
    });
    expect(first.measurementEvidence.visibleResponseLatencyMs.threshold).toMatchObject({
      status: "pass",
      basis: "p95",
      evaluatedValue: 96.2,
    });
    expect(first.director.sourcesUsed).toEqual(["codebuddy", "fallback"]);
    expect(first.director.sessionPlanAndAdaptationLatencyMs).toBe(3_116);
    expect(first.rounds[0]).toMatchObject({
      roundId: "round-1",
      trackingMode: "pose",
      poseConfidence: 0.873,
      trackingFps: 24.3,
    });
    expect(first.adaptations).toHaveLength(2);
    expect(first.adaptations[0]).toMatchObject({
      afterRoundId: "round-1",
      appliesToRoundId: "round-2",
      director: { source: "codebuddy", latencyMs: 650 },
    });
  });

  it("forces keyboard and guided-demo pose measurements to explicit N/A nulls", () => {
    const keyboardResult = resultFor("keyboard");
    keyboardResult.poseMetricSummaries = {
      trackingFps: { mean: 30, sampleCount: 100 },
      inferenceMs: { mean: 10, sampleCount: 100 },
      visibleResponseLatencyMs: { mean: 20, sampleCount: 10 },
    };
    const evidence = buildSessionEvidence({
      trialId: "trial-2",
      roomSpaceClass: "tight",
      result: {
        ...keyboardResult,
        directorLatencyMs: 0,
        directorMetas: { plan: meta("demo", 0), adaptations: [meta("demo", 0), meta("demo", 0)] },
      },
      sceneDirector: null,
    });

    expect(evidence.context.trackingMode).toBe("keyboard");
    expect(evidence.metrics.trackingFps).toBeNull();
    expect(evidence.metrics.inferenceMs).toBeNull();
    expect(evidence.metrics.visibleResponseLatencyMs).toBeNull();
    expect(evidence.metrics.timeToFirstMovementMs).toBe(31_250);
    expect(evidence.duration.observedAdventureSeconds).toBe(205.6);
    expect(evidence.director.scene).toBeNull();
    expect(evidence.rounds.every((round) => round.poseConfidence === null)).toBe(true);
    expect(evidence.rounds.every((round) => round.trackingFps === null)).toBe(true);
    expect(evidence.measurementEvidence.trackingFps).toMatchObject({
      summary: null,
      threshold: { status: "not_evaluated", basis: null, evaluatedValue: null },
    });
    expect(evidence.measurementEvidence.timeToFirstMovementMs.threshold.status).toBe(
      "not_evaluated",
    );
    expect(evidence.measurementEvidence.inferenceMs.threshold.status).toBe("not_evaluated");
    expect(evidence.measurementEvidence.visibleResponseLatencyMs.threshold.status).toBe(
      "not_evaluated",
    );
  });

  it("does not certify a run that switched from pose to keyboard", () => {
    const mixedResult = resultFor("pose");
    mixedResult.telemetry[2] = {
      ...mixedResult.telemetry[2],
      trackingMode: "keyboard",
      poseConfidence: 0,
      trackingFps: 0,
    };
    mixedResult.poseMetricSummaries = {
      trackingFps: { mean: 28, sampleCount: 100, p05: 25 },
      inferenceMs: { mean: 30, sampleCount: 100, p95: 40 },
      visibleResponseLatencyMs: { mean: 70, sampleCount: 4, p95: 90 },
    };

    const evidence = buildSessionEvidence({
      trialId: "trial-3",
      roomSpaceClass: "open",
      result: mixedResult,
      sceneDirector: meta("codebuddy", 100),
    });

    expect(evidence.context.trackingMode).toBe("mixed");
    expect(evidence.metrics.trackingFps).toBeNull();
    expect(evidence.metrics.visibleResponseLatencyMs).toBeNull();
    expect(evidence.measurementEvidence.trackingFps.threshold.status).toBe("not_evaluated");
    expect(evidence.measurementEvidence.timeToFirstMovementMs.threshold.status).toBe(
      "not_evaluated",
    );
  });

  it("does not certify pose metrics with too few counted samples", () => {
    const result = resultFor("pose");
    result.poseMetricSummaries = {
      trackingFps: { mean: 25, sampleCount: 119, min: 20, max: 30, p05: 21, p95: 29 },
      inferenceMs: { mean: 30, sampleCount: 119, min: 20, max: 45, p05: 22, p95: 42 },
      visibleResponseLatencyMs: {
        mean: 70,
        sampleCount: 2,
        min: 60,
        max: 80,
        p05: 60,
        p95: 80,
      },
    };

    const evidence = buildSessionEvidence({
      trialId: "trial-3",
      roomSpaceClass: "open",
      result,
      sceneDirector: meta("codebuddy", 1_000),
    });

    expect(evidence.measurementEvidence.trackingFps.summary?.sampleCount).toBe(119);
    expect(evidence.measurementEvidence.trackingFps.threshold.status).toBe("not_evaluated");
    expect(evidence.measurementEvidence.inferenceMs.threshold.status).toBe("not_evaluated");
    expect(evidence.measurementEvidence.visibleResponseLatencyMs.summary?.sampleCount).toBe(2);
    expect(evidence.measurementEvidence.visibleResponseLatencyMs.threshold.status).toBe(
      "not_evaluated",
    );
  });

  it("does not export names, media, landmarks, upload paths, or free-form agent text", () => {
    const evidence = buildSessionEvidence({
      trialId: "trial-3",
      roomSpaceClass: null,
      result: resultFor("pose"),
      sceneDirector: meta("codebuddy", 100),
    });
    const serialized = JSON.stringify(evidence);

    expect(serialized).not.toMatch(/Alice|Bearer|secret-token|Users\/|private-room|bedroom/i);
    expect(serialized).not.toMatch(
      /"(?:uploadPath|previewUrl|imageData|videoData|landmarks)"\s*:/i,
    );
    expect(evidence.privacy).toMatchObject({
      liveCameraHandlingDesign: "browser_only",
      liveCameraNetworkAuditIncluded: false,
      personalIdentifiersIncluded: false,
      imagesOrVideoIncluded: false,
      rawPoseLandmarksIncluded: false,
      capturedRoomStillIncluded: false,
      uploadPathsIncluded: false,
    });
  });

  it("rejects provenance mismatches and unsafe identifying build fields", () => {
    const result = resultFor("pose");
    expect(() =>
      buildSessionEvidence({
        trialId: "trial-2",
        roomSpaceClass: "uncertain",
        result: { ...result, directorMetas: { ...result.directorMetas, adaptations: [meta("fallback", 3)] } },
        sceneDirector: meta("fallback", 1),
      }),
    ).toThrow(/one director provenance/i);

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-Alice",
        roomSpaceClass: null,
        result,
        sceneDirector: null,
      }),
    ).toThrow(/trialId/i);

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-1",
        roomSpaceClass: null,
        result,
        sceneDirector: null,
        build: { buildId: "/Users/alice/local-build" },
      }),
    ).toThrow(/buildId/i);

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-1",
        roomSpaceClass: null,
        result: { ...result, totalTargets: result.totalTargets + 1 },
        sceneDirector: null,
      }),
    ).toThrow(/per-round telemetry/i);

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-1",
        roomSpaceClass: null,
        result: { ...result, telemetry: result.telemetry.slice(0, 2) },
        sceneDirector: null,
      }),
    ).toThrow(/all validated rounds/i);
  });

  it("rejects internally contradictory counts, adaptation parameters, and latency totals", () => {
    const completionMismatch = resultFor("pose");
    completionMismatch.telemetry[0] = {
      ...completionMismatch.telemetry[0],
      completionRate: 0.9,
    };
    expect(() =>
      buildSessionEvidence({
        trialId: "trial-1",
        roomSpaceClass: "open",
        result: completionMismatch,
        sceneDirector: null,
      }),
    ).toThrow(/completion rate must match/i);

    const latencyMismatch = resultFor("pose");
    latencyMismatch.directorLatencyMs += 1;
    expect(() =>
      buildSessionEvidence({
        trialId: "trial-3",
        roomSpaceClass: "uncertain",
        result: latencyMismatch,
        sceneDirector: null,
      }),
    ).toThrow(/latency total must match/i);
  });

  it.each<[string, (round: QuestRound) => QuestRound]>([
    ["round identity", (round) => ({ ...round, id: "round-3" })],
    ["movement and mechanic", (round) => ({
      ...round,
      movementId: "reach",
      mechanic: "collect_fireflies",
    })],
    ["duration", (round) => ({ ...round, durationSeconds: round.durationSeconds + 1 })],
    ["target rate", (round) => ({ ...round, targetRate: round.targetRate + 1 })],
    ["range scale", (round) => ({ ...round, rangeScale: round.rangeScale + 0.01 })],
    ["tempo", (round) => ({ ...round, tempo: round.tempo + 0.01 })],
  ])("rejects an adaptation whose %s contradicts the final plan", (_label, mutate) => {
    const result = resultFor("pose");
    const firstDecision = result.adaptations[0];
    result.adaptations[0] = {
      ...firstDecision,
      nextRound: mutate(firstDecision.nextRound),
    };

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-2",
        roomSpaceClass: "tight",
        result,
        sceneDirector: null,
      }),
    ).toThrow(/adaptations must align/i);
  });

  it("does not require private/free-form round prose to match for adaptation integrity", () => {
    const result = resultFor("pose");
    const firstDecision = result.adaptations[0];
    result.adaptations[0] = {
      ...firstDecision,
      nextRound: { ...firstDecision.nextRound, prompt: "Different non-exported prompt" },
    };

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-2",
        roomSpaceClass: "tight",
        result,
        sceneDirector: null,
      }),
    ).not.toThrow();
  });

  it("requires protocol trial IDs and complete exact release provenance", () => {
    const result = resultFor("pose");
    expect(() =>
      buildSessionEvidence({
        trialId: "trial-4",
        roomSpaceClass: null,
        result,
        sceneDirector: null,
      }),
    ).toThrow(/trialId/i);

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-1",
        roomSpaceClass: null,
        result,
        sceneDirector: null,
        build: { buildId: "build-123" },
      }),
    ).toThrow(/both buildId and commitSha/i);

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-1",
        roomSpaceClass: null,
        result,
        sceneDirector: null,
        build: { buildId: "build-123", commitSha: "abc1234" },
      }),
    ).toThrow(/commitSha/i);

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-1",
        roomSpaceClass: null,
        result,
        sceneDirector: null,
        build: { buildId: "submission-2026.08.13", commitSha: "a".repeat(40) },
      }),
    ).toThrow(/buildId/i);

    expect(() =>
      buildSessionEvidence({
        trialId: "trial-1",
        roomSpaceClass: null,
        result,
        sceneDirector: null,
        build: { buildId: `build-${"9".repeat(21)}`, commitSha: "a".repeat(40) },
      }),
    ).toThrow(/buildId/i);
  });

  it("summarizes finite non-negative samples with deterministic nearest-rank percentiles", () => {
    expect(summarizeMetricSamples([30, Number.NaN, -1, 10, 20, 40])).toEqual({
      mean: 25,
      sampleCount: 4,
      min: 10,
      max: 40,
      p05: 10,
      p95: 40,
    });
    expect(summarizeMetricSamples([])).toBeNull();
  });
});
