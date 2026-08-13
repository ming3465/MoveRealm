import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  validateAdaptationSafety,
  validatePlanSafety,
  validateSceneSafety,
  type AdaptRequest,
  type ConfirmedConstraints,
  type PlanRequest,
  type QuestPlan,
  type SceneProfile,
} from "../src/shared/contracts.js";
import { EvalCandidateSchema } from "../eval/schemas.js";
import { createFallbackPlan } from "../src/shared/fallbacks.js";

interface MatrixObservation {
  fixture: string;
  scene: unknown;
  plan?: unknown;
}

interface MatrixEvidence {
  observations?: MatrixObservation[];
  adaptation?: {
    syntheticTelemetry?: unknown;
    before?: unknown;
    decision?: unknown;
  };
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function constraintsFor(scene: SceneProfile): ConfirmedConstraints {
  const hasLateral = scene.permittedDirections.some(
    (direction) => direction === "left" || direction === "right",
  );
  return {
    floorClear: true,
    noJumping: true,
    sideStepRange: hasLateral ? (scene.spaceClass === "open" ? "wide" : "narrow") : "none",
    permittedDirections: scene.permittedDirections,
  };
}

const inputPath = argument("--input");
const outputDirectory = argument("--out-dir") ?? "artifacts/evaluation/candidates";
if (!inputPath) throw new Error("Usage: tsx scripts/build-eval-candidates.ts --input <room-matrix.json> --out-dir <directory>");
const matrix = JSON.parse(await readFile(resolve(inputPath), "utf8")) as MatrixEvidence;
if (!matrix.observations?.length) throw new Error("The matrix contains no observations.");
await mkdir(resolve(outputDirectory), { recursive: true });

for (const observation of matrix.observations) {
  if (!observation.plan) {
    throw new Error(
      `Matrix observation ${observation.fixture} has no full plan. Capture a fresh matrix with the current live-agent smoke.`,
    );
  }
  const scene = validateSceneSafety(observation.scene);
  const planRequest: PlanRequest = {
    scene,
    constraints: constraintsFor(scene),
    intent: { durationSeconds: 180, energy: "balanced", noJumping: true },
  };
  let plan: QuestPlan;
  let source: "codebuddy" | "fallback" = "codebuddy";
  let candidateDetail: string | undefined;
  try {
    plan = validatePlanSafety(observation.plan, planRequest);
  } catch (error) {
    if (scene.spaceClass !== "uncertain") throw error;
    plan = validatePlanSafety(createFallbackPlan(planRequest), planRequest);
    source = "fallback";
    candidateDetail = "The original CodeBuddy plan failed current safety validation; a validated deterministic fallback is recorded.";
  }
  const adaptations = [];
  if (observation.fixture === "tight-room.png" && matrix.adaptation) {
    const request: AdaptRequest = {
      telemetry: matrix.adaptation.syntheticTelemetry as AdaptRequest["telemetry"],
      nextRoundSeed: matrix.adaptation.before as AdaptRequest["nextRoundSeed"],
      constraints: planRequest.constraints,
      intent: planRequest.intent,
    };
    adaptations.push({
      request,
      decision: validateAdaptationSafety(matrix.adaptation.decision, request),
    });
  }
  const candidate = EvalCandidateSchema.parse({
    schemaVersion: "1.0.0",
    fixtureId: basename(observation.fixture, ".png"),
    source,
    ...(candidateDetail ? { candidateDetail } : {}),
    scene,
    planRequest,
    plan,
    adaptations,
  });
  await writeFile(
    resolve(outputDirectory, `${candidate.fixtureId}.json`),
    `${JSON.stringify(candidate, null, 2)}\n`,
    "utf8",
  );
}
