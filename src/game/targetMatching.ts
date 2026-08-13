import type { MovementEvent } from "../pose/types.js";
import type { MovementId } from "../shared/contracts.js";

export interface MovementTarget {
  movementId: MovementId;
  x: number;
  y: number;
  side?: "left" | "right";
  requiredAmplitude?: number;
}

export function requiredAmplitudeForMovement(
  movementId: MovementId,
  rangeScale: number,
): number | undefined {
  if (movementId === "side_step") return 0.55 * rangeScale;
  if (movementId === "squat") return 0.42 * rangeScale;
  return undefined;
}

export function targetIntervalMs(targetRate: number, tempo: number): number {
  return Math.max(2_400, (60_000 / targetRate) / tempo);
}

export function isMovementOnTarget(
  event: MovementEvent,
  target: MovementTarget,
  assisted: boolean,
): boolean {
  if (event.movementId !== target.movementId) return false;
  if (assisted) return true;

  if (
    target.requiredAmplitude != null &&
    event.amplitude < target.requiredAmplitude
  ) {
    return false;
  }

  if (target.movementId === "side_step") {
    return event.side != null && event.side === target.side;
  }

  if (target.movementId === "squat") {
    return Math.abs(event.x - target.x) <= 0.3 && event.y >= target.y - 0.24;
  }

  const horizontalDistance = event.x - target.x;
  const verticalDistance = (event.y - target.y) * 1.15;
  return Math.hypot(horizontalDistance, verticalDistance) <= 0.28;
}
