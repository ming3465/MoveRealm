# MoveRealm release checks

Recorded on 13–14 August 2026 in Asia/Singapore. This file separates automated and controlled
observations from the real-person and submission work that is still pending.

## Current release identity — 14 August 2026

- Clean release checkpoint: `49dadbee7bf106b9434cae5a992d456d3cac1433`
- Release tree: `cb5f6e024784156864c8fc4acf7af7673c3f49d4`
- Source state for recorded candidate gates: clean tracked checkout
- Release application commit: `49dadbee7bf106b9434cae5a992d456d3cac1433`
- Application build ID: `build-31764155833`
- Pages workflow: [run 31764155833](https://github.com/ming3465/MoveRealm/actions/runs/31764155833),
  **success**
- Push/public verification: **PASS** — `origin/main`, HTTP 200, exact public camera smoke, and exact
  public full-session smoke all matched the release identity.
- Docker image:
  `sha256:4119e32ef7f0145daa53a6669259fe0cbf81324b682689651cdc97003d3c7c15`
  (343,108,191 bytes), built with exact commit `49dadbe` and local audit build
  `build-20260814`. This build ID is **not** a GitHub Actions run or public deployment ID.

## Previous deployed identity — 13 August 2026

- Application source commit: `7fe9009728d545798c1b5efd7b367d4f54264eaf`
- Application build ID: `build-31714506917`
- Public URL: <https://ming3465.github.io/MoveRealm/>
- Source URL: <https://github.com/ming3465/MoveRealm>
- Pages workflow: [run 31714506917](https://github.com/ming3465/MoveRealm/actions/runs/31714506917)
- Workflow result: `success`; `npm ci`, tests, build, Pages configuration, artifact upload, and
  deployment all completed successfully.
- Earlier packaged-adapter Docker evidence (**predecessor `2ab9584` only**):
  `sha256:a205205819345589179d079656e0afefb38887b8b460a2c00d942dc0a11e47b6`
  (343,057,128 bytes), tag `moverealm:2ab9584`, built with predecessor build/commit arguments. No
  Docker run was performed for `7fe9009`; this image does not carry the deployed predecessor identity.

The Pages workflow ignores pushes limited to `docs/**`, `artifacts/**`, `README.md`, and
`assets/README.md`. This documentation-only follow-up therefore does not redeploy the app or create
a newer release identity. Run 31764155833 remains the exact application deployment unless a
source-bearing path changes or the workflow is manually dispatched.

## Environment

- MacBook Pro `MacBookPro18,3`, Apple M1 Pro, 16 GB memory
- macOS 26.5 (`25F71`)
- Google Chrome 151.0.7922.137
- Node.js 24.12.0; npm 11.9.0

## Implementation-checkpoint gates

| Check | Command or source | Observed result |
|---|---|---|
| Complete automated tests | `npm run test:all` | **PASS** — 128/128 Vitest tests across 16 files; 13/13 Python recovery-agent tests; 82/82 Python safety-probe tests |
| Strict client/server typecheck and production bundle | `npm run build` | **PASS** |
| Dependency audit | `npm audit --audit-level=low` | **PASS** — 0 vulnerabilities |
| Submission-document local links | resolve local Markdown targets | **PASS** — 13 Markdown files / 174 local links / 0 missing |
| Documentation diff hygiene | `git diff --check` | **PASS** |
| Exact Docker provenance | inspect packaged client and image metadata | **PASS** — commit `49dadbe…`, build `build-20260814`, and expected image digest matched |
| Docker health | packaged adapter health endpoint before and after smoke | **PASS** — fallback healthy; CodeBuddy false as forced |
| Docker captured-room basic smoke and cleanup | packaged release, fake camera, forced fallback | **PASS** — safe defaults; score 0→145; exact scene/plan POSTs; zero retained uploads; stop escalated to exit 137 |
| Predecessor guided full browser smoke | production mode; local audit build `build-20260814`; source `cf15709` | **PASS** — reach/squat/side-step; scores 0→145→290→435; `Guided demo` adaptation 64→48%, 0.90→0.77×, 7→6; postcard 2.6 min / 18% / `N/A`; API POSTs `[]`; no errors |
| Predecessor captured-room full fallback smoke | production mode; fake camera; local audit build `build-20260814`; source `cf15709` | **PASS** — camera ready; exact scene/plan/adapt/adapt POSTs; all rounds to score 435; `Safe fallback`; adaptation 60→44%, 0.90→0.77×, 7→6; postcard 2.6 min / 18% / `N/A`; no errors |
| Python recovery artifact | controlled Qwen3-VL 4B run | **PASS** — hard gates rejected the 18/24 original (43.492 s) and selected the eligible 15/24 fallback (37.550 s) |
| Adversarial Safety Probe | clean contract mode | **PASS** — 332 probes: 302 defended, 30 honored, 0 breaches, 0 over-rejections, 0 inconclusive; 20 controls; 7 frontiers |
| Free local CodeBuddy/Qwen3-VL 4B strict matrix | isolated localhost service; fallback forbidden | **PASS** — open/tight/uncertain produced three materially different safe 180-second plans; adaptation reduced range/tempo/rate; uploads empty |
| Free local CodeBuddy browser adaptation | fake camera plus production UI | **PASS** — visible `CodeBuddy live` scene/adaptation, exact scene/plan/adapt POSTs, camera ready, score 0→145, no errors |

The Python artifact SHA-256 is
`b41ebb3f61d652b60d68b4c8e9c01f0b91e43af52fb311dbbf9bd1dd9fa9d029`; it records shared
candidate-context SHA-256 `502824677434c6c6d0196d367ecdcfdde1f8aaa84138f1fe976858dce766fcfa`.
The Safety Probe report SHA-256 values are
`099383377d19483a10256ad5a9bef7789be06d02dad2395dfe5a48275e484bdd` (JSON) and
`a0b17057adb890a0e0f6b51d8f96959642c1c8d04e440e97611eab909c0dd164` (Markdown). The frozen report
was produced from clean source commit `4df7cd03114a47e059bc5f03bdb98af3a8f21385`.
The newest sanitized CodeBuddy observation is
[`codebuddy-current-vision-instability-2026-08-14.json`](codebuddy-current-vision-instability-2026-08-14.json),
SHA-256 `6acfa59a47552c0b0c0334c4c9c627949ae4c65aa09d1eeeaa8064864d283fda`.
It records the one strict pass and the subsequent matrix/browser/model failures without raw prompts,
responses, paths, images, credentials, or participant data. The earlier sanitized 429 blocker is
[`codebuddy-upstream-blocker-2026-08-14.json`](codebuddy-upstream-blocker-2026-08-14.json), SHA-256
`961f9ad01e1932d2f93b53d0e3c593cce97b290169c10f195bc757df0d6319a9`. It records that the
availability observation occurred before the source was frozen and while the worktree was dirty;
the application source was subsequently frozen as `cf15709`. It is not clean-source live-pass
evidence.

The current local-model evidence is
[`codebuddy-local-qwen-matrix-de0b2de.json`](codebuddy-local-qwen-matrix-de0b2de.json), SHA-256
`75ce775069d32867d2e7dc6d56fa4030d3bd3e0f13409eef9c64217ba807bf35`, and
[`codebuddy-local-ui-adaptation-de0b2de.json`](codebuddy-local-ui-adaptation-de0b2de.json), SHA-256
`a83a93d33ce203eccd750a39ca0985af897cf6aee4c10200c07640929b593cba`. The first records clean
source/tree provenance, exact local model-manifest digests, three distinct safe plans, a grounded
adaptation, and zero retained uploads. The second records the visible controlled UI path. Neither
contains room image bytes, raw model output, credentials, participant data, or real-person pose
measurements.

The two privacy-reviewed local browser exports are:

- [`local-guided-keyboard-session-cf15709.json`](local-guided-keyboard-session-cf15709.json),
  SHA-256 `aebcf7c43158672e1d4bc486f7f71c7cb56116df3256dcb4592fab1a5deed3aa`;
- [`local-captured-fallback-keyboard-session-cf15709.json`](local-captured-fallback-keyboard-session-cf15709.json),
  SHA-256 `ebaa8c4cb97ef91e79c72a81f9f356beaeae04bb89c52bf98cf5e60232cc5b8d`.

Both embed exact commit `cf157093ff3dab7b3598387d68973f82a3e364c2` and local audit build
`build-20260814`, set personal identifiers, images/video, raw landmarks, room stills, and upload paths
to false, and leave keyboard pose metrics `null` with human/device thresholds `not_evaluated`.

## Current public release gates

| Check | Command or source | Observed result |
|---|---|---|
| Complete automated tests | `npm run test:all` | **PASS** — 128/128 Vitest, 13/13 Python recovery-agent, 82/82 safety-probe tests in CI and locally |
| Strict client/server typecheck and production bundle | `npm run build` | **PASS** |
| Dependency audit | `npm audit --audit-level=low` | **PASS** — 0 vulnerabilities |
| Local Markdown links | resolve every local Markdown target | **PASS** — 13 files / 174 local links / 0 missing |
| Tracked secret-pattern scan | common cloud token, private-key, API-key, and CodeBuddy-password patterns | **PASS** — no tracked match |
| CI deployment | Pages run 31764155833 | **PASS** — exact commit and build identity injected into client |
| Public HTTP check | `curl -fsS https://ming3465.github.io/MoveRealm/` | **PASS** — HTTP 200 |
| Exact-release public camera/full smoke | public URL, expected commit/build, Chrome fake camera, real configured clock | **PASS** — camera ready; pause/focus containment; all three mechanics; score 435; `Guided demo` adaptation; postcard/export/replay/stop; API POSTs `[]`; no console errors |
| Predecessor packaged captured-room basic path | `2ab9584` Docker image on port 4176 plus camera/capture/fallback smoke | **PASS** — health true/CodeBuddy false; camera ready; safe defaults; `Safe fallback`; score 0→145 |
| Predecessor packaged basic request audit | `2ab9584` Docker captured-room smoke with CDP network events | **PASS** — only `/api/scene/analyze` and `/api/quest/plan`; one still upload; no unexpected POST destination |
| Predecessor packaged upload cleanup | inspect Node temporary still directory after the `2ab9584` capture smoke | **PASS** — empty; container stopped and port freed after stop escalation (exit 137, not a graceful stop) |
| Earlier packaged full fallback adaptation | predecessor Docker URL plus capture, adaptation, and expected-fallback flags | **PASS** — `Safe fallback`; range 60→44%, tempo 0.90→0.77×, rate 7→6; not rerun for `7fe9009` |

The predecessor Docker smokes and request audits used Chrome's fake camera and keyboard controls.
The implementation-checkpoint Docker image recorded above is current source evidence for the basic
captured-room/fallback package path. The older `2ab9584` Docker scopes in this table remain
predecessor-only. These controlled checks are not real-person tracking evidence or a replacement
for the pending real-camera network inspection.

## Evidence-integrity hardening

The current release retains the automated validation and UI safeguards
introduced in `2ab9584` for local anonymous evidence:

- trial IDs are restricted to `trial-1`, `trial-2`, and `trial-3`;
- an exact 40-character commit SHA and numeric `build-N` provenance pair must both be present or both
  absent;
- aggregate target counts and completion rate must agree with all three round records;
- each adaptation, including its complete next-round parameters, must agree with the validated final
  plan;
- reported plan/adaptation latency totals must agree with their provenance records; and
- the download UI prevents duplicate activation, clamps trial input to 1–3, attaches and removes its
  temporary anchor, delays object-URL revocation, and reports sanitized success, hash-unavailable, or
  failure status.

The previous release's 100-test suite and the current 128-test Vitest layer cover these integrity
boundaries. They validate exported records; they do not complete any of the pending human trials or
measure real-person performance.

## Offline Shadow Judge

CodeBuddy remains the only runtime Movement Director. The optional local Shadow Judge runs only
over frozen synthetic inputs, after deterministic fixture, contract, consistency, and
movement-feasibility gates. It cannot approve, rewrite, block, or execute a quest.

The final Qwen3-VL reports were each regenerated in one evaluator invocation with the same recorded
model digest. Open passed and scored 24/24 (93.790 s); tight passed and scored 36/36 (110.697 s).
The original uncertain-room plan scored an advisory 19/24 (79.390 s), but the authoritative hard
gate failed and `eligible` was false because the plan included a squat on an occluded floor. The
corrected reach-only fallback passed, was eligible, and scored 24/24 (73.674 s). This controlled
disagreement is evidence for keeping the model advisory, not runtime output, safety certification,
accuracy, official judging, or human evidence.
The synthetic record contains no participant media, webcam stream, landmarks, identity, or health
inference. See [`docs/EVALUATION.md`](../../docs/EVALUATION.md).

Those 8B open/tight reports are frozen predecessor `7fe9009` evaluator snapshots. Their candidate
JSON does not pass the newer canonical-presentation gates and is not current-candidate pass
evidence. The clean candidate is supported by the current tests/probe, Python uncertain-room
recovery, plus the current local 4B strict matrix and browser adaptation records above. The earlier
signed-in/upstream mixed observation remains recovery evidence only.

An ephemeral current-source compatibility check reconstructed open/tight/uncertain candidates from
the preserved matrix into `/tmp` and ran `npm run eval -- --judge none`; all three deterministic
gates passed and were eligible (input SHA-256 prefixes `d6f66a09`, `5a0af7f7`, `437e0860`). No new
artifact or 8B model report was frozen, and this is not fresh live CodeBuddy evidence.

## Current full guided session

The full public smoke runs the real configured clock; it does not accelerate rounds or rests. This
was a separate deployed-site observation, not a browser step in CI. The exact-release command was:

```bash
MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ MOVEREALM_CAMERA_SMOKE=1 \
  MOVEREALM_FULL_SMOKE=1 \
  MOVEREALM_EXPECT_COMMIT=49dadbee7bf106b9434cae5a992d456d3cac1433 \
  MOVEREALM_EXPECT_BUILD_ID=build-31764155833 npm run smoke:browser
```

It exited 0 against commit `49dadbee7bf106b9434cae5a992d456d3cac1433`, Pages run 31764155833,
and build `build-31764155833`, then passed:

- round scores: 0→145, 145→290, 290→435;
- all three mechanics: reach, squat, side-step;
- visible `Guided demo` adaptation: range 64→48%, tempo 0.90→0.77×, target rate 7→6;
- postcard 2.6 active minutes, 18% completion, a 3.0-minute adventure clock, and tracking FPS `N/A`
  in keyboard mode;
- anonymous local evidence file `moverealm-trial-1-session.json` downloaded successfully and its
  privacy-reviewed copy is preserved as
  [`public-guided-keyboard-session-49dadbe.json`](public-guided-keyboard-session-49dadbe.json);
- downloaded SHA-256 `f003b7eb3015f426125725237c90dccd2128198ba599f069fcaec0f7e3e78c93`
  exactly matched the checksum visible in the UI and the preserved file; it identifies this one
  observation, while later runs can differ because the JSON contains observed timing fields;
- export identity exactly matched commit `49dadbee7bf106b9434cae5a992d456d3cac1433` and build
  `build-31764155833`;
- the export recorded keyboard tracking, `null`/`N/A` tracking FPS, inference, and visible-response
  values, with FPS, inference, visible-latency, and TTFF thresholds `not_evaluated`;
- all three rounds and both adaptation decisions were present in the export;
- browser request audit reported API POSTs `[]` for the public guided flow;
- no runtime or browser-console error occurred.

This keyboard evidence proves the exporter, checksum, identity, round/adaptation record, and N/A
semantics. It does not measure or pass real-person FPS, visible latency, or TTFF. The repeatable
consent and evidence procedure is in
[`docs/TRIAL_PROTOCOL.md`](../../docs/TRIAL_PROTOCOL.md); all three human trials remain pending.

## Predecessor controlled live CodeBuddy UI

The local production adapter reported:

```json
{"ok":true,"product":"MoveRealm","movementDirector":"codebuddy","codeBuddyConnected":true}
```

With Chrome's fake camera and keyboard controls, the end-to-end UI then passed:

- room analysis badge: `CodeBuddy live`, 34,826 ms;
- floor confirmation default: unchecked; continue disabled;
- first-round score: 0→145;
- adaptation badge: `CodeBuddy live`, 12,438 ms;
- visible adaptation: range 60→45%, tempo 0.90→0.70×, rate 7→5;
- temporary room-still directory: empty after analysis.

The client boundary was also rerun after the asynchronous validation repair. A second independent
controlled run passed with `CodeBuddy live` at scene and adaptation, including conservative output;
its variable service latencies were 32,496 ms and 7,480 ms. The release values above remain tied to
the preserved screenshots rather than being averaged.

This establishes live service connectivity, source provenance, safe adaptation, and cleanup in a
controlled non-human flow. It does not establish real-person pose FPS, movement-to-visual latency,
time to first movement, accuracy, or usability.

## Predecessor sanitized room matrix

The controlled localhost artifact from predecessor release `2ab9584`
[`live-agent-room-matrix-2ab9584.json`](live-agent-room-matrix-2ab9584.json) recorded health
`codeBuddyConnected: true`, disallowed fallback, and returned materially different room profiles and
validated 180-second plans. Every scene and plan source was `codebuddy`; the temporary-upload
directory was empty afterward. The file's SHA-256 is
`e4dabc45278f5be9d177c1c8d1282337d432a5cba3cbe8ebdc4c7008bfb05787`.

| Fixture | Scene | Plan signature | Scene latency | Plan latency |
|---|---|---|---:|---:|
| Open | `open` | reach 0.85, squat 0.80, side-step 0.90 | 12.686 s | 24.178 s |
| Tight | `tight` | reach 0.65, squat 0.75, reach 0.68 | 13.433 s | 26.180 s |
| Uncertain | `uncertain` | reach 0.55, squat 0.60, reach 0.62 | 15.060 s | 22.017 s |

The tight-room live adaptation took 7.627 s and changed range 0.75→0.55, tempo 0.78→0.62, and
rate 7→5 while keeping the next squat. Its inputs were explicitly synthetic keyboard telemetry
(4/12 targets, `too_hard`, pose confidence 0, tracking FPS 0), not a human measurement.

## Screenshot evidence

- `assets/submission/screenshots/01-landing.png` through `06-postcard.png`: consent-free guided UI.
- `07-live-codebuddy-scene.png`: controlled fake-camera `CodeBuddy live` room result,
  SHA-256 `48e0e5f0fd8bd402f8550021b3ca338034414d7a9ad6acc2252ff0c68889fc4a`.
- `08-live-codebuddy-adaptation.png`: controlled fake-camera `CodeBuddy live` adaptation,
  SHA-256 `06c00b49384d72ee83f0ada2d8a476e486f7a189020ac5bf68ce28949dbfce40`.

## Explicitly not closed by these checks

- real-person pose throughput target of at least 20 FPS on the M1 Pro;
- real-person camera-to-visible-response target below 100 ms;
- real-person time to first accepted movement target below 45 seconds;
- browser network inspection during a real-person camera session;
- three consenting user trials;
- accepted YouTube or Google Drive upload URL for the completed 4:58.834 local backup (or a
  preferred live-person recording);
- participant consent for any retained real-person media;
- team members, registered contact email, and every still-unconfirmed portal field.

Do not replace these pending fields with fake-camera, keyboard, fixture, target, or estimated values.

## Camera-free backup video

- File: `assets/submission/moverealm-guided-backup.mp4`
- Duration: 298.833696 seconds (4:58.834), inside the official 3–5 minute range
- Video: H.264, 1440×810
- Audio: mono AAC at 22,050 Hz; synthetic Samantha narration
- Loudness: −16.4 LUFS integrated; −1.0 dBFS true peak
- SHA-256: `dd4d2ef14e7eed8217f45a520a056e895d098a74755d5e09c0ba9fcbe3951951`
- Transcript SHA-256: `3ecedf106de903f9c552a4042a7c1a77e7514338a37d2c2bf3287fc2ffe3c20a`

Opening, live-scene, live-adaptation, architecture, and closing frames were visually inspected. The
opening/closing card bakes in the camera-free, synthetic-narration, keyboard-control, and no-human-
measurement disclosures. The narration covers overview, core features, build approach, and one
CodeBuddy structured-output development tip. The official portal still requires a user-owned
YouTube or Google Drive link and a signed-out accessibility check.
