import { z } from "zod";

export const MovementIdSchema = z.enum(["reach", "squat", "side_step"]);
export type MovementId = z.infer<typeof MovementIdSchema>;

export const SpaceClassSchema = z.enum(["tight", "open", "uncertain"]);
export const DirectionSchema = z.enum(["vertical", "left", "right", "center"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const ObstacleSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    zone: z.enum(["left", "center", "right", "floor"]),
    severity: z.enum(["low", "medium", "high"]),
  })
  .strict();

export const SceneProfileSchema = z
  .object({
    spaceClass: SpaceClassSchema,
    obstacles: z.array(ObstacleSchema).max(8),
    permittedDirections: z.array(DirectionSchema).min(1).max(4),
    confidence: z.number().min(0).max(1),
    summary: z.string().trim().min(1).max(180),
  })
  .strict()
  .superRefine((profile, context) => {
    if (new Set(profile.permittedDirections).size !== profile.permittedDirections.length) {
      context.addIssue({
        code: "custom",
        path: ["permittedDirections"],
        message: "Movement directions must be unique.",
      });
    }
  });
export type SceneProfile = z.infer<typeof SceneProfileSchema>;

export const EnergyLevelSchema = z.enum(["gentle", "balanced", "bright"]);
export type EnergyLevel = z.infer<typeof EnergyLevelSchema>;

export const UserIntentSchema = z
  .object({
    durationSeconds: z.literal(180),
    energy: EnergyLevelSchema,
    noJumping: z.literal(true),
  })
  .strict();
export type UserIntent = z.infer<typeof UserIntentSchema>;

export const ConfirmedConstraintsSchema = z
  .object({
    floorClear: z.boolean(),
    noJumping: z.literal(true),
    sideStepRange: z.enum(["none", "narrow", "wide"]),
    permittedDirections: z.array(DirectionSchema).min(1).max(4),
  })
  .strict();
export type ConfirmedConstraints = z.infer<typeof ConfirmedConstraintsSchema>;

export const PlanRequestSchema = z
  .object({
    scene: SceneProfileSchema,
    constraints: ConfirmedConstraintsSchema,
    intent: UserIntentSchema,
  })
  .strict();
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

export const MechanicSchema = z.enum([
  "collect_fireflies",
  "shelter_seedlings",
  "redirect_river",
]);
export type Mechanic = z.infer<typeof MechanicSchema>;

export const QuestRoundSchema = z
  .object({
    id: z.string().regex(/^round-[1-3]$/),
    movementId: MovementIdSchema,
    durationSeconds: z.number().int().min(20).max(90),
    targetRate: z.number().int().min(3).max(16),
    rangeScale: z.number().min(0.4).max(1),
    tempo: z.number().min(0.55).max(1.25),
    mechanic: MechanicSchema,
    prompt: z.string().trim().min(1).max(90),
    accent: z.enum(["mint", "orchid", "amber"]),
  })
  .strict()
  .superRefine((round, context) => {
    const expectedMechanic: Record<MovementId, Mechanic> = {
      reach: "collect_fireflies",
      squat: "shelter_seedlings",
      side_step: "redirect_river",
    };
    if (round.mechanic !== expectedMechanic[round.movementId]) {
      context.addIssue({
        code: "custom",
        path: ["mechanic"],
        message: `Mechanic must match ${round.movementId}.`,
      });
    }
  });
export type QuestRound = z.infer<typeof QuestRoundSchema>;

export const QuestPlanSchema = z
  .object({
    theme: z.literal("neon_rainforest"),
    title: z.string().trim().min(1).max(70),
    requestedDurationSeconds: z.literal(180),
    restBetweenRoundsSeconds: z.number().int().min(0).max(20),
    rounds: z.array(QuestRoundSchema).length(3),
    safetyNote: z.string().trim().min(1).max(150),
  })
  .strict()
  .superRefine((plan, context) => {
    const total =
      plan.rounds.reduce((sum, round) => sum + round.durationSeconds, 0) +
      plan.restBetweenRoundsSeconds * (plan.rounds.length - 1);
    if (total !== plan.requestedDurationSeconds) {
      context.addIssue({
        code: "custom",
        path: ["rounds"],
        message: `Round and rest durations total ${total}s, expected ${plan.requestedDurationSeconds}s.`,
      });
    }
    plan.rounds.forEach((round, index) => {
      if (round.id !== `round-${index + 1}`) {
        context.addIssue({
          code: "custom",
          path: ["rounds", index, "id"],
          message: `Round ${index + 1} must use id round-${index + 1}.`,
        });
      }
    });
  });
export type QuestPlan = z.infer<typeof QuestPlanSchema>;

export const DifficultyFeedbackSchema = z.enum(["too_hard", "just_right", "too_easy"]);
export type DifficultyFeedback = z.infer<typeof DifficultyFeedbackSchema>;

