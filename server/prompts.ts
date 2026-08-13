import type { AdaptRequest, PlanRequest } from "../src/shared/contracts.js";

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
confidence and produce a conservative profile.`;
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
round and restBetweenRoundsSeconds 12, which totals exactly 180 seconds. The movement/mechanic
mapping is reach/collect_fireflies, squat/shelter_seedlings, side_step/redirect_river. If lateral
range is none, do not use side_step. If it is narrow, side_step rangeScale must be <= 0.62. Keep
side_step out of the plan when neither left nor right is permitted. When neither left nor right is
permitted, reach rangeScale must be <= 0.70. When vertical is not permitted, do not use squat and
keep reach rangeScale <= 0.62. Keep all user-facing copy concise enough for the stated character
limits. If scene.spaceClass is uncertain, every round rangeScale must be <= 0.62.`;
}

export function adaptationPrompt(request: AdaptRequest): string {
  return `${SHARED_RULES}

Tune the already validated next round using the completed-round telemetry below:
${JSON.stringify(request, null, 2)}

Return this exact shape:
{
  "nextRound": { same complete shape as nextRoundSeed },
  "reason": string under 150 characters,
  "adjustments": [("target_envelope" | "tempo" | "target_rate" | "none")]
}
You may change only rangeScale, tempo, targetRate, prompt, and accent. Preserve id, movementId,
durationSeconds, and mechanic. Accent must remain one of mint, orchid, or amber. The reason is
user-facing: explain one observable input and one resulting change in plain language. Do not use
JSON field names, underscores, telemetry jargon, or raw decimals. Do not infer fatigue,
engagement, intent, or diagnose form. Example: "Only 4 of 12 targets were reached and you chose
Too hard, so the next targets are closer and slower."`;
}

export function repairPrompt(originalPrompt: string, validationError: string): string {
  return `${originalPrompt}

Your previous response was rejected by deterministic validation: ${validationError.slice(0, 240)}.
Return a corrected JSON object only. Do not add markdown fences or explanation.`;
}
