# MoveRealm agent handoff

Read this file first when continuing work in this repository. Then read
[`CODEBUDDY.md`](CODEBUDDY.md), [`README.md`](README.md), and
[`docs/VALIDATION.md`](docs/VALIDATION.md). Do not infer that a plan, synthetic fixture, keyboard
smoke, or model score is a real-person measurement.

## Current state — 14 August 2026

- Public app: <https://ming3465.github.io/MoveRealm/>
- Repository: <https://github.com/ming3465/MoveRealm>
- Deployed application source: `cf2ea8bc0cced379a7cf01bc968c5fe09a6b7e62`
- Deployed build: `build-31766511011`
- Pages run: <https://github.com/ming3465/MoveRealm/actions/runs/31766511011> — successful
- `origin/main` can be ahead of the deployed source by documentation/evidence-only commits. Verify
  both identities before changing release claims.
- Last complete local gate: 129/129 Vitest tests, 13/13 Python recovery-agent tests, 82/82 Python
  Safety Probe tests, production build passed, dependency audit reported 0 vulnerabilities.
- Exact release Docker image: `sha256:1e15b02099608930674d565c431942b1f9234e2a7ef365bb3ab8d18c2112156c`
  (343,108,983 bytes). Health, captured-room fallback, request audit, and upload cleanup passed.
  Container shutdown escalated to exit 137; do not call it graceful.
- The worktree was clean and all tracked work was pushed when this handoff was written.

## What is finished

The implemented flow is:

`landing → room capture/demo → constraint confirmation → T-pose + side-step calibration → three
Neon Rainforest rounds → two visible adaptations → animated postcard/export → replay or stop`

The production loop is:

`room still → /api/scene/analyze → confirmed constraints → /api/quest/plan → local pose/gameplay
telemetry → /api/quest/adapt → deterministic validation → visible CodeBuddy/fallback provenance`

Verified behavior includes camera retry/readiness, browser-only live video and pose processing,
MediaPipe in a Worker, reach/squat/side-step detection, pose-loss pause/resume, keyboard access,
pause/resume/stop, full three-round guided play, schema repair, deterministic fallback, exact
180-second plans, upload deletion, public deployment, evidence export, and Docker packaging.

The current local CodeBuddy + Qwen3-VL 4B matrix is preserved at
[`artifacts/validation/codebuddy-local-qwen-matrix-5b77105.json`](artifacts/validation/codebuddy-local-qwen-matrix-5b77105.json).
With fallback forbidden it produced materially different open, tight, and uncertain plans, all
eligible under current hard gates, plus a live `too_hard` adaptation. The Chrome fake camera is a
green test card rather than a room; its invalid empty-direction result was correctly rejected and
visibly fell back. That record is
[`artifacts/validation/codebuddy-local-synthetic-camera-fallback-5b77105.json`](artifacts/validation/codebuddy-local-synthetic-camera-fallback-5b77105.json).

## The only required work still pending

These steps require a person, physical device session, credentials, or authenticated portal access.
Do not replace them with synthetic values.

1. Run three consenting real-person webcam trials on the M1 Pro by following
   [`docs/TRIAL_PROTOCOL.md`](docs/TRIAL_PROTOCOL.md).
2. For each eligible trial, preserve the anonymous session export and record only observed:
   tracking FPS p05, pose inference p95, visible camera-to-game response p95, TTFF, target
   completion, movement coverage, pose-loss pause/resume, CodeBuddy latency, and privacy/network
   checks. Respect the protocol's minimum sample counts.
3. Confirm the three trials collectively exercise reach, squat, side-step, and live pose-loss
   pause/resume. Do not mark three reach-only sessions as complete.
4. Upload `assets/submission/moverealm-guided-backup.mp4` and
   `assets/submission/moverealm-guided-backup.vtt` to YouTube or Google Drive, then verify signed-out
   playback and captions.
5. Add team members, registered contact email, video URL, and final portal fields, then submit.

Resume verification after the user supplies the trial exports or completes the external actions.
The goal is not evidence-complete until then.

## First commands on another device

```bash
git pull --ff-only origin main
node --version              # requires Node >=22.12
python3 --version           # CI uses Python 3.12
npm ci
npm run test:all
npm run build
npm audit --audit-level=low
```

For local development:

```bash
npm run dev
# http://127.0.0.1:4173
```

For a production-shaped adapter/client:

```bash
npm run build
npm start
```

For the camera-free public release smoke:

