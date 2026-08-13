export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseMask {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
}

export type PoseFrameCallbackSource = "video_frame_callback" | "animation_frame_fallback";

/** All `*At` values use the window's monotonic `performance.now()` timeline. */
export interface PoseSourceTiming {
  frameCallbackSource: PoseFrameCallbackSource;
  /** Time the browser invoked our callback for this video frame. Not sensor capture time. */
  frameCallbackAt: number;
  /** Browser-reported camera capture time. Present only when rVFC supplies `captureTime`. */
  cameraCaptureAt?: number;
  /** Browser-reported submission-for-composition time from rVFC `presentationTime`. */
  videoFramePresentedAt?: number;
  /** Time `createImageBitmap(video)` resolved on the main thread. */
  bitmapReadyAt: number;
}

export interface PoseWorkerTiming extends PoseSourceTiming {
  /** Time worker processing began, converted onto the window performance timeline. */
  workerStartedAt: number;
  /** Time MediaPipe invoked its result callback, before landmark/mask copying. */
  inferenceCompletedAt: number;
  /** Time landmark/mask copying finished, immediately before posting the result. */
  workerCompletedAt: number;
}

export interface PoseFrameTiming extends PoseWorkerTiming {
  /** Time the worker result message began handling on the main thread. */
  mainDeliveredAt: number;
}

export interface PoseFrame {
  /**
   * Backward-compatible alias for `timing.frameCallbackAt`, used for detector cooldowns.
   * It is neither physical camera capture nor inference-completion time.
   */
  timestamp: number;
  sourceWidth: number;
  sourceHeight: number;
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[];
  confidence: number;
  fps: number;
  inferenceMs: number;
  timing: PoseFrameTiming;
  mask?: PoseMask;
}

export type PoseWorkerResult = Omit<PoseFrame, "timing"> & {
  type: "result";
  timing: PoseWorkerTiming;
};

export type PoseWorkerRequest =
  | {
      type: "init";
      wasmRoot: string;
      modelUrl: string;
      enableMask: boolean;
    }
  | {
      type: "frame";
      bitmap: ImageBitmap;
      timing: PoseSourceTiming;
      /** Allows worker times to be converted to the window's performance timeline. */
      mainPerformanceTimeOrigin: number;
    }
  | { type: "dispose" };

export type PoseWorkerResponse =
  | { type: "ready" }
  | PoseWorkerResult
  | { type: "error"; message: string; recoverable: boolean };

export interface CalibrationProfile {
  centerX: number;
  standingHipY: number;
  shoulderWidth: number;
  bodyHeight: number;
  lateralEnvelope: number;
}

export interface MovementEvent {
  movementId: "reach" | "squat" | "side_step";
  /**
   * Camera events inherit `PoseFrame.timestamp` (the frame callback time); keyboard
   * events use their input time. Do not present this field as sensor-capture time.
   */
  timestamp: number;
  amplitude: number;
  x: number;
  y: number;
  side?: "left" | "right";
  /** Present only when a camera-derived event explicitly carries its source pose timing. */
  poseTiming?: PoseFrameTiming;
  /** Main-thread time the detector accepted the pose; not the visible-feedback paint time. */
  detectedAt?: number;
}
