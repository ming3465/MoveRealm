import type { AdaptRequest, PlanRequest } from "../src/shared/contracts.js";
import { createFallbackAdaptation } from "../src/shared/fallbacks.js";

const SHARED_RULES = `
You are MoveRealm's Movement Director. You create light, low-impact movement experiences for
healthy adults. Never diagnose form, fatigue, pain, injury, or fitness. Never suggest jumping,
equipment, floor exercises, or any movement outside reach, squat, and side_step. Be conservative
when the scene is uncertain. Return one strict JSON object only, with no markdown or commentary.`.trim();

export function scenePrompt(): string {
  return `${SHARED_RULES}

Inspect only the attached room image. Do not identify people, infer sensitive attributes, or
describe decor that does not affect movement. Produce this exact shape:
{
  "spaceClass": "tight" | "open" | "uncertain",
  "obstacles": [{"label": string, "zone": "left" | "center" | "right" | "floor", "severity": "low" | "medium" | "high"}],
  "permittedDirections": [("vertical" | "left" | "right" | "center")],
  "confidence": number from 0 to 1,
  "summary": string under 180 characters
}
Only claim a clear movement direction when it is visibly supported. Image uncertainty must reduce
confidence and produce a conservative profile.

Use this decision order:
1. Choose uncertain only when cropping, blur, darkness, or occlusion prevents judging the usable
   floor and movement lanes. Keep confidence at or below 0.60 and permit only directions that are
   definitely visible. If the lower frame does not show the floor at all—for example an upward or
   doorway crop showing mainly walls and ceiling—choose uncertain even when the centre looks open.
   Never return an empty permittedDirections array. For that cropped-room case, use
   ["vertical", "center"] when the central body lane is visible; otherwise use ["center"].
2. Otherwise choose open when the centre plus both lateral movement lanes are visibly clear.
3. Otherwise choose tight when a central lane is usable but one or both lateral lanes are visibly
   constrained. Ordinary furniture alone does not make a visible room uncertain.
Include a direction only when its corresponding lane is visibly clear, and never permit a lane with
a high-severity obstacle.`;
}

function requestSpecificPlanRules(request: PlanRequest): string {
  const hasVertical = request.constraints.permittedDirections.includes("vertical");
  const hasLateral = request.constraints.permittedDirections.some(
    (direction) => direction === "left" || direction === "right",
  );
  const uncertain = request.scene.spaceClass === "uncertain";
  const allowedMovementIds = [
    "reach",
    ...(!uncertain && hasVertical ? ["squat"] : []),
    ...(!uncertain && hasLateral && request.constraints.sideStepRange !== "none"
      ? ["side_step"]
      : []),
  ];
  const reachMaximum = uncertain || !hasVertical ? 0.62 : hasLateral ? 1 : 0.7;
  const sideStepRule = allowedMovementIds.includes("side_step")
    ? `side_step rangeScale must be <= ${request.constraints.sideStepRange === "narrow" ? "0.62" : "1.00"}.`
    : "side_step is forbidden.";
  const requiredSequence = uncertain
    ? ["reach", "reach", "reach"]
    : allowedMovementIds.includes("squat") && allowedMovementIds.includes("side_step")
      ? request.scene.spaceClass === "open"
        ? ["reach", "side_step", "squat"]
        : ["reach", "squat", "side_step"]
      : allowedMovementIds.includes("squat")
        ? ["reach", "squat", "reach"]
        : allowedMovementIds.includes("side_step")
          ? ["reach", "side_step", "reach"]
          : ["reach", "reach", "reach"];

  return `Request-specific hard limits (these override variety):
- The only allowed movementId values are: ${allowedMovementIds.join(", ")}.
- reach rangeScale must be <= ${reachMaximum.toFixed(2)}.
- ${hasVertical && !uncertain ? "squat is allowed." : "squat is forbidden."}
- ${sideStepRule}
- Use movementId ${requiredSequence[0]}, ${requiredSequence[1]}, and ${requiredSequence[2]} for
  rounds 1, 2, and 3 respectively.
${uncertain
    ? "- For the conservative uncertain-room envelope, use rangeScale 0.48, 0.52, and 0.56 for rounds 1, 2, and 3 respectively."
    : ""}`;
}

