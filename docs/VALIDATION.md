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

## Clean local candidate verification — 14 August 2026

Exact source: commit `cf157093ff3dab7b3598387d68973f82a3e364c2`, tree
`404fdc889cabc0212a6fd2197102eff7da5abde6`. The verification records were produced from a clean
tracked checkout. This candidate has not been pushed or deployed; the public site remains the
`7fe9009` deployed predecessor.

| Check | Observed | Evidence status |
|---|---|---|
| Complete automated test gate | `npm run test:all`: **120/120 Vitest tests across 15 files**, **13/13 Python recovery-agent tests**, **82/82 safety-probe tests** | recorded automated local-candidate evidence |
| Production build | strict client/server checks and Vite build passed | recorded automated local-candidate evidence |
| npm dependency audit | **0 vulnerabilities** | recorded automated local-candidate evidence |
| Clean Docker identity | `sha256:724a0e56188dc18e4d7419556a72084d5e0c9398674510a50c3c8177d80aaa57` (343,092,337 bytes); embedded commit/tree provenance matched | recorded packaged local-candidate evidence |
| Clean Docker health, index, and basic smoke | all passed | recorded packaged local-candidate evidence |
| Guided full browser smoke | production mode; local audit ID `build-20260814`; three mechanics; scores 0→145→290→435; adaptation 64→48%, 0.90→0.77×, 7→6; 2.6 min / 18% / `N/A`; no POSTs/errors | recorded automated local-candidate evidence; audit ID is not a CI run |
| Captured-room full fallback smoke | production mode; camera ready; exact scene/plan/adapt/adapt POSTs; scores to 435; `Safe fallback`; adaptation 60→44%, 0.90→0.77×, 7→6; 2.6 min / 18% / `N/A`; no errors | recorded synthetic-camera local-candidate evidence; audit ID is not a CI run |
| Python Qwen3-VL 4B recovery | unsafe original 18/24 in 43.492 s; eligible fallback 15/24 in 37.550 s; hard gates selected fallback | recorded controlled synthetic evidence |
| Safety Probe | 332 candidates: 302 defended, 30 honored, 0 breaches, 0 over-rejections, 0 inconclusive; 20/20 controls and 7/7 frontiers | recorded controlled synthetic evidence |
| Current CodeBuddy strict loop | **MIXED / NOT A LIVE PASS**: one strict tight-room CodeBuddy scene → plan → adapt loop succeeded; the next strict matrix collapsed all 3 rooms to one scene signature; later browser/fixture retries fell back at 45 s; explicit vision models timed out | recorded loop/recovery/instability evidence |

The Python recovery artifact SHA-256 is
`b41ebb3f61d652b60d68b4c8e9c01f0b91e43af52fb311dbbf9bd1dd9fa9d029`; both evaluations share
candidate-context SHA-256 `502824677434c6c6d0196d367ecdcfdde1f8aaa84138f1fe976858dce766fcfa`.
The Safety Probe report SHA-256 values are
`df2eebab3db2a4ea5b50ea4ecfbd17e633a66ffe8bf7e6d5374592a6be34a8e5` (JSON) and
`e484a6efb3c972d82c604048a0fae46d722fd6e076b3302c2d5134505cb428df` (Markdown).

`build-20260814` is a local audit build identifier, not a GitHub Actions run. The guided export is
[`local-guided-keyboard-session-cf15709.json`](../artifacts/validation/local-guided-keyboard-session-cf15709.json),
SHA-256 `aebcf7c43158672e1d4bc486f7f71c7cb56116df3256dcb4592fab1a5deed3aa`. The captured fallback
export is
[`local-captured-fallback-keyboard-session-cf15709.json`](../artifacts/validation/local-captured-fallback-keyboard-session-cf15709.json),
SHA-256 `ebaa8c4cb97ef91e79c72a81f9f356beaeae04bb89c52bf98cf5e60232cc5b8d`. Both embed the exact
candidate commit and audit build, set personal/media privacy fields false, and leave pose FPS,
inference, visible latency, and TTFF thresholds `not_evaluated` because controls were keyboard-based.

