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

The public URL is a static GitHub Pages deployment of the complete guided-demo path. It visibly
labels guided and deterministic decisions and does not claim to host the live CodeBuddy server
adapter. Release-application
[Pages run 31675892852](https://github.com/ming3465/MoveRealm/actions/runs/31675892852) for commit
[`d640de4`](https://github.com/ming3465/MoveRealm/commit/d640de4) passed all 55 tests across 7 files,
the production build, artifact upload, and deployment.

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

### Defined impact and commercial hypothesis

The intended product outcomes are a first accepted movement within 45 seconds, at least 20 pose FPS
on an M1 Pro, and under 100 ms visible response latency. These are targets, not measured claims; the
human/device rows are explicitly pending in [VALIDATION.md](VALIDATION.md).

The initial route is a consumer short-movement product. Potential licensing routes include corporate
wellness, hospitality, and community-fitness programs, where the same bounded Movement Director can
adapt branded worlds to constrained rooms. These routes are commercial hypotheses; no revenue,
conversion, retention, or population-level user result has yet been validated.

## CodeBuddy product sharing

Use this paragraph in the portal, then replace the final placeholder with truthful development-use
evidence:

> MoveRealm uses the CodeBuddy CLI HTTP service as its live Movement Director. Our Express adapter
> submits structured scene, plan, and adaptation tasks to asynchronous `/api/v1/runs`, reads the SSE
> stream, validates every response against strict Zod safety contracts, retries one schema-invalid
> response, and visibly switches to a deterministic safe fallback if the service is unavailable.
> This made CodeBuddy useful as a bounded decision-maker inside a real-time product instead of an
> opaque chatbot. **[ADD ONE TRUTHFUL SENTENCE ABOUT CODEBUDDY'S DEVELOPMENT WORKFLOW AND LINK THE
> CORRESPONDING PROMPT/HISTORY OR USAGE SCREENSHOT.]**

Required proof before submission:

- [x] Sanitized runtime artifacts record `/api/health` with `codeBuddyConnected: true` for the three
  controlled room-matrix runs.
- [x] Two synthetic fake-camera UI captures record health connectivity, visible `CodeBuddy live`
  scene/adaptation provenance, the bounded adaptation, and empty temporary-upload cleanup. They are
  controlled evidence, not a real-person run or final-video proof.
- [ ] Screenshot or recording of `/api/health` showing `codeBuddyConnected: true` in the final video.
- [ ] Visible `CodeBuddy live` badge in the demo.
- [ ] Redacted CodeBuddy task/history or usage screenshot proving product use.
- [ ] No password, bearer token, redemption code, email, or private prompt content visible.
- [ ] Development-use sentence above is supported by the captured evidence.

## Official rubric map

The dimensions and weights below reproduce the official Participant Handbook. “Gap before submit”
items are disclosure and evidence tasks, not claims that the criterion has already been satisfied.

| Official dimension | Weight | MoveRealm evidence to put on screen | Repository evidence | Gap before submit |
|---|---:|---|---|---|
| AI innovation — scenario insight and depth of AI utilization | 30% | One approved still becomes a constrained plan; missed targets plus explicit feedback produce a visible next-round change | [`server/codebuddy.ts`](../server/codebuddy.ts), [`server/prompts.ts`](../server/prompts.ts), [`src/components/GameScreen.tsx`](../src/components/GameScreen.tsx), and the [live room matrix](../artifacts/README.md) | Show live CodeBuddy provenance in the video and do not describe deterministic fallback as live AI |
| Technical excellence — implementation, AI-tool mastery, completeness, stability | 20% | Show source badge, safety rejection boundary, local pose Worker, low-confidence pause, and fallback recovery | [`src/shared/contracts.ts`](../src/shared/contracts.ts), [`server/app.ts`](../server/app.ts), [`src/pose/pose.worker.ts`](../src/pose/pose.worker.ts), 55/55 current tests across 7 files, 0 audit vulnerabilities, and successful Pages run 31675892852 | Cite [`release-checks.md`](../artifacts/validation/release-checks.md) and complete remaining real-person measurements |
| User experience and demo — smoothness, interaction thoughtfulness, friendliness | 25% | Three-minute setup, room confirmation, calibration, visible adaptation trace, pause/resume, result postcard, guided backup | [`docs/DEMO.md`](DEMO.md), [`src/App.tsx`](../src/App.tsx), [`src/components/`](../src/components) | Record a clean 3–5 minute take; user trials remain pending |
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
- **Health scope:** This is light movement for healthy adults, not medical or rehabilitation
  guidance. Users should stop if they feel pain, dizziness, or unwell.

## Release gates

Run from the repository root and save the complete terminal output with the submission artifacts:

```bash
npm test
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
| Unit/contracts/adapter tests | **PASS — 55/55 tests across 7 files** | [Pages run 31675892852](https://github.com/ming3465/MoveRealm/actions/runs/31675892852); [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Strict client/server build | **PASS** | [Pages run 31675892852](https://github.com/ming3465/MoveRealm/actions/runs/31675892852) |
| Release-application GitHub Pages deployment, commit `d640de4` | **PASS** | [run 31675892852](https://github.com/ming3465/MoveRealm/actions/runs/31675892852), <https://ming3465.github.io/MoveRealm/> |
| Dependency audit | **PASS — 0 vulnerabilities** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Public basic browser smoke | **PASS** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Public adaptation smoke | **PASS — `Guided demo` provenance** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Docker captured-room fallback adaptation | **PASS — `Safe fallback` provenance** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Controlled captured-room request audit | **PASS — one still POST; only plan/adaptation POSTs afterward** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Exact-release public full smoke, commit `d640de4` / run 31675892852 | **PASS — 3 rounds, adaptation, honest postcard, replay/stop, no console errors** | [`release-checks.md`](../artifacts/validation/release-checks.md) |
| Camera/Worker smoke | recorded synthetic-camera evidence on 13 August | [`VALIDATION.md`](VALIDATION.md) |
| Synthetic fake-camera live CodeBuddy UI | **PASS — health true, scene/adaptation `CodeBuddy live`, bounded adaptation, empty temporary upload directory** | [`VALIDATION.md`](VALIDATION.md); [`artifacts/README.md`](../artifacts/README.md) |
| Public HTTPS real-person camera flow | **[PENDING DEVICE RUN]** | **[PENDING]** |
| Live CodeBuddy open/tight/uncertain fixture matrix | **PASS — controlled evidence** | [`artifacts/README.md`](../artifacts/README.md) |
| Real-person FPS / visible latency / TTFF | **[PENDING ALL MEASUREMENTS]** | [`VALIDATION.md`](VALIDATION.md) |
| Three-user trial | **[PENDING ALL 3 USERS]** | [`VALIDATION.md`](VALIDATION.md) |
| Final 3–5 minute video | **[PENDING RECORDING AND UPLOAD]** | **[PENDING VIDEO URL]** |

## Submission artifact manifest

Finalize artifacts first, then compute checksums. Any subsequent edit invalidates the checksum.

| Artifact | Requirement | Final location | SHA-256 |
|---|---|---|---|
| Public application | Optional bonus link | <https://ming3465.github.io/MoveRealm/> | n/a |
| Source repository | Submission/review source | <https://github.com/ming3465/MoveRealm> | n/a |
| 3–5 minute demo video | Required | **[PENDING YOUTUBE OR GOOGLE DRIVE URL]** | `<SHA256-PENDING>` |
| 16:9 cover image, 380×216 px | Required | [`assets/submission/moverealm-cover-380x216.png`](../assets/submission/moverealm-cover-380x216.png) | `38637377111cffc7dce5c45ab3e9c0c3591fc55ce692f9af811940880b1dcf2c` |
| Project description export | Required portal copy | [`docs/SUBMISSION.md`](SUBMISSION.md) | `<SHA256-PENDING-AFTER-FREEZE>` |
| CodeBuddy usage proof | Required for scoring eligibility | **[PENDING REDACTED FILE]** | `<SHA256-PENDING>` |
| Sanitized live-agent evidence | Supporting evidence | [`artifacts/validation/`](../artifacts/validation/) | see [`artifacts/README.md`](../artifacts/README.md) |
| Guided UI screenshot set | Supporting evidence | [`assets/submission/screenshots/`](../assets/submission/screenshots/) — 6 consent-free PNGs | see [`artifacts/README.md`](../artifacts/README.md) |
| Synthetic fake-camera CodeBuddy UI captures | Supporting controlled evidence, not real-person evidence | [`assets/submission/screenshots/`](../assets/submission/screenshots/) — 2 consent-free PNGs | see [`artifacts/README.md`](../artifacts/README.md) |
| Final validation record | Supporting evidence | `docs/VALIDATION.md` | `<SHA256-PENDING>` |
| Test/build/audit/smoke record | Supporting evidence | [`artifacts/validation/release-checks.md`](../artifacts/validation/release-checks.md) | `<SHA256-PENDING-AFTER-FREEZE>` |

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
- [ ] Demo URL opens in a signed-out browser and is 3–5 minutes long.
- [x] Public URL is populated and the HTTPS endpoint returns HTTP 200.
- [x] Release-application Pages run 31675892852 for commit `d640de4` passed 55/55 tests across 7
  files, the build, and deployment.
- [x] Six consent-free guided screenshots exist under `assets/submission/screenshots/`.
- [x] Two additional consent-free synthetic fake-camera CodeBuddy UI captures exist under
  `assets/submission/screenshots/`; they are not real-person evidence.
- [ ] Product-sharing paragraph includes truthful CodeBuddy development-use proof.
- [ ] All secrets and participant-identifying material are redacted or consented.
- [ ] Artifact hashes match the uploaded final files.
- [ ] Every pending validation value remains visibly pending unless a raw observation exists.
- [ ] Real-person FPS, visible latency, TTFF, all three user trials, and the demo video remain marked
  pending unless their raw evidence is captured.