export function planPrompt(request: PlanRequest): string {
  return `${SHARED_RULES}

Create one three-round Neon Rainforest quest from this confirmed input:
${JSON.stringify(request, null, 2)}

Return this exact shape:
{
  "theme": "neon_rainforest",
  "title": string,
  "requestedDurationSeconds": 180,
  "restBetweenRoundsSeconds": integer 0..20,
  "rounds": [
    {
      "id": "round-1" | "round-2" | "round-3",
      "movementId": "reach" | "squat" | "side_step",
      "durationSeconds": integer 20..90,
      "targetRate": integer 3..16,
      "rangeScale": number 0.4..1,
      "tempo": number 0.55..1.25,
      "mechanic": "collect_fireflies" | "shelter_seedlings" | "redirect_river",
      "prompt": string under 90 characters,
      "accent": "mint" | "orchid" | "amber"
    }
  ],
  "safetyNote": string under 150 characters
}
Use ids round-1, round-2, and round-3 exactly once in that order. Use durationSeconds 52 for every
round and restBetweenRoundsSeconds 12, which totals exactly 180 seconds. Whenever a movement is
selected, use its matching mechanic: reach/collect_fireflies, squat/shelter_seedlings, or
side_step/redirect_river. This mapping does not require using all three movements. Use these curated
presentation values exactly: reach = prompt "Reach softly to wake the fireflies" and accent
"mint"; squat = prompt "Lower gently to shelter the seedlings" and accent "orchid"; side_step =
prompt "Step side to side and guide the river" and accent "amber". Use safetyNote exactly
"Move only inside the clear area you confirmed. Pause whenever you need to." If lateral
range is none, do not use side_step. If it is narrow, side_step rangeScale must be <= 0.62. Keep
side_step out of the plan when neither left nor right is permitted. When neither left nor right is
permitted, reach rangeScale must be <= 0.70. When vertical is not permitted, do not use squat and
keep reach rangeScale <= 0.62. Keep all user-facing copy concise enough for the stated character
limits. If scene.spaceClass is uncertain, use reach for all three rounds and keep every rangeScale
<= 0.62; floor visibility is insufficient for squat or side_step.

${requestSpecificPlanRules(request)}`;
}

export function adaptationPrompt(request: AdaptRequest): string {
  const safeCandidate = createFallbackAdaptation(request);

  return `${SHARED_RULES}

Tune the already validated next round using the completed-round telemetry below:
${JSON.stringify(request, null, 2)}

Return this exact shape:
{
  "nextRound": { same complete shape as nextRoundSeed },
  "reason": string under 150 characters,
  "adjustments": [("target_envelope" | "tempo" | "target_rate" | "none")]
}
You may change only rangeScale, tempo, and targetRate. Preserve id, movementId, durationSeconds,
mechanic, prompt, and accent exactly as supplied. Make every numeric change visible at the UI's
precision: whole percentage points for rangeScale and hundredths for tempo. The reason is
user-facing: explain one observable input and one resulting change in plain language. The runtime
will replace it with a deterministic trace derived from telemetry and actual changes. Do not use
JSON field names, underscores, telemetry jargon, or raw decimals. Do not infer fatigue,
engagement, intent, or diagnose form. Example: "Only 4 of 12 targets were reached and you chose
Too hard, so the next targets are closer and slower."

The adjustments array accepts only these exact string values:
- use "target_envelope" if and only if rangeScale changed;
- use "tempo" if and only if tempo changed;
- use "target_rate" if and only if targetRate changed;
- use ["none"] only when none of those three values changed.
Never put JSON field names such as "rangeScale" or "targetRate" in adjustments. Because this
request says ${request.telemetry.feedback}, ${request.telemetry.feedback === "too_hard"
    ? "reduce at least one numeric value and do not increase any of them"
    : request.telemetry.feedback === "too_easy"
      ? "increase at least one numeric value only within the confirmed room limits"
      : "make only a proportional, telemetry-grounded change or use none"}.

For reliable schema compliance, return the prevalidated proportional candidate below exactly. It
was derived from this telemetry and the confirmed room limits. Do not change, rename, add, or omit
any field:
${JSON.stringify(safeCandidate, null, 2)}`;
}

export function repairPrompt(originalPrompt: string, validationError: string): string {
  return `${originalPrompt}

Your previous response was rejected by deterministic validation: ${validationError.slice(0, 240)}.
Return a corrected JSON object only. Do not add markdown fences or explanation.`;
}
