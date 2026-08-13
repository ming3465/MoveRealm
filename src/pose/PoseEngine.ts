import type {
  PoseFrame,
  PoseSourceTiming,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from "./types.js";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface PoseEngineHandlers {
  onFrame: (frame: PoseFrame) => void;
  onReady?: () => void;
  onError?: (message: string, recoverable: boolean) => void;
}

/**
 * Returns a genuine camera-capture-to-paint duration only when the browser supplied
 * capture metadata. Presentation callbacks and rAF fallbacks intentionally return null.
 */
export function cameraCaptureToVisibleLatencyMs(
  timing: { cameraCaptureAt?: number } | undefined,
  visibleAt: number,
): number | null {
  const capturedAt = timing?.cameraCaptureAt;
  if (
    capturedAt == null ||
    !Number.isFinite(capturedAt) ||
    !Number.isFinite(visibleAt) ||
    visibleAt < capturedAt
  ) {
    return null;
  }
  return visibleAt - capturedAt;
}

export class PoseEngine {
  private worker?: Worker;
  private video?: HTMLVideoElement;
  private callbackHandle?: number;
  private callbackKind?: "video" | "animation";
  private ready = false;
  private inFlight = false;
  private stopped = false;
  private lastSentAt = 0;
  private handlers?: PoseEngineHandlers;

  start(video: HTMLVideoElement, handlers: PoseEngineHandlers): void {
    if (this.video && this.video !== video) this.cancelFrameCallback();
    this.video = video;
    this.handlers = handlers;
    this.stopped = false;
    if (!this.worker) this.createWorker();
    this.scheduleFrameCallback();
  }

  unbindVideo(): void {
    this.cancelFrameCallback();
    this.video = undefined;
  }

  private createWorker(): void {
    this.worker = new Worker(new URL("./pose.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
      const response = event.data;
      if (response.type === "ready") {
        this.ready = true;
        this.handlers?.onReady?.();
        return;
      }
      if (response.type === "error") {
        this.inFlight = false;
        this.handlers?.onError?.(response.message, response.recoverable);
        return;
      }
      this.inFlight = false;
      const mainDeliveredAt = performance.now();
      this.handlers?.onFrame({
        timestamp: response.timestamp,
        sourceWidth: response.sourceWidth,
        sourceHeight: response.sourceHeight,
        landmarks: response.landmarks,
        worldLandmarks: response.worldLandmarks,
        confidence: response.confidence,
        fps: response.fps,
        inferenceMs: response.inferenceMs,
        timing: {
          ...response.timing,
          mainDeliveredAt,
        },
        ...(response.mask ? { mask: response.mask } : {}),
      });
    };
    this.worker.onerror = (event) => {
      this.inFlight = false;
      this.handlers?.onError?.(event.message || "Pose worker failed to load.", false);
    };
    this.worker.postMessage({
      type: "init",
      wasmRoot: WASM_ROOT,
      modelUrl: MODEL_URL,
      enableMask: true,
    } satisfies PoseWorkerRequest);
  }

  private scheduleFrameCallback(): void {
    if (this.stopped || !this.video || this.callbackHandle != null) return;
    if (typeof this.video.requestVideoFrameCallback === "function") {
      this.callbackKind = "video";
      this.callbackHandle = this.video.requestVideoFrameCallback(this.onVideoFrame);
      return;
    }
    this.callbackKind = "animation";
    this.callbackHandle = requestAnimationFrame(this.onAnimationFrame);
  }

  private cancelFrameCallback(): void {
    if (this.callbackHandle == null) return;
    if (this.callbackKind === "video" && this.video) {
      this.video.cancelVideoFrameCallback(this.callbackHandle);
    } else {
      cancelAnimationFrame(this.callbackHandle);
    }
    this.callbackHandle = undefined;
    this.callbackKind = undefined;
  }

  private onVideoFrame = (
    frameCallbackAt: DOMHighResTimeStamp,
    metadata: VideoFrameCallbackMetadata,
  ): void => {
    this.callbackHandle = undefined;
    this.callbackKind = undefined;
    this.scheduleFrameCallback();
    this.readFrame({
      frameCallbackSource: "video_frame_callback",
      frameCallbackAt,
      ...(Number.isFinite(metadata.captureTime)
        ? { cameraCaptureAt: metadata.captureTime }
        : {}),
      ...(Number.isFinite(metadata.presentationTime)
        ? { videoFramePresentedAt: metadata.presentationTime }
        : {}),
      bitmapReadyAt: frameCallbackAt,
    });
  };

  private onAnimationFrame = (frameCallbackAt: DOMHighResTimeStamp): void => {
    this.callbackHandle = undefined;
    this.callbackKind = undefined;
    this.scheduleFrameCallback();
    this.readFrame({
      frameCallbackSource: "animation_frame_fallback",
      frameCallbackAt,
      bitmapReadyAt: frameCallbackAt,
    });
  };

  private readFrame(sourceTiming: PoseSourceTiming): void {
    if (
      !this.ready ||
      this.inFlight ||
      !this.video ||
      this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      sourceTiming.frameCallbackAt - this.lastSentAt < 32
    ) {
      return;
    }

    this.inFlight = true;
    this.lastSentAt = sourceTiming.frameCallbackAt;
    void createImageBitmap(this.video)
      .then((bitmap) => {
        if (!this.worker || this.stopped) {
          bitmap.close();
          this.inFlight = false;
          return;
        }
        const timing: PoseSourceTiming = {
          ...sourceTiming,
          bitmapReadyAt: performance.now(),
        };
        this.worker.postMessage(
          {
            type: "frame",
            bitmap,
            timing,
            mainPerformanceTimeOrigin: performance.timeOrigin,
          } satisfies PoseWorkerRequest,
          [bitmap],
        );
      })
      .catch((error: unknown) => {
        this.inFlight = false;
        this.handlers?.onError?.(
          error instanceof Error ? error.message : "Could not read a camera frame.",
          true,
        );
      });
  }

  dispose(): void {
    this.stopped = true;
    this.unbindVideo();
    this.worker?.postMessage({ type: "dispose" } satisfies PoseWorkerRequest);
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
    this.inFlight = false;
  }
}
