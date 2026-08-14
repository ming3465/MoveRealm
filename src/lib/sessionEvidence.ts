import packageMetadata from "../../package.json" with { type: "json" };
import {
  AdaptationDecisionSchema,
  DirectorMetaSchema,
  QuestPlanSchema,
  RoundTelemetrySchema,
  SpaceClassSchema,
  type DirectorMeta,
  type DirectorSource,
  type AdaptationDecision,
  type QuestPlan,
  type QuestRound,
  type RoundTelemetry,
  type SceneProfile,
} from "../shared/contracts.js";

type SpaceClass = SceneProfile["spaceClass"];

export const SESSION_EVIDENCE_SCHEMA_VERSION = "1.0.0" as const;
export const MIN_TRACKING_METRIC_SAMPLES = 120;
export const MIN_VISIBLE_RESPONSE_SAMPLES = 3;

/** Shared aggregate result shape; UI code can import this without creating a UI-to-lib cycle. */
export interface SessionResult {
  plan: QuestPlan;
  telemetry: RoundTelemetry[];
  adaptations: AdaptationDecision[];
  activeSeconds: number;
  totalTargets: number;
  completedTargets: number;
  timeToFirstMovementMs: number | null;
  directorLatencyMs: number;
  poseMetricSummaries: SessionPerformanceSummaries;
  directorMetas: {
    plan: DirectorMeta;
    adaptations: DirectorMeta[];
  };
  journeyDurationMs: number;
}

export interface SessionEvidenceBuildMetadata {
  /** The non-personal numeric CI run identifier, formatted as `build-N`. */
  buildId?: string | null;
  /** The exact 40-character Git source revision. Branch names and paths are excluded. */
  commitSha?: string | null;
}

export interface MetricSummaryInput {
  mean: number;
  sampleCount: number;
  min?: number | null;
  max?: number | null;
  p05?: number | null;
  p95?: number | null;
}

export interface SessionPerformanceSummaries {
  trackingFps?: MetricSummaryInput | null;
  inferenceMs?: MetricSummaryInput | null;
  visibleResponseLatencyMs?: MetricSummaryInput | null;
}

export interface BuildSessionEvidenceInput {
  /** Non-personal identifier such as `trial-1`; never use a participant name. */
  trialId: string;
  roomSpaceClass: SpaceClass | null;
  result: SessionResult;
  /** Scene provenance is held by App; plan/adaptation provenance travels with SessionResult. */
  sceneDirector: DirectorMeta | null;
  build?: SessionEvidenceBuildMetadata;
}

export interface DirectorStepEvidence {
  source: DirectorSource;
  latencyMs: number;
}

export interface RoundEvidence {
  roundId: string;
  movementId: "reach" | "squat" | "side_step";
  durationSeconds: number;
  trackingMode: "pose" | "keyboard";
  completionRate: number;
  movementRange: number;
  poseConfidence: number | null;
  trackingFps: number | null;
  targetsPresented: number;
  targetsCompleted: number;
  feedback: "too_hard" | "just_right" | "too_easy";
}

export interface AdaptationEvidence {
  afterRoundId: string;
  appliesToRoundId: string;
  adjustments: Array<"target_envelope" | "tempo" | "target_rate" | "none">;
  nextRoundParameters: Pick<QuestRound, "rangeScale" | "tempo" | "targetRate">;
  director: DirectorStepEvidence;
}

export interface MetricSummaryEvidence {
  mean: number;
  sampleCount: number;
  min: number | null;
  max: number | null;
  p05: number | null;
  p95: number | null;
}

export interface ThresholdEvidence {
  status: "pass" | "fail" | "not_evaluated";
  comparator: "at_least" | "at_most" | "under";
  target: number;
  basis: "mean" | "p05" | "p95" | null;
  evaluatedValue: number | null;
}