The current CodeBuddy result still means no local-candidate live-agent pass may be claimed. The
structured loop generated one valid tight-room scene, 180-second plan, and grounded adaptation, but
was not repeatable: the next matrix failed room differentiation and later retries fell back safely.
Retry before recording or explicitly use the `Safe fallback` disclosure. The newest privacy-safe
record is [`codebuddy-current-vision-instability-2026-08-14.json`](../artifacts/validation/codebuddy-current-vision-instability-2026-08-14.json),
SHA-256 `6acfa59a47552c0b0c0334c4c9c627949ae4c65aa09d1eeeaa8064864d283fda`.

## Deployed predecessor verification — 13 August 2026

| Check | Observed | Evidence status |
|---|---|---|
| Vitest suite | 13 files, **100/100 tests passed** in CI and locally | recorded automated evidence |
| Production build | strict client/server checks and Vite build passed | recorded in Pages run 31714506917 |
| npm dependency audit | **0 vulnerabilities** | recorded automated evidence |
| GitHub Pages deployment | successful for release commit `7fe9009728d545798c1b5efd7b367d4f54264eaf` | recorded in Pages run 31714506917 |
| Deployed build identity | `build-31714506917`; commit matched the release SHA | recorded automated release evidence |
| Public guided demo | <https://ming3465.github.io/MoveRealm/> returned HTTP 200 | recorded deployment check |
| Source repository | <https://github.com/ming3465/MoveRealm> | recorded release location |
| Exact-release public camera basic smoke | fake camera; `cameraReady: true`; score 0→145; API POSTs `[]`; no console errors | recorded automated release evidence |
| Exact-release public full smoke and anonymous export | scores 0→145→290→435; checksum and exact identity matched; pose gates `not_evaluated` | recorded automated release evidence |
| Predecessor public full smoke and anonymous export | passed against `2ab9584` / run 31682611174; checksum and exact identity matched; pose gates `not_evaluated` | recorded predecessor automated evidence |
| Predecessor Docker captured-room basic path | `2ab9584` image; forced-fallback health true/CodeBuddy false; camera ready; `Safe fallback`; score 0→145 | recorded predecessor automated evidence |
| Predecessor Docker basic request audit | one still POST; only scene and plan POSTs | recorded predecessor automated evidence |
| Earlier Docker full fallback adaptation | passed with `Safe fallback`; not rerun for the deployed `7fe9009` release | recorded predecessor automated evidence |
| Offline Shadow Judge | hard gates overrode a positive advisory score for an unsafe uncertain-room plan | recorded controlled synthetic evaluation |
| Guided screenshot set | 6 consent-free PNGs | recorded submission artifacts |
| Synthetic fake-camera CodeBuddy UI set | 2 consent-free PNGs; live source badges and upload cleanup recorded | recorded controlled evidence |

