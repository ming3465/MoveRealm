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

const ROUND_PRESENTATION: Record<
  MovementId,
  { mechanic: Mechanic; prompt: string; accent: "mint" | "orchid" | "amber" }
> = {
  reach: {
    mechanic: "collect_fireflies",
    prompt: "Reach softly to wake the fireflies",
    accent: "mint",
  },
  squat: {
    mechanic: "shelter_seedlings",
    prompt: "Lower gently to shelter the seedlings",
    accent: "orchid",
  },
  side_step: {
    mechanic: "redirect_river",
    prompt: "Step side to side and guide the river",
    accent: "amber",
  },
};

export const CANONICAL_SAFETY_NOTE =
  "Move only inside the clear area you confirmed. Pause whenever you need to.";

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
    if (round.mechanic !== ROUND_PRESENTATION[round.movementId].mechanic) {
      context.addIssue({
        code: "custom",
        path: ["mechanic"],
        message: `Mechanic must match ${round.movementId}.`,
      });
    }
  });
export type QuestRound = z.infer<typeof QuestRoundSchema>;

/**
 * Movement instructions are curated product copy, never agent instructions.
 * The agent may tune only the three numeric parameters validated below.
 */
export function canonicalizeRoundPresentation(round: QuestRound): QuestRound {
  return {
    ...round,
    rangeScale: Math.round(round.rangeScale * 100) / 100,
    tempo: Number(round.tempo.toFixed(2)),
    ...ROUND_PRESENTATION[round.movementId],
  };
}

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
    const measuredCompletion = telemetry.targetsPresented === 0
      ? 0
      : telemetry.targetsCompleted / telemetry.targetsPresented;
    if (Math.abs(telemetry.completionRate - measuredCompletion) > 0.001) {
      context.addIssue({
        code: "custom",
        path: ["completionRate"],
        message: "Completion rate must match the presented and completed target counts.",
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
  .strict()
  .superRefine((request, context) => {
    const telemetryRound = Number(request.telemetry.roundId.slice(-1));
    const nextRound = Number(request.nextRoundSeed.id.slice(-1));
    if (nextRound !== telemetryRound + 1) {
      context.addIssue({
        code: "custom",
        path: ["nextRoundSeed", "id"],
        message: "The adaptation seed must be the round immediately after the telemetry round.",
      });
    }
  });
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
  if (
    profile.spaceClass === "open" &&
    !["left", "right", "center"].every((direction) =>
      profile.permittedDirections.includes(direction as Direction),
    )
  ) {
    throw new Error("An open room must visibly support the center and both lateral lanes.");
  }
  if (profile.spaceClass === "uncertain" && profile.confidence > 0.6) {
    throw new Error("An uncertain room may not claim confidence above 0.60.");
  }
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

  const requiredMovements = [
    "reach",
    ...(request.scene.spaceClass !== "uncertain" &&
    request.constraints.permittedDirections.includes("vertical")
      ? ["squat"]
      : []),
    ...(request.scene.spaceClass !== "uncertain" &&
    request.constraints.sideStepRange !== "none" &&
    hasLateralDirection
      ? ["side_step"]
      : []),
  ];
  const missingMovement = requiredMovements.find(
    (movementId) => !plan.rounds.some((round) => round.movementId === movementId),
  );
  if (missingMovement) {
    throw new Error(`The plan omits required validated movement ${missingMovement}.`);
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

  return {
    ...plan,
    rounds: plan.rounds.map(canonicalizeRoundPresentation),
    safetyNote: CANONICAL_SAFETY_NOTE,
  };
}

function displayedRange(value: number): number {
  return Math.round(value * 100);
}

function displayedTempo(value: number): string {
  return value.toFixed(2);
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
    nextRound.mechanic !== nextRoundSeed.mechanic ||
    nextRound.prompt !== nextRoundSeed.prompt ||
    nextRound.accent !== nextRoundSeed.accent
  ) {
    throw new Error(
      "An adaptation may tune validated numeric parameters, but may not replace its movement or presentation.",
    );
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

  const rawChanged = {
    target_envelope: nextRound.rangeScale !== nextRoundSeed.rangeScale,
    tempo: nextRound.tempo !== nextRoundSeed.tempo,
    target_rate: nextRound.targetRate !== nextRoundSeed.targetRate,
  } as const;
  const changed = {
    target_envelope: displayedRange(nextRound.rangeScale) !== displayedRange(nextRoundSeed.rangeScale),
    tempo: displayedTempo(nextRound.tempo) !== displayedTempo(nextRoundSeed.tempo),
    target_rate: rawChanged.target_rate,
  } as const;
  if (
    (rawChanged.target_envelope && !changed.target_envelope) ||
    (rawChanged.tempo && !changed.tempo)
  ) {
    throw new Error("Adaptation changes must be visible at the displayed parameter precision.");
  }
  const actualAdjustments = (Object.keys(changed) as Array<keyof typeof changed>).filter(
    (adjustment) => changed[adjustment],
  );
  const declaredAdjustments = new Set(decision.adjustments);

  const canReduceDifficulty =
    displayedRange(nextRoundSeed.rangeScale) > displayedRange(0.4) ||
    displayedTempo(nextRoundSeed.tempo) > displayedTempo(0.55) ||
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

  return {
    ...decision,
    nextRound: canonicalizeRoundPresentation(decision.nextRound),
  };
}

/**
 * Render the public adaptation trace exclusively from validated telemetry and
 * actual parameter differences. Agent prose is never trusted as evidence of
 * fatigue, form, or any other unobserved state.
 */
export function groundedAdaptationReason(
  request: AdaptRequest,
  decision: AdaptationDecision,
): string {
  const { telemetry, nextRoundSeed } = request;
  const observation = `${telemetry.targetsCompleted}/${telemetry.targetsPresented} targets`;
  const measuredContext = telemetry.trackingMode === "pose"
    ? `range ${Math.round(telemetry.movementRange * 100)}%; pose confidence ${Math.round(telemetry.poseConfidence * 100)}%`
    : `keyboard range ${Math.round(telemetry.movementRange * 100)}%`;
  const feedback = {
    too_hard: "Too hard",
    just_right: "Just right",
    too_easy: "Too easy",
  }[telemetry.feedback];
  const changes: string[] = [];
  if (displayedRange(decision.nextRound.rangeScale) < displayedRange(nextRoundSeed.rangeScale)) changes.push("closer");
  if (displayedRange(decision.nextRound.rangeScale) > displayedRange(nextRoundSeed.rangeScale)) changes.push("farther");
  if (displayedTempo(decision.nextRound.tempo) < displayedTempo(nextRoundSeed.tempo)) changes.push("slower");
  if (displayedTempo(decision.nextRound.tempo) > displayedTempo(nextRoundSeed.tempo)) changes.push("quicker");
  if (decision.nextRound.targetRate < nextRoundSeed.targetRate) changes.push("fewer targets");
  if (decision.nextRound.targetRate > nextRoundSeed.targetRate) changes.push("more targets");

  const changeSummary = changes.length ? changes.join(", ") : "settings stay the same";
  return `${observation}; ${measuredContext}; you chose ${feedback}. Next: ${changeSummary}.`;
}

export function validateAndGroundAdaptation(
  input: unknown,
  request: AdaptRequest,
): AdaptationDecision {
  const decision = validateAdaptationSafety(input, request);
  return {
    ...decision,
    reason: groundedAdaptationReason(request, decision),
  };
}

export function formatMovementName(movementId: MovementId): string {
  return {
    reach: "Firefly reaches",
    squat: "Seedling shelters",
    side_step: "River side-steps",
  }[movementId];
}
