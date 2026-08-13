# Release and validation artifacts

## Release snapshot — 13 August 2026

- Public guided demo: <https://ming3465.github.io/MoveRealm/>
- Source repository: <https://github.com/ming3465/MoveRealm>
- Baseline deployment: [GitHub Pages run 31673855670](https://github.com/ming3465/MoveRealm/actions/runs/31673855670)
  completed `npm ci`, **53/53 tests**, the production build, artifact upload, and deployment.
- Final favicon-inclusive Pages run ID: **[PENDING FROM RELEASE OWNER]**.
- Current local verification: 6 test files, **53/53 tests passed**.

The public GitHub Pages site is the static guided-demo build. Live CodeBuddy scene, planning, and
adaptation calls require the Node adapter; static hosting uses the visibly labelled guided or safe
deterministic path and must not be described as live CodeBuddy.

## Sanitized live-agent evidence

The JSON files in `validation/` are sanitized observations from `npm run smoke:agent` on 13 August
2026. They contain synthetic fixture hashes, structured scene/plan/adaptation output, source labels,
latencies, and upload-cleanup state. They contain no room image bytes, live frames, landmarks,
credentials, run IDs, prompts, email addresses, or personal data.

Use these three successful live CodeBuddy observations for the controlled release room matrix:

| Fixture | Evidence file | Scene | Directions | Plan signature | Scene / plan / adaptation latency |
|---|---|---|---|---|---|
| Open | `live-agent-open-room.json` | open | vertical, left, right, centre | reach 0.82, squat 0.75, side-step 0.88 | 17.824 s / 27.480 s / 5.490 s |
| Tight | `live-agent-tight.json` | tight | vertical, centre | reach 0.65, squat 0.75, reach 0.60 | 18.961 s / 21.900 s / 5.502 s |
| Uncertain | `live-agent-uncertain-room.json` | uncertain | vertical, centre | reach 0.55, squat 0.60, reach 0.62 | 15.631 s / 24.600 s / 5.753 s |

Each row records `codebuddy` as the scene, plan, and adaptation source; a 180-second safe plan; and
an empty local temporary-upload directory after analysis.

`live-agent-tight-room.json` intentionally preserves a separate transient recovery run in which
scene and adaptation were live but the plan timed out after 30 seconds and returned the labelled
deterministic fallback. It demonstrates the fallback state and must not be cited as a successful
live-plan observation.

The adaptation input in all four files is explicitly marked `syntheticTelemetry`: 4 of 12 targets,
`too_hard`, keyboard mode, pose confidence 0, and tracking FPS 0. It is a controlled contract test,
not a human trial, real-person pose measurement, or user result.

## Guided-session time accounting

The full guided browser smoke asserts the result card's exact accounting:

- Three 52-second movement rounds = 156 seconds = **2.6 active minutes**.
- Two 12-second rests = 24 seconds = 0.4 minutes.
- Total adventure = 180 seconds = **3.0 minutes**.
- Guided keyboard-mode tracking FPS is `N/A`.

This supports the wording “2.6 active minutes within a 3.0-minute adventure.” It does not support a
claim of three active minutes or any real-person tracking result.

## Reproduction commands

Start the local app in one terminal:

```bash
npm run dev
```

Run browser evidence from a second terminal:

```bash
npm run smoke:browser
MOVEREALM_FULL_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 MOVEREALM_CAPTURE_SMOKE=1 npm run smoke:browser
MOVEREALM_ADAPT_SMOKE=1 npm run smoke:browser
```

The camera smoke uses Chrome's fake media stream to check permission and Worker readiness. It does
not contain a trackable person. Preserve a fresh command log before calling any individual command a
final submission run.

For new live-agent artifacts, start CodeBuddy and the app, verify `/api/health` reports
`codeBuddyConnected: true`, then use `npm run smoke:agent` with an explicit fixture and evidence path.
Do not overwrite the release JSON files without reviewing their provenance and sanitization.

## Artifact checksums

| File | SHA-256 |
|---|---|
| `validation/live-agent-open-room.json` | `fb29536989e0c56764acdf764cf8def9e954d93ba89707bdbef30b4a368155f5` |
| `validation/live-agent-tight.json` | `340cfbed25d8a78f38f0cd2a6797202f00807ed88dbac89318cff5267f2f08d7` |
| `validation/live-agent-uncertain-room.json` | `159bfcfde10804f29b6b34f7a6ef2d00f25aa92d871777a57da2d1f53f723889` |
| `validation/live-agent-tight-room.json` | `c7bc82a101ab9b641a79f9422eecf2fb29d02d5d554fe9eb51fcbffc58f59d3d` |
| `../assets/submission/moverealm-cover-380x216.png` | `38637377111cffc7dce5c45ab3e9c0c3591fc55ce692f9af811940880b1dcf2c` |

Any edit to an artifact invalidates its listed checksum; recompute with `shasum -a 256 <file>`.

## Explicitly pending evidence

- **Pending:** real-person pose FPS on the target device.
- **Pending:** real-person visible camera-to-game latency.
- **Pending:** real-person time to first accepted movement (TTFF).
- **Pending:** all three qualitative user trials.
- **Pending:** final 3–5 minute demo recording, accessible video URL, and video checksum.
- **Pending:** final favicon-inclusive Pages run ID.

Synthetic fixtures, keyboard telemetry, a successful deployment, and a camera-permission smoke do
not close any of those pending items.