[GitHub Pages run 31714506917](https://github.com/ming3465/MoveRealm/actions/runs/31714506917)
completed `npm ci`, all 100 tests across 13 files, `npm run build`, artifact upload, and deployment
successfully for release commit
[`7fe9009`](https://github.com/ming3465/MoveRealm/commit/7fe9009728d545798c1b5efd7b367d4f54264eaf).
CI injected build ID `build-31714506917` and the full commit SHA into the client. The release command
and result record belongs in
[`artifacts/validation/release-checks.md`](../artifacts/validation/release-checks.md).

The Pages workflow excludes docs-only changes under `docs/**`, `artifacts/**`, `README.md`, and
`assets/README.md` from its push trigger. This documentation follow-up does not imply a newer
application deployment; run 31714506917 remains the exact application release.

The deployed predecessor retains the evidence-integrity checks introduced in `2ab9584` around the local
exporter:

- anonymous trial IDs are limited to `trial-1`, `trial-2`, and `trial-3`;
- a numeric `build-N` ID and exact 40-character commit SHA must be present together or both absent;
- each round's completion rate must agree with target counts, and total counts must agree with all
  round records;
- every adaptation and its full next-round parameters must agree with the validated final plan;
- the reported plan/adaptation latency total must agree with its provenance records; and
- the UI prevents duplicate downloads, clamps the trial input to 1–3, removes its temporary anchor,
  delays object-URL cleanup, and presents sanitized success, hash-unavailable, or failure status.

These are automated integrity controls covered by the deployed predecessor's 100-test suite. They do not complete a
human trial or measure pose performance.

## Recorded automated browser evidence — 13 August 2026

Environment: Apple M1 Pro, Chrome 151, and Node 24.12.

The synthetic-camera browser smoke reached MediaPipe Worker readiness, safety confirmation,
calibration, Phaser gameplay, keyboard scoring, pause, and resume without an application error.
Chrome's fake stream does not contain a trackable person, so this evidence does **not** establish
real-person pose FPS, camera-to-visual response latency, movement accuracy, time to first movement,
or usability.

The deployed `7fe9009` public application passed an exact-release camera basic smoke as a separate
deployed-site observation, not a CI browser job. Chrome's fake camera reached `cameraReady: true`,
the first score advanced 0 → 145, the request audit recorded API POSTs `[]`, and no console errors
occurred. Because the stream was synthetic, this does not close any real-person camera gate.

No Docker run was performed for `7fe9009`. The Docker image tagged `moverealm:2ab9584` is
predecessor evidence:
`sha256:a205205819345589179d079656e0afefb38887b8b460a2c00d942dc0a11e47b6` (343,057,128 bytes)
and embeds predecessor commit `2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52` / build
`build-31682611174`.
In forced-fallback mode, health reported true with CodeBuddy disconnected. Its controlled
fake-camera basic path reached camera readiness, preserved safe defaults, showed `Safe fallback`,
scored 0 → 145, sent exactly scene and plan POSTs, left the temporary-upload directory empty, and
the container was stopped and its port freed after stop escalation. Exit 137 means this is not
recorded as a graceful stop. The earlier packaged full fallback adaptation also remains predecessor
evidence. Those older Docker scopes were not rerun for `7fe9009`; the clean local candidate has the
separate packaged evidence recorded above.

The exact-release full browser smoke also passed against commit
`7fe9009728d545798c1b5efd7b367d4f54264eaf`, Pages run 31714506917, and build
`build-31714506917`. Scores advanced 0 → 145 → 290 → 435. The visible `Guided demo`
adaptation changed range 64 → 48%, tempo 0.90 → 0.77×, and target rate 7 → 6. The postcard
displayed 2.6 active minutes, 18% completion, and tracking `N/A`; the request audit recorded API
POSTs `[]`; and no console errors occurred.

That smoke downloaded anonymous keyboard evidence. The privacy-reviewed copy is preserved as
[`public-guided-keyboard-session-7fe9009.json`](../artifacts/validation/public-guided-keyboard-session-7fe9009.json).
Its SHA-256 `5a3da763a925d02c4152cd305587c3d60e20bb261e354f6372b59fb797ba4620`
matched the preserved file, and its product identity exactly matched the deployed predecessor commit and
build. The export records three rounds, two adaptations, 156 completed active seconds within the
planned 180-second adventure, and keyboard tracking. Tracking FPS, inference, and visible-response
values are `null`/`N/A`; the FPS, inference, visible-latency, and TTFF gates are `not_evaluated`.
Its 3.803-second first movement was keyboard input, so it is not evidence for the pending real-person
TTFF gate.

The earlier full smoke/export remains preserved as predecessor evidence at
[`public-guided-keyboard-session-2ab9584.json`](../artifacts/validation/public-guided-keyboard-session-2ab9584.json)
with checksum `00458af188807b5e2e49df994ac1581ff27608d9d1628f60d4df11158c2ef8b7`.

The predecessor `2ab9584` packaged basic smoke also recorded browser requests. It observed exactly one
`POST /api/scene/analyze`, followed by `POST /api/quest/plan`, with no adaptation request or
unexpected POST destination. The earlier full fallback adaptation evidence additionally reached
`POST /api/quest/adapt`; do not merge the two scopes. Both are controlled fake-camera evidence, so
the real-camera network inspection remains pending.

The deployed-predecessor full guided-smoke oracle checks the result card's time accounting:

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
MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ MOVEREALM_CAMERA_SMOKE=1 \
  MOVEREALM_EXPECT_COMMIT=7fe9009728d545798c1b5efd7b367d4f54264eaf \
  MOVEREALM_EXPECT_BUILD_ID=build-31714506917 npm run smoke:browser
MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ MOVEREALM_FULL_SMOKE=1 \
  MOVEREALM_EXPECT_COMMIT=7fe9009728d545798c1b5efd7b367d4f54264eaf \
  MOVEREALM_EXPECT_BUILD_ID=build-31714506917 npm run smoke:browser
```

These commands document how to reproduce each path. Cite the preserved command and result entries in
[`artifacts/validation/release-checks.md`](../artifacts/validation/release-checks.md); do not infer a
passing human/device measurement from either synthetic-camera or guided smoke evidence.

## Consent-free guided screenshots

The release includes six 1440×913 guided-flow PNGs under
[`assets/submission/screenshots/`](../assets/submission/screenshots/): landing, room confirmation,
calibration, gameplay, adaptation, and postcard. They contain no participant or retained webcam
frame and are submission UI artifacts, not human/device evidence.

## Preserved predecessor synthetic-camera CodeBuddy UI evidence — 13 August 2026

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

## Preserved predecessor live-CodeBuddy room matrix — 13 August 2026

The sanitized
[`live-agent-room-matrix-2ab9584.json`](../artifacts/validation/live-agent-room-matrix-2ab9584.json)
preserves a localhost controlled observation from predecessor release `2ab9584`. Health reported
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

## Recorded offline Shadow Judge — controlled synthetic evaluation

CodeBuddy remains the only runtime Movement Director. The optional local Shadow Judge runs after
deterministic fixture, contract, consistency, and movement-feasibility gates over frozen synthetic
inputs; it cannot approve, rewrite, block, or execute a quest. The final reports were each regenerated
in one evaluator invocation with the unchanged model digest. Open passed hard gates and scored 24/24
in 93.790 seconds; tight passed and scored 36/36 in 110.697 seconds. The original uncertain-room plan
received a positive 19/24 advisory score in 79.390 seconds, but its authoritative hard gates failed
and `eligible` was false because it included a squat despite an occluded floor. The corrected
reach-only fallback passed, was eligible, and scored 24/24 in 73.674 seconds.

These results are synthetic, advisory, and local. They are not runtime output, safety certification,
model accuracy, official judging, or human-trial evidence. The artifacts contain no participant
media, webcam stream, landmarks, identity, or health inference. See
[`EVALUATION.md`](EVALUATION.md) for the fixed model settings, reproduction commands, hard-gate
definitions, recorded scores, and limitations.

The 8B open/tight reports are frozen predecessor `7fe9009` evaluator snapshots. Their predecessor
candidate JSON does not pass the newer `cf15709` canonical-presentation gates, so these scores are
not current-candidate pass evidence. Current candidate evidence is limited to the new tests/probe,
Python uncertain-room recovery, and full browser smokes recorded above; the current live three-room
matrix was attempted and failed its differentiation gate.

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
| Local-candidate push and deployment | publish the current local branch, whose application source is checkpoint `cf157093ff3dab7b3598387d68973f82a3e364c2`, and verify the resulting public build plus pushed branch HEAD | — | **pending explicit authorization and deployment** |
| Team members and registered contact | completed portal fields | — | **pending user input** |

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
