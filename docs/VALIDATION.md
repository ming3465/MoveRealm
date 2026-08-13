# Validation evidence and pending live measurements

This record deliberately separates completed automated or controlled checks from measurements that
still require a person, a real webcam, the target device, or a finished submission recording. A
dash (`—`) means **not measured**; it is not a zero and must never be replaced with an estimate.

## Evidence status

- **Recorded automated evidence** — an automated run completed and its observed scope is stated.
- **Recorded controlled evidence** — a local integration run completed against synthetic fixtures
  or telemetry, but it is not a human trial.
- **Pending human/device evidence** — requires a real person, real webcam, and target device.
- **Pending submission evidence** — requires a finished, accessible recording or artifact.

## Current release verification — 13 August 2026

| Check | Observed | Evidence status |
|---|---|---|
| Vitest suite | 6 files, **53/53 tests passed** | recorded automated evidence |
| Production build | strict client/server checks and Vite build passed | recorded in Pages run 31673855670 |
| GitHub Pages deployment | successful | recorded in Pages run 31673855670 |
| Public guided demo | <https://ming3465.github.io/MoveRealm/> returned HTTP 200 | recorded deployment check |
| Source repository | <https://github.com/ming3465/MoveRealm> | recorded release location |
| Final favicon-inclusive Pages run ID | — | pending release bookkeeping |

[GitHub Pages run 31673855670](https://github.com/ming3465/MoveRealm/actions/runs/31673855670)
completed `npm ci`, all 53 tests, `npm run build`, artifact upload, and deployment successfully. A
newer favicon-inclusive deployment must replace the pending run-ID row once the release owner sends
the final run ID.

## Recorded automated browser evidence — 13 August 2026

Environment: Apple M1 Pro, Chrome 151, and Node 24.12.

The synthetic-camera browser smoke reached MediaPipe Worker readiness, safety confirmation,
calibration, Phaser gameplay, keyboard scoring, pause, and resume without an application error.
Chrome's fake stream does not contain a trackable person, so this evidence does **not** establish
real-person pose FPS, camera-to-visual response latency, movement accuracy, time to first movement,
or usability.

The current full guided-smoke oracle also checks the result card's time accounting:

- Three 52-second rounds = 156 seconds = **2.6 active minutes**.
- Two 12-second rests = 24 seconds = 0.4 minutes.
- 156 + 24 = 180 seconds = the complete **3.0-minute adventure**.
- Keyboard-mode tracking FPS is `N/A`, not a measured pose result.

Use a running local server and execute the checks from a second terminal:

```bash
npm run smoke:browser
MOVEREALM_FULL_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 MOVEREALM_CAPTURE_SMOKE=1 npm run smoke:browser
MOVEREALM_ADAPT_SMOKE=1 npm run smoke:browser
```

These commands document how to reproduce each path. Preserve a fresh final-run log before citing a
specific command as submission evidence.

## Recorded controlled live-CodeBuddy room matrix — 13 August 2026

The sanitized JSON observations in [`artifacts/validation/`](../artifacts/validation/) record three
successful end-to-end live CodeBuddy scene, plan, and adaptation calls. All three health checks
reported `codeBuddyConnected: true`; every plan totalled 180 seconds; and the local temporary-upload
directory was empty after analysis.

| Fixture | Evidence file | Scene | Permitted directions | Plan signature |
|---|---|---|---|---|
| Open | [`live-agent-open-room.json`](../artifacts/validation/live-agent-open-room.json) | `open` | vertical, left, right, center | reach 0.82, squat 0.75, side-step 0.88 |
| Tight | [`live-agent-tight.json`](../artifacts/validation/live-agent-tight.json) | `tight` | vertical, center | reach 0.65, squat 0.75, reach 0.60 |
| Uncertain | [`live-agent-uncertain-room.json`](../artifacts/validation/live-agent-uncertain-room.json) | `uncertain` | vertical, center | reach 0.55, squat 0.60, reach 0.62 |

| Fixture | Scene latency | Plan latency | Adaptation latency | Scene / plan / adaptation source |
|---|---:|---:|---:|---|
| Open | 17.824 s | 27.480 s | 5.490 s | CodeBuddy / CodeBuddy / CodeBuddy |
| Tight | 18.961 s | 21.900 s | 5.502 s | CodeBuddy / CodeBuddy / CodeBuddy |
| Uncertain | 15.631 s | 24.600 s | 5.753 s | CodeBuddy / CodeBuddy / CodeBuddy |

The adaptation request in each artifact uses explicitly labelled synthetic keyboard telemetry: 4 of
12 targets, `too_hard`, pose confidence 0, and tracking FPS 0. The live adaptation kept the next
squat movement while reducing its range, tempo, and target rate:

| Fixture | Range | Tempo | Target rate |
|---|---:|---:|---:|
| Open | 0.75 → 0.55 | 0.80 → 0.65 | 8 → 6 |
| Tight | 0.75 → 0.55 | 0.80 → 0.60 | 7 → 5 |
| Uncertain | 0.60 → 0.45 | 0.70 → 0.55 | 6 → 4 |

This is controlled agent-contract evidence, not a human trial or pose-performance measurement.

[`live-agent-tight-room.json`](../artifacts/validation/live-agent-tight-room.json) intentionally
preserves a separate recovery run: scene analysis and adaptation were live CodeBuddy results, while
the plan timed out after 30 seconds and returned the visibly labelled deterministic fallback. It is
fallback evidence and must not be counted as a fourth successful live plan.

## Pending real-person and submission evidence

Record these only from the actual target laptop, a real webcam, and a consenting participant, or
from the finished submission artifact where specified.

| Check | Target | Observed | Status |
|---|---:|---:|---|
| Real-person pose processing | at least 20 FPS on M1 Pro | — | **pending human/device measurement** |
| Real-person visible response latency | under 100 ms | — | **pending human/device measurement** |
| Real-person time to first accepted movement (TTFF) | under 45 seconds | — | **pending timed human run** |
| Three-user qualitative trial | three completed observations | — | **pending all 3 user trials** |
| Final 3–5 minute submission video | accessible YouTube or Google Drive link | — | **pending recording and upload** |

Measurement method:

1. Use the FPS and inference timing emitted by the pose Worker for pose processing.
2. Use a 60 FPS phone recording for camera-to-visual response latency if possible.
3. Start the TTFF timer before setup and stop it at the participant's first accepted movement.
4. Save the raw observation or recording reference with consent; never transcribe a target as an
   observed result.

## Privacy checks

| Check | Observation | Status |
|---|---|---|
| Browser camera frames produce no outbound requests | — | pending real-camera network inspection |
| Server temporary room still is removed after analysis | empty after all three controlled matrix runs | recorded controlled evidence |
| Participant consent for retained stills or recordings | — | pending per participant |

Use browser network tooling during the real-camera run to check that live frames are not uploaded.
Inspect the server's temporary upload location after analysis. Save only consented room stills for
submission evidence, and do not retain live camera recordings unless the participant explicitly
agreed to the demo recording.

## Pending three-user trial record

| Trial | Room | Time to first move | Completion | Confusion / quote | Change made | Status |
|---|---|---:|---:|---|---|---|
| 1 | — | — | — | — | — | pending human trial |
| 2 | — | — | — | — | — | pending human trial |
| 3 | — | — | — | — | — | pending human trial |

Report the three observations as a small qualitative sample. Do not extrapolate population results.
