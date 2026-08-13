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
| Vitest suite | 10 files, **75/75 tests passed** in CI and locally | recorded automated evidence |
| Production build | strict client/server checks and Vite build passed | recorded in Pages run 31682611174 |
| npm dependency audit | **0 vulnerabilities** | recorded automated evidence |
| GitHub Pages deployment | successful for release commit `2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52` | recorded in Pages run 31682611174 |
| Deployed build identity | `build-31682611174`; commit matched the release SHA | recorded automated release evidence |
| Public guided demo | <https://ming3465.github.io/MoveRealm/> returned HTTP 200 | recorded deployment check |
| Source repository | <https://github.com/ming3465/MoveRealm> | recorded release location |
| Current-release public basic browser smoke | passed | recorded automated release evidence |
| Exact-release public full-smoke adaptation step | passed with `Guided demo` provenance; range 64→48%, tempo 0.90→0.77×, rate 7→6 | recorded automated release evidence |
| Exact-release Docker captured-room basic path | forced-fallback health true/CodeBuddy false; camera ready; `Safe fallback`; score 0→145 | recorded automated release evidence |
| Exact-release Docker basic request audit | one still POST; only scene and plan POSTs | recorded automated release evidence |
| Earlier Docker full fallback adaptation | passed with `Safe fallback`; not rerun as a full path in the current image | recorded predecessor automated evidence |
| Exact-release public full smoke and anonymous export | passed against `2ab9584` / run 31682611174; checksum and exact identity matched; pose gates `not_evaluated` | recorded automated release evidence |
| Guided screenshot set | 6 consent-free PNGs | recorded submission artifacts |
| Synthetic fake-camera CodeBuddy UI set | 2 consent-free PNGs; live source badges and upload cleanup recorded | recorded controlled evidence |

