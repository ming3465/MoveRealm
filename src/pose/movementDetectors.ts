import type { MovementId } from "../shared/contracts.js";
import type {
  CalibrationProfile,
  MovementEvent,
  PoseFrame,
  PoseLandmark,
} from "./types.js";

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

export const RELIABLE_POSE_CONFIDENCE = 0.55;

function midpoint(a: PoseLandmark, b: PoseLandmark): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: PoseLandmark, b: PoseLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function visible(landmarks: PoseLandmark[], indexes: number[], threshold = 0.5): boolean {
  return indexes.every((index) => (landmarks[index]?.visibility ?? 0) >= threshold);
}

function angle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (denominator === 0) return 180;
  const cosine = Math.min(1, Math.max(-1, (ab.x * cb.x + ab.y * cb.y) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function calibrationFromPose(frame: PoseFrame): CalibrationProfile | undefined {
  const landmarks = frame.landmarks;
  if (
    !visible(landmarks, [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP, LEFT_ANKLE, RIGHT_ANKLE])
  ) {
    return undefined;
  }
  const shoulder = midpoint(landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER]);
  const hip = midpoint(landmarks[LEFT_HIP], landmarks[RIGHT_HIP]);
  const ankle = midpoint(landmarks[LEFT_ANKLE], landmarks[RIGHT_ANKLE]);
  return {
    centerX: hip.x,
    standingHipY: hip.y,
    shoulderWidth: Math.max(0.06, distance(landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER])),
    bodyHeight: Math.max(0.35, ankle.y - shoulder.y),
    lateralEnvelope: 0.12,
  };
}

export function isTPose(frame: PoseFrame): boolean {
  const landmarks = frame.landmarks;
  if (!visible(landmarks, [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_WRIST, RIGHT_WRIST], 0.58)) {
    return false;
  }
  const shoulders = distance(landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER]);
  const wristSpan = Math.abs(landmarks[LEFT_WRIST].x - landmarks[RIGHT_WRIST].x);
  const wristLevel =
    Math.abs(landmarks[LEFT_WRIST].y - landmarks[LEFT_SHOULDER].y) < 0.14 &&
    Math.abs(landmarks[RIGHT_WRIST].y - landmarks[RIGHT_SHOULDER].y) < 0.14;
  return wristLevel && wristSpan > Math.max(0.48, shoulders * 2.15);
}

export function lateralOffset(frame: PoseFrame, centerX: number): number | undefined {
  const landmarks = frame.landmarks;
  if (!visible(landmarks, [LEFT_HIP, RIGHT_HIP])) return undefined;
  return midpoint(landmarks[LEFT_HIP], landmarks[RIGHT_HIP]).x - centerX;
}

export interface SideCalibrationState {
  reachedSide: boolean;
  complete: boolean;
  maxOffset: number;
  outwardFrames: number;
  centerFrames: number;
}

export class SideCalibrationTracker {
  private reachedSide = false;
  private outwardFrames = 0;
  private centerFrames = 0;
  private maxOffset = 0.08;

  constructor(
    private readonly outwardThreshold: number,
    private readonly centerThreshold = Math.max(0.018, outwardThreshold * 0.45),
    private readonly outwardFramesRequired = 5,
    private readonly centerFramesRequired = 4,
  ) {}

  update(offset: number | undefined): SideCalibrationState {
    if (offset == null || !Number.isFinite(offset)) {
      if (this.reachedSide) this.centerFrames = 0;
      else this.outwardFrames = 0;
      return this.snapshot();
    }

    const absoluteOffset = Math.abs(offset);
    this.maxOffset = Math.max(this.maxOffset, absoluteOffset);

    if (!this.reachedSide) {
      this.outwardFrames = absoluteOffset > this.outwardThreshold
        ? this.outwardFrames + 1
        : 0;
      if (this.outwardFrames >= this.outwardFramesRequired) {
        this.reachedSide = true;
        this.centerFrames = 0;
      }
    } else {
      this.centerFrames = absoluteOffset <= this.centerThreshold
        ? this.centerFrames + 1
        : 0;
    }

    return this.snapshot();
  }

  private snapshot(): SideCalibrationState {
    return {
      reachedSide: this.reachedSide,
      complete: this.reachedSide && this.centerFrames >= this.centerFramesRequired,
      maxOffset: this.maxOffset,
      outwardFrames: this.outwardFrames,
      centerFrames: this.centerFrames,
    };
  }
}

export class TrackingGate {
  private lowSince?: number;
  private goodFrames = 0;
  private paused = false;

  update(confidence: number, timestamp: number): boolean {
    if (confidence < RELIABLE_POSE_CONFIDENCE) {
      this.goodFrames = 0;
      this.lowSince ??= timestamp;
      if (timestamp - this.lowSince >= 700) this.paused = true;
    } else {
      this.lowSince = undefined;
      this.goodFrames += 1;
      if (this.goodFrames >= 3) this.paused = false;
    }
    return this.paused;
  }

