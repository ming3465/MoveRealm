import { describe, expect, it } from "vitest";
import {
  QuestPlanSchema,
  AdaptRequestSchema,
  RoundTelemetrySchema,
  groundedAdaptationReason,
  validateAdaptationSafety,
  validatePlanSafety,
  validateSceneSafety,
  type AdaptRequest,
  type PlanRequest,
} from "../src/shared/contracts.js";
import {
  createFallbackAdaptation,
  createFallbackPlan,
  DEMO_SCENES,
} from "../src/shared/fallbacks.js";

const request: PlanRequest = {
  scene: DEMO_SCENES.tight,
  constraints: {
    floorClear: true,
    noJumping: true,
    sideStepRange: "narrow",
    permittedDirections: DEMO_SCENES.tight.permittedDirections,
  },
  intent: { durationSeconds: 180, energy: "balanced", noJumping: true },
};

describe("quest safety contract", () => {
  it("rejects a permitted lane occupied by a high-severity obstacle", () => {
    expect(() =>
      validateSceneSafety({
        ...DEMO_SCENES.tight,
        obstacles: [{ label: "Desk fills the left lane", zone: "left", severity: "high" }],
      }),
    ).toThrow(/blocks the permitted left lane/i);
  });

  it("requires open and uncertain labels to match their conservative direction envelope", () => {
    expect(() =>
      validateSceneSafety({
        ...DEMO_SCENES.open,
        permittedDirections: ["center"],
      }),
    ).toThrow(/open room must visibly support/i);
    expect(() =>
      validateSceneSafety({
        ...DEMO_SCENES.uncertain,
        confidence: 0.61,
      }),
    ).toThrow(/confidence above 0\.60/i);
  });
  it("builds a valid three-minute conservative plan", () => {
    const plan = createFallbackPlan(request);
    expect(validatePlanSafety(plan, request)).toEqual(plan);
    expect(plan.rounds).toHaveLength(3);
    expect(
      plan.rounds.reduce((sum, round) => sum + round.durationSeconds, 0) +
        plan.restBetweenRoundsSeconds * 2,
    ).toBe(180);
    expect(plan.rounds.find((round) => round.movementId === "side_step")?.rangeScale).toBeLessThanOrEqual(0.62);
  });

  it("replaces agent-authored movement instructions with curated safe copy", () => {
    const unsafeCopy = structuredClone(createFallbackPlan(request));
    unsafeCopy.rounds[0].prompt = "Jump onto the chair as high as you can";
    unsafeCopy.rounds[0].accent = "amber";
    unsafeCopy.safetyNote = "Move through the obstacle if it is in the way.";

    const safe = validatePlanSafety(unsafeCopy, request);

    expect(safe.rounds[0]).toMatchObject({
      prompt: "Reach softly to wake the fireflies",
      accent: "mint",
    });
    expect(safe.safetyNote).toBe(
      "Move only inside the clear area you confirmed. Pause whenever you need to.",
    );
  });

  it.each(["jump", "burpee", "lunge"])("rejects unknown movement %s", (movementId) => {
    const unsafe = structuredClone(createFallbackPlan(request)) as Record<string, unknown> & {
      rounds: Array<Record<string, unknown>>;
    };
    unsafe.rounds[0].movementId = movementId;
    expect(() => QuestPlanSchema.parse(unsafe)).toThrow();
  });

  it("rejects duration-breaking output", () => {
    const unsafe = structuredClone(createFallbackPlan(request));
    unsafe.rounds[0].durationSeconds = 70;
    expect(() => validatePlanSafety(unsafe, request)).toThrow(/total/i);
  });

  it("requires every movement supported by the confirmed lanes", () => {
    const repetitive = structuredClone(createFallbackPlan(request));
    repetitive.rounds = repetitive.rounds.map((round) => ({
      ...round,
      movementId: "reach",
      mechanic: "collect_fireflies",
      prompt: "Reach softly to wake the fireflies",
      accent: "mint",
    }));

    expect(() => validatePlanSafety(repetitive, request)).toThrow(/required validated movement/i);
  });

  it("rejects duplicate or out-of-order round IDs", () => {
    const unsafe = createFallbackPlan(request);
    unsafe.rounds[1].id = "round-1";
    expect(() => validatePlanSafety(unsafe, request)).toThrow(/round 2/i);
  });

  it("rejects side-steps beyond a confirmed narrow envelope", () => {
    const unsafe = structuredClone(createFallbackPlan(request));
    const sideStep = unsafe.rounds.find((round) => round.movementId === "side_step");
    expect(sideStep).toBeDefined();
    sideStep!.rangeScale = 0.9;
    expect(() => validatePlanSafety(unsafe, request)).toThrow(/too wide/i);
  });

  it("omits and rejects side-steps when no lateral direction is permitted", () => {
    const noLateralRequest: PlanRequest = {
      ...request,
      constraints: {
        ...request.constraints,
        sideStepRange: "wide",
        permittedDirections: ["vertical", "center"],
      },
    };
    expect(
      createFallbackPlan(noLateralRequest).rounds.some(
        (round) => round.movementId === "side_step",
      ),
    ).toBe(false);
    expect(() => validatePlanSafety(createFallbackPlan(request), noLateralRequest)).toThrow(
      /not permitted/i,
    );
  });

  it("omits squats and caps reaches when vertical movement is unavailable", () => {
    const horizontalOnlyRequest: PlanRequest = {
      ...request,
      constraints: {
        ...request.constraints,
        permittedDirections: ["left", "right", "center"],
      },
    };
    const plan = createFallbackPlan(horizontalOnlyRequest);
    expect(plan.rounds.every((round) => round.movementId !== "squat")).toBe(true);
    expect(
      plan.rounds
        .filter((round) => round.movementId === "reach")
        .every((round) => round.rangeScale <= 0.62),
    ).toBe(true);
    expect(validatePlanSafety(plan, horizontalOnlyRequest)).toEqual(plan);
  });

  it("does not allow adaptation to replace a validated movement", () => {
    const plan = createFallbackPlan(request);
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: "reach",
        completionRate: 0.4,
        movementRange: 0.6,
        poseConfidence: 0.9,
        trackingFps: 27,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 4,
        feedback: "too_hard",
      },
      nextRoundSeed: plan.rounds[1],
      constraints: request.constraints,
      intent: request.intent,
    };
    const replacement = {
      nextRound: { ...plan.rounds[1], movementId: "reach", mechanic: "collect_fireflies" },
      reason: "Replacing the movement.",
      adjustments: ["tempo"],
    };
    expect(() => validateAdaptationSafety(replacement, adaptationRequest)).toThrow(/may not replace/i);
  });

  it("does not allow adaptation to replace curated movement instructions", () => {
    const plan = createFallbackPlan(request);
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: plan.rounds[0].movementId,
        completionRate: 0.4,
        movementRange: 0.6,
        poseConfidence: 0.9,
        trackingFps: 27,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 4,
        feedback: "too_hard",
      },
      nextRoundSeed: plan.rounds[1],
      constraints: request.constraints,
      intent: request.intent,
    };
    const unsafeCopy = {
      nextRound: {
        ...plan.rounds[1],
        prompt: "Jump onto the chair as high as you can",
        tempo: plan.rounds[1].tempo - 0.1,
      },
      reason: "Unsafe movement copy.",
      adjustments: ["tempo"],
    };

    expect(() => validateAdaptationSafety(unsafeCopy, adaptationRequest)).toThrow(
      /movement or presentation/i,
    );
  });

  it("rejects a wide reach plan when only the central vertical lane is permitted", () => {
    const centralRequest: PlanRequest = {
      ...request,
      constraints: {
        ...request.constraints,
        sideStepRange: "none",
        permittedDirections: ["vertical", "center"],
      },
    };
    const unsafe = createFallbackPlan(centralRequest);
    unsafe.rounds[0].rangeScale = 0.9;
    expect(() => validatePlanSafety(unsafe, centralRequest)).toThrow(/reach envelope/i);
  });

  it("caps every fallback round for an uncertain scene", () => {
    const uncertainRequest: PlanRequest = {
      ...request,
      scene: DEMO_SCENES.uncertain,
      constraints: {
        ...request.constraints,
        sideStepRange: "none",
        permittedDirections: DEMO_SCENES.uncertain.permittedDirections,
      },
    };
    const plan = createFallbackPlan(uncertainRequest);
    expect(plan.rounds.every((round) => round.rangeScale <= 0.62)).toBe(true);
    expect(plan.rounds.every((round) => round.movementId === "reach")).toBe(true);
    expect(validatePlanSafety(plan, uncertainRequest)).toEqual(plan);

    const floorDependent = structuredClone(plan);
    floorDependent.rounds[1].movementId = "squat";
    floorDependent.rounds[1].mechanic = "shelter_seedlings";
    expect(() => validatePlanSafety(floorDependent, uncertainRequest)).toThrow(/reach rounds only/i);
  });

  it("rejects an adaptation whose labels do not match its parameter changes", () => {
    const plan = createFallbackPlan(request);
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: plan.rounds[0].movementId,
        completionRate: 0.5,
        movementRange: 0.5,
        poseConfidence: 0.9,
        trackingFps: 27,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 5,
        feedback: "too_hard",
      },
      nextRoundSeed: plan.rounds[1],
      constraints: request.constraints,
      intent: request.intent,
    };
    const mismatched = {
      nextRound: { ...plan.rounds[1], tempo: plan.rounds[1].tempo - 0.1 },
      reason: "Targets were missed, so the next round is slower.",
      adjustments: ["target_envelope"],
    };
    expect(() => validateAdaptationSafety(mismatched, adaptationRequest)).toThrow(/must match/i);
  });

  it("keeps an easy narrow side-step adaptation inside its confirmed envelope", () => {
    const plan = createFallbackPlan(request);
    const sideStep = plan.rounds.find((round) => round.movementId === "side_step")!;
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: "reach",
        completionRate: 1,
        movementRange: 0.9,
        poseConfidence: 0.95,
        trackingFps: 28,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 10,
        feedback: "too_easy",
      },
      nextRoundSeed: sideStep,
      constraints: request.constraints,
      intent: request.intent,
    };
    const decision = createFallbackAdaptation(adaptationRequest);
    expect(decision.nextRound.rangeScale).toBeLessThanOrEqual(0.62);
    expect(validateAdaptationSafety(decision, adaptationRequest)).toEqual(decision);
  });

  it("rejects any difficulty increase after explicit too-hard feedback", () => {
    const plan = createFallbackPlan(request);
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: "reach",
        completionRate: 0.4,
        movementRange: 0.5,
        poseConfidence: 0.9,
        trackingFps: 27,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 4,
        feedback: "too_hard",
      },
      nextRoundSeed: plan.rounds[1],
      constraints: request.constraints,
      intent: request.intent,
    };
    const harder = {
      nextRound: { ...plan.rounds[1], targetRate: plan.rounds[1].targetRate + 1 },
      reason: "Increasing the rate.",
      adjustments: ["target_rate"],
    };
    expect(() => validateAdaptationSafety(harder, adaptationRequest)).toThrow(/too-hard/i);

    const noOp = {
      nextRound: { ...plan.rounds[1] },
      reason: "Keeping the same round.",
      adjustments: ["none"],
    };
    expect(() => validateAdaptationSafety(noOp, adaptationRequest)).toThrow(/visibly reduce/i);
  });

  it("rejects a numeric adaptation that is invisible at the displayed precision", () => {
    const plan = createFallbackPlan(request);
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: plan.rounds[0].movementId,
        completionRate: 0.4,
        movementRange: 0.5,
        poseConfidence: 0.9,
        trackingFps: 27,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 4,
        feedback: "too_hard",
      },
      nextRoundSeed: plan.rounds[1],
      constraints: request.constraints,
      intent: request.intent,
    };
    const invisible = {
      nextRound: { ...plan.rounds[1], rangeScale: plan.rounds[1].rangeScale - 0.0001 },
      reason: "A tiny invisible change.",
      adjustments: ["target_envelope"],
    };

    expect(() => validateAdaptationSafety(invisible, adaptationRequest)).toThrow(
      /displayed parameter precision/i,
    );
  });

  it("rejects telemetry whose completion rate contradicts its target counts", () => {
    expect(() =>
      RoundTelemetrySchema.parse({
        roundId: "round-1",
        movementId: "reach",
        completionRate: 0.9,
        movementRange: 0.7,
        poseConfidence: 0.9,
        trackingFps: 27,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 4,
        feedback: "just_right",
      }),
    ).toThrow(/must match/i);
  });

  it("requires the adaptation seed to immediately follow its telemetry round", () => {
    const plan = createFallbackPlan(request);
    expect(() =>
      AdaptRequestSchema.parse({
        telemetry: {
          roundId: "round-1",
          movementId: plan.rounds[0].movementId,
          completionRate: 0.5,
          movementRange: 0.6,
          poseConfidence: 0.9,
          trackingFps: 27,
          trackingMode: "pose",
          targetsPresented: 10,
          targetsCompleted: 5,
          feedback: "just_right",
        },
        nextRoundSeed: plan.rounds[2],
        constraints: request.constraints,
        intent: request.intent,
      }),
    ).toThrow(/immediately after/i);
  });

  it("renders the trace only from counts, explicit feedback, and actual changes", () => {
    const plan = createFallbackPlan(request);
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: plan.rounds[0].movementId,
        completionRate: 0.4,
        movementRange: 0.5,
        poseConfidence: 0.9,
        trackingFps: 27,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 4,
        feedback: "too_hard",
      },
      nextRoundSeed: plan.rounds[1],
      constraints: request.constraints,
      intent: request.intent,
    };
    const decision = createFallbackAdaptation(adaptationRequest);

    expect(groundedAdaptationReason(adaptationRequest, decision)).toBe(
      "4/10 targets; range 50%; pose confidence 90%; you chose Too hard. Next: closer, slower, fewer targets.",
    );
  });

  it("makes low pose confidence explicit when it overrides easy feedback", () => {
    const plan = createFallbackPlan(request);
    const adaptationRequest: AdaptRequest = {
      telemetry: {
        roundId: "round-1",
        movementId: plan.rounds[0].movementId,
        completionRate: 1,
        movementRange: 0.95,
        poseConfidence: 0.2,
        trackingFps: 8,
        trackingMode: "pose",
        targetsPresented: 10,
        targetsCompleted: 10,
        feedback: "too_easy",
      },
      nextRoundSeed: plan.rounds[1],
      constraints: request.constraints,
      intent: request.intent,
    };
    const decision = createFallbackAdaptation(adaptationRequest);
    const reason = groundedAdaptationReason(adaptationRequest, decision);

    expect(reason).toContain("pose confidence 20%");
    expect(reason).toContain("you chose Too easy");
    expect(reason).toContain("Next: closer, slower, fewer targets");
  });
});