export const RoundTelemetrySchema = z
  .object({
    roundId: z.string().regex(/^round-[1-3]$/),
    movementId: MovementIdSchema,
    completionRate: z.number().min(0).max(1),
    movementRange: z.number().min(0).max(1.5),
    poseConfidence: z.number().min(0).max(1),
    trackingFps: z.number().min(0).max(120),
    trackingMode: z.enum(["pose", "keyboard"]),
    targetsPresented: z.number().int().min(0).max(100),
    targetsCompleted: z.number().int().min(0).max(100),
    feedback: DifficultyFeedbackSchema,
  })
  .strict()
  .superRefine((telemetry, context) => {
    if (telemetry.targetsCompleted > telemetry.targetsPresented) {
      context.addIssue({
        code: "custom",
        path: ["targetsCompleted"],
        message: "Completed targets cannot exceed presented targets.",
      });
    }
  });
export type RoundTelemetry = z.infer<typeof RoundTelemetrySchema>;

export const AdaptationDecisionSchema = z
  .object({
    nextRound: QuestRoundSchema,
    reason: z.string().trim().min(1).max(150),
    adjustments: z
      .array(z.enum(["target_envelope", "tempo", "target_rate", "none"]))
      .min(1)
      .max(3),
  })
  .strict()
  .superRefine((decision, context) => {
    if (new Set(decision.adjustments).size !== decision.adjustments.length) {
      context.addIssue({
        code: "custom",
        path: ["adjustments"],
        message: "Adjustment labels must be unique.",
      });
    }
    if (decision.adjustments.includes("none") && decision.adjustments.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["adjustments"],
        message: "None cannot be combined with changed parameters.",
      });
    }
  });
export type AdaptationDecision = z.infer<typeof AdaptationDecisionSchema>;

export const AdaptRequestSchema = z
  .object({
    telemetry: RoundTelemetrySchema,
    nextRoundSeed: QuestRoundSchema,
    constraints: ConfirmedConstraintsSchema,
    intent: UserIntentSchema,
  })
  .strict();
export type AdaptRequest = z.infer<typeof AdaptRequestSchema>;

export const DirectorSourceSchema = z.enum(["codebuddy", "fallback", "demo"]);
export type DirectorSource = z.infer<typeof DirectorSourceSchema>;

export const DirectorMetaSchema = z
  .object({
    source: DirectorSourceSchema,
    latencyMs: z.number().min(0),
    label: z.string().min(1).max(100),
    detail: z.string().max(220).optional(),
  })
  .strict();
export type DirectorMeta = z.infer<typeof DirectorMetaSchema>;

export interface DirectorResponse<T> {
  data: T;
  meta: DirectorMeta;
}

export function validateSceneSafety(input: unknown): SceneProfile {
  const profile = SceneProfileSchema.parse(input);
  const blockedDirections = new Set(
    profile.obstacles
      .filter((obstacle) => obstacle.severity === "high")
      .map((obstacle) => obstacle.zone)
      .filter((zone): zone is "left" | "right" | "center" =>
        zone === "left" || zone === "right" || zone === "center"),
  );
  const unsafeDirection = profile.permittedDirections.find((direction) =>
    direction !== "vertical" && blockedDirections.has(direction),
  );
  if (unsafeDirection) {
    throw new Error(`A high-severity obstacle blocks the permitted ${unsafeDirection} lane.`);
  }
  return profile;
}

export function validatePlanSafety(input: unknown, request: PlanRequest): QuestPlan {
  const plan = QuestPlanSchema.parse(input);
  const hasLateralDirection = request.constraints.permittedDirections.some(
    (direction) => direction === "left" || direction === "right",
  );

  if (!request.constraints.floorClear) {
    throw new Error("A quest cannot start until the user confirms the floor is clear.");
  }

  if (
    (request.constraints.sideStepRange === "none" || !hasLateralDirection) &&
    plan.rounds.some((round) => round.movementId === "side_step")
  ) {
    throw new Error("The plan includes side-steps even though lateral movement is not permitted.");
  }

  if (
    request.constraints.sideStepRange === "narrow" &&
    plan.rounds.some((round) => round.movementId === "side_step" && round.rangeScale > 0.62)
  ) {
    throw new Error("The side-step envelope is too wide for the confirmed room.");
  }

  if (
    !request.constraints.permittedDirections.includes("vertical") &&
    plan.rounds.some((round) => round.movementId === "squat")
  ) {
    throw new Error("The plan uses vertical movement where it was not permitted.");
  }

  if (
    !request.constraints.permittedDirections.includes("vertical") &&
    plan.rounds.some((round) => round.movementId === "reach" && round.rangeScale > 0.62)
  ) {
    throw new Error("The reach envelope is too large without a permitted vertical lane.");
  }

  if (
    !hasLateralDirection &&
    plan.rounds.some((round) => round.movementId === "reach" && round.rangeScale > 0.7)
  ) {
    throw new Error("The reach envelope is too wide without a permitted lateral lane.");
  }

  if (
    request.scene.spaceClass === "uncertain" &&
    plan.rounds.some((round) => round.rangeScale > 0.62)
  ) {
    throw new Error("An uncertain room requires a conservative movement envelope.");
  }

  if (
    request.scene.spaceClass === "uncertain" &&
    plan.rounds.some((round) => round.movementId !== "reach")
  ) {
    throw new Error("An uncertain room permits in-place reach rounds only.");
  }

  return plan;
}

