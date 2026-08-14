import { describe, expect, it } from "vitest";
import { confidenceOf } from "../src/pose/confidence.js";
import { RELIABLE_POSE_CONFIDENCE } from "../src/pose/movementDetectors.js";
import type { PoseLandmark } from "../src/pose/types.js";

/** 33 landmarks, all invisible, so each case only sets what it cares about. */
function frame(visibilities: Record<number, number>): PoseLandmark[] {
  return Array.from({ length: 33 }, (_unused, index) => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: visibilities[index] ?? 0,
  }));
}

const NOSE = 0;
const SHOULDERS = [11, 12];
const HIPS = [23, 24];
const KNEES = [25, 26];
const ANKLES = [27, 28];

function withAll(indexes: number[], value: number): Record<number, number> {
  return Object.fromEntries(indexes.map((index) => [index, value]));
}

describe("tracked-presence confidence", () => {
  it("keeps a seated laptop framing playable when the legs are out of shot", () => {
    // The exact situation that deadlocked a real session: head and shoulders clear,
    // hips marginal, legs entirely outside the camera.
    const seated = frame({
      ...withAll([NOSE, ...SHOULDERS], 0.97),
      ...withAll(HIPS, 0.4),
      ...withAll([...KNEES, ...ANKLES], 0),
    });
    expect(confidenceOf(seated)).toBeGreaterThanOrEqual(RELIABLE_POSE_CONFIDENCE);
  });

  it("ignores knees and ankles entirely", () => {
    const upperBody = { ...withAll([NOSE, ...SHOULDERS, ...HIPS], 0.9) };
    const withLegs = frame({ ...upperBody, ...withAll([...KNEES, ...ANKLES], 0.9) });
    const withoutLegs = frame({ ...upperBody, ...withAll([...KNEES, ...ANKLES], 0) });
    expect(confidenceOf(withoutLegs)).toBe(confidenceOf(withLegs));
  });

  it("survives a single occluded hip", () => {
    const oneHipHidden = frame({
      ...withAll([NOSE, ...SHOULDERS], 0.95),
      23: 0.92,
      24: 0,
    });
    expect(confidenceOf(oneHipHidden)).toBeGreaterThanOrEqual(RELIABLE_POSE_CONFIDENCE);
  });

  it("still reports an empty frame as untracked", () => {
    expect(confidenceOf(frame({}))).toBe(0);
  });

  it("still reports a departing player as untracked", () => {
    // Everything fades together when someone walks out of shot, which is the case
    // the pause is genuinely for.
    const leaving = frame(withAll([NOSE, ...SHOULDERS, ...HIPS], 0.2));
    expect(confidenceOf(leaving)).toBeLessThan(RELIABLE_POSE_CONFIDENCE);
  });

  it("does not let one bright point carry the whole frame", () => {
    const onlyNose = frame({ [NOSE]: 1 });
    expect(confidenceOf(onlyNose)).toBeLessThan(RELIABLE_POSE_CONFIDENCE);
  });

  it("reports a fully visible player at full confidence", () => {
    expect(confidenceOf(frame(withAll([NOSE, ...SHOULDERS, ...HIPS], 1)))).toBe(1);
  });
});