export interface SessionEvidence {
  schemaVersion: typeof SESSION_EVIDENCE_SCHEMA_VERSION;
  trialId: string;
  product: {
    name: "MoveRealm";
    appVersion: string;
    buildId: string | null;
    commitSha: string | null;
  };
  context: {
    roomSpaceClass: SpaceClass | null;
    trackingMode: "pose" | "keyboard" | "mixed";
  };
  duration: {
    plannedAdventureSeconds: number;
    plannedActiveSeconds: number;
    plannedRestSeconds: number;
    completedActiveSeconds: number;
    observedAdventureSeconds: number | null;
  };
  metrics: {
    completionRate: number;
    timeToFirstMovementMs: number | null;
    trackingFps: number | null;
    inferenceMs: number | null;
    visibleResponseLatencyMs: number | null;
  };
  measurementEvidence: {
    timeToFirstMovementMs: {
      threshold: ThresholdEvidence;
    };
    trackingFps: {
      summary: MetricSummaryEvidence | null;
      threshold: ThresholdEvidence;
    };
    inferenceMs: {
      summary: MetricSummaryEvidence | null;
      threshold: ThresholdEvidence;
    };
    visibleResponseLatencyMs: {
      summary: MetricSummaryEvidence | null;
      threshold: ThresholdEvidence;
    };
  };
  director: {
    scene: DirectorStepEvidence | null;
    plan: DirectorStepEvidence;
    adaptations: DirectorStepEvidence[];
    sourcesUsed: DirectorSource[];
    sessionPlanAndAdaptationLatencyMs: number;
  };
  rounds: RoundEvidence[];
  adaptations: AdaptationEvidence[];
  privacy: {
    liveCameraHandlingDesign: "browser_only";
    liveCameraNetworkAuditIncluded: false;
    personalIdentifiersIncluded: false;
    imagesOrVideoIncluded: false;
    rawPoseLandmarksIncluded: false;
    capturedRoomStillIncluded: false;
    uploadPathsIncluded: false;
    statement: string;
  };
}

const TRIAL_ID_PATTERN = /^trial-[1-3]$/;
const BUILD_ID_PATTERN = /^build-[1-9][0-9]{0,19}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

