# MoveRealm

> Turn any room into an adaptive movement adventure.

MoveRealm is a three-minute, zero-equipment movement game. Its Movement Director reads one room
still, builds a quest constrained to the confirmed floor space, watches only local pose telemetry,
and visibly tunes the next round. The single world is **Neon Rainforest**: reaches collect
fireflies, squats shelter seedlings, and side-steps redirect a glowing river.

## Release links

- **Public guided demo:** [ming3465.github.io/MoveRealm](https://ming3465.github.io/MoveRealm/)
- **Source:** [github.com/ming3465/MoveRealm](https://github.com/ming3465/MoveRealm)

GitHub Pages hosts the static client, so the public link is the complete guided-demo path and uses
visibly labelled deterministic decisions. The live CodeBuddy Movement Director requires the local or
production Node adapter described below; the public demo does not impersonate that integration.

The release-application Pages deployment
[run 31682611174](https://github.com/ming3465/MoveRealm/actions/runs/31682611174) for commit
[`2ab9584`](https://github.com/ming3465/MoveRealm/commit/2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52)
passed all 75 tests across 10 files, the production build, artifact upload, and deployment. The
deployed client identifies itself as build `build-31682611174` at full commit
`2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52`. Six consent-free guided screenshots and two controlled
synthetic fake-camera CodeBuddy UI captures are available under
[`assets/submission/screenshots/`](assets/submission/screenshots/).

The Pages workflow ignores changes limited to `docs/**`, `artifacts/**`, `README.md`, and
`assets/README.md`. Documentation-only release follow-ups therefore do not redeploy the application;
run 31682611174 remains the exact application release until source-bearing paths change or the
workflow is manually dispatched.

## Run it

Requirements: Node 22.12+ and a modern Chromium/Safari browser. Camera access requires localhost
or HTTPS.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. The complete guided demo works without a camera or CodeBuddy: select
“Try the guided demo,” confirm the demo floor, then use the on-screen arrow/space controls.

For a production-shaped local run:

```bash
npm run build
npm start
```

## Connect the live CodeBuddy Movement Director

Start CodeBuddy in a separate persistent terminal session using its official HTTP service:

```bash
npm run codebuddy
```

If CodeBuddy has HTTP authentication enabled, copy the example environment file and set the
password it prints. Keep that value server-side; do not expose it to Vite or the browser.

```bash
cp .env.example .env
# edit CODEBUDDY_PASSWORD in .env
npm run dev
```

The adapter calls the asynchronous `/api/v1/runs` endpoint and reads the run’s SSE stream. It retries
one schema-invalid result, then serves a deterministic plan with a visible **Safe fallback** badge.
The app never proxies CodeBuddy’s filesystem, terminal, or process endpoints.

## What is enforced

- Exactly three validated movement IDs: `reach`, `squat`, and `side_step`.
- No jumping, equipment moves, diagnosis, fatigue estimates, or invented exercise names.
- Three rounds plus configured rests must total exactly 180 seconds.
- Side-step range cannot exceed the user-confirmed room envelope.
- Adaptation may tune target range, tempo, and rate; it cannot replace the next movement.
- Sustained low pose confidence pauses the world. Three reliable frames are required to resume.
- Live camera frames and pose landmarks remain in the browser. Only the captured room still is sent
  to `/api/scene/analyze`; the adapter deletes its temporary copy in a `finally` block.

This is a light movement experience for healthy adults, not medical or rehabilitation guidance.
Users should stop if they feel pain, dizziness, or unwell.

## Architecture

```text
camera -> MediaPipe worker -> 33 landmarks + small person mask -> movement state machines -> Phaser
   |                                                                          |
   +-- one approved still -> Express adapter -> CodeBuddy -> Zod safety gate -+
                                               telemetry <- round summary <----+
```

The built client remains useful on static hosting: failed `/api` calls select the same labelled
deterministic path. A production Node deployment serves both the Vite bundle and the three app APIs.

## Verification

```bash
npm test             # current release: 75/75 tests pass across 10 files
npm run build        # strict client/server typecheck and production bundle
npm audit --audit-level=low  # current release: 0 vulnerabilities
```

Start `npm run dev` in one terminal, then use a second terminal for the browser checks:

```bash
npm run smoke:browser
MOVEREALM_FULL_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 MOVEREALM_CAPTURE_SMOKE=1 npm run smoke:browser
MOVEREALM_ADAPT_SMOKE=1 npm run smoke:browser
```

The current `2ab9584` public basic smoke passed. Its exact-release Docker image
`moverealm:2ab9584` (`sha256:a205205819345589179d079656e0afefb38887b8b460a2c00d942dc0a11e47b6`,
343,057,128 bytes) embedded the exact commit/build identity. In forced-fallback mode, its fake-camera
basic path reported health true with CodeBuddy disconnected, reached camera readiness, preserved safe
defaults, showed `Safe fallback`, scored 0 → 145, sent exactly the scene and plan POSTs, and left the
temporary-upload directory empty. The container stopped and its port was freed after stop escalation.
Its exit 137 is not presented as a graceful stop.

A separate deployed-site full smoke (not a CI job) passed against exact release identity `2ab9584` /
run 31682611174 / build `build-31682611174`: scores advanced 0 → 145 → 290 → 435; `Guided
demo` adaptation showed range 64 → 48%, tempo 0.90 → 0.77×, and target rate 7 → 6; the
`Glowgarden Awakening` postcard reported 2.6 active minutes, 18% completion, tracking `N/A`, and a
3.0-minute adventure clock. Replay and stop passed the smoke oracle, the request audit recorded no
API POSTs, and no console errors appeared. Its preserved anonymous keyboard JSON matched the visible
SHA-256 `00458af188807b5e2e49df994ac1581ff27608d9d1628f60d4df11158c2ef8b7` and exact
build/commit identity. Its 3.7-second keyboard first movement and `N/A`/`not_evaluated` pose fields
are exporter evidence, not human TTFF or pose evidence. See
[`artifacts/validation/release-checks.md`](artifacts/validation/release-checks.md) for the command and
result record.

Separate controlled UI evidence used Chrome's synthetic fake-camera stream: health reported
`codeBuddyConnected: true`; the scene and adaptation screens visibly showed `CodeBuddy live` with
34.826 s and 12.438 s source latencies; adaptation changed range 60 → 45%, tempo 0.90 → 0.70×,
and target rate 7 → 5; and the temporary upload directory was empty afterward. This is agent/UI and
cleanup evidence, not real-person FPS, visible response latency, TTFF, or usability evidence.

The full guided smoke checks the honest result accounting: three 52-second movement rounds are
**2.6 active minutes**, and two 12-second rests bring the complete adventure to **3.0 minutes**.
Keyboard-mode tracking FPS remains `N/A`; it is not presented as a real-person pose measurement.

## Privacy-safe local evidence

After a completed session, the final postcard can download an anonymous JSON evidence file to the
current device. It contains aggregate counts, metric summaries and threshold states, round and
adaptation results, director provenance, and the CI-injected build/commit identity. It excludes
names, media, room text, agent prose, upload paths, and raw landmarks; the UI displays the file's
SHA-256 after download. Keyboard or mixed-control exports deliberately do not evaluate real-camera
pose gates.

Release `2ab9584` hardens this evidence boundary: only anonymous trials 1–3 are accepted; build ID
and exact 40-character commit provenance must be supplied together; completion counts, full
adaptation parameters, and plan/adaptation latency totals must agree; and the sanitized download
prevents duplicate activation, constrains the trial input, cleans up its temporary browser URL, and
reports download failure or a hash-unavailable status without adding participant data.

Use the [three-person trial protocol](docs/TRIAL_PROTOCOL.md) before collecting any human evidence.
Real-person FPS, visible latency, TTFF, and all three trials remain pending until three consenting M1
Pro webcam runs are observed and privacy-reviewed. See [docs/DEMO.md](docs/DEMO.md) for the judging
script and [docs/VALIDATION.md](docs/VALIDATION.md) for the evidence matrix. Do not fill pending
results from targets, keyboard runs, fake-camera runs, or estimates.

## Camera-free backup video

`npm run video:backup` reproducibly builds the disclosed camera-free submission backup at
[`assets/submission/moverealm-guided-backup.mp4`](assets/submission/moverealm-guided-backup.mp4).
The current artifact is 4:58, 1440×810 H.264/AAC with synthetic narration, guided keyboard controls,
controlled CodeBuddy provenance captures, an architecture explanation, build reflection, and a
development tip. A YouTube or Google Drive upload is still required by the official portal; this
local artifact is not itself an accepted video URL.

## Main source map

- `src/shared/contracts.ts` — Zod wire schemas and deterministic safety checks
- `server/codebuddy.ts` — authenticated async runs, SSE parsing, structured-output extraction
- `server/app.ts` — the three product endpoints, retry, fallback, and still deletion
- `src/pose/pose.worker.ts` — MediaPipe inference off the UI thread
- `src/pose/movementDetectors.ts` — calibration, tracking gate, and movement state machines
- `src/lib/sessionEvidence.ts` — privacy-safe aggregate session evidence and threshold semantics
- `src/game/NeonRainforestScene.ts` — procedural Phaser world and mechanics
- `src/components/GameScreen.tsx` — telemetry, visible adaptation, pause/stop, result handoff

References: [MediaPipe Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js),
[CodeBuddy HTTP API](https://www.workbuddy.ai/docs/cli/http-api).
