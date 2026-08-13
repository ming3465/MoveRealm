import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PoseEngine,
  cameraCaptureToVisibleLatencyMs,
} from "../src/pose/PoseEngine.js";
import type { PoseWorkerRequest, PoseWorkerResponse } from "../src/pose/types.js";

class WorkerDouble {
  static latest?: WorkerDouble;
  onmessage?: (event: MessageEvent<PoseWorkerResponse>) => void;
  onerror?: (event: ErrorEvent) => void;
  messages: PoseWorkerRequest[] = [];

  constructor() {
    WorkerDouble.latest = this;
  }

  postMessage(message: PoseWorkerRequest): void {
    this.messages.push(message);
  }

  terminate(): void {}

  respond(response: PoseWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<PoseWorkerResponse>);
  }
}

describe("PoseEngine timing", () => {
  let animationCallback: FrameRequestCallback | undefined;

  beforeEach(() => {
    WorkerDouble.latest = undefined;
    vi.stubGlobal("Worker", WorkerDouble);
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      animationCallback = callback;
      return 41;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
      width: 1280,
      height: 720,
      close: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses rVFC metadata without relabelling presentation as camera capture", async () => {
    let videoCallback: VideoFrameRequestCallback | undefined;
    const cancelVideoFrameCallback = vi.fn();
    const video = {
      readyState: 4,
      requestVideoFrameCallback: vi.fn((callback: VideoFrameRequestCallback) => {
        videoCallback = callback;
        return 17;
      }),
      cancelVideoFrameCallback,
    } as unknown as HTMLVideoElement;
    const onFrame = vi.fn();
    const engine = new PoseEngine();
    engine.start(video, { onFrame });
    const worker = WorkerDouble.latest!;
    worker.respond({ type: "ready" });

    videoCallback!(120, {
      captureTime: 105,
      expectedDisplayTime: 124,
      height: 720,
      mediaTime: 1,
      presentationTime: 118,
      presentedFrames: 1,
      width: 1280,
    });
    await Promise.resolve();

    const request = worker.messages.at(-1)!;
    expect(request.type).toBe("frame");
    if (request.type !== "frame") throw new Error("Expected a frame request");
    expect(request.timing).toMatchObject({
      frameCallbackSource: "video_frame_callback",
      frameCallbackAt: 120,
      cameraCaptureAt: 105,
      videoFramePresentedAt: 118,
    });
    expect(request.timing.bitmapReadyAt).toBeGreaterThan(0);

    worker.respond({
      type: "result",
      timestamp: request.timing.frameCallbackAt,
      sourceWidth: 1280,
      sourceHeight: 720,
      landmarks: [],
      worldLandmarks: [],
      confidence: 0,
      fps: 24,
      inferenceMs: 20,
      timing: {
        ...request.timing,
        workerStartedAt: 125,
        inferenceCompletedAt: 145,
        workerCompletedAt: 147,
      },
    });
    const delivered = onFrame.mock.calls[0][0];
    expect(delivered.timestamp).toBe(120);
    expect(delivered.timing.mainDeliveredAt).toBeGreaterThan(0);
    expect(cameraCaptureToVisibleLatencyMs(delivered.timing, 185)).toBe(80);

    engine.unbindVideo();
    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(17);
    engine.dispose();
  });

  it("falls back to rAF and keeps capture latency unavailable", async () => {
    const video = { readyState: 4 } as HTMLVideoElement;
    const engine = new PoseEngine();
    engine.start(video, { onFrame: vi.fn() });
    const worker = WorkerDouble.latest!;
    worker.respond({ type: "ready" });
    animationCallback!(90);
    await Promise.resolve();

    const request = worker.messages.at(-1)!;
    expect(request.type).toBe("frame");
    if (request.type !== "frame") throw new Error("Expected a frame request");
    expect(request.timing.frameCallbackSource).toBe("animation_frame_fallback");
    expect(request.timing.cameraCaptureAt).toBeUndefined();
    expect(cameraCaptureToVisibleLatencyMs(request.timing, 140)).toBeNull();
    engine.dispose();
  });

  it("rejects invalid or backwards capture-to-visible measurements", () => {
    expect(cameraCaptureToVisibleLatencyMs({ cameraCaptureAt: 100 }, 99)).toBeNull();
    expect(cameraCaptureToVisibleLatencyMs({ cameraCaptureAt: Number.NaN }, 120)).toBeNull();
    expect(cameraCaptureToVisibleLatencyMs({}, 120)).toBeNull();
    expect(cameraCaptureToVisibleLatencyMs(undefined, 120)).toBeNull();
  });
});
