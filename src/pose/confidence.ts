import type { PoseLandmark } from "./types.js";

/** Nose plus both shoulders and both hips: the points a usable framing always contains. */
export const PRESENCE_LANDMARKS = [0, 11, 12, 23, 24] as const;

/** How many of those points must be clear for the session to count as tracked. */
export const PRESENCE_SAMPLE = 3;

/**
 * Answer one question: is a person reliably in frame?
 *
 * An earlier version averaged eleven landmarks including knees and ankles, so a player
 * seated at ordinary laptop distance scored below the reliability threshold purely
 * because their legs were outside the shot. The tracking gate then paused the world and
 * stopped the round clock, which is a deadlock rather than a safety response.
 *
 * Reading the torso and taking its three clearest points keeps a genuine absence low —
 * every torso point falls away together when someone leaves — while a single occluded
 * hip or a tight upper-body framing no longer halts play. Whether a *specific* movement
 * is measurable is decided separately: each detector in movementDetectors.ts checks the
 * joints that movement needs before emitting anything.
 */
export function confidenceOf(landmarks: PoseLandmark[]): number {
  const clearest = PRESENCE_LANDMARKS.map((index) => landmarks[index]?.visibility ?? 0)
    .sort((a, b) => b - a)
    .slice(0, PRESENCE_SAMPLE);
  return clearest.reduce((sum, value) => sum + value, 0) / clearest.length;
}
