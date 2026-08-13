import {
  DirectorMetaSchema,
  validateSceneSafety,
  validateAdaptationSafety,
  validatePlanSafety,
  type AdaptRequest,
  type AdaptationDecision,
  type DirectorResponse,
  type PlanRequest,
  type QuestPlan,
  type SceneProfile,
} from "../shared/contracts";
import {
  createFallbackAdaptation,
  createFallbackPlan,
  createFallbackSceneProfile,
} from "../shared/fallbacks";
import type { CapturedStill } from "./camera";

// Two schema-validation attempts may each use the adapter's 30 s CodeBuddy
// deadline. The browser must remain present long enough to receive the repaired
// response or the adapter's labelled fallback.
const DIRECTOR_REQUEST_TIMEOUT_MS = 66_000;

function fallbackMeta(startedAt: number, detail: string): DirectorResponse<never>["meta"] {
  return {
    source: "fallback",
    latencyMs: Math.round(performance.now() - startedAt),
    label: "Deterministic fallback",
    detail,
  };
}

async function parseResponse<T>(
  response: Response,
  parse: (value: unknown) => T,
): Promise<DirectorResponse<T>> {
  const body = (await response.json()) as { data?: unknown; meta?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed with HTTP ${response.status}.`);
  return {
    data: parse(body.data),
    meta: DirectorMetaSchema.parse(body.meta),
  };
}

export async function analyzeScene(still: CapturedStill): Promise<DirectorResponse<SceneProfile>> {
  const startedAt = performance.now();
  try {
    const form = new FormData();
    form.append("room", still.blob, "room.jpg");
    form.append("width", String(still.width));
    form.append("height", String(still.height));
    const response = await fetch("/api/scene/analyze", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(DIRECTOR_REQUEST_TIMEOUT_MS),
    });
    return parseResponse(response, validateSceneSafety);
  } catch (error) {
    return {
      data: createFallbackSceneProfile({ width: still.width, height: still.height, byteLength: still.blob.size }),
      meta: fallbackMeta(
        startedAt,
        error instanceof Error ? `Static/offline mode: ${error.message}` : "Static/offline mode.",
      ),
    };
  }
}

export async function requestPlan(request: PlanRequest): Promise<DirectorResponse<QuestPlan>> {
  const startedAt = performance.now();
  try {
    const response = await fetch("/api/quest/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(DIRECTOR_REQUEST_TIMEOUT_MS),
    });
    return parseResponse(response, (value) => validatePlanSafety(value, request));
  } catch (error) {
    return {
      data: validatePlanSafety(createFallbackPlan(request), request),
      meta: fallbackMeta(
        startedAt,
        error instanceof Error ? `Static/offline mode: ${error.message}` : "Static/offline mode.",
      ),
    };
  }
}

export async function requestAdaptation(
  request: AdaptRequest,
): Promise<DirectorResponse<AdaptationDecision>> {
  const startedAt = performance.now();
  try {
    const response = await fetch("/api/quest/adapt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(DIRECTOR_REQUEST_TIMEOUT_MS),
    });
    return parseResponse(response, (value) => validateAdaptationSafety(value, request));
  } catch (error) {
    return {
      data: validateAdaptationSafety(createFallbackAdaptation(request), request),
      meta: fallbackMeta(
        startedAt,
        error instanceof Error ? `Static/offline mode: ${error.message}` : "Static/offline mode.",
      ),
    };
  }
}