export function validateAdaptationSafety(
  input: unknown,
  request: AdaptRequest,
): AdaptationDecision {
  const decision = AdaptationDecisionSchema.parse(input);
  const { nextRound, nextRoundSeed } = { ...decision, nextRoundSeed: request.nextRoundSeed };
  const hasLateralDirection = request.constraints.permittedDirections.some(
    (direction) => direction === "left" || direction === "right",
  );

  if (
    nextRound.id !== nextRoundSeed.id ||
    nextRound.movementId !== nextRoundSeed.movementId ||
    nextRound.durationSeconds !== nextRoundSeed.durationSeconds ||
    nextRound.mechanic !== nextRoundSeed.mechanic
  ) {
    throw new Error("An adaptation may tune a validated round, but may not replace its movement.");
  }

  if (
    nextRound.movementId === "side_step" &&
    request.constraints.sideStepRange === "narrow" &&
    nextRound.rangeScale > 0.62
  ) {
    throw new Error("The adapted side-step envelope exceeds the confirmed room constraint.");
  }

  if (
    nextRound.movementId === "side_step" &&
    (request.constraints.sideStepRange === "none" || !hasLateralDirection)
  ) {
    throw new Error("The adaptation reintroduced disabled lateral movement.");
  }

  if (
    nextRound.movementId === "reach" &&
    !request.constraints.permittedDirections.includes("vertical") &&
    nextRound.rangeScale > 0.62
  ) {
    throw new Error("The adapted reach envelope exceeds the confirmed vertical lane.");
  }

  if (
    nextRound.movementId === "reach" &&
    !hasLateralDirection &&
    nextRound.rangeScale > 0.7
  ) {
    throw new Error("The adapted reach envelope exceeds the confirmed central lane.");
  }


  if (
    nextRoundSeed.rangeScale <= 0.62 &&
    !hasLateralDirection &&
    nextRound.rangeScale > 0.62
  ) {
    throw new Error("The adaptation exceeds the validated conservative envelope.");
  }

  if (
    request.telemetry.feedback === "too_hard" &&
    (nextRound.rangeScale > nextRoundSeed.rangeScale ||
      nextRound.tempo > nextRoundSeed.tempo ||
      nextRound.targetRate > nextRoundSeed.targetRate)
  ) {
    throw new Error("A too-hard response may not increase the next round difficulty.");
  }

  const changed = {
    target_envelope: nextRound.rangeScale !== nextRoundSeed.rangeScale,
    tempo: nextRound.tempo !== nextRoundSeed.tempo,
    target_rate: nextRound.targetRate !== nextRoundSeed.targetRate,
  } as const;
  const actualAdjustments = (Object.keys(changed) as Array<keyof typeof changed>).filter(
    (adjustment) => changed[adjustment],
  );
  const declaredAdjustments = new Set(decision.adjustments);

  const canReduceDifficulty =
    nextRoundSeed.rangeScale > 0.4 ||
    nextRoundSeed.tempo > 0.55 ||
    nextRoundSeed.targetRate > 3;
  if (
    request.telemetry.feedback === "too_hard" &&
    canReduceDifficulty &&
    actualAdjustments.length === 0
  ) {
    throw new Error("A too-hard response must visibly reduce at least one next-round parameter.");
  }

  if (actualAdjustments.length === 0) {
    if (declaredAdjustments.size !== 1 || !declaredAdjustments.has("none")) {
      throw new Error("A no-op adaptation must declare only none.");
    }
  } else {
    if (declaredAdjustments.has("none")) {
      throw new Error("A changed adaptation may not declare none.");
    }
    if (
      actualAdjustments.some((adjustment) => !declaredAdjustments.has(adjustment)) ||
      [...declaredAdjustments].some(
        (adjustment) => adjustment !== "none" && !actualAdjustments.includes(adjustment),
      )
    ) {
      throw new Error("Declared adjustments must match the actual parameter changes.");
    }
  }

  return decision;
}

export function formatMovementName(movementId: MovementId): string {
  return {
    reach: "Firefly reaches",
    squat: "Seedling shelters",
    side_step: "River side-steps",
  }[movementId];
}
