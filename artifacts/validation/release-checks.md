# MoveRealm release checks

Recorded on 13 August 2026 in Asia/Singapore. This file separates automated and controlled
observations from the real-person and submission work that is still pending.

## Release identity

- Application source commit: `d640de4c6a7b2d39081f3309b3fd4273b03e89e8`
- Public URL: <https://ming3465.github.io/MoveRealm/>
- Source URL: <https://github.com/ming3465/MoveRealm>
- Pages workflow: [run 31675892852](https://github.com/ming3465/MoveRealm/actions/runs/31675892852)
- Workflow result: `success`; `npm ci`, tests, build, Pages configuration, artifact upload, and
  deployment all completed successfully.
- Final production Docker image ID: `sha256:af06b76c34728e2baea274826ebe535b55ba76e2a753af06211ca3f8dc2c9b1e`
- Docker image size: 343,002,617 bytes.

Documentation and evidence assets may be committed after the application source commit. They do
not change the application result identified above.

## Environment

- MacBook Pro `MacBookPro18,3`, Apple M1 Pro, 16 GB memory
- macOS 26.5 (`25F71`)
- Google Chrome 151.0.7922.137
- Node.js 24.12.0; npm 11.9.0

## Automated release gates

| Check | Command or source | Observed result |
|---|---|---|
| Unit, contract, adapter, and boundary tests | `npm test` | **PASS** — 55/55 tests across 7 files |
| Strict client/server typecheck and production bundle | `npm run build` | **PASS** |
| Dependency audit | `npm audit --audit-level=low` | **PASS** — 0 vulnerabilities |
| Local Markdown links | resolve every local Markdown target | **PASS** — 8 files checked |
| Tracked secret-pattern scan | common cloud token, private-key, API-key, and CodeBuddy-password patterns | **PASS** — no tracked match |
| CI deployment | Pages run 31675892852 | **PASS** |
| Public HTTP check | `curl -fsS https://ming3465.github.io/MoveRealm/` | **PASS** — HTTP 200 |
| Public basic browser smoke | `MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ npm run smoke:browser` | **PASS** — keyboard entry, opt-in floor gate, calibration, scoring, pause/resume; no console errors |
| Public guided adaptation smoke | public URL plus `MOVEREALM_ADAPT_SMOKE=1` | **PASS** — `Guided demo`; range 64→48%, tempo 0.90→0.77×, rate 7→6 |
| Packaged captured-room fallback adaptation | Docker URL plus capture, adaptation, and expected-fallback flags | **PASS** — `Safe fallback`; range 60→44%, tempo 0.90→0.77×, rate 7→6 |
| Controlled browser request audit | captured-room smoke with CDP network events | **PASS** — exactly `/api/scene/analyze`, `/api/quest/plan`, and `/api/quest/adapt`; one still upload; no unexpected POST destination |
| Packaged upload cleanup | inspect Node temporary still directory after capture smoke | **PASS** — empty |

The Docker smoke and request audit used Chrome's fake camera and keyboard controls. They show the
implemented request boundary in a controlled run, but they are not real-person tracking evidence or
a replacement for the pending real-camera network inspection.

## Full guided session

The full public smoke runs the real configured clock; it does not accelerate rounds or rests. The
exact-release observation ran against commit `d640de4` / Pages run 31675892852 and passed:

- round scores: 0→145, 145→290, 290→435;
- all three mechanics: reach, squat, side-step;
- visible adaptation: range 64→48%, tempo 0.90→0.77×, target rate 7→6;
- postcard: 2.6 active minutes, 3.0-minute adventure clock, tracking FPS `N/A` in keyboard mode;
- replay and stop returned to the intended screens;
- no runtime or browser-console error.

An earlier independent run against predecessor commit `47f7467` produced the same scores,
adaptation parameters, time accounting, and successful replay/stop result.

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

## Sanitized room matrix

The versioned JSON files in this directory preserve three successful live CodeBuddy observations:

| Fixture | Scene | Plan | Adaptation | Upload directory after analysis |
|---|---:|---:|---:|---|
| Open | 17.824 s | 27.480 s | 5.490 s | empty |
| Tight | 18.961 s | 21.900 s | 5.502 s | empty |
| Uncertain | 15.631 s | 24.600 s | 5.753 s | empty |

All three returned materially different, validated 180-second plans and `codebuddy` provenance for
scene, plan, and adaptation. Adaptation telemetry in these artifacts is explicitly synthetic
keyboard telemetry, not a human measurement.

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
- participant consent for any retained real-person media.

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