describe("room fixtures", () => {
  it("keeps open, tight and uncertain room profiles materially different", () => {
    expect(new Set(Object.values(DEMO_SCENES).map((scene) => scene.spaceClass)).size).toBe(3);
    expect(DEMO_SCENES.open.permittedDirections).not.toEqual(DEMO_SCENES.uncertain.permittedDirections);
    expect(DEMO_SCENES.tight.obstacles.length).toBeGreaterThan(DEMO_SCENES.open.obstacles.length);
  });

  it("produces materially different conservative plans for all three room classes", () => {
    const plans = Object.values(DEMO_SCENES).map((scene) => {
      const lateral = scene.permittedDirections.includes("left") && scene.permittedDirections.includes("right");
      const roomRequest: PlanRequest = {
        scene,
        constraints: {
          floorClear: true,
          noJumping: true,
          sideStepRange: lateral ? (scene.spaceClass === "open" ? "wide" : "narrow") : "none",
          permittedDirections: scene.permittedDirections,
        },
        intent: request.intent,
      };
      return validatePlanSafety(createFallbackPlan(roomRequest), roomRequest);
    });
    const signatures = plans.map((plan) =>
      plan.rounds.map((round) => `${round.movementId}:${round.rangeScale}`).join("|"),
    );
    expect(new Set(signatures).size).toBe(3);
    expect(plans[2].rounds.some((round) => round.movementId === "side_step")).toBe(false);
  });
});
