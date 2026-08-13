# MoveRealm release checks

Recorded on 13 August 2026 in Asia/Singapore. This file separates automated and controlled
observations from the real-person and submission work that is still pending.

## Release identity

- Application source commit: `2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52`
- Application build ID: `build-31682611174`
- Public URL: <https://ming3465.github.io/MoveRealm/>
- Source URL: <https://github.com/ming3465/MoveRealm>
- Pages workflow: [run 31682611174](https://github.com/ming3465/MoveRealm/actions/runs/31682611174)
- Workflow result: `success`; `npm ci`, tests, build, Pages configuration, artifact upload, and
  deployment all completed successfully.
- Exact-release packaged-adapter Docker image ID:
  `sha256:a205205819345589179d079656e0afefb38887b8b460a2c00d942dc0a11e47b6`
  (343,057,128 bytes), tag `moverealm:2ab9584`, built with release build/commit arguments. This image
  is separate from the static Pages artifact but carries the same exact application identity.

The Pages workflow ignores pushes limited to `docs/**`, `artifacts/**`, `README.md`, and
`assets/README.md`. This documentation-only follow-up therefore does not redeploy the app or create
a newer release identity. Run 31682611174 remains the exact application deployment unless a
source-bearing path changes or the workflow is manually dispatched.

## Environment

- MacBook Pro `MacBookPro18,3`, Apple M1 Pro, 16 GB memory
- macOS 26.5 (`25F71`)
- Google Chrome 151.0.7922.137
- Node.js 24.12.0; npm 11.9.0

## Automated release gates

| Check | Command or source | Observed result |
|---|---|---|
| Unit, contract, adapter, and boundary tests | `npm test` | **PASS** — 75/75 tests across 10 files in CI and locally |
| Strict client/server typecheck and production bundle | `npm run build` | **PASS** |
| Dependency audit | `npm audit --audit-level=low` | **PASS** — 0 vulnerabilities |
| Local Markdown links | resolve every local Markdown target | **PASS** — 9 files / 90 local links checked |
| Tracked secret-pattern scan | common cloud token, private-key, API-key, and CodeBuddy-password patterns | **PASS** — no tracked match |
| CI deployment | Pages run 31682611174 | **PASS** — commit and build identity injected into client |
| Public HTTP check | `curl -fsS https://ming3465.github.io/MoveRealm/` | **PASS** — HTTP 200 |
| Public basic browser smoke | `MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ npm run smoke:browser` | **PASS** — keyboard entry, opt-in floor gate, calibration, scoring, pause/resume; no console errors |
| Exact-release public full-smoke adaptation step | full browser smoke against expected commit/build | **PASS** — `Guided demo`; range 64→48%, tempo 0.90→0.77×, rate 7→6 |
| Exact-release packaged captured-room basic path | Docker image on port 4176 plus camera/capture/fallback smoke | **PASS** — health true/CodeBuddy false; camera ready; safe defaults; `Safe fallback`; score 0→145 |
| Exact-release packaged basic request audit | current Docker captured-room smoke with CDP network events | **PASS** — only `/api/scene/analyze` and `/api/quest/plan`; one still upload; no unexpected POST destination |
| Exact-release packaged upload cleanup | inspect Node temporary still directory after current capture smoke | **PASS** — empty; container stopped and port freed after stop escalation (exit 137, not a graceful stop) |
| Earlier packaged full fallback adaptation | prior Docker URL plus capture, adaptation, and expected-fallback flags | **PASS** — `Safe fallback`; range 60→44%, tempo 0.90→0.77×, rate 7→6; not rerun as a full path in the current image |

The Docker smokes and request audits used Chrome's fake camera and keyboard controls. The exact
release image was rerun only through the basic captured-room scene/plan path, so it must not be cited
as a current-image full adaptation run. These controlled checks are not real-person tracking
evidence or a replacement for the pending real-camera network inspection.

## Evidence-integrity hardening

Release `2ab9584` adds automated validation and UI safeguards for local anonymous evidence:

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

The 75-test suite covers these integrity boundaries. They validate exported records; they do not
complete any of the pending human trials or measure real-person performance.

## Full guided session

The full public smoke runs the real configured clock; it does not accelerate rounds or rests. This
was a separate deployed-site observation, not a browser step in CI. The exact-release command was:

```bash
MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ MOVEREALM_FULL_SMOKE=1 \
  MOVEREALM_EXPECT_COMMIT=2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52 \
  MOVEREALM_EXPECT_BUILD_ID=build-31682611174 npm run smoke:browser
```

It exited 0 against commit `2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52`, Pages run 31682611174,
and build `build-31682611174`, then passed:

- round scores: 0→145, 145→290, 290→435;
- all three mechanics: reach, squat, side-step;
- visible `Guided demo` adaptation: range 64→48%, tempo 0.90→0.77×, target rate 7→6;
- postcard title `Glowgarden Awakening`, 2.6 active minutes, 18% completion, a 3.0-minute adventure
  clock, and tracking FPS `N/A` in keyboard mode;
- first movement 3.7 seconds after session entry via keyboard, not a human TTFF measurement;
- anonymous local evidence file `moverealm-trial-1-session.json` downloaded successfully and its
  privacy-reviewed copy is preserved as
  [`public-guided-keyboard-session-2ab9584.json`](public-guided-keyboard-session-2ab9584.json);
- downloaded SHA-256 `00458af188807b5e2e49df994ac1581ff27608d9d1628f60d4df11158c2ef8b7`
  exactly matched the checksum visible in the UI and the preserved file; it identifies this one
  observation, while later runs can differ because the JSON contains observed timing fields;
- export identity exactly matched commit `2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52` and build
  `build-31682611174`;
- the export recorded keyboard tracking, `null`/`N/A` tracking FPS, inference, and visible-response
  values, with FPS, inference, visible-latency, and TTFF thresholds `not_evaluated`;
- all three rounds and both adaptation decisions were present in the export;
- replay and stop returned to the intended screens;
- browser request audit reported API POSTs `[]` for the public guided flow;
- no runtime or browser-console error occurred.

This keyboard evidence proves the exporter, checksum, identity, round/adaptation record, and N/A
semantics. It does not measure or pass real-person FPS, visible latency, or TTFF. The repeatable
consent and evidence procedure is in
[`docs/TRIAL_PROTOCOL.md`](../../docs/TRIAL_PROTOCOL.md); all three human trials remain pending.

## Controlled live CodeBuddy UI

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

## Current-source sanitized room matrix

The fresh controlled localhost artifact
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
