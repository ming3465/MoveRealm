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
[run 31762210597](https://github.com/ming3465/MoveRealm/actions/runs/31762210597) for commit
[`9f2710f`](https://github.com/ming3465/MoveRealm/commit/9f2710f5bc5e2f75d872f0a7aa528f2b44e5ef90)
passed the complete 127-test Vitest, 13-test Python recovery-agent, and 82-test safety-probe gate,
the production build, artifact upload, and deployment. The deployed client identifies itself as
build `build-31762210597` at full commit
`9f2710f5bc5e2f75d872f0a7aa528f2b44e5ef90`. Six consent-free guided screenshots and two controlled
synthetic fake-camera CodeBuddy UI captures are available under
[`assets/submission/screenshots/`](assets/submission/screenshots/).

The Pages workflow ignores changes limited to `docs/**`, `artifacts/**`, `README.md`, and
`assets/README.md`. Documentation-only release follow-ups therefore do not redeploy the application;
run 31762210597 remains the exact application release until source-bearing paths change or the
workflow is manually dispatched.

## Released implementation checkpoint — 14 August 2026

The core implementation and local-agent evidence were frozen at clean commit
`de0b2defc22f524e29bc4ea1019e86c4d31aa915`, tree
`25b1f5b728a0b2baaf0ba39bb5a9087e7906d998`, then shipped in release commit `9f2710f` above.

The exact clean candidate passed `npm run test:all`: **127/127 Vitest tests across 16 files**, **13/13
Python recovery-agent tests**, and **82/82 Python safety-probe tests**. The strict production build
passed and `npm audit --audit-level=low` reported **0 vulnerabilities**. The exact-source Docker image
`sha256:f1ac14aab1b2bf42b4a20e0ed2a53f83d74955e047d6d8560b4b76236d87dd0b`
(343,104,634 bytes) passed health, index, captured-room basic smoke, exact commit/build assertions,
and zero-upload cleanup.

The free local runtime path uses CodeBuddy Code 2.136.0 to orchestrate Apache-2.0 Qwen3-VL 4B
through loopback Ollama 0.23.1. With fallback forbidden, the exact clean candidate produced distinct
open, tight, and uncertain scene profiles and distinct safe 180-second plans; its live adaptation
changed range `0.62→0.46`, tempo `0.90→0.77`, and target rate `8→7`. A separate fake-camera browser
smoke visibly showed `CodeBuddy live`, made exactly scene/plan/adapt POSTs, scored 0→145, and rendered
an 8.895-second adaptation with no console errors. See the sanitized
[`strict matrix`](artifacts/validation/codebuddy-local-qwen-matrix-de0b2de.json) and
[`UI observation`](artifacts/validation/codebuddy-local-ui-adaptation-de0b2de.json). These controlled
runs are agent-loop evidence, not real-person pose, latency, TTFF, or usability evidence.

Earlier signed-in CodeBuddy 429/time-out records remain preserved as recovery evidence; they no
longer describe the recommended local 4B route.

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

For the free local vision route, install Ollama, then run these commands in separate terminals. The
setup downloads Qwen3-VL 4B once (about 3.3 GB) and creates a deterministic local alias; no model is
downloaded at application runtime.

```bash
ollama serve
ollama pull qwen3-vl:4b-instruct-q4_K_M
npm run director:local:setup
npm run codebuddy:local
```

Alternatively, start a signed-in CodeBuddy model with its official HTTP service:

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

The local command binds only to loopback, keeps HTTP password authentication enabled, permits only
CodeBuddy's `Read` tool for the explicitly attached room still, and caps the agent at two turns.
The adapter calls asynchronous `/api/v1/runs`, reads the SSE stream, retries one schema-invalid
result, then serves a deterministic plan with a visible **Safe fallback** badge. The app never
proxies CodeBuddy’s filesystem, terminal, or process endpoints.

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
npm run test:all     # local candidate: 127 Vitest + 13 recovery-agent + 82 probe tests
npm run build        # strict client/server typecheck and production bundle
npm audit --audit-level=low  # local candidate: 0 vulnerabilities
```

Start `npm run dev` in one terminal, then use a second terminal for the browser checks:

```bash
npm run smoke:browser
MOVEREALM_FULL_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 MOVEREALM_CAPTURE_SMOKE=1 npm run smoke:browser
MOVEREALM_ADAPT_SMOKE=1 npm run smoke:browser
```

The current `9f2710f` public camera basic smoke was a separate deployed-site observation, not a CI
job. With Chrome's fake camera it reported `cameraReady: true`, scored 0 → 145, recorded API POSTs
`[]`, and produced no console errors. It is camera-startup and basic-flow evidence, not a real-person
FPS, latency, TTFF, or usability measurement.

The exact-release public full smoke also passed against `9f2710f` / run 31762210597 / build
`build-31762210597`: scores advanced 0 → 145 → 290 → 435; `Guided demo` adaptation showed
range 64 → 48%, tempo 0.90 → 0.77×, and target rate 7 → 6; and the postcard reported 2.6 active
minutes, 18% completion, and tracking `N/A`. The request audit recorded API POSTs `[]`, and no
console errors appeared. The preserved anonymous keyboard JSON matched SHA-256
`a9a676b0b16843ef4f883f33ed20738de2b9c204bbabed5ca44ae39a86b7224d` and the exact
build/commit identity. Its keyboard timing and `N/A`/`not_evaluated` pose fields are exporter
evidence, not human TTFF or pose evidence. See
[`artifacts/validation/release-checks.md`](artifacts/validation/release-checks.md) for the command and
result record and
[`public-guided-keyboard-session-9f2710f.json`](artifacts/validation/public-guided-keyboard-session-9f2710f.json)
for the privacy-reviewed export.

The exact implementation-checkpoint Docker image `sha256:f1ac14aa…` passed the captured-room basic
path before release. Older `2ab9584` packaged/full-session results remain predecessor evidence and
must not be cited as current-release execution.

Earlier controlled UI evidence used Chrome's synthetic fake-camera stream: health reported
`codeBuddyConnected: true`; the scene and adaptation screens visibly showed `CodeBuddy live` with
34.826 s and 12.438 s source latencies; adaptation changed range 60 → 45%, tempo 0.90 → 0.70×,
and target rate 7 → 5; and the temporary upload directory was empty afterward. This is agent/UI and
cleanup evidence, not real-person FPS, visible response latency, TTFF, or usability evidence.

The current full guided smoke checks the honest result accounting: three 52-second movement rounds are
**2.6 active minutes**, and two 12-second rests bring the complete adventure to **3.0 minutes**.
Keyboard-mode tracking FPS remains `N/A`; it is not presented as a real-person pose measurement.

## Privacy-safe local evidence

After a completed session, the final postcard can download an anonymous JSON evidence file to the
current device. It contains aggregate counts, metric summaries and threshold states, round and
adaptation results, director provenance, and the CI-injected build/commit identity. It excludes
names, media, room text, agent prose, upload paths, and raw landmarks; the UI displays the file's
SHA-256 after download. Keyboard or mixed-control exports deliberately do not evaluate real-camera
pose gates.

The current release retains the evidence boundary introduced in `2ab9584`: only anonymous trials
1–3 are accepted; build ID
and exact 40-character commit provenance must be supplied together; completion counts, full
adaptation parameters, and plan/adaptation latency totals must agree; and the sanitized download
prevents duplicate activation, constrains the trial input, cleans up its temporary browser URL, and
reports download failure or a hash-unavailable status without adding participant data.

## Offline Shadow Judge

CodeBuddy remains the only runtime Movement Director. The optional local Shadow Judge evaluates
frozen synthetic fixtures after the fact; deterministic production contracts run first and remain
the sole automated safety authority. In the recorded disagreement, the advisory model scored an
unsafe uncertain-room plan positively while the hard gate rejected its occluded-floor squat and a
reach-only fallback passed. The judge never approves, rewrites, blocks, or executes a quest, and its
scores are not accuracy, safety, official-judge, human-trial, or runtime evidence. See
[`docs/EVALUATION.md`](docs/EVALUATION.md) for the fixed setup, observations, and limitations.
The 8B open/tight reports are predecessor `7fe9009` snapshots; their candidate JSON is not a
`de0b2de` current-gate pass.

The dependency-free [`python_agent/`](python_agent/) wrapper turns that evaluator into a small
`observe → evaluate → recover → verify` agent. It defaults to the free local 3.3 GB Qwen3-VL 4B
Ollama model and can select a labelled fallback only after the production gates accept it. In the
frozen run, the cheap model preferred the unsafe original (18/24) over the safe fallback (15/24),
but deterministic eligibility still forced the correct recovery. CodeBuddy remains the runtime
Movement Director; this Python loop is offline evaluation evidence.

```bash
npm run test:python
npm run agent:python -- --candidate <candidate.json> --fallback-candidate <fallback.json>
```

The frozen Python-agent record belongs to clean commit `cf157093ff3dab7b3598387d68973f82a3e364c2`
and tree `404fdc889cabc0212a6fd2197102eff7da5abde6`. Both candidates share context SHA-256
`502824677434c6c6d0196d367ecdcfdde1f8aaa84138f1fe976858dce766fcfa`; its artifact SHA-256 is
`b41ebb3f61d652b60d68b4c8e9c01f0b91e43af52fb311dbbf9bd1dd9fa9d029`. The original scored 18/24
in 43.492 seconds and the validated fallback scored 15/24 in 37.550 seconds.

Use the [three-person trial protocol](docs/TRIAL_PROTOCOL.md) before collecting any human evidence.
Real-person FPS, visible latency, TTFF, and all three trials remain pending until three consenting M1
Pro webcam runs are observed and privacy-reviewed. See [docs/DEMO.md](docs/DEMO.md) for the judging
script and [docs/VALIDATION.md](docs/VALIDATION.md) for the evidence matrix. Do not fill pending
results from targets, keyboard runs, fake-camera runs, or estimates.

## Adversarial Safety Probe

The Shadow Judge scores quality after the fact; nothing was attacking the safety gate itself. The
Python **Safety Probe** in [`agent/`](agent/README.md) does. It invents quests a careless or
adversarial director might emit, asks the *real* production contracts to rule on them, and compares
each verdict against an independently written restatement of the documented movement rules. Only two
outcomes count as findings: an unsafe candidate the gate accepted, or a compliant candidate it
refused.

```bash
npm run probe                     # attack the production contracts
npm run probe -- --mode live      # audit a running adapter
npm run probe:tests               # 82 tests, standard library only
```

Against clean commit `cf157093ff3dab7b3598387d68973f82a3e364c2`, it ran 332 candidates over 6 adaptive
rounds and terminated on its own when nothing new appeared: 302 unsafe candidates defended and 30
compliant candidates honored,
**0 breaches and 0 over-rejections**, with all 20 compliant baselines accepted. Bisection measured
seven envelope frontiers, each agreeing with the documented threshold — the narrow-room side-step
cap, for example, was observed accepted up to 0.6156 and refused from 0.6203 against a documented
0.62. The contract report contains 0 inconclusive probes and has SHA-256
`df2eebab3db2a4ea5b50ea4ecfbd17e633a66ffe8bf7e6d5374592a6be34a8e5` (JSON) and
`e484a6efb3c972d82c604048a0fae46d722fd6e076b3302c2d5134505cb428df` (Markdown). The stub gates in
its 82-test suite prove a breach *would* be reported. This is contract-behaviour evidence over synthetic rooms:
not a human trial, pose or latency measurement, security audit, or certification. The tool never
approves, rewrites, blocks, or executes a quest, and reads no participant data.

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
- `.codebuddy/models.json` + `ollama/MoveRealm.Modelfile` — reproducible free local vision director
- `server/app.ts` — the three product endpoints, retry, fallback, and still deletion
- `src/pose/pose.worker.ts` — MediaPipe inference off the UI thread
- `src/pose/movementDetectors.ts` — calibration, tracking gate, and movement state machines
- `src/lib/sessionEvidence.ts` — privacy-safe aggregate session evidence and threshold semantics
- `src/game/NeonRainforestScene.ts` — procedural Phaser world and mechanics
- `src/components/GameScreen.tsx` — telemetry, visible adaptation, pause/stop, result handoff
- `python_agent/moverealm_agent.py` — cheap local-VLM evaluation and fail-closed recovery loop
- `agent/moverealm_probe/oracle.py` — independent restatement of the documented movement rules
- `agent/bridge/contract_bridge.ts` — stdio bridge that runs the real gates for the Python probe

References: [MediaPipe Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js),
[CodeBuddy HTTP API](https://www.workbuddy.ai/docs/cli/http-api).
