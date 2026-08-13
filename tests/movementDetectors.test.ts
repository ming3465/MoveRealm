import { describe, expect, it } from "vitest";
import {
  MovementDetector,
  RELIABLE_POSE_CONFIDENCE,
  SideCalibrationTracker,
  TrackingGate,
  calibrationFromPose,
  isTPose,
  lateralOffset,
} from "../src/pose/movementDetectors.js";
import type { CalibrationProfile, PoseFrame, PoseLandmark } from "../src/pose/types.js";

function landmarks(): PoseLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
}

function standingPose(timestamp = 0): PoseFrame {
  const points = landmarks();
  points[11] = { x: 0.4, y: 0.3, z: 0, visibility: 0.99 };
  points[12] = { x: 0.6, y: 0.3, z: 0, visibility: 0.99 };
  points[15] = { x: 0.22, y: 0.3, z: 0, visibility: 0.99 };
  points[16] = { x: 0.78, y: 0.3, z: 0, visibility: 0.99 };
  points[23] = { x: 0.44, y: 0.52, z: 0, visibility: 0.99 };
  points[24] = { x: 0.56, y: 0.52, z: 0, visibility: 0.99 };
  points[25] = { x: 0.45, y: 0.7, z: 0, visibility: 0.99 };
  points[26] = { x: 0.55, y: 0.7, z: 0, visibility: 0.99 };
  points[27] = { x: 0.45, y: 0.93, z: 0, visibility: 0.99 };
  points[28] = { x: 0.55, y: 0.93, z: 0, visibility: 0.99 };
  return {
    timestamp,
    sourceWidth: 1280,
    sourceHeight: 720,
    landmarks: points,
    worldLandmarks: [],
    confidence: 0.95,
    fps: 28,
    inferenceMs: 26,
    timing: {
      frameCallbackSource: "video_frame_callback",
      frameCallbackAt: timestamp,
      cameraCaptureAt: Math.max(0, timestamp - 8),
      videoFramePresentedAt: timestamp - 1,
      bitmapReadyAt: timestamp + 1,
      workerStartedAt: timestamp + 2,
      inferenceCompletedAt: timestamp + 27,
      workerCompletedAt: timestamp + 28,
      mainDeliveredAt: timestamp + 29,
    },
  };
}

const calibration: CalibrationProfile = {
  centerX: 0.5,
  standingHipY: 0.52,
  shoulderWidth: 0.2,
  bodyHeight: 0.63,
  lateralEnvelope: 0.12,
};

describe("calibration", () => {
  it("extracts camera-relative body scale and recognizes a T-pose", () => {
    const frame = standingPose();
    expect(isTPose(frame)).toBe(true);
    const result = calibrationFromPose(frame);
    expect(result?.centerX).toBeCloseTo(0.5);
    expect(result?.shoulderWidth).toBeCloseTo(0.2);
    expect(result?.bodyHeight).toBeGreaterThan(0.5);
  });

  it("does not mistake invisible hips for a return to centre", () => {
    const frame = standingPose();
    frame.landmarks[23].visibility = 0;
    frame.landmarks[24].visibility = 0;
    expect(lateralOffset(frame, 0.5)).toBeUndefined();
  });

  it("requires a verified return to centre after the side-step", () => {
    const tracker = new SideCalibrationTracker(0.07);
    for (let frame = 0; frame < 4; frame += 1) {
      expect(tracker.update(0.1).reachedSide).toBe(false);
    }
    const reached = tracker.update(0.1);
    expect(reached.reachedSide).toBe(true);
    expect(reached.complete).toBe(false);

    for (let frame = 0; frame < 6; frame += 1) {
      expect(tracker.update(0.1).complete).toBe(false);
    }
    expect(tracker.update(0.01).complete).toBe(false);
    expect(tracker.update(undefined).centerFrames).toBe(0);
    for (let frame = 0; frame < 3; frame += 1) {
      expect(tracker.update(0.01).complete).toBe(false);
    }
    expect(tracker.update(0.01).complete).toBe(true);
  });
});

