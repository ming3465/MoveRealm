# MoveRealm submission package

This is the judge-facing source of truth for the Tencent Cloud Hackathon: Agent Development
Challenge Singapore 2026 submission. Replace every bracketed placeholder before submitting.

Official references:

- [Participant Handbook](https://hackmd.io/nimCWa4fSkegAuAutR6BPw?view=)
- [Event page](https://luma.com/jo916m7a)

The handbook lists the submission cutoff as **14 August 2026 at 6:00 PM**. Confirm the portal's
displayed timezone and final requirements before upload. It requires a 3–5 minute demo video. The
same handbook separately describes pitch day as both “5-minute presentation + 5-minute Q&A” and
“8-minute presentation + 5-minute Q&A”; confirm the finalist format with the organizers rather than
assuming either timing.

## Portal fields

| Field | Submission copy |
|---|---|
| Project title | MoveRealm |
| Direction | Life Agent |
| Product used | CodeBuddy |
| Short blurb | Your room becomes a safe adaptive movement adventure. |
| Public app URL | <https://ming3465.github.io/MoveRealm/> |
| Demo video URL | **[PENDING UPLOAD]** |
| Source/repository URL | <https://github.com/ming3465/MoveRealm> |
| Team members | **[PENDING]** |
| Contact email | **[PENDING — USE REGISTERED HACKATHON EMAIL]** |

The short blurb is eight words, below the handbook's hard limit of ten words.

A compliant-duration camera-free backup file is complete at
[`assets/submission/moverealm-guided-backup.mp4`](../assets/submission/moverealm-guided-backup.mp4).
It is 4:58.834 and visibly discloses synthetic narration, guided keyboard controls, and the absence
of human pose measurements. The portal field remains pending until this file, or a preferred
live-person take, is uploaded to YouTube or Google Drive and tested while signed out.

The public URL is a static GitHub Pages deployment of the complete guided-demo path. It visibly
labels guided and deterministic decisions and does not claim to host the live CodeBuddy server
adapter. Release-application
[Pages run 31714506917](https://github.com/ming3465/MoveRealm/actions/runs/31714506917) for commit
[`7fe9009`](https://github.com/ming3465/MoveRealm/commit/7fe9009728d545798c1b5efd7b367d4f54264eaf)
passed all 100 tests across 13 files, the production build, artifact upload, and deployment. The client
carries exact release identity `build-31714506917` /
`7fe9009728d545798c1b5efd7b367d4f54264eaf`, which completed-session evidence exports embed.

The Pages workflow uses `paths-ignore` for docs, artifacts, `README.md`, and `assets/README.md`.
This docs-only follow-up therefore does not create a newer application deployment; run 31714506917
remains the release application.

The newer local candidate is clean commit `cf157093ff3dab7b3598387d68973f82a3e364c2`, tree
`404fdc889cabc0212a6fd2197102eff7da5abde6`. It passed `npm run test:all` with **120/120 Vitest
tests across 15 files**, **13/13 Python recovery-agent tests**, and **82/82 safety-probe tests**; the
strict production build passed and the dependency audit reported **0 vulnerabilities**. Clean Docker
image `sha256:724a0e56188dc18e4d7419556a72084d5e0c9398674510a50c3c8177d80aaa57`
(343,092,337 bytes) embedded the expected commit/tree provenance and passed health, index, and basic
packaged smoke checks. It has **not** been pushed or deployed; the public app remains `7fe9009`.

Two production-mode full browser routes passed against that clean source with local audit build ID
`build-20260814` (**not** a GitHub Actions run). The guided route completed reach/squat/side-step,
scored 0→145→290→435, showed adaptation 64→48%, 0.90→0.77×, 7→6, and ended at 2.6 active
minutes / 18% / tracking `N/A` with no API POSTs or errors. The captured-room route reached camera
readiness, made exactly scene/plan/adapt/adapt POSTs, completed all rounds to score 435 under the
labelled `Safe fallback`, showed adaptation 60→44%, 0.90→0.77×, 7→6, and produced the same
postcard totals with no errors. Both anonymous exports matched the exact commit/build, retained no
personal or media fields, and kept keyboard pose metrics `null`.

The current CodeBuddy live check is **BLOCKED externally**, not passed. Localhost health succeeded,
but a strict scene smoke returned the labelled deterministic fallback after its bounded 45-second
deadline. The sanitized local log reported HTTP 429 before generation on all eight upstream retries.
Do not record this candidate as `CodeBuddy live` until a fresh strict check succeeds.

The deployed predecessor retains the anonymous evidence boundary introduced in `2ab9584`: only trials
1–3 are accepted; an exact
40-character commit and numeric `build-N` provenance pair must appear together; aggregate counts,
per-round completion, full adaptation parameters, and plan/adaptation latency totals must be
internally consistent; and the sanitized download handles duplicate activation, trial-input bounds,
temporary-anchor and object-URL cleanup, hash-unavailable status, and download failure. These
automated integrity checks strengthen the exporter; they do not complete a human trial.

## Project description

### Overview

MoveRealm is a three-minute, zero-equipment movement game for healthy adults who want a short,
approachable activity in the room they already have. The user approves one room still, confirms the
clear floor and side-step envelope, and enters a single Neon Rainforest world. Reaches collect
fireflies, squats shelter seedlings, and permitted side-steps redirect a glowing river. In the
current guided plan, three 52-second rounds provide **2.6 active minutes** and two 12-second rests
bring the complete adventure to **3.0 minutes**. The product does not call 2.6 active minutes three
active minutes.

### Scenario insight and problem

The product hypothesis is that movement sessions often fail before they start because time, safe
space, and motivation are uncertain. Generic workout media cannot see a chair near the movement lane,
cannot respect the user's confirmed floor space, and cannot visibly adjust after a difficult round.
MoveRealm turns those constraints into the controller while keeping the experience intentionally
short. The three planned user trials and live-person performance measurements remain pending in
[VALIDATION.md](VALIDATION.md), so this submission must not present the hypothesis as completed user
research.

### Agent and solution design

The CodeBuddy-powered Movement Director performs three bounded jobs:

1. It analyzes one user-approved room still and returns obstacles, permitted directions, and a room
   classification.
2. It generates a three-round quest constrained by the confirmed floor and side-step envelope.
3. It receives a round summary plus explicit difficulty feedback and proposes tuned parameters for
   the next already-validated movement.

The Express adapter calls CodeBuddy's asynchronous `/api/v1/runs` endpoint and consumes the run's
SSE stream. Zod schemas treat agent output as untrusted: only `reach`, `squat`, and `side_step` are
accepted; rounds plus rests must total exactly 180 seconds; lateral movement cannot exceed confirmed
space; and adaptation may tune range, tempo, and target rate but cannot replace the next movement.
One schema-invalid result receives one repair attempt. An unavailable or still-invalid result selects
a deterministic safe plan and the UI visibly labels its source.

MediaPipe pose inference runs in a browser Worker. Live camera frames and pose landmarks stay in the
browser; only the approved room still is sent to scene analysis, and the server removes its temporary
copy in a `finally` block. Sustained low confidence pauses play, and three reliable frames are needed
to resume.

An optional local Shadow Judge evaluates frozen synthetic CodeBuddy outputs offline, after
deterministic fixture and production-contract gates. It cannot approve, rewrite, block, or execute a
quest; CodeBuddy remains the only runtime Movement Director and deterministic contracts remain the
sole automated safety authority. The recorded model/hard-gate disagreement and limitations are in
[`EVALUATION.md`](EVALUATION.md). Its 8B open/tight reports are predecessor `7fe9009` snapshots; the
old candidate JSON is not current `cf15709` pass evidence.

A small standard-library Python agent wraps the same evaluator with an explicit
`observe → evaluate → recover → verify` loop and the free local Qwen3-VL 4B model. Its recorded run
is deliberately fail-closed: even though the cheap model scored an unsafe candidate above the safe
fallback, the agent selected only the fallback accepted by production gates. This is offline
synthetic evaluation evidence, not a second runtime authority or a participant result.

### Defined impact and commercial hypothesis

The intended product outcomes are a first accepted movement within 45 seconds, at least 20 pose FPS
on an M1 Pro, and under 100 ms visible response latency. These are targets, not measured claims; the
human/device rows are explicitly pending in [VALIDATION.md](VALIDATION.md). The consent-first
[three-person protocol](TRIAL_PROTOCOL.md) defines how to use the postcard's anonymous local JSON
export without retaining identifiers or room media; none of its three human trials has been run.

The initial route is a consumer short-movement product. Potential licensing routes include corporate
wellness, hospitality, and community-fitness programs, where the same bounded Movement Director can
adapt branded worlds to constrained rooms. These routes are commercial hypotheses; no revenue,
conversion, retention, or population-level user result has yet been validated.

## CodeBuddy product sharing

Use this paragraph in the portal:

> MoveRealm uses the CodeBuddy CLI HTTP service as its live Movement Director. Our Express adapter
> submits structured scene, plan, and adaptation tasks to asynchronous `/api/v1/runs`, reads the SSE
> stream, validates every response against strict Zod safety contracts, retries one schema-invalid
> response, and visibly switches to a deterministic safe fallback if the service is unavailable.
> This made CodeBuddy useful as a bounded decision-maker inside a real-time product instead of an
> opaque chatbot. In practice, keeping one persistent `moverealm` HTTP session made scene, plan, and
> adaptation prompt iteration fast; the most reliable pattern was strict JSON schemas, one repair
> attempt, and deterministic validation outside the model.

Evidence supporting this sharing:

- [x] The predecessor
  [`live-agent-room-matrix-2ab9584.json`](../artifacts/validation/live-agent-room-matrix-2ab9584.json)
  records `/api/health` with `codeBuddyConnected: true`, three materially different room
  profiles/plans with `codebuddy` provenance and exact 180-second totals, one bounded live
  adaptation from synthetic keyboard telemetry, and empty upload cleanup.
- [x] The offline Shadow Judge record shows why deterministic safety outranks model
  preference: it scored an unsafe uncertain-room plan positively, while the hard gate rejected the
  occluded-floor squat and the reach-only fallback passed. It is advisory synthetic evaluation, not
  runtime or human evidence; see [`EVALUATION.md`](EVALUATION.md).
- [x] Two synthetic fake-camera UI captures record health connectivity, visible `CodeBuddy live`
  scene/adaptation provenance, the bounded adaptation, and empty temporary-upload cleanup. They are
  controlled evidence, not a real-person run or final-video proof.
- [ ] Optional live-person take enhancement: show `/api/health` with `codeBuddyConnected: true`.
- [x] Visible `CodeBuddy live` badge appears in the controlled evidence segment of the backup video.
- [ ] Optional enhancement: add a redacted CodeBuddy task/history or usage screenshot if the portal
  provides an appropriate supporting-media field.
- [x] No password, bearer token, redemption code, email, or private prompt content is visible in the
  camera-free backup.
- [x] The development-use sentence is supported by the persistent-session adapter, controlled live
  matrix, repair/fallback tests, and visible live-source captures.

## Official rubric map

The dimensions and weights below reproduce the official Participant Handbook. “Gap before submit”
items are disclosure and evidence tasks, not claims that the criterion has already been satisfied.

| Official dimension | Weight | MoveRealm evidence to put on screen | Repository evidence | Gap before submit |
|---|---:|---|---|---|
| AI innovation — scenario insight and depth of AI utilization | 30% | One approved still becomes a constrained plan; missed targets plus explicit feedback produce a visible next-round change | [`server/codebuddy.ts`](../server/codebuddy.ts), [`server/prompts.ts`](../server/prompts.ts), [`src/components/GameScreen.tsx`](../src/components/GameScreen.tsx), the [live room evidence](../artifacts/README.md), and the advisory/hard-gate disagreement in [`EVALUATION.md`](EVALUATION.md) | Show live CodeBuddy provenance in the video; do not describe fallback or the offline Shadow Judge as live AI |
| Technical excellence — implementation, AI-tool mastery, completeness, stability | 20% | Show source badge, safety rejection boundary, local pose Worker, low-confidence pause, fallback recovery, and anonymous evidence export | [`src/shared/contracts.ts`](../src/shared/contracts.ts), [`server/app.ts`](../server/app.ts), [`src/pose/pose.worker.ts`](../src/pose/pose.worker.ts), [`src/lib/sessionEvidence.ts`](../src/lib/sessionEvidence.ts), clean local candidate `cf15709` with 120/120 Vitest + 13/13 recovery-agent + 82/82 probe tests and 0 audit vulnerabilities, plus deployed-predecessor Pages run 31714506917 | Cite [`release-checks.md`](../artifacts/validation/release-checks.md), keep the local/deployed distinction visible, and complete the pending protocol-based real-person measurements |
| User experience and demo — smoothness, interaction thoughtfulness, friendliness | 25% | Three-minute setup, room confirmation, calibration, visible adaptation trace, pause/resume, result postcard, guided backup | [`docs/DEMO.md`](DEMO.md), [`TRIAL_PROTOCOL.md`](TRIAL_PROTOCOL.md), [`src/App.tsx`](../src/App.tsx), [`src/components/`](../src/components), and the 4:58 camera-free backup | Upload the backup or record a preferred live-person take; all three human trials remain pending |
| Business value and viability — real problem and commercial rollout potential | 25% | Explain the time/space/motivation problem, target user, short-session value, and licensing hypothesis | Project description above and [`README.md`](../README.md) | Keep commercial statements as hypotheses until user and market evidence exists |

## Required disclosures

Use these exact facts in the video description or submission text:

- **Privacy:** Live camera frames and pose landmarks stay in the browser. One user-approved room still
  is sent to `/api/scene/analyze`; the server deletes its temporary copy after the request.
- **Safety boundary:** MoveRealm permits only reach, squat, and side-step movements, never jumping.
  The user must confirm the floor, and generated lateral range cannot exceed the confirmed envelope.
- **Tracking behavior:** Sustained low pose confidence pauses the world; three reliable frames are
  required to resume.
- **Adaptation boundary:** The Movement Director may tune range, tempo, and target rate but cannot
  replace the next validated movement.
- **Source disclosure:** `CodeBuddy live`, `Guided demo`, and `Safe fallback` are different modes and
  remain visibly labelled. A fallback result must never be narrated as a live agent result.
- **Evaluation disclosure:** The optional Shadow Judge is local, offline, synthetic, and advisory. It
  is neither a runtime authority nor safety, accuracy, official-judge, or human-trial evidence.
- **Health scope:** This is light movement for healthy adults, not medical or rehabilitation
  guidance. Users should stop if they feel pain, dizziness, or unwell.

## Release gates

Run from the repository root and save the complete terminal output with the submission artifacts:

```bash
npm run test:all
npm run build
npm audit --audit-level=low
```

With the local server running:

```bash
npm run smoke:browser
MOVEREALM_FULL_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 MOVEREALM_CAPTURE_SMOKE=1 npm run smoke:browser
MOVEREALM_ADAPT_SMOKE=1 npm run smoke:browser
```

`MOVEREALM_FULL_SMOKE=1` completes all three guided rounds and asserts that the postcard reports 2.6
active minutes inside the 3.0-minute adventure. `MOVEREALM_CAMERA_SMOKE=1` checks camera permission
and MediaPipe Worker readiness with Chrome's fake stream; it is not a real-person FPS, visible
latency, or TTFF measurement.

Do not mark a gate passed from an estimate. Record commands, provenance, date, environment, and
results in [`artifacts/validation/release-checks.md`](../artifacts/validation/release-checks.md).

| Gate | Result | Evidence path |
|---|---|---|
| Clean local-candidate automated gate, commit `cf15709` | **PASS — 120/120 Vitest across 15 files; 13/13 recovery-agent; 82/82 probe tests** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Clean local-candidate strict client/server build | **PASS** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Release-application GitHub Pages deployment, commit `7fe9009`, build `build-31714506917` | **PASS** | [run 31714506917](https://github.com/ming3465/MoveRealm/actions/runs/31714506917), <https://ming3465.github.io/MoveRealm/> |
| Deployed-predecessor CI tests | **PASS — 100/100 across 13 files** | [Pages run 31714506917](https://github.com/ming3465/MoveRealm/actions/runs/31714506917) |
| Local-candidate dependency audit | **PASS — 0 vulnerabilities** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Clean local-candidate Docker image | **PASS — `sha256:724a0e56188dc18e4d7419556a72084d5e0c9398674510a50c3c8177d80aaa57`, 343,092,337 bytes; provenance, health, index, and basic smoke passed** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Local-candidate guided full browser smoke, audit build `build-20260814` | **PASS — three mechanics; scores 0→145→290→435; guided adaptation 64→48%, 0.90→0.77×, 7→6; 2.6 min / 18% / `N/A`; no POSTs/errors; exact identity and privacy semantics** | [`local-guided-keyboard-session-cf15709.json`](../artifacts/validation/local-guided-keyboard-session-cf15709.json) |
| Local-candidate captured-room full fallback smoke, audit build `build-20260814` | **PASS — camera ready; exact scene/plan/adapt/adapt POSTs; score 435; `Safe fallback`; adaptation 60→44%, 0.90→0.77×, 7→6; 2.6 min / 18% / `N/A`; no errors; exact identity and privacy semantics** | [`local-captured-fallback-keyboard-session-cf15709.json`](../artifacts/validation/local-captured-fallback-keyboard-session-cf15709.json) |
| Local-candidate push and public deployment | **[PENDING EXPLICIT AUTHORIZATION]** | public site remains `7fe9009` |
| Exact-release public camera basic smoke | **PASS — fake camera ready, score 0→145, API POSTs `[]`, no console errors** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Predecessor Docker identity | **PASS for `2ab9584` only — `moverealm:2ab9584`, image `sha256:a205205819345589179d079656e0afefb38887b8b460a2c00d942dc0a11e47b6`, 343,057,128 bytes** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Predecessor Docker captured-room basic path | **PASS for `2ab9584` only — health true/CodeBuddy false, camera ready, `Safe fallback`, score 0→145, scene/plan POSTs, empty upload directory** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Earlier Docker full fallback adaptation | **PASS — predecessor evidence; not rerun for the deployed `7fe9009` release** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Exact-release public full smoke, commit `7fe9009` / run 31714506917 / build `build-31714506917` | **PASS — scores 0→145→290→435; `Guided demo` adaptation; 2.6 active min / 18% / `N/A` / 3.0-min clock; API POSTs `[]`; no console errors** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Anonymous guided-keyboard evidence export | **PASS — preserved JSON; SHA-256 `5a3da763…` and exact build/commit matched; pose gates `not_evaluated`** | [`public-guided-keyboard-session-7fe9009.json`](../artifacts/validation/public-guided-keyboard-session-7fe9009.json); [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Camera/Worker smoke | recorded synthetic-camera evidence on 13 August | [`VALIDATION.md`](VALIDATION.md) |
| Synthetic fake-camera live CodeBuddy UI | **PASS — health true, scene/adaptation `CodeBuddy live`, bounded adaptation, empty temporary upload directory** | [`VALIDATION.md`](VALIDATION.md); [`artifacts/README.md`](../artifacts/README.md) |
| Current local-candidate CodeBuddy strict scene check | **BLOCKED EXTERNALLY — localhost health true; labelled fallback after 45 s; sanitized log recorded HTTP 429 before generation on 8 retries; not a live pass** | [`codebuddy-upstream-blocker-2026-08-14.json`](../artifacts/validation/codebuddy-upstream-blocker-2026-08-14.json) |
| Public HTTPS real-person camera flow | **[PENDING DEVICE RUN]** | **[PENDING]** |
| Predecessor live CodeBuddy open/tight/uncertain matrix | **PASS for `2ab9584` evidence; synthetic adaptation telemetry is not human evidence** | [`live-agent-room-matrix-2ab9584.json`](../artifacts/validation/live-agent-room-matrix-2ab9584.json); [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Offline Shadow Judge | **PASS as controlled advisory evaluation — hard gates rejected an unsafe plan the model scored positively** | [`EVALUATION.md`](EVALUATION.md) |
| Python recovery agent, Qwen3-VL 4B | **PASS — clean `cf15709`; hard gates selected 15/24 fallback over ineligible 18/24 original** | [`python-agent-qwen3-vl-4b.json`](../artifacts/evaluation/python-agent-qwen3-vl-4b.json); [`EVALUATION.md`](EVALUATION.md) |
| Adversarial Safety Probe | **PASS — 332 candidates; 302 defended / 30 honored / 0 breaches / 0 over-rejections / 0 inconclusive; 20 controls; 7 frontiers** | [`safety-probe.json`](../agent/evidence/safety-probe.json); [`EVALUATION.md`](EVALUATION.md) |
| Three-person privacy-safe protocol | **READY — human execution still pending** | [`TRIAL_PROTOCOL.md`](TRIAL_PROTOCOL.md) |
| Real-person FPS / visible latency / TTFF | **[PENDING ALL MEASUREMENTS]** | [`VALIDATION.md`](VALIDATION.md) |
| Three-user trial | **[PENDING ALL 3 USERS]** | [`VALIDATION.md`](VALIDATION.md) |
| Camera-free 3–5 minute backup video | **PASS — local 4:58 artifact** | [`moverealm-guided-backup.mp4`](../assets/submission/moverealm-guided-backup.mp4) |
| Accepted video link | **[PENDING YOUTUBE OR GOOGLE DRIVE UPLOAD]** | **[PENDING VIDEO URL]** |

The exact-release full browser smoke above was a separate deployed-site observation, not a CI
browser job. Its keyboard timings and `N/A` pose fields are not human TTFF or pose evidence; the
preserved export's exact SHA-256 is recorded in the manifest below.

## Submission artifact manifest

Finalize artifacts first, then compute checksums. Any subsequent edit invalidates the checksum.

| Artifact | Requirement | Final location | SHA-256 |
|---|---|---|---|
| Public application | Optional bonus link | <https://ming3465.github.io/MoveRealm/> | n/a |
| Source repository | Submission/review source | <https://github.com/ming3465/MoveRealm> | n/a |
| 3–5 minute camera-free backup video | Required local artifact; upload still pending | [`assets/submission/moverealm-guided-backup.mp4`](../assets/submission/moverealm-guided-backup.mp4) | `dd4d2ef14e7eed8217f45a520a056e895d098a74755d5e09c0ba9fcbe3951951` |
| Demo video URL | Required portal field | **[PENDING YOUTUBE OR GOOGLE DRIVE URL]** | n/a |
| Backup narration transcript | Supporting accessibility/disclosure artifact | [`assets/submission/moverealm-guided-backup-transcript.txt`](../assets/submission/moverealm-guided-backup-transcript.txt) | `3ecedf106de903f9c552a4042a7c1a77e7514338a37d2c2bf3287fc2ffe3c20a` |
| 16:9 cover image, 380×216 px | Required | [`assets/submission/moverealm-cover-380x216.png`](../assets/submission/moverealm-cover-380x216.png) | `38637377111cffc7dce5c45ab3e9c0c3591fc55ce692f9af811940880b1dcf2c` |
| Project description export | Required portal copy | [`docs/SUBMISSION.md`](SUBMISSION.md) | see the [post-freeze manifest](../artifacts/submission-manifest.json) |
| Controlled CodeBuddy live-use proof | Supporting scoring evidence | [`assets/submission/screenshots/07-live-codebuddy-scene.png`](../assets/submission/screenshots/07-live-codebuddy-scene.png), [`08-live-codebuddy-adaptation.png`](../assets/submission/screenshots/08-live-codebuddy-adaptation.png), and [`artifacts/validation/`](../artifacts/validation/) | see [`artifacts/README.md`](../artifacts/README.md) |
| Predecessor sanitized live-agent matrix | Supporting `2ab9584` controlled evidence; synthetic telemetry is not human evidence | [`live-agent-room-matrix-2ab9584.json`](../artifacts/validation/live-agent-room-matrix-2ab9584.json) | `e4dabc45278f5be9d177c1c8d1282337d432a5cba3cbe8ebdc4c7008bfb05787` |
| Guided UI screenshot set | Supporting evidence | [`assets/submission/screenshots/`](../assets/submission/screenshots/) — 6 consent-free PNGs | see [`artifacts/README.md`](../artifacts/README.md) |
| Synthetic fake-camera CodeBuddy UI captures | Supporting controlled evidence, not real-person evidence | [`assets/submission/screenshots/`](../assets/submission/screenshots/) — 2 consent-free PNGs | see [`artifacts/README.md`](../artifacts/README.md) |
| Privacy-safe real-person trial protocol | Supporting procedure; all human actions pending | [`docs/TRIAL_PROTOCOL.md`](TRIAL_PROTOCOL.md) | see the [post-freeze manifest](../artifacts/submission-manifest.json) |
| Local anonymous evidence exporter | Supporting implementation; keyboard export smoke passed | [`src/lib/sessionEvidence.ts`](../src/lib/sessionEvidence.ts) | source-controlled |
| Current anonymous guided-keyboard export | Supporting exporter evidence; not a human trial | [`public-guided-keyboard-session-7fe9009.json`](../artifacts/validation/public-guided-keyboard-session-7fe9009.json) | `5a3da763a925d02c4152cd305587c3d60e20bb261e354f6372b59fb797ba4620` |
| Local-candidate guided full-smoke export; `build-20260814` is a local audit ID | Supporting exact clean-source guided evidence; not a human trial | [`local-guided-keyboard-session-cf15709.json`](../artifacts/validation/local-guided-keyboard-session-cf15709.json) | `aebcf7c43158672e1d4bc486f7f71c7cb56116df3256dcb4592fab1a5deed3aa` |
| Local-candidate captured fallback full-smoke export; `build-20260814` is a local audit ID | Supporting exact clean-source fallback/capture evidence; not a human trial | [`local-captured-fallback-keyboard-session-cf15709.json`](../artifacts/validation/local-captured-fallback-keyboard-session-cf15709.json) | `ebaa8c4cb97ef91e79c72a81f9f356beaeae04bb89c52bf98cf5e60232cc5b8d` |
| Offline Shadow Judge record | Supporting synthetic advisory evaluation; not runtime, safety certification, official judging, or human evidence | [`docs/EVALUATION.md`](EVALUATION.md) | see the [post-freeze manifest](../artifacts/submission-manifest.json) |
| Python Qwen3-VL 4B recovery record | Supporting controlled synthetic fail-closed agent evidence | [`python-agent-qwen3-vl-4b.json`](../artifacts/evaluation/python-agent-qwen3-vl-4b.json) | `b41ebb3f61d652b60d68b4c8e9c01f0b91e43af52fb311dbbf9bd1dd9fa9d029` |
| Safety Probe JSON / Markdown | Supporting synthetic contract-behaviour evidence | [`safety-probe.json`](../agent/evidence/safety-probe.json) / [`safety-probe.md`](../agent/evidence/safety-probe.md) | `df2eebab3db2a4ea5b50ea4ecfbd17e633a66ffe8bf7e6d5374592a6be34a8e5` / `e484a6efb3c972d82c604048a0fae46d722fd6e076b3302c2d5134505cb428df` |
| Current CodeBuddy blocker record | Availability/fallback evidence; explicitly not a live pass | [`codebuddy-upstream-blocker-2026-08-14.json`](../artifacts/validation/codebuddy-upstream-blocker-2026-08-14.json) | `961f9ad01e1932d2f93b53d0e3c593cce97b290169c10f195bc757df0d6319a9` |
| Final validation record | Supporting evidence | [`docs/VALIDATION.md`](VALIDATION.md) | see the [post-freeze manifest](../artifacts/submission-manifest.json) |
| Test/build/audit/smoke record | Supporting evidence | [`artifacts/validation/release-checks.md`](../artifacts/validation/release-checks.md) | see the [post-freeze manifest](../artifacts/submission-manifest.json) |

Example checksum commands, run only against the final files:

```bash
shasum -a 256 path/to/moverealm-source.zip
shasum -a 256 path/to/moverealm-demo.mp4
shasum -a 256 path/to/moverealm-cover.png
```

## Final portal check

- [ ] Project title, Life Agent direction, and CodeBuddy product selection are correct.
- [ ] Short blurb remains under ten words.
- [ ] Project image is 16:9 and readable at the recommended 380×216 px display size.
- [ ] Project description covers scenario, users, pain point, solution architecture, prompts, and
  defined or measured impact without converting targets into results.
- [x] Local backup video is 4:58.834 and contains the required overview, features, build reflection,
  and development tip.
- [ ] YouTube or Google Drive demo URL opens in a signed-out browser.
- [x] Public URL is populated and the HTTPS endpoint returns HTTP 200.
- [x] Release-application Pages run 31714506917 for commit `7fe9009` / build
  `build-31714506917` passed 100/100 tests across 13 files, the build, and deployment.
- [x] Clean local candidate `cf157093ff3dab7b3598387d68973f82a3e364c2` / tree
  `404fdc889cabc0212a6fd2197102eff7da5abde6` passed 120/120 Vitest, 13/13 recovery-agent,
  82/82 probe tests, build, audit with 0 vulnerabilities, and exact-provenance Docker checks.
- [x] Its guided and captured-room full smokes passed in production mode under local audit build ID
  `build-20260814` (not CI), with exact commit/build exports, privacy fields false, and keyboard pose
  metrics unevaluated.
- [ ] Obtain authorization, push the current local branch (application source checkpoint
  `cf15709` plus frozen evidence/docs), deploy it, and verify the resulting public build and pushed
  branch HEAD; until then the public app remains `7fe9009`.
- [ ] Retry the strict CodeBuddy check and require a generated `CodeBuddy live` result; the current
  local-candidate check is externally blocked and returned `Safe fallback` after 45 seconds.
- [x] Exact-release full smoke verified the anonymous keyboard export's visible SHA-256,
  `N/A`/`not_evaluated` pose semantics, exact build identity, three rounds and adaptation,
  no API POSTs, and no console errors.
- [x] Six consent-free guided screenshots exist under `assets/submission/screenshots/`.
- [x] Two additional consent-free synthetic fake-camera CodeBuddy UI captures exist under
  `assets/submission/screenshots/`; they are not real-person evidence.
- [x] Product-sharing paragraph is complete and supported by versioned runtime evidence.
- [ ] All secrets and participant-identifying material are redacted or consented.
- [x] Finalized binary hashes match the frozen files; documentation hashes are recorded in the
  post-freeze manifest, and the uploaded video must still be rechecked after transfer.
- [ ] Every pending validation value remains visibly pending unless a raw observation exists.
- [x] Real-person FPS, visible latency, TTFF, and all three user trials remain marked pending unless
  their raw evidence is captured; the accepted video URL remains pending upload.
- [ ] Run and privacy-review all three human trials in [`TRIAL_PROTOCOL.md`](TRIAL_PROTOCOL.md).
- [ ] Fill team members and the registered hackathon contact email in the portal.