  markUnavailable(): void {
    this.lowSince = undefined;
    this.goodFrames = 0;
    this.paused = true;
  }

  reset(): void {
    this.lowSince = undefined;
    this.goodFrames = 0;
    this.paused = false;
  }
}

export class MovementDetector {
  private latched = false;
  private lastEventAt = -Infinity;
  private sideNeedsCenter = false;

  constructor(private calibration: CalibrationProfile) {}

  setCalibration(calibration: CalibrationProfile): void {
    this.calibration = calibration;
    this.reset();
  }

  reset(): void {
    this.latched = false;
    this.sideNeedsCenter = false;
    this.lastEventAt = -Infinity;
  }

  process(frame: PoseFrame, movementId: MovementId, rangeScale: number): MovementEvent | undefined {
    if (frame.confidence < RELIABLE_POSE_CONFIDENCE || frame.landmarks.length !== 33) {
      return undefined;
    }
    if (movementId === "reach") return this.reach(frame, rangeScale);
    if (movementId === "squat") return this.squat(frame, rangeScale);
    return this.sideStep(frame, rangeScale);
  }

  private emit(
    movementId: MovementId,
    frame: PoseFrame,
    amplitude: number,
    x: number,
    y: number,
    side?: "left" | "right",
  ): MovementEvent | undefined {
    if (frame.timestamp - this.lastEventAt < 380) return undefined;
    this.lastEventAt = frame.timestamp;
    return {
      movementId,
      timestamp: frame.timestamp,
      amplitude,
      x,
      y,
      ...(side ? { side } : {}),
      detectedAt: performance.now(),
    };
  }

  private reach(frame: PoseFrame, rangeScale: number): MovementEvent | undefined {
    const points = frame.landmarks;
    if (!visible(points, [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_WRIST, RIGHT_WRIST])) return undefined;
    const candidates = [
      { wrist: points[LEFT_WRIST], shoulder: points[LEFT_SHOULDER] },
      { wrist: points[RIGHT_WRIST], shoulder: points[RIGHT_SHOULDER] },
    ];
    const scored = candidates
      .map(({ wrist, shoulder }) => ({
        wrist,
        amplitude:
          distance(wrist, shoulder) / Math.max(0.18, this.calibration.bodyHeight * 0.46),
        raised: wrist.y < shoulder.y - (0.025 + 0.055 * rangeScale),
      }))
      .sort((a, b) => b.amplitude - a.amplitude);
    const active = scored[0].raised && scored[0].amplitude > 0.62 * rangeScale;
    if (!active) {
      this.latched = false;
      return undefined;
    }
    if (this.latched) return undefined;
    this.latched = true;
    return this.emit(
      "reach",
      frame,
      Math.min(1.5, scored[0].amplitude),
      1 - scored[0].wrist.x,
      scored[0].wrist.y,
      scored[0].wrist.x > 0.5 ? "left" : "right",
    );
  }

  private squat(frame: PoseFrame, rangeScale: number): MovementEvent | undefined {
    const points = frame.landmarks;
    if (!visible(points, [LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE])) {
      return undefined;
    }
    const hip = midpoint(points[LEFT_HIP], points[RIGHT_HIP]);
    const kneeAngle =
      (angle(points[LEFT_HIP], points[LEFT_KNEE], points[LEFT_ANKLE]) +
        angle(points[RIGHT_HIP], points[RIGHT_KNEE], points[RIGHT_ANKLE])) /
      2;
    const hipDrop = (hip.y - this.calibration.standingHipY) / this.calibration.bodyHeight;
    const amplitude = Math.max((168 - kneeAngle) / 65, hipDrop / 0.22);
    const active = amplitude > 0.42 * rangeScale;
    if (!active) {
      if (amplitude < 0.2) this.latched = false;
      return undefined;
    }
    if (this.latched) return undefined;
    this.latched = true;
    return this.emit("squat", frame, Math.min(1.5, amplitude), 1 - hip.x, hip.y);
  }

  private sideStep(frame: PoseFrame, rangeScale: number): MovementEvent | undefined {
    const points = frame.landmarks;
    if (!visible(points, [LEFT_HIP, RIGHT_HIP])) return undefined;
    const hip = midpoint(points[LEFT_HIP], points[RIGHT_HIP]);
    const offset = hip.x - this.calibration.centerX;
    const normalized = Math.abs(offset) / Math.max(this.calibration.lateralEnvelope, 0.08);
    if (normalized < 0.3) {
      this.sideNeedsCenter = false;
      return undefined;
    }
    if (this.sideNeedsCenter || normalized < 0.55 * rangeScale) return undefined;
    this.sideNeedsCenter = true;
    const physicalSide = offset > 0 ? "left" : "right";
    return this.emit(
      "side_step",
      frame,
      Math.min(1.5, normalized),
      1 - hip.x,
      hip.y,
      physicalSide,
    );
  }
}
