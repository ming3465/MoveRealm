import { describe, expect, it } from "vitest";
import {
  isMovementOnTarget,
  requiredAmplitudeForMovement,
  targetIntervalMs,
  type MovementTarget,
} from "../src/game/targetMatching.js";
import type { MovementEvent } from "../src/pose/types.js";

function movement(overrides: Partial<MovementEvent> = {}): MovementEvent {
  return {
    movementId: "reach",
    timestamp: 1_000,
    amplitude: 0.8,
    x: 0.76,
    y: 0.2,
    ...overrides,
  };
}

describe("physical target matching", () => {
  it("counts a camera reach near its firefly but not on the opposite side", () => {
    const target: MovementTarget = { movementId: "reach", x: 0.75, y: 0.18 };
    expect(isMovementOnTarget(movement(), target, false)).toBe(true);
    expect(isMovementOnTarget(movement({ x: 0.2 }), target, false)).toBe(false);
  });

  it("requires a side-step to match the visible river direction", () => {
    const target: MovementTarget = {
      movementId: "side_step",
      x: 0.24,
      y: 0.58,
      side: "left",
      requiredAmplitude: 0.44,
    };
    expect(
      isMovementOnTarget(
        movement({ movementId: "side_step", side: "left", x: 0.24, y: 0.58 }),
        target,
        false,
      ),
    ).toBe(true);
    expect(
      isMovementOnTarget(
        movement({ movementId: "side_step", side: "left", amplitude: 0.43 }),
        target,
        false,
      ),
    ).toBe(false);
    expect(
      isMovementOnTarget(
        movement({ movementId: "side_step", side: "right", x: 0.76, y: 0.58 }),
        target,
        false,
      ),
    ).toBe(false);
  });

  it("requires a squat to reach the round-specific movement range", () => {
    const target: MovementTarget = {
      movementId: "squat",
      x: 0.5,
      y: 0.78,
      requiredAmplitude: 0.36,
    };
    expect(
      isMovementOnTarget(
        movement({ movementId: "squat", x: 0.5, y: 0.7, amplitude: 0.35 }),
        target,
        false,
      ),
    ).toBe(false);
    expect(
      isMovementOnTarget(
        movement({ movementId: "squat", x: 0.5, y: 0.7, amplitude: 0.36 }),
        target,
        false,
      ),
    ).toBe(true);
  });

  it("derives stricter targets and slower replacement from round parameters", () => {
    expect(requiredAmplitudeForMovement("side_step", 1)).toBeGreaterThan(
      requiredAmplitudeForMovement("side_step", 0.5) ?? 0,
    );
    expect(requiredAmplitudeForMovement("squat", 1)).toBeGreaterThan(
      requiredAmplitudeForMovement("squat", 0.5) ?? 0,
    );
    expect(requiredAmplitudeForMovement("reach", 1)).toBeUndefined();
    expect(targetIntervalMs(10, 1)).toBe(6_000);
    expect(targetIntervalMs(16, 1.25)).toBe(3_000);
  });

  it("keeps matching keyboard controls forgiving in the guided demo", () => {
    const target: MovementTarget = { movementId: "reach", x: 0.12, y: 0.08 };
    expect(isMovementOnTarget(movement({ x: 0.5, y: 0.5 }), target, true)).toBe(true);
    expect(
      isMovementOnTarget(movement({ movementId: "squat" }), target, true),
    ).toBe(false);
  });
});
