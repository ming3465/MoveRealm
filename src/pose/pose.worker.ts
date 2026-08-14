/// <reference lib="webworker" />

import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type {
  PoseLandmark,
  PoseMask,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "./types";
import { RELIABLE_POSE_CONFIDENCE } from "./movementDetectors";
import { confidenceOf } from "./confidence";

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let landmarker: PoseLandmarker | undefined;
let enableMask = true;
let processing = false;
const processedTimes: number[] = [];

function normalizeLandmark(landmark: NormalizedLandmark): PoseLandmark {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z ?? 0,
    visibility: landmark.visibility ?? 0,
  };
}

function copyMask(result: PoseLandmarkerResult): PoseMask | undefined {
  if (!enableMask || !result.segmentationMasks?.[0]) return undefined;
  const source = result.segmentationMasks[0];
  const values = source.getAsFloat32Array();
  const width = 64;
  const height = 64;
  const alpha = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y / height) * source.height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x / width) * source.width));
      alpha[y * width + x] = Math.round(values[sourceY * source.width + sourceX] * 255);
    }
  }
  return { width, height, alpha };
}

function postError(error: unknown, recoverable: boolean): void {
  const response: PoseWorkerResponse = {
    type: "error",
    message: error instanceof Error ? error.message : "Pose tracking failed.",
    recoverable,
  };
  workerScope.postMessage(response);
}

async function initialize(request: Extract<PoseWorkerRequest, { type: "init" }>): Promise<void> {
  try {
    enableMask = request.enableMask;
    // This worker is emitted as an ES module. MediaPipe's default loader targets
    // classic scripts and leaves ModuleFactory unset when used from a module
    // worker, so explicitly select its module-compatible WASM bundle.
    const fileset = await FilesetResolver.forVisionTasks(request.wasmRoot, true);
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: request.modelUrl,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: RELIABLE_POSE_CONFIDENCE,
      minPosePresenceConfidence: RELIABLE_POSE_CONFIDENCE,
      minTrackingConfidence: RELIABLE_POSE_CONFIDENCE,
      outputSegmentationMasks: enableMask,
    });
    workerScope.postMessage({ type: "ready" } satisfies PoseWorkerResponse);
  } catch (error) {
    postError(error, false);
  }
}

function processFrame(request: Extract<PoseWorkerRequest, { type: "frame" }>): void {
  if (!landmarker || processing) {
    request.bitmap.close();
    return;
  }

  processing = true;
  const sourceWidth = request.bitmap.width;
  const sourceHeight = request.bitmap.height;
  const workerStartedNow = performance.now();
  const onMainTimeline = (workerNow: number) =>
    performance.timeOrigin + workerNow - request.mainPerformanceTimeOrigin;
  try {
    landmarker.detectForVideo(request.bitmap, request.timing.frameCallbackAt, (result) => {
      try {
        const inferenceCompletedNow = performance.now();
        const landmarks = (result.landmarks[0] ?? []).map(normalizeLandmark);
        const worldLandmarks = (result.worldLandmarks[0] ?? []).map(normalizeLandmark);
        const mask = copyMask(result);
        const workerCompletedNow = performance.now();
        processedTimes.push(workerCompletedNow);
        while (
          processedTimes.length > 1 &&
          workerCompletedNow - processedTimes[0] > 1_000
        ) {
          processedTimes.shift();
        }
        const response: PoseWorkerResponse = {
          type: "result",
          timestamp: request.timing.frameCallbackAt,
          sourceWidth,
          sourceHeight,
          landmarks,
          worldLandmarks,
          confidence: landmarks.length === 33 ? confidenceOf(landmarks) : 0,
          fps: processedTimes.length > 1
            ? Math.min(
                120,
                ((processedTimes.length - 1) * 1_000) /
                  Math.max(1, workerCompletedNow - processedTimes[0]),
              )
            : 0,
          inferenceMs: inferenceCompletedNow - workerStartedNow,
          timing: {
            ...request.timing,
            workerStartedAt: onMainTimeline(workerStartedNow),
            inferenceCompletedAt: onMainTimeline(inferenceCompletedNow),
            workerCompletedAt: onMainTimeline(workerCompletedNow),
          },
          ...(mask ? { mask } : {}),
        };
        const transfer = mask ? [mask.alpha.buffer] : [];
        workerScope.postMessage(response, transfer);
      } finally {
        result.close();
      }
    });
  } catch (error) {
    postError(error, true);
  } finally {
    request.bitmap.close();
    processing = false;
  }
}

workerScope.onmessage = (event: MessageEvent<PoseWorkerRequest>) => {
  const request = event.data;
  if (request.type === "init") void initialize(request);
  if (request.type === "frame") processFrame(request);
  if (request.type === "dispose") {
    landmarker?.close();
    landmarker = undefined;
    workerScope.close();
  }
};