[GitHub Pages run 31682611174](https://github.com/ming3465/MoveRealm/actions/runs/31682611174)
completed `npm ci`, all 75 tests across 10 files, `npm run build`, artifact upload, and deployment
successfully for release commit
[`2ab9584`](https://github.com/ming3465/MoveRealm/commit/2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52).
CI injected build ID `build-31682611174` and the full commit SHA into the client. The release command
and result record belongs in
[`artifacts/validation/release-checks.md`](../artifacts/validation/release-checks.md).

The Pages workflow excludes docs-only changes under `docs/**`, `artifacts/**`, `README.md`, and
`assets/README.md` from its push trigger. This documentation follow-up does not imply a newer
application deployment; run 31682611174 remains the exact application release.

Release `2ab9584` adds evidence-integrity checks around the local exporter:

- anonymous trial IDs are limited to `trial-1`, `trial-2`, and `trial-3`;
- a numeric `build-N` ID and exact 40-character commit SHA must be present together or both absent;
- each round's completion rate must agree with target counts, and total counts must agree with all
  round records;
- every adaptation and its full next-round parameters must agree with the validated final plan;
- the reported plan/adaptation latency total must agree with its provenance records; and
- the UI prevents duplicate downloads, clamps the trial input to 1–3, removes its temporary anchor,
  delays object-URL cleanup, and presents sanitized success, hash-unavailable, or failure status.

These are automated integrity controls. They do not complete a human trial or measure pose
performance.

## Recorded automated browser evidence — 13 August 2026

Environment: Apple M1 Pro, Chrome 151, and Node 24.12.

The synthetic-camera browser smoke reached MediaPipe Worker readiness, safety confirmation,
calibration, Phaser gameplay, keyboard scoring, pause, and resume without an application error.
Chrome's fake stream does not contain a trackable person, so this evidence does **not** establish
real-person pose FPS, camera-to-visual response latency, movement accuracy, time to first movement,
or usability.

The current `2ab9584` public application passed its basic smoke. Its exact-release Docker image,
tagged `moverealm:2ab9584`, is
`sha256:a205205819345589179d079656e0afefb38887b8b460a2c00d942dc0a11e47b6` (343,057,128 bytes)
and embeds commit `2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52` / build `build-31682611174`.
In forced-fallback mode, health reported true with CodeBuddy disconnected. Its controlled
fake-camera basic path reached camera readiness, preserved safe defaults, showed `Safe fallback`,
scored 0 → 145, sent exactly scene and plan POSTs, left the temporary-upload directory empty, and
the container was stopped and its port freed after stop escalation. Exit 137 means this is not
recorded as a graceful stop. The earlier packaged full fallback adaptation remains valid predecessor
evidence but was not rerun as a full current-image path.

After deployment, a separate public full browser smoke (not a CI job) passed with exit 0 against
commit `2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52`, Pages run 31682611174, and build
`build-31682611174`. Scores advanced 0 → 145 → 290 → 435. The visible `Guided demo`
adaptation changed range 64 → 48%, tempo 0.90 → 0.77×, and target rate 7 → 6. The
`Glowgarden Awakening` postcard displayed 2.6 active minutes, 18% completion, tracking `N/A`, and a
3.0-minute adventure clock. Replay and stop passed the smoke oracle; the request audit recorded no
API POST requests; and no console errors occurred.

That smoke downloaded anonymous keyboard evidence. The privacy-reviewed copy is preserved as
[`public-guided-keyboard-session-2ab9584.json`](../artifacts/validation/public-guided-keyboard-session-2ab9584.json).
Its SHA-256 `00458af188807b5e2e49df994ac1581ff27608d9d1628f60d4df11158c2ef8b7`
matched the checksum shown in the UI, and its product identity exactly matched the full release
commit and build. The export correctly labelled the run `keyboard`: tracking FPS, inference, and
visible-response values were `null`/`N/A`, while the FPS, inference, visible-latency, and TTFF gates
were `not_evaluated`. Its 3.7-second first movement was keyboard input, so it is not evidence for the
pending real-person TTFF gate. The checksum identifies this observation; later valid runs can differ
because the JSON contains observed timing fields.

The exact-release `2ab9584` packaged basic smoke also recorded browser requests. It observed exactly one
`POST /api/scene/analyze`, followed by `POST /api/quest/plan`, with no adaptation request or
unexpected POST destination. The earlier full fallback adaptation evidence additionally reached
`POST /api/quest/adapt`; do not merge the two scopes. Both are controlled fake-camera evidence, so
the real-camera network inspection remains pending.

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
MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ MOVEREALM_FULL_SMOKE=1 \
  MOVEREALM_EXPECT_COMMIT=2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52 \
  MOVEREALM_EXPECT_BUILD_ID=build-31682611174 npm run smoke:browser
```

These commands document how to reproduce each path. Cite the preserved command and result entries in
[`artifacts/validation/release-checks.md`](../artifacts/validation/release-checks.md); do not infer a
passing human/device measurement from the successful guided smoke.

## Consent-free guided screenshots

The release includes six 1440×913 guided-flow PNGs under
[`assets/submission/screenshots/`](../assets/submission/screenshots/): landing, room confirmation,
calibration, gameplay, adaptation, and postcard. They contain no participant or retained webcam
frame and are submission UI artifacts, not human/device evidence.

## Recorded synthetic fake-camera CodeBuddy UI evidence — 13 August 2026

This controlled browser flow used Chrome's synthetic fake-camera stream; it did not contain a
trackable or identifiable person. Health reported `codeBuddyConnected: true`, and the temporary
upload directory was empty after scene analysis.

| UI state | Visible provenance | Displayed source latency | Visible result |
|---|---|---:|---|
| Scene | `CodeBuddy live` | 34.826 s | conservative uncertain-room result |
| Adaptation | `CodeBuddy live` | 12.438 s | range 60 → 45%, tempo 0.90 → 0.70×, target rate 7 → 5 |

The displayed seconds are CodeBuddy request/source latencies, not camera-to-visual movement latency.
The two consent-free captures are:

| File | SHA-256 |
|---|---|
| [`07-live-codebuddy-scene.png`](../assets/submission/screenshots/07-live-codebuddy-scene.png) | `48e0e5f0fd8bd402f8550021b3ca338034414d7a9ad6acc2252ff0c68889fc4a` |
| [`08-live-codebuddy-adaptation.png`](../assets/submission/screenshots/08-live-codebuddy-adaptation.png) | `06c00b49384d72ee83f0ada2d8a476e486f7a189020ac5bf68ce28949dbfce40` |

This proves controlled agent connectivity, visible live provenance, adaptation output, and cleanup.
It does **not** establish real-person pose FPS, visible movement latency, TTFF, movement accuracy,
usability, or a participant result.

## Recorded current-source live-CodeBuddy room matrix — 13 August 2026

The sanitized
[`live-agent-room-matrix-2ab9584.json`](../artifacts/validation/live-agent-room-matrix-2ab9584.json)
preserves a fresh localhost controlled run from the current source. Health reported
`codeBuddyConnected: true`, fallback was disallowed, every scene and plan source was `codebuddy`,
all plans totalled exactly 180 seconds, and the local temporary-upload directory was empty. Its
SHA-256 is `e4dabc45278f5be9d177c1c8d1282337d432a5cba3cbe8ebdc4c7008bfb05787`.

| Fixture | Scene | Permitted directions | Plan signature | Scene latency | Plan latency |
|---|---|---|---|---:|---:|
| Open | `open` | vertical, left, right, center | reach 0.85, squat 0.80, side-step 0.90 | 12.686 s | 24.178 s |
| Tight | `tight` | vertical, center | reach 0.65, squat 0.75, reach 0.68 | 13.433 s | 26.180 s |
| Uncertain | `uncertain` | vertical, center | reach 0.55, squat 0.60, reach 0.62 | 15.060 s | 22.017 s |

The same run's tight-room adaptation used explicitly labelled synthetic keyboard telemetry: 4 of
12 targets, `too_hard`, pose confidence 0, and tracking FPS 0. The live `codebuddy` decision took
7.627 s and kept the next squat while changing range 0.75 → 0.55, tempo 0.78 → 0.62, and target
rate 7 → 5. This is controlled agent-contract evidence, not a human trial or pose-performance
measurement.

## Pending real-person and submission evidence

Record these only from the actual target laptop, a real webcam, and a consenting participant, or
from the finished submission artifact where specified.

| Check | Target | Observed | Status |
|---|---:|---:|---|
| Real-person pose processing | at least 20 FPS on M1 Pro | — | **pending human/device measurement** |
| Real-person visible response latency | under 100 ms | — | **pending human/device measurement** |
| Real-person time to first accepted movement (TTFF) | under 45 seconds | — | **pending timed human run** |
| Three-user qualitative trial | three completed observations | — | **pending all 3 user trials** |
| Camera-free backup video file | 3–5 minutes; overview, features, reflection, tip | 4:58.834; H.264/AAC; 1440×810 | **recorded local artifact** |
| Accepted video URL | accessible YouTube or Google Drive link | — | **pending upload and signed-out check** |

Follow the repeatable, consent-first procedure in
[`TRIAL_PROTOCOL.md`](TRIAL_PROTOCOL.md). The final postcard's local evidence exporter records
counted aggregate pose summaries, threshold states, director provenance, and exact build identity
without names, media, room text, paths, or raw landmarks. Use its FPS p05 and visible-response p95
only for a completed pose-mode run. The protocol provides a stopwatch fallback for TTFF and a
separately consented 60 FPS fallback for visible latency. Never transcribe a target or a keyboard
export as an observed real-person result.

## Privacy checks

| Check | Observation | Status |
|---|---|---|
| Browser camera frames produce no outbound requests | — | pending real-camera network inspection |
| Server temporary room still is removed after analysis | empty after all three controlled matrix runs and the synthetic fake-camera UI flow | recorded controlled evidence |
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

## Recorded camera-free backup video

[`moverealm-guided-backup.mp4`](../assets/submission/moverealm-guided-backup.mp4) is a 4:58.834
consent-free backup assembled from the verified guided UI, controlled fake-camera CodeBuddy
captures, and a code-rendered architecture slide. It is 1440×810 H.264 with mono AAC synthetic
narration. Audio analysis observed −16.4 LUFS integrated loudness and −1.0 dBFS true peak. Opening,
midpoint, architecture, and closing frames were visually inspected. Its SHA-256 is
`dd4d2ef14e7eed8217f45a520a056e895d098a74755d5e09c0ba9fcbe3951951`.

The opening and closing card explicitly says camera-free backup demo, synthetic narration, guided
keyboard controls, no person shown, and no human pose measurements claimed. The matching transcript
is [`moverealm-guided-backup-transcript.txt`](../assets/submission/moverealm-guided-backup-transcript.txt).
The official requirement still needs this file, or a preferred live-person take, uploaded to
YouTube or Google Drive and tested while signed out.