```bash
MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ \
MOVEREALM_CAMERA_SMOKE=1 \
MOVEREALM_FULL_SMOKE=1 \
MOVEREALM_EXPECT_COMMIT=cf2ea8bc0cced379a7cf01bc968c5fe09a6b7e62 \
MOVEREALM_EXPECT_BUILD_ID=build-31766511011 \
npm run smoke:browser
```

This takes the real configured three-minute clock. Its keyboard timing and `N/A` pose fields are not
human FPS, latency, or TTFF evidence.

## Architecture map

- App state machine and privacy cleanup: `src/App.tsx`
- Camera acquisition/retry: `src/lib/camera.ts`
- Capture/readiness UI: `src/components/CaptureScreen.tsx`, `src/components/CameraStage.tsx`
- Calibration: `src/components/CalibrationScreen.tsx`, `src/pose/calibration.ts`
- Worker pose engine: `src/pose/PoseEngine.ts`, `src/pose/pose.worker.ts`
- Movement detection/tracking gate: `src/pose/movementDetectors.ts`
- Game/session telemetry: `src/components/GameScreen.tsx`
- Phaser world/targets: `src/game/NeonGame.tsx`, `src/game/NeonRainforestScene.ts`
- Canonical contracts and safety gates: `src/shared/contracts.ts`
- Deterministic safe plans: `src/shared/fallbacks.ts`
- Browser API boundary: `src/lib/directorApi.ts`
- Server adapter/routes and still deletion: `server/app.ts`, `server/codebuddy.ts`
- Agent prompts: `server/prompts.ts`
- Anonymous evidence: `src/lib/sessionEvidence.ts`, `src/components/PostcardScreen.tsx`
- Python recovery agent: `python_agent/moverealm_agent.py`
- Adversarial Safety Probe: `agent/`
- Offline evaluator: `eval/`, `scripts/evaluate-agent.ts`

## Product and safety invariants

- Keep exactly one world: Neon Rainforest.
- Only movement IDs `reach`, `squat`, and `side_step` may execute.
- Never add jumping, equipment exercises, diagnosis, fatigue estimation, calories, food scanning,
  accounts, social features, or Gaussian splatting.
- Plans must contain three rounds and two rests totaling exactly 180 seconds.
- Respect confirmed directions, no-jumping, uncertain-room reach-only behavior, and side-step caps.
- Canonical movement prompts are server-controlled; model prose cannot introduce unsafe actions.
- Adaptation may change validated range, tempo, and target rate but cannot change the next movement.
- Sustained unreliable pose pauses gameplay; do not guess through tracking loss.
- Live video and landmarks stay in the browser. Only an explicitly captured still may leave it.
- Delete temporary room stills after scene analysis, including failures and repair attempts.
- Validate agent output and fallback output. One malformed response gets one repair, then a visibly
  labelled deterministic fallback.
- Never fabricate trial results, performance measurements, deployment status, or model provenance.

## Release discipline

- Inspect `git status --short` before editing. Preserve unrelated user work.
- A source-bearing push triggers Pages and changes the embedded commit/build identity. Wait for CI,
  verify the exact public URL, preserve the new export, then reconcile documentation and the
  submission manifest.
- Pushes limited to `docs/**`, `artifacts/**`, `README.md`, `assets/README.md`, `AGENT.md`, and
  `CODEBUDDY.md` are ignored by the Pages workflow.
- Do not describe a local build ID as a GitHub Actions run.
- Do not describe the synthetic camera, keyboard telemetry, fixtures, Shadow Judge, or Python agent
  as human trials or real pose-performance evidence.
- Run `git diff --check`, local Markdown-link validation, JSON/checksum validation, and a tracked
  secret scan before pushing evidence changes.
- Never commit `.env`, credentials, participant media, raw room stills, upload paths, raw pose
  landmarks, or unrestricted model output.

## Canonical evidence and submission files

- [`docs/VALIDATION.md`](docs/VALIDATION.md) — evidence boundaries and observed results
- [`docs/TRIAL_PROTOCOL.md`](docs/TRIAL_PROTOCOL.md) — exact real-person procedure
- [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — portal copy and final checklist
- [`docs/RECORDING_CHECKLIST.md`](docs/RECORDING_CHECKLIST.md) — recording handoff
- [`docs/EVALUATION.md`](docs/EVALUATION.md) — local model/Shadow Judge limits
- [`artifacts/validation/release-checks.md`](artifacts/validation/release-checks.md) — release commands
- [`artifacts/submission-manifest.json`](artifacts/submission-manifest.json) — frozen checksums/status

If evidence and source disagree, trust the executable source and rerun the relevant check; do not
edit evidence to make it look successful.
