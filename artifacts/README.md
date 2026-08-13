# Validation artifacts

The JSON files in `validation/` are sanitized observations from `npm run smoke:agent` on 13 August
2026. They contain synthetic fixture hashes, structured scene/plan/adaptation output, source labels,
latencies, and upload-cleanup state. They contain no room image bytes, live frames, landmarks,
credentials, run IDs, prompts, email addresses, or personal data.

Use these three successful live CodeBuddy observations for the release room matrix:

| Fixture | Evidence file | Scene | Directions | Plan signature |
|---|---|---|---|---|
| Open | `live-agent-open-room.json` | open | vertical, left, right, centre | reach 0.82, squat 0.75, side-step 0.88 |
| Tight | `live-agent-tight.json` | tight | vertical, centre | reach 0.65, squat 0.75, reach 0.60 |
| Uncertain | `live-agent-uncertain-room.json` | uncertain | vertical, centre | reach 0.55, squat 0.60, reach 0.62 |

`live-agent-tight-room.json` intentionally preserves a separate transient run in which scene and
adaptation were live but the plan exhausted its repair attempt and returned the labelled
deterministic fallback. It demonstrates the fallback state and must not be cited as a successful
live-plan observation.

The adaptation input in these files is explicitly marked `syntheticTelemetry`; it is a controlled
contract test, not a human trial or a pose measurement.
