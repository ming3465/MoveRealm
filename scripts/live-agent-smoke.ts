import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  DirectorMetaSchema,
  validateAdaptationSafety,
  validatePlanSafety,
  validateSceneSafety,
  type AdaptRequest,
  type ConfirmedConstraints,
  type DirectorResponse,
  type PlanRequest,
  type QuestPlan,
  type SceneProfile,
} from "../src/shared/contracts.js";

const baseUrl = (process.env.MOVEREALM_URL ?? "http://127.0.0.1:4173").replace(/\/$/, "");
const allowFallback = process.env.MOVEREALM_ALLOW_FALLBACK === "1";
const matrix = process.env.MOVEREALM_ROOM_MATRIX === "1";
const fixtureRoot = resolve("assets/room-fixtures");
const fixturePaths = matrix
  ? ["open-room.png", "tight-room.png", "uncertain-room.png"].map((name) => join(fixtureRoot, name))
  : [resolve(process.env.MOVEREALM_ROOM_IMAGE ?? join(fixtureRoot, "tight-room.png"))];

function dimensionsOfPng(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("The live-agent smoke currently requires a PNG room fixture.");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function jsonResponse<T>(
  path: string,
  init: RequestInit,
  validate: (input: unknown) => T,
): Promise<{ response: DirectorResponse<T>; elapsedMs: number }> {
  const startedAt = performance.now();
  const httpResponse = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(70_000),
  });
  const body = (await httpResponse.json()) as { data?: unknown; meta?: unknown; error?: string };
  if (!httpResponse.ok) throw new Error(`${path}: ${body.error ?? `HTTP ${httpResponse.status}`}`);
  const response = {
    data: validate(body.data),
    meta: DirectorMetaSchema.parse(body.meta),
  };
  if (!allowFallback && response.meta.source !== "codebuddy") {
    throw new Error(`${path} returned ${response.meta.source}; a live CodeBuddy result is required.`);
  }
  return { response, elapsedMs: Math.round(performance.now() - startedAt) };
}

function confirmedConstraints(scene: SceneProfile): ConfirmedConstraints {
  const lateral = scene.permittedDirections.includes("left") || scene.permittedDirections.includes("right");
  return {
    floorClear: true,
    noJumping: true,
    sideStepRange: lateral ? (scene.spaceClass === "open" ? "wide" : "narrow") : "none",
    permittedDirections: scene.permittedDirections,
  };
}

const healthResponse = await fetch(`${baseUrl}/api/health`, {
  signal: AbortSignal.timeout(5_000),
});
if (!healthResponse.ok) throw new Error(`Health endpoint returned HTTP ${healthResponse.status}.`);
const health = (await healthResponse.json()) as {
  movementDirector?: string;
  codeBuddyConnected?: boolean;
};
if (!allowFallback && !health.codeBuddyConnected) {
  throw new Error("MoveRealm is reachable, but CodeBuddy is not connected.");
}

const observations = [];
let adaptationEvidence: unknown;
for (const fixturePath of fixturePaths) {
  const bytes = await readFile(fixturePath);
  const dimensions = dimensionsOfPng(bytes);
  const form = new FormData();
  form.append("room", new Blob([bytes], { type: "image/png" }), basename(fixturePath));
  form.append("width", String(dimensions.width));
  form.append("height", String(dimensions.height));

  const sceneRun = await jsonResponse(
    "/api/scene/analyze",
    { method: "POST", body: form },
    validateSceneSafety,
  );
  const constraints = confirmedConstraints(sceneRun.response.data);
  const planRequest: PlanRequest = {
    scene: sceneRun.response.data,
    constraints,
    intent: { durationSeconds: 180, energy: "balanced", noJumping: true },
  };
  const planRun = await jsonResponse(
    "/api/quest/plan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planRequest),
    },
    (value) => validatePlanSafety(value, planRequest),
  );
  const plan: QuestPlan = planRun.response.data;

  observations.push({
    fixture: basename(fixturePath),
    fixtureSha256: createHash("sha256").update(bytes).digest("hex"),
    scene: sceneRun.response.data,
    sceneSource: sceneRun.response.meta.source,
    sceneDetail: sceneRun.response.meta.detail,
    sceneLatencyMs: sceneRun.response.meta.latencyMs,
    sceneClientElapsedMs: sceneRun.elapsedMs,
    planSource: planRun.response.meta.source,
    planDetail: planRun.response.meta.detail,
    planLatencyMs: planRun.response.meta.latencyMs,
    planClientElapsedMs: planRun.elapsedMs,
    plan: planRun.response.data,
    planSignature: plan.rounds.map((round) => `${round.movementId}:${round.rangeScale}`).join("|"),
    planTotalSeconds:
      plan.rounds.reduce((sum, round) => sum + round.durationSeconds, 0) +
      plan.restBetweenRoundsSeconds * (plan.rounds.length - 1),
  });

  if (basename(fixturePath) === "tight-room.png" || fixturePaths.length === 1) {
    const adaptationRequest: AdaptRequest = {
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
      constraints,
      intent: planRequest.intent,
    };
    const adaptationRun = await jsonResponse(
      "/api/quest/adapt",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adaptationRequest),
      },
      (value) => validateAdaptationSafety(value, adaptationRequest),
    );
    adaptationEvidence = {
      source: adaptationRun.response.meta.source,
      detail: adaptationRun.response.meta.detail,
      latencyMs: adaptationRun.response.meta.latencyMs,
      clientElapsedMs: adaptationRun.elapsedMs,
      syntheticTelemetry: adaptationRequest.telemetry,
      before: adaptationRequest.nextRoundSeed,
      decision: adaptationRun.response.data,
    };
  }
}

if (matrix) {
  const sceneSignatures = observations.map((item) =>
    `${item.scene.spaceClass}|${item.scene.permittedDirections.join(",")}`,
  );
  const planSignatures = observations.map((item) => item.planSignature);
  if (new Set(sceneSignatures).size !== observations.length) {
    throw new Error(`Room fixtures did not produce three materially different scene profiles: ${sceneSignatures.join(" / ")}`);
  }
  if (new Set(planSignatures).size !== observations.length) {
    throw new Error(`Room fixtures did not produce three materially different plans: ${planSignatures.join(" / ")}`);
  }
}

let localUploadDirectoryEmpty: boolean | "not-local" = "not-local";
if (/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(baseUrl)) {
  const uploadDirectory = join(tmpdir(), "moverealm-room-stills");
  localUploadDirectoryEmpty = (await readdir(uploadDirectory).catch(() => [])).length === 0;
  if (!localUploadDirectoryEmpty) throw new Error("Temporary room uploads remain after analysis.");
}

const evidence = {
  observedAt: new Date().toISOString(),
  baseUrl,
  health,
  allowFallback,
  roomMatrix: matrix,
  observations,
  adaptation: adaptationEvidence,
  localUploadDirectoryEmpty,
};
const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
if (process.env.MOVEREALM_AGENT_EVIDENCE) {
  await writeFile(resolve(process.env.MOVEREALM_AGENT_EVIDENCE), serialized, "utf8");
}
process.stdout.write(serialized);
