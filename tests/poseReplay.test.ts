import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isMovementOnTarget } from "../src/game/targetMatching.js";
import {
  MovementDetector,
  SideCalibrationTracker,
  TrackingGate,
  calibrationFromPose,
  isTPose,
} from "../src/pose/movementDetectors.js";
import type { PoseFrame, PoseLandmark } from "../src/pose/types.js";

interface ReplayStep {
  id: string;
  timestamp: number;
  confidence?: number;
  overrides: Record<string, [number, number]>;
}

interface PoseReplay {
  schemaVersion: "1.0.0";
  provenance: string;
  sourceWidth: number;
  sourceHeight: number;
  confidence: number;
  fps: number;
  baseLandmarks: Record<string, [number, number]>;
  steps: ReplayStep[];
  sideCalibrationOffsets: Array<number | null>;
}

const replay = JSON.parse(
  readFileSync(new URL("./fixtures/pose-replay.json", import.meta.url), "utf8"),
) as PoseReplay;

function frame(stepId: string): PoseFrame {
  const step = replay.steps.find((item) => item.id === stepId);
  if (!step) throw new Error(`Missing replay step ${stepId}.`);
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.99,
  }));
  for (const [index, [x, y]] of Object.entries({
    ...replay.baseLandmarks,
    ...step.overrides,
  })) {
    landmarks[Number(index)] = { x, y, z: 0, visibility: 0.99 };
  }
  return {
    timestamp: step.timestamp,
    sourceWidth: replay.sourceWidth,
    sourceHeight: replay.sourceHeight,
    landmarks,
    worldLandmarks: [],
    confidence: step.confidence ?? replay.confidence,
    fps: replay.fps,
    inferenceMs: 26,
    timing: {
      frameCallbackSource: "video_frame_callback",
      frameCallbackAt: step.timestamp,
      cameraCaptureAt: Math.max(0, step.timestamp - 8),
      videoFramePresentedAt: Math.max(0, step.timestamp - 1),
      bitmapReadyAt: step.timestamp + 1,
      workerStartedAt: step.timestamp + 2,
      inferenceCompletedAt: step.timestamp + 27,
      workerCompletedAt: step.timestamp + 28,
      mainDeliveredAt: step.timestamp + 29,
    },
  };
}

describe("frozen pose replay", () => {
  it("replays calibration, all three target matches, and tracking loss without participant data", () => {
    expect(replay.provenance).toMatch(/synthetic/i);
    const tPose = frame("t_pose");
    expect(isTPose(tPose)).toBe(true);
    const calibration = calibrationFromPose(tPose);
    expect(calibration).toBeDefined();

    const calibrationTracker = new SideCalibrationTracker(0.07);
    const calibrationStates = replay.sideCalibrationOffsets.map((offset) =>
      calibrationTracker.update(offset ?? undefined),
    );
    expect(calibrationStates.at(-1)?.complete).toBe(true);

    const detector = new MovementDetector(calibration!);
    const reach = detector.process(frame("reach"), "reach", 0.8);
    expect(reach).toBeDefined();
    expect(
      isMovementOnTarget(reach!, { movementId: "reach", x: 0.95, y: 0.1 }, false),
    ).toBe(true);

    detector.process(frame("reach_reset"), "reach", 0.8);
    detector.reset();
    const squat = detector.process(frame("squat"), "squat", 0.8);
    expect(squat).toBeDefined();
    expect(
      isMovementOnTarget(
        squat!,
        { movementId: "squat", x: 0.5, y: 0.75, requiredAmplitude: 0.336 },
        false,
      ),
    ).toBe(true);

    detector.process(frame("standing_reset"), "squat", 0.8);
    detector.reset();
    const left = detector.process(frame("side_left"), "side_step", 0.8);
    expect(left?.side).toBe("left");
    expect(
      isMovementOnTarget(
        left!,
        { movementId: "side_step", x: 0.37, y: 0.52, side: "left", requiredAmplitude: 0.44 },
        false,
      ),
    ).toBe(true);
    detector.process(frame("side_center"), "side_step", 0.8);
    const right = detector.process(frame("side_right"), "side_step", 0.8);
    expect(right?.side).toBe("right");

    const gate = new TrackingGate();
    expect(gate.update(frame("t_pose").confidence, 0)).toBe(false);
    expect(gate.update(frame("lost").confidence, 4_000)).toBe(false);
    expect(gate.update(frame("lost").confidence, 4_701)).toBe(true);
    expect(gate.update(frame("visible_1").confidence, 4_720)).toBe(true);
    expect(gate.update(frame("visible_2").confidence, 4_750)).toBe(true);
    expect(gate.update(frame("visible_3").confidence, 4_780)).toBe(false);
  });
});