describe("movement state machines", () => {
  it("emits one reach until the arm resets", () => {
    const detector = new MovementDetector(calibration);
    const reach = standingPose(1_000);
    reach.landmarks[15] = { x: 0.05, y: 0.1, z: 0, visibility: 0.99 };
    const first = detector.process(reach, "reach", 0.8);
    expect(first?.movementId).toBe("reach");
    expect(first?.poseTiming).toBe(reach.timing);
    expect(detector.process({ ...reach, timestamp: 1_500 }, "reach", 0.8)).toBeUndefined();
    const reset = standingPose(1_900);
    reset.landmarks[15] = { x: 0.4, y: 0.45, z: 0, visibility: 0.99 };
    reset.landmarks[16] = { x: 0.6, y: 0.45, z: 0, visibility: 0.99 };
    detector.process(reset, "reach", 0.8);
    expect(detector.process({ ...reach, timestamp: 2_300 }, "reach", 0.8)?.movementId).toBe("reach");
  });

  it("emits a squat after a calibrated hip drop, then waits for standing reset", () => {
    const detector = new MovementDetector(calibration);
    const squat = standingPose(1_000);
    squat.landmarks[23] = { x: 0.44, y: 0.75, z: 0, visibility: 0.99 };
    squat.landmarks[24] = { x: 0.56, y: 0.75, z: 0, visibility: 0.99 };
    expect(detector.process(squat, "squat", 0.8)?.movementId).toBe("squat");
    expect(detector.process({ ...squat, timestamp: 1_500 }, "squat", 0.8)).toBeUndefined();
    detector.process(standingPose(1_900), "squat", 0.8);
    expect(detector.process({ ...squat, timestamp: 2_300 }, "squat", 0.8)?.movementId).toBe("squat");
  });

  it("requires a return to centre between side-step events", () => {
    const detector = new MovementDetector(calibration);
    const left = standingPose(1_000);
    left.landmarks[23].x += 0.13;
    left.landmarks[24].x += 0.13;
    expect(detector.process(left, "side_step", 0.8)?.side).toBe("left");
    expect(detector.process({ ...left, timestamp: 1_500 }, "side_step", 0.8)).toBeUndefined();
    detector.process(standingPose(1_900), "side_step", 0.8);
    const right = standingPose(2_300);
    right.landmarks[23].x -= 0.13;
    right.landmarks[24].x -= 0.13;
    expect(detector.process(right, "side_step", 0.8)?.side).toBe("right");
  });

  it("does not invent events from invisible landmarks", () => {
    const detector = new MovementDetector(calibration);
    const frame = standingPose(1_000);
    frame.confidence = 0.2;
    expect(detector.process(frame, "reach", 0.8)).toBeUndefined();
  });

  it("uses the same reliable-confidence threshold as the tracking gate", () => {
    const detector = new MovementDetector(calibration);
    const reach = standingPose(1_000);
    reach.landmarks[15] = { x: 0.05, y: 0.1, z: 0, visibility: 0.99 };
    reach.confidence = RELIABLE_POSE_CONFIDENCE - 0.001;
    expect(detector.process(reach, "reach", 0.8)).toBeUndefined();

    reach.confidence = RELIABLE_POSE_CONFIDENCE;
    expect(detector.process(reach, "reach", 0.8)?.movementId).toBe("reach");

    const gate = new TrackingGate();
    expect(gate.update(RELIABLE_POSE_CONFIDENCE - 0.001, 0)).toBe(false);
    expect(gate.update(RELIABLE_POSE_CONFIDENCE - 0.001, 701)).toBe(true);
    expect(gate.update(RELIABLE_POSE_CONFIDENCE, 720)).toBe(true);
    expect(gate.update(RELIABLE_POSE_CONFIDENCE, 750)).toBe(true);
    expect(gate.update(RELIABLE_POSE_CONFIDENCE, 780)).toBe(false);
  });
});

describe("tracking gate", () => {
  it("pauses after sustained signal loss and needs three good frames to resume", () => {
    const gate = new TrackingGate();
    expect(gate.update(0.2, 0)).toBe(false);
    expect(gate.update(0.2, 701)).toBe(true);
    expect(gate.update(0.9, 720)).toBe(true);
    expect(gate.update(0.9, 750)).toBe(true);
    expect(gate.update(0.9, 780)).toBe(false);
  });

  it("stays paused after the pose stream disappears until three good frames return", () => {
    const gate = new TrackingGate();
    gate.markUnavailable();
    expect(gate.update(0.2, 1_000)).toBe(true);
    expect(gate.update(0.9, 1_030)).toBe(true);
    expect(gate.update(0.9, 1_060)).toBe(true);
    expect(gate.update(0.9, 1_090)).toBe(false);
  });
});
