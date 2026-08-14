import type {
  AdaptRequest,
  AdaptationDecision,
  EnergyLevel,
  PlanRequest,
  QuestPlan,
  QuestRound,
  SceneProfile,
} from "./contracts.js";
import { groundedAdaptationReason } from "./contracts.js";

export const DEMO_SCENES: Record<"open" | "tight" | "uncertain", SceneProfile> = {
  open: {
    spaceClass: "open",
    obstacles: [{ label: "Low chair near the far-right edge", zone: "right", severity: "low" }],
    permittedDirections: ["vertical", "left", "right", "center"],
    confidence: 0.9,
    summary: "Clear central floor with room for controlled movement in both directions.",
  },
  tight: {
    spaceClass: "tight",
    obstacles: [
      { label: "Desk close to the left movement lane", zone: "left", severity: "medium" },
      { label: "Chair beside the right movement lane", zone: "right", severity: "medium" },
    ],
    permittedDirections: ["vertical", "left", "right", "center"],
    confidence: 0.87,
    summary: "The centre is usable, but lateral movement should stay narrow and controlled.",
  },
  uncertain: {
    spaceClass: "uncertain",
    obstacles: [{ label: "Floor edge is partly outside the frame", zone: "floor", severity: "medium" }],
    permittedDirections: ["vertical", "center"],
    confidence: 0.54,
    summary: "Only the central movement lane is confidently visible; use a conservative envelope.",
  },
};

interface FallbackImageHints {
  width?: number;
  height?: number;
  byteLength?: number;
}

export function createFallbackSceneProfile(hints: FallbackImageHints = {}): SceneProfile {
  const portraitOrNarrow =
    typeof hints.width === "number" &&
    typeof hints.height === "number" &&
    hints.width / Math.max(hints.height, 1) < 1.15;

  if (portraitOrNarrow) {
    return {
      ...DEMO_SCENES.tight,
      confidence: 0.42,
      summary: "The fallback could not inspect the room reliably, so lateral movement is limited.",
    };
  }

  return {
    ...DEMO_SCENES.uncertain,
    confidence: 0.38,
    summary: "The Movement Director is offline; a conservative central movement lane is assumed.",
  };
}

const ENERGY_SETTINGS: Record<EnergyLevel, { targetRate: number; tempo: number }> = {
  gentle: { targetRate: 5, tempo: 0.72 },
  balanced: { targetRate: 7, tempo: 0.9 },
  bright: { targetRate: 9, tempo: 1.08 },
};

function makeRound(
  index: number,
  movementId: QuestRound["movementId"],
  energy: EnergyLevel,
  rangeScale: number,
): QuestRound {
  const settings = ENERGY_SETTINGS[energy];
  const properties: Record<
    QuestRound["movementId"],
    Pick<QuestRound, "mechanic" | "prompt" | "accent">
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

  return {
    id: `round-${index}` as QuestRound["id"],
    movementId,
    durationSeconds: 52,
    targetRate: settings.targetRate,
    rangeScale,
    tempo: settings.tempo,
    ...properties[movementId],
  };
}

