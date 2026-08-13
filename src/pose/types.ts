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

export interface PoseFrame {
  timestamp: number;
  sourceWidth: number;
  sourceHeight: number;
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[];
  confidence: number;
  fps: number;
  inferenceMs: number;
  mask?: PoseMask;
}

export type PoseWorkerRequest =
  | {
      type: "init";
      wasmRoot: string;
      modelUrl: string;
      enableMask: boolean;
    }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number }
  | { type: "dispose" };

export type PoseWorkerResponse =
  | { type: "ready" }
  | ({ type: "result" } & PoseFrame)
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
  timestamp: number;
  amplitude: number;
  x: number;
  y: number;
  side?: "left" | "right";
  detectedAt?: number;
}
