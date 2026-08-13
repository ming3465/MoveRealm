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

The baseline Pages deployment [run 31673855670](https://github.com/ming3465/MoveRealm/actions/runs/31673855670)
passed all 53 tests, the production build, artifact upload, and deployment. A newer
favicon-inclusive deployment is awaiting its final release run ID.

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
npm test             # current release: 53/53 tests pass
npm run build        # strict client/server typecheck and production bundle
npm audit --audit-level=low
```

Start `npm run dev` in one terminal, then use a second terminal for the browser checks:

```bash
npm run smoke:browser
MOVEREALM_FULL_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 MOVEREALM_CAPTURE_SMOKE=1 npm run smoke:browser
MOVEREALM_ADAPT_SMOKE=1 npm run smoke:browser
```

The full guided smoke checks the honest result accounting: three 52-second movement rounds are
**2.6 active minutes**, and two 12-second rests bring the complete adventure to **3.0 minutes**.
Keyboard-mode tracking FPS remains `N/A`; it is not presented as a real-person pose measurement.

See [docs/DEMO.md](docs/DEMO.md) for the judging script and [docs/VALIDATION.md](docs/VALIDATION.md)
for the evidence matrix and explicitly pending live-device, three-user, and video checklist. Do not
fill pending results from estimates.

## Main source map

- `src/shared/contracts.ts` — Zod wire schemas and deterministic safety checks
- `server/codebuddy.ts` — authenticated async runs, SSE parsing, structured-output extraction
- `server/app.ts` — the three product endpoints, retry, fallback, and still deletion
- `src/pose/pose.worker.ts` — MediaPipe inference off the UI thread
- `src/pose/movementDetectors.ts` — calibration, tracking gate, and movement state machines
- `src/game/NeonRainforestScene.ts` — procedural Phaser world and mechanics
- `src/components/GameScreen.tsx` — telemetry, visible adaptation, pause/stop, result handoff

References: [MediaPipe Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js),
[CodeBuddy HTTP API](https://www.workbuddy.ai/docs/cli/http-api).
