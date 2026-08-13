import type { PoseFrame, PoseWorkerRequest, PoseWorkerResponse } from "./types";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface PoseEngineHandlers {
  onFrame: (frame: PoseFrame) => void;
  onReady?: () => void;
  onError?: (message: string, recoverable: boolean) => void;
}

export class PoseEngine {
  private worker?: Worker;
  private video?: HTMLVideoElement;
  private frameHandle?: number;
  private ready = false;
  private inFlight = false;
  private stopped = false;
  private lastSentAt = 0;
  private handlers?: PoseEngineHandlers;

  start(video: HTMLVideoElement, handlers: PoseEngineHandlers): void {
    this.video = video;
    this.handlers = handlers;
    this.stopped = false;
    if (!this.worker) this.createWorker();
    if (this.frameHandle == null) this.frameHandle = requestAnimationFrame(this.loop);
  }

  unbindVideo(): void {
    this.video = undefined;
    if (this.frameHandle != null) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = undefined;
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
      this.handlers?.onFrame({
        timestamp: response.timestamp,
        sourceWidth: response.sourceWidth,
        sourceHeight: response.sourceHeight,
        landmarks: response.landmarks,
        worldLandmarks: response.worldLandmarks,
        confidence: response.confidence,
        fps: response.fps,
        inferenceMs: response.inferenceMs,
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

  private loop = (now: number): void => {
    if (this.stopped) return;
    this.frameHandle = requestAnimationFrame(this.loop);
    if (
      !this.ready ||
      this.inFlight ||
      !this.video ||
      this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      now - this.lastSentAt < 32
    ) {
      return;
    }

    this.inFlight = true;
    this.lastSentAt = now;
    void createImageBitmap(this.video)
      .then((bitmap) => {
        if (!this.worker || this.stopped) {
          bitmap.close();
          this.inFlight = false;
          return;
        }
        this.worker.postMessage(
          { type: "frame", bitmap, timestamp: now } satisfies PoseWorkerRequest,
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
  };

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