export function createFallbackPlan(request: PlanRequest): QuestPlan {
  const { sideStepRange } = request.constraints;
  const verticalAllowed = request.constraints.permittedDirections.includes("vertical");
  const lateralAllowed =
    sideStepRange !== "none" &&
    request.constraints.permittedDirections.some(
      (direction) => direction === "left" || direction === "right",
    );
  const sequence: QuestRound["movementId"][] = request.scene.spaceClass === "uncertain"
    ? ["reach", "reach", "reach"]
    : !lateralAllowed
    ? verticalAllowed
      ? ["reach", "squat", "reach"]
      : ["reach", "reach", "reach"]
    : !verticalAllowed
      ? ["reach", "side_step", "reach"]
      : request.scene.spaceClass === "open"
        ? ["reach", "side_step", "squat"]
        : ["reach", "squat", "side_step"];
  const sideStepScale = sideStepRange === "wide" ? 0.84 : 0.56;
  const defaultScale = request.scene.spaceClass === "open"
    ? 0.86
    : request.scene.spaceClass === "uncertain"
      ? 0.6
      : 0.64;
  const reachScale = Math.min(
    defaultScale,
    verticalAllowed ? 1 : 0.62,
    lateralAllowed ? 1 : 0.7,
  );

  return {
    theme: "neon_rainforest",
    title:
      request.scene.spaceClass === "open" ? "Canopy River Run" : "Glowgarden Awakening",
    requestedDurationSeconds: 180,
    restBetweenRoundsSeconds: 12,
    rounds: sequence.map((movementId, index) =>
      makeRound(
        index + 1,
        movementId,
        request.intent.energy,
        movementId === "side_step"
          ? sideStepScale
          : movementId === "reach"
            ? reachScale
            : defaultScale,
      ),
    ),
    safetyNote: "Move only inside the clear area you confirmed. Pause whenever you need to.",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

function maximumRangeScale(request: AdaptRequest): number {
  const { movementId } = request.nextRoundSeed;
  const hasLateralDirection = request.constraints.permittedDirections.some(
    (direction) => direction === "left" || direction === "right",
  );
  if (movementId === "side_step") {
    return request.constraints.sideStepRange === "narrow" ? 0.62 : 1;
  }
  if (movementId === "reach") {
    return Math.min(
      request.constraints.permittedDirections.includes("vertical") ? 1 : 0.62,
      hasLateralDirection ? 1 : 0.7,
      request.nextRoundSeed.rangeScale <= 0.62 ? 0.62 : 1,
    );
  }
  return request.nextRoundSeed.rangeScale <= 0.62 ? 0.62 : 1;
}

function adjustmentsFor(
  seed: QuestRound,
  nextRound: QuestRound,
): AdaptationDecision["adjustments"] {
  const adjustments: AdaptationDecision["adjustments"] = [];
  if (nextRound.rangeScale !== seed.rangeScale) adjustments.push("target_envelope");
  if (nextRound.tempo !== seed.tempo) adjustments.push("tempo");
  if (nextRound.targetRate !== seed.targetRate) adjustments.push("target_rate");
  return adjustments.length ? adjustments : ["none"];
}

export function createFallbackAdaptation(request: AdaptRequest): AdaptationDecision {
  const { telemetry, nextRoundSeed } = request;
  const struggled = telemetry.feedback === "too_hard" || telemetry.completionRate < 0.68;
  const trackingWasWeak =
    telemetry.trackingMode === "pose" && telemetry.poseConfidence < 0.62;
  const wasEasy = telemetry.feedback === "too_easy" && telemetry.completionRate > 0.82;

  if (struggled || trackingWasWeak) {
    const nextRound: QuestRound = {
      ...nextRoundSeed,
      rangeScale: clamp(nextRoundSeed.rangeScale - 0.16, 0.4, maximumRangeScale(request)),
      tempo: clamp(nextRoundSeed.tempo - 0.13, 0.55, 1.25),
      targetRate: clamp(nextRoundSeed.targetRate - (trackingWasWeak ? 2 : 1), 3, 16),
    };
    const decision: AdaptationDecision = {
      nextRound,
      reason: "Validated adaptation pending grounded trace.",
      adjustments: adjustmentsFor(nextRoundSeed, nextRound),
    };
    return { ...decision, reason: groundedAdaptationReason(request, decision) };
  }

  if (wasEasy) {
    const nextRound: QuestRound = {
      ...nextRoundSeed,
      rangeScale: clamp(nextRoundSeed.rangeScale + 0.08, 0.4, maximumRangeScale(request)),
      tempo: clamp(nextRoundSeed.tempo + 0.08, 0.55, 1.25),
      targetRate: clamp(nextRoundSeed.targetRate + 1, 3, 16),
    };
    const decision: AdaptationDecision = {
      nextRound,
      reason: "Validated adaptation pending grounded trace.",
      adjustments: adjustmentsFor(nextRoundSeed, nextRound),
    };
    return { ...decision, reason: groundedAdaptationReason(request, decision) };
  }

  const decision: AdaptationDecision = {
    nextRound: { ...nextRoundSeed },
    reason: "Validated adaptation pending grounded trace.",
    adjustments: ["none"],
  };
  return { ...decision, reason: groundedAdaptationReason(request, decision) };
}