function safeIdentifier(
  value: string | null | undefined,
  pattern: RegExp,
  label: string,
): string | null {
  if (value == null || value === "") return null;
  if (!pattern.test(value)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return value;
}

function finiteNonNegative(value: number | null, label: string): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number or null.`);
  }
  return value;
}

function rounded(value: number, fractionDigits: number): number {
  const factor = 10 ** fractionDigits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function metric(value: number | null, label: string, fractionDigits = 1): number | null {
  const checked = finiteNonNegative(value, label);
  return checked == null ? null : rounded(checked, fractionDigits);
}

function metricSummary(
  value: MetricSummaryInput | null | undefined,
  label: string,
  fractionDigits: number,
): MetricSummaryEvidence | null {
  if (value == null) return null;
  if (!Number.isInteger(value.sampleCount) || value.sampleCount <= 0) {
    throw new Error(`${label}.sampleCount must be a positive integer.`);
  }
  const mean = metric(value.mean, `${label}.mean`, fractionDigits)!;
  const min = metric(value.min ?? null, `${label}.min`, fractionDigits);
  const max = metric(value.max ?? null, `${label}.max`, fractionDigits);
  const p05 = metric(value.p05 ?? null, `${label}.p05`, fractionDigits);
  const p95 = metric(value.p95 ?? null, `${label}.p95`, fractionDigits);
  if (min != null && max != null && min > max) {
    throw new Error(`${label}.min cannot exceed max.`);
  }
  if ((min != null && mean < min) || (max != null && mean > max)) {
    throw new Error(`${label}.mean must fall inside the supplied min/max range.`);
  }
  if (p05 != null && ((min != null && p05 < min) || (max != null && p05 > max))) {
    throw new Error(`${label}.p05 must fall inside the supplied min/max range.`);
  }
  if (p95 != null && ((min != null && p95 < min) || (max != null && p95 > max))) {
    throw new Error(`${label}.p95 must fall inside the supplied min/max range.`);
  }
  if (p05 != null && p95 != null && p05 > p95) {
    throw new Error(`${label}.p05 cannot exceed p95.`);
  }
  return { mean, sampleCount: value.sampleCount, min, max, p05, p95 };
}

export function summarizeMetricSamples(values: readonly number[]): MetricSummaryInput | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const at = (proportion: number): number =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(proportion * sorted.length) - 1))];
  return {
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    sampleCount: sorted.length,
    min: sorted[0],
    max: sorted.at(-1)!,
    p05: at(0.05),
    p95: at(0.95),
  };
}

function threshold(
  summary: MetricSummaryEvidence | null,
  comparator: ThresholdEvidence["comparator"],
  target: number,
  preferredQuantile?: "p05" | "p95",
  minimumSampleCount = 1,
): ThresholdEvidence {
  if (
    !summary ||
    summary.sampleCount < minimumSampleCount ||
    (preferredQuantile != null && summary[preferredQuantile] == null)
  ) {
    return {
      status: "not_evaluated",
      comparator,
      target,
      basis: null,
      evaluatedValue: null,
    };
  }
  const useQuantile = preferredQuantile != null && summary[preferredQuantile] != null;
  const evaluatedValue = useQuantile ? summary[preferredQuantile]! : summary.mean;
  const passed = comparator === "at_least"
    ? evaluatedValue >= target
    : comparator === "at_most"
      ? evaluatedValue <= target
      : evaluatedValue < target;
  return {
    status: passed ? "pass" : "fail",
    comparator,
    target,
    basis: useQuantile ? preferredQuantile! : "mean",
    evaluatedValue,
  };
}

function scalarThreshold(
  value: number | null,
  comparator: ThresholdEvidence["comparator"],
  target: number,
): ThresholdEvidence {
  if (value == null) {
    return {
      status: "not_evaluated",
      comparator,
      target,
      basis: null,
      evaluatedValue: null,
    };
  }
  const passed = comparator === "at_least"
    ? value >= target
    : comparator === "at_most"
      ? value <= target
      : value < target;
  return {
    status: passed ? "pass" : "fail",
    comparator,
    target,
    basis: "mean",
    evaluatedValue: value,
  };
}

function directorStep(value: DirectorMeta): DirectorStepEvidence {
  const parsed = DirectorMetaSchema.parse(value);
  // label and detail are deliberately discarded: they are free-form strings and may contain paths
  // or upstream error text. Evidence needs only provenance and measured latency.
  return {
    source: parsed.source,
    latencyMs: rounded(parsed.latencyMs, 0),
  };
}

function trackingMode(modes: Set<"pose" | "keyboard">): SessionEvidence["context"]["trackingMode"] {
  if (modes.size > 1) return "mixed";
  return modes.has("pose") ? "pose" : "keyboard";
}

function sameQuestRound(left: QuestRound, right: QuestRound): boolean {
  return left.id === right.id &&
    left.movementId === right.movementId &&
    left.durationSeconds === right.durationSeconds &&
    left.targetRate === right.targetRate &&
    left.rangeScale === right.rangeScale &&
    left.tempo === right.tempo &&
    left.mechanic === right.mechanic;
}

/**
 * Builds deterministic, JSON-safe session evidence from aggregate game results.
 *
 * The returned object intentionally has no extension bag and copies no free-form plan, director,
 * room, or adaptation text. Extra runtime properties on the input are therefore ignored.
 */
export function buildSessionEvidence(input: BuildSessionEvidenceInput): SessionEvidence {
  const trialId = safeIdentifier(input.trialId, TRIAL_ID_PATTERN, "trialId");
  if (!trialId) throw new Error("trialId is required.");
  const roomSpaceClass = input.roomSpaceClass == null
    ? null
    : SpaceClassSchema.parse(input.roomSpaceClass);
  const plan = QuestPlanSchema.parse(input.result.plan);
  const telemetry = RoundTelemetrySchema.array().parse(input.result.telemetry);
  const adaptations = AdaptationDecisionSchema.array().parse(input.result.adaptations);
  const sceneMeta = input.sceneDirector == null
    ? null
    : directorStep(input.sceneDirector);
  const planMeta = directorStep(input.result.directorMetas.plan);
  const adaptationMetas = input.result.directorMetas.adaptations.map(directorStep);
  const buildId = safeIdentifier(input.build?.buildId, BUILD_ID_PATTERN, "buildId");
  const commitSha = safeIdentifier(input.build?.commitSha, COMMIT_SHA_PATTERN, "commitSha");

  if ((buildId == null) !== (commitSha == null)) {
    throw new Error("Build evidence requires both buildId and commitSha, or neither.");
  }

  if (adaptationMetas.length !== adaptations.length) {
    throw new Error("Provide exactly one director provenance record per adaptation.");
  }
  if (telemetry.length !== plan.rounds.length) {
    throw new Error("A session evidence export requires telemetry for all validated rounds.");
  }
  if (adaptations.length !== Math.max(0, plan.rounds.length - 1)) {
    throw new Error("A session evidence export requires one decision between every round.");
  }

  const seenRoundIds = new Set<string>();
  const rounds: RoundEvidence[] = telemetry.map((round, index) => {
    const plannedRound = plan.rounds[index];
    if (
      !plannedRound ||
      round.roundId !== plannedRound.id ||
      round.movementId !== plannedRound.movementId ||
      seenRoundIds.has(round.roundId)
    ) {
      throw new Error("Session telemetry must align uniquely with the validated plan order.");
    }
    seenRoundIds.add(round.roundId);
    const expectedCompletionRate = round.targetsPresented === 0
      ? 0
      : round.targetsCompleted / round.targetsPresented;
    if (Math.abs(round.completionRate - expectedCompletionRate) > 1e-9) {
      throw new Error("Each round completion rate must match its target counts.");
    }
    const poseTracked = round.trackingMode === "pose";
    return {
      roundId: round.roundId,
      movementId: round.movementId,
      durationSeconds: plannedRound.durationSeconds,
      trackingMode: round.trackingMode,
      completionRate: rounded(round.completionRate, 3),
      movementRange: rounded(round.movementRange, 3),
      poseConfidence: poseTracked ? rounded(round.poseConfidence, 3) : null,
      trackingFps: poseTracked ? rounded(round.trackingFps, 1) : null,
      targetsPresented: round.targetsPresented,
      targetsCompleted: round.targetsCompleted,
      feedback: round.feedback,
    };
  });

  const adaptationEvidence = adaptations.map((adaptation, index): AdaptationEvidence => {
    const appliesTo = plan.rounds[index + 1];
    const afterRound = plan.rounds[index];
    if (
      !afterRound ||
      !appliesTo ||
      !sameQuestRound(adaptation.nextRound, appliesTo)
    ) {
      throw new Error("Session adaptations must align with the following validated round.");
    }
    return {
      afterRoundId: afterRound.id,
      appliesToRoundId: adaptation.nextRound.id,
      adjustments: [...adaptation.adjustments],
      nextRoundParameters: {
        rangeScale: rounded(adaptation.nextRound.rangeScale, 3),
        tempo: rounded(adaptation.nextRound.tempo, 3),
        targetRate: adaptation.nextRound.targetRate,
      },
      director: adaptationMetas[index],
    };
  });

  const modes = new Set(rounds.map((round) => round.trackingMode));
  const overallTrackingMode = trackingMode(modes);
  const poseOnlyEvidence = overallTrackingMode === "pose";
  const timeToFirstMovementMs = metric(
    input.result.timeToFirstMovementMs,
    "timeToFirstMovementMs",
    0,
  );
  // Only explicit, counted pose samples can support a display value or pass/fail statement.
  const trackingFpsSummary = poseOnlyEvidence
    ? metricSummary(input.result.poseMetricSummaries.trackingFps, "trackingFps", 1)
    : null;
  const inferenceSummary = poseOnlyEvidence
    ? metricSummary(input.result.poseMetricSummaries.inferenceMs, "inferenceMs", 1)
    : null;
  const responseLatencySummary = poseOnlyEvidence
    ? metricSummary(
        input.result.poseMetricSummaries.visibleResponseLatencyMs,
        "visibleResponseLatencyMs",
        1,
      )
    : null;
  const plannedActiveSeconds = plan.rounds.reduce(
    (total, round) => total + round.durationSeconds,
    0,
  );
  const plannedRestSeconds =
    plan.restBetweenRoundsSeconds * Math.max(0, plan.rounds.length - 1);
  const completedActiveSeconds = finiteNonNegative(
    input.result.activeSeconds,
    "completedActiveSeconds",
  )!;
  if (completedActiveSeconds > plannedActiveSeconds) {
    throw new Error("Completed active duration exceeds the validated plan.");
  }
  if (completedActiveSeconds !== plannedActiveSeconds) {
    throw new Error("A session evidence export requires the complete active duration.");
  }
  const totalTargets = Math.max(0, input.result.totalTargets);
  const completedTargets = Math.max(0, input.result.completedTargets);
  if (
    !Number.isInteger(totalTargets) ||
    !Number.isInteger(completedTargets) ||
    completedTargets > totalTargets
  ) {
    throw new Error("Target totals must be non-negative integers with completed <= presented.");
  }
  const telemetryTargets = rounds.reduce(
    (totals, round) => ({
      presented: totals.presented + round.targetsPresented,
      completed: totals.completed + round.targetsCompleted,
    }),
    { presented: 0, completed: 0 },
  );
  if (
    totalTargets !== telemetryTargets.presented ||
    completedTargets !== telemetryTargets.completed
  ) {
    throw new Error("Session target totals must match the per-round telemetry.");
  }

  const directorLatencyMs = finiteNonNegative(
    input.result.directorLatencyMs,
    "directorLatencyMs",
  )!;
  const provenanceLatencyMs = input.result.directorMetas.plan.latencyMs +
    input.result.directorMetas.adaptations.reduce((sum, meta) => sum + meta.latencyMs, 0);
  if (Math.abs(directorLatencyMs - provenanceLatencyMs) > 0.001) {
    throw new Error("Director latency total must match plan and adaptation provenance.");
  }

  const sources = [
    ...(sceneMeta ? [sceneMeta.source] : []),
    planMeta.source,
    ...adaptationMetas.map((step) => step.source),
  ];

  return {
    schemaVersion: SESSION_EVIDENCE_SCHEMA_VERSION,
    trialId,
    product: {
      name: "MoveRealm",
      appVersion: packageMetadata.version,
      buildId,
      commitSha,
    },
    context: {
      roomSpaceClass,
      trackingMode: overallTrackingMode,
    },
    duration: {
      plannedAdventureSeconds: plan.requestedDurationSeconds,
      plannedActiveSeconds,
      plannedRestSeconds,
      completedActiveSeconds: rounded(completedActiveSeconds, 1),
      observedAdventureSeconds: metric(
        input.result.journeyDurationMs / 1_000,
        "observedAdventureDuration",
        1,
      ),
    },
    metrics: {
      completionRate: totalTargets === 0 ? 0 : rounded(completedTargets / totalTargets, 3),
      timeToFirstMovementMs,
      // Keyboard/demo values are N/A, even if a caller accidentally supplies synthetic numbers.
      trackingFps: poseOnlyEvidence ? trackingFpsSummary?.mean ?? null : null,
      inferenceMs: poseOnlyEvidence ? inferenceSummary?.mean ?? null : null,
      visibleResponseLatencyMs: poseOnlyEvidence ? responseLatencySummary?.mean ?? null : null,
    },
    measurementEvidence: {
      timeToFirstMovementMs: {
        // A keyboard/demo event is a real input event, but it is not evidence for the
        // real-camera TTFF acceptance gate.
        threshold: scalarThreshold(poseOnlyEvidence ? timeToFirstMovementMs : null, "under", 45_000),
      },
      trackingFps: {
        summary: trackingFpsSummary,
        threshold: threshold(
          trackingFpsSummary,
          "at_least",
          20,
          "p05",
          MIN_TRACKING_METRIC_SAMPLES,
        ),
      },
      inferenceMs: {
        summary: inferenceSummary,
        // 50 ms is the per-frame processing budget corresponding to 20 FPS.
        threshold: threshold(
          inferenceSummary,
          "at_most",
          50,
          "p95",
          MIN_TRACKING_METRIC_SAMPLES,
        ),
      },
      visibleResponseLatencyMs: {
        summary: responseLatencySummary,
        threshold: threshold(
          responseLatencySummary,
          "under",
          100,
          "p95",
          MIN_VISIBLE_RESPONSE_SAMPLES,
        ),
      },
    },
    director: {
      scene: sceneMeta,
      plan: planMeta,
      adaptations: adaptationMetas,
      sourcesUsed: [...new Set(sources)],
      sessionPlanAndAdaptationLatencyMs: rounded(directorLatencyMs, 0),
    },
    rounds,
    adaptations: adaptationEvidence,
    privacy: {
      // These fields describe the implementation contract and this export, not an observed
      // network audit of a particular real-camera session.
      liveCameraHandlingDesign: "browser_only",
      liveCameraNetworkAuditIncluded: false,
      personalIdentifiersIncluded: false,
      imagesOrVideoIncluded: false,
      rawPoseLandmarksIncluded: false,
      capturedRoomStillIncluded: false,
      uploadPathsIncluded: false,
      statement:
        "By design live camera frames stay in the browser. This local evidence is not a network audit and contains aggregate measurements only; it excludes names, media, room stills, pose landmarks, and upload paths.",
    },
  };
}
