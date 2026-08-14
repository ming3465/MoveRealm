# Release and validation artifacts

## Offline Shadow Judge

[`evaluation/`](evaluation/) contains frozen synthetic candidate bundles and schema-validated
local Qwen3-VL reports. These are advisory evaluator observations, not runtime output, safety
certification, official judging, or human-trial evidence. See
[`docs/EVALUATION.md`](../docs/EVALUATION.md) for reproduction and limitations.

Deterministic fixture, contract, consistency, and movement-feasibility gates run first and remain
authoritative. In the recorded uncertain-room case, they rejected an occluded-floor squat even
though the advisory model scored that plan positively; the reach-only validated fallback passed.
The 8B open/tight candidate/report files are frozen predecessor `7fe9009` evaluator snapshots. Their
candidate JSON does not satisfy the newer current canonical-presentation gates; do not cite those
old open/tight results as current-candidate passes.

[`evaluation/python-agent-qwen3-vl-4b.json`](evaluation/python-agent-qwen3-vl-4b.json) is the
privacy-bounded output of the optional Python recovery agent using local Qwen3-VL 4B. The model
preferred the unsafe original 18/24 over the safe fallback 15/24; deterministic gates rejected the
original and the agent selected the labelled fallback. Its SHA-256 is
`b41ebb3f61d652b60d68b4c8e9c01f0b91e43af52fb311dbbf9bd1dd9fa9d029`. It embeds clean commit
`cf157093ff3dab7b3598387d68973f82a3e364c2`, tree
`404fdc889cabc0212a6fd2197102eff7da5abde6`, and shared context SHA-256
`502824677434c6c6d0196d367ecdcfdde1f8aaa84138f1fe976858dce766fcfa`. The original and fallback
judge latencies were 43.492 and 37.550 seconds respectively.

## Released implementation checkpoint — 14 August 2026

- Exact source commit: `49dadbee7bf106b9434cae5a992d456d3cac1433`
- Exact source tree: `cb5f6e024784156864c8fc4acf7af7673c3f49d4`
- `npm run test:all`: **128/128 Vitest tests across 16 files**, **13/13 Python recovery-agent tests**,
  and **82/82 safety-probe tests**.
- Strict production build: **passed**.
- Dependency audit: **0 vulnerabilities**.
- Exact-source Docker image:
  `sha256:4119e32ef7f0145daa53a6669259fe0cbf81324b682689651cdc97003d3c7c15`
  (343,108,191 bytes); health before/after, exact `build-20260814`/commit assertions,
  captured-room basic fallback smoke, scene/plan request audit, and zero-upload cleanup passed. The
  temporary audit container stopped after escalation with exit 137, not gracefully.
- Free local CodeBuddy/Qwen3-VL 4B strict matrix: **passed** with fallback forbidden. Open, tight,
  and uncertain rooms produced materially different profiles and safe 180-second plans; the live
  adaptation reduced squat range 0.62→0.46, tempo 1.00→0.87, and target rate 10→9.
- Synthetic-camera invalid-room recovery: **passed** with visible `Safe fallback`, camera ready,
  safe confirmation defaults, exact scene/plan POSTs, score 0→145, and no console errors. Chrome's
  green test card is not a room, so this is resilience—not live scene-understanding—evidence.
- Release: shipped in application commit `49dadbee7bf106b9434cae5a992d456d3cac1433`, Pages run
  31764155833, build `build-31764155833`.

Current live evidence is
[`validation/codebuddy-local-qwen-matrix-5b77105.json`](validation/codebuddy-local-qwen-matrix-5b77105.json)
(SHA-256 `8ac958431bd25c0ec9947a295656a17f083f7df3878cca8abd26f141b79215f6`)
and
[`validation/codebuddy-local-synthetic-camera-fallback-5b77105.json`](validation/codebuddy-local-synthetic-camera-fallback-5b77105.json)
(SHA-256 `248df0f0fd5868b293500bb9e71406766a91f0847c09bd98d3af6100d6792a49`).
They contain structured synthetic-fixture or controlled fake-camera results only—no image bytes,
raw model output, credentials, participant data, or real-person pose measurements.

The Safety Probe's clean contract run covered 332 candidates: 302 defended, 30 honored, 0 breaches,
0 over-rejections, and 0 inconclusive probes, with 20/20 controls and seven matching frontiers. Its
SHA-256 values are `099383377d19483a10256ad5a9bef7789be06d02dad2395dfe5a48275e484bdd`
for [`../agent/evidence/safety-probe.json`](../agent/evidence/safety-probe.json) and
`a0b17057adb890a0e0f6b51d8f96959642c1c8d04e440e97611eab909c0dd164` for
[`../agent/evidence/safety-probe.md`](../agent/evidence/safety-probe.md).

## Current public release — 14 August 2026

- Public guided demo: <https://ming3465.github.io/MoveRealm/>
- Source repository: <https://github.com/ming3465/MoveRealm>
- Release-application deployment:
  [GitHub Pages run 31764155833](https://github.com/ming3465/MoveRealm/actions/runs/31764155833)
  for commit
  [`49dadbe`](https://github.com/ming3465/MoveRealm/commit/49dadbee7bf106b9434cae5a992d456d3cac1433)
  completed `npm ci`, **128/128 Vitest**, **13/13 Python recovery-agent**, and **82/82 safety-probe
  tests**, the production build, artifact upload, and deployment. The deployed client carries build
  `build-31764155833` and the exact full commit SHA.
- Dependency audit: **0 vulnerabilities**.
- Exact-release public camera/full smoke: **passed** with Chrome's fake camera,
  `cameraReady=true`, pause/focus containment, and no console errors. It is controlled, non-human
  evidence and was run separately from CI.
- That same full smoke against commit `49dadbe` / run 31764155833 / build
  `build-31764155833`: **passed** with `Guided demo` provenance. Round scores were
  0 → 145 → 290 → 435; adaptation
  64 → 48%, 0.90 → 0.77×, and 7 → 6; postcard 2.6 active minutes / 3.0-minute adventure /
  18% completion / tracking `N/A`; API POSTs `[]`; no console errors. The visible and downloaded
  SHA-256 both matched
  `f003b7eb3015f426125725237c90dccd2128198ba599f069fcaec0f7e3e78c93` for
  [`validation/public-guided-keyboard-session-49dadbe.json`](validation/public-guided-keyboard-session-49dadbe.json).
- The exact release Docker image `sha256:4119e32e…` passed health,
  captured-room basic fallback, exact identity, and zero-upload cleanup before release. Earlier
  `2ab9584` packaged/full-session results remain predecessor-only evidence.

The preserved release command and result record belongs in
[`validation/release-checks.md`](validation/release-checks.md).

The public GitHub Pages site is the static guided-demo build. Live CodeBuddy scene, planning, and
adaptation calls require the Node adapter; static hosting uses the visibly labelled guided or safe
deterministic path and must not be described as live CodeBuddy.

## Sanitized live-agent evidence

The current recommended runtime evidence is the local CodeBuddy/Qwen3-VL 4B
[`strict matrix`](validation/codebuddy-local-qwen-matrix-5b77105.json) plus the controlled
[`synthetic-camera fallback`](validation/codebuddy-local-synthetic-camera-fallback-5b77105.json).
The matrix records clean source/tree provenance, exact model-manifest hashes, three differentiated
room/plan pairs, live adaptation, current hard-gate eligibility, and an empty upload directory. The
browser record separately proves visible safe recovery from a non-room input. Both remain
synthetic/controlled evidence, not human trials.

The newest signed-in/upstream mixed result is
[`validation/codebuddy-current-vision-instability-2026-08-14.json`](validation/codebuddy-current-vision-instability-2026-08-14.json),
SHA-256 `6acfa59a47552c0b0c0334c4c9c627949ae4c65aa09d1eeeaa8064864d283fda`.
It records a genuine strict tight-room scene → plan → adapt pass, followed by a failed three-room
differentiation gate, a strict browser fallback at 45 seconds, and bounded explicit vision-model
timeouts. No credential, prompt, raw response, local path, image, or participant data is retained.
It proves that the upstream structured loop can run and that recovery is safe; it does **not**
describe the now-passing local 4B route.

The earlier availability record is
[`validation/codebuddy-upstream-blocker-2026-08-14.json`](validation/codebuddy-upstream-blocker-2026-08-14.json),
SHA-256 `961f9ad01e1932d2f93b53d0e3c593cce97b290169c10f195bc757df0d6319a9`.
For local candidate `cf15709`, localhost health was true, but the strict scene smoke reached the
bounded 45-second deadline and selected the labelled deterministic fallback. The sanitized log
recorded HTTP 429 before generation on all eight upstream retries. It retains no credential, prompt,
model response, local log path, or room image. This record proves bounded recovery and cleanup; it is
**not** a successful live CodeBuddy observation. The artifact also discloses that the observation
preceded the clean source freeze and occurred in a dirty worktree; its source was later frozen as
`cf15709`.

The predecessor live-agent JSON files described below are sanitized observations from
`npm run smoke:agent` on 13 August 2026. They contain synthetic fixture hashes, structured scene/plan/adaptation output, source labels,
latencies, and upload-cleanup state. They contain no room image bytes, live frames, landmarks,
credentials, run IDs, submitted model prompts, email addresses, or personal data. The structured
adaptation records do retain bounded user-facing round instructions and reasons generated from
synthetic fixtures; they are not participant text.

The predecessor `2ab9584` room matrix is preserved in
[`validation/live-agent-room-matrix-2ab9584.json`](validation/live-agent-room-matrix-2ab9584.json):

| Fixture | Scene | Directions | Plan signature | Scene / plan latency |
|---|---|---|---|---|
| Open | open | vertical, left, right, centre | reach 0.85, squat 0.80, side-step 0.90 | 12.686 s / 24.178 s |
| Tight | tight | vertical, centre | reach 0.65, squat 0.75, reach 0.68 | 13.433 s / 26.180 s |
| Uncertain | uncertain | vertical, centre | reach 0.55, squat 0.60, reach 0.62 | 15.060 s / 22.017 s |

Each row records `codebuddy` as the scene and plan source and a 180-second safe plan. The matrix also
records an empty local temporary-upload directory after all analyses. Its tight-room adaptation has
`codebuddy` provenance, took 7.627 s, and changed range 0.75 → 0.55, tempo 0.78 → 0.62, and target
rate 7 → 5.

The earlier individual `live-agent-open-room.json`, `live-agent-tight.json`, and
`live-agent-uncertain-room.json` files remain preserved as predecessor observations rather than
being silently overwritten.

`live-agent-tight-room.json` intentionally preserves a separate transient recovery run in which
scene and adaptation were live but the plan timed out after 30 seconds and returned the labelled
deterministic fallback. It demonstrates the fallback state and must not be cited as a successful
live-plan observation.

The adaptation input in these files is explicitly marked `syntheticTelemetry`: 4 of 12 targets,
`too_hard`, keyboard mode, pose confidence 0, and tracking FPS 0. It is a controlled contract test,
not a human trial, real-person pose measurement, or user result.

## Synthetic fake-camera live CodeBuddy UI evidence

A separate controlled browser flow used Chrome's synthetic fake-camera stream, not a real person.
It recorded `/api/health` with `codeBuddyConnected: true`; a scene screen with a visible
`CodeBuddy live` badge and 34.826 s source latency; and an adaptation screen with a visible
`CodeBuddy live` badge and 12.438 s source latency. The adaptation reduced range 60 → 45%, tempo
0.90 → 0.70×, and target rate 7 → 5. The temporary upload directory was empty after analysis.

The displayed seconds are agent request/source latencies, not camera-to-visual response latency.
This controlled evidence establishes agent connectivity, UI provenance, bounded adaptation, and
upload cleanup; it does not establish real-person FPS, visible movement latency, TTFF, accuracy,
usability, or a participant result.

## Guided-session time accounting

The full guided browser smoke asserts the result card's exact accounting:

- Three 52-second movement rounds = 156 seconds = **2.6 active minutes**.
- Two 12-second rests = 24 seconds = 0.4 minutes.
- Total adventure = 180 seconds = **3.0 minutes**.
- Guided keyboard-mode tracking FPS is `N/A`.

This supports the wording “2.6 active minutes within a 3.0-minute adventure.” It does not support a
claim of three active minutes or any real-person tracking result.

The current exact-release guided keyboard record is preserved at
[`validation/public-guided-keyboard-session-49dadbe.json`](validation/public-guided-keyboard-session-49dadbe.json).
Its pose metrics and real-camera thresholds are explicitly `null` / `not_evaluated`; it validates
the exporter and release identity but is not a human trial.

## Reproduction commands

Verify all local candidate test layers before collecting browser evidence:

```bash
npm run test:all
npm run build
npm audit --audit-level=low
```

Start the local app in one terminal:

```bash
npm run dev
```

Run browser evidence from a second terminal:

```bash
npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 MOVEREALM_CAPTURE_SMOKE=1 npm run smoke:browser
MOVEREALM_ADAPT_SMOKE=1 npm run smoke:browser
MOVEREALM_URL=https://ming3465.github.io/MoveRealm/ MOVEREALM_CAMERA_SMOKE=1 \
  MOVEREALM_FULL_SMOKE=1 \
  MOVEREALM_EXPECT_COMMIT=49dadbee7bf106b9434cae5a992d456d3cac1433 \
  MOVEREALM_EXPECT_BUILD_ID=build-31764155833 npm run smoke:browser
```

The camera smoke uses Chrome's fake media stream to check permission and Worker readiness. It does
not contain a trackable person. Its request audit verifies exactly one room-still POST in that
controlled run; the real-camera inspection remains pending. Preserve a fresh command log before
calling any individual command a final submission run.

For new live-agent artifacts, start CodeBuddy and the app, verify `/api/health` reports
`codeBuddyConnected: true`, then use `npm run smoke:agent` with an explicit fixture and evidence path.
Require generated `codebuddy` provenance before calling it live; health alone is insufficient. Do
not overwrite the release JSON files without reviewing their provenance and sanitization.

```bash
ollama serve
ollama pull qwen3-vl:4b-instruct-q4_K_M
npm run director:local:setup
npm run codebuddy:local

MOVEREALM_ROOM_MATRIX=1 \
  MOVEREALM_AGENT_EVIDENCE=/tmp/moverealm-local-room-matrix.json \
  npm run smoke:agent
```

## Artifact checksums

| File | SHA-256 |
|---|---|
| `validation/public-guided-keyboard-session-49dadbe.json` | `f003b7eb3015f426125725237c90dccd2128198ba599f069fcaec0f7e3e78c93` |
| `validation/codebuddy-local-qwen-matrix-5b77105.json` | `8ac958431bd25c0ec9947a295656a17f083f7df3878cca8abd26f141b79215f6` |
| `validation/codebuddy-local-synthetic-camera-fallback-5b77105.json` | `248df0f0fd5868b293500bb9e71406766a91f0847c09bd98d3af6100d6792a49` |
| `evaluation/python-agent-qwen3-vl-4b.json` | `b41ebb3f61d652b60d68b4c8e9c01f0b91e43af52fb311dbbf9bd1dd9fa9d029` |
| `../agent/evidence/safety-probe.json` | `099383377d19483a10256ad5a9bef7789be06d02dad2395dfe5a48275e484bdd` |
| `../agent/evidence/safety-probe.md` | `a0b17057adb890a0e0f6b51d8f96959642c1c8d04e440e97611eab909c0dd164` |
| `validation/codebuddy-current-vision-instability-2026-08-14.json` | `6acfa59a47552c0b0c0334c4c9c627949ae4c65aa09d1eeeaa8064864d283fda` |
| `validation/codebuddy-upstream-blocker-2026-08-14.json` | `961f9ad01e1932d2f93b53d0e3c593cce97b290169c10f195bc757df0d6319a9` |
| `validation/local-guided-keyboard-session-cf15709.json` | `aebcf7c43158672e1d4bc486f7f71c7cb56116df3256dcb4592fab1a5deed3aa` |
| `validation/local-captured-fallback-keyboard-session-cf15709.json` | `ebaa8c4cb97ef91e79c72a81f9f356beaeae04bb89c52bf98cf5e60232cc5b8d` |
| `validation/public-guided-keyboard-session-7fe9009.json` | `5a3da763a925d02c4152cd305587c3d60e20bb261e354f6372b59fb797ba4620` |
| `validation/public-guided-keyboard-session-2ab9584.json` | `00458af188807b5e2e49df994ac1581ff27608d9d1628f60d4df11158c2ef8b7` |
| `validation/live-agent-room-matrix-2ab9584.json` | `e4dabc45278f5be9d177c1c8d1282337d432a5cba3cbe8ebdc4c7008bfb05787` |
| `validation/live-agent-open-room.json` | `fb29536989e0c56764acdf764cf8def9e954d93ba89707bdbef30b4a368155f5` |
| `validation/live-agent-tight.json` | `340cfbed25d8a78f38f0cd2a6797202f00807ed88dbac89318cff5267f2f08d7` |
| `validation/live-agent-uncertain-room.json` | `159bfcfde10804f29b6b34f7a6ef2d00f25aa92d871777a57da2d1f53f723889` |
| `validation/live-agent-tight-room.json` | `c7bc82a101ab9b641a79f9422eecf2fb29d02d5d554fe9eb51fcbffc58f59d3d` |
| `../assets/submission/moverealm-cover-380x216.png` | `38637377111cffc7dce5c45ab3e9c0c3591fc55ce692f9af811940880b1dcf2c` |

Any edit to an artifact invalidates its listed checksum; recompute with `shasum -a 256 <file>`.

The final documentation and evidence-file hashes are collected after the documentation snapshot in
[`submission-manifest.json`](submission-manifest.json). Keeping that manifest separate avoids a
self-referential checksum inside `docs/SUBMISSION.md`. The manifest does not claim that pending
human, video-upload, or portal work is complete.

## Consent-free guided screenshots

Six 1440×913 guided-flow PNGs exist under `../assets/submission/screenshots/`. They contain no
participant or retained webcam frame and show the complete UI sequence:

| File | SHA-256 |
|---|---|
| `01-landing.png` | `abb574b44daa01bcda4ccd4bd43548d7e9d989627f35853dc5d2dd70d1811d18` |
| `02-confirm-room.png` | `3cecb302b16dc4b29b0444d60f77f80691fea707a84e0fc1c150ceda83460bc0` |
| `03-calibration.png` | `12e9f974d1570ac2f112ef94a6778e75e112c9641e91e6850d7639fd28f0938e` |
| `04-game.png` | `e89388ff5245bd38b8405a783f6087af2f3b571f502790521d6430885a587d60` |
| `05-adaptation.png` | `b3d632ad24b94e82c9a5f44a141b55cfe98fd2a7ba229d1662c9ce1c24bb2fea` |
| `06-postcard.png` | `7aed29ba39d0d12341fa1e9027d4b0e06b84f310add77731c9a6428cde35ff42` |

These are guided-demo submission artifacts, not live CodeBuddy, participant, or real-device
performance evidence.

Two additional 1440×857 consent-free captures document the synthetic fake-camera live-CodeBuddy UI
flow. They are separate from the six guided screenshots and are controlled, non-human evidence:

| File | SHA-256 |
|---|---|
| `07-live-codebuddy-scene.png` | `48e0e5f0fd8bd402f8550021b3ca338034414d7a9ad6acc2252ff0c68889fc4a` |
| `08-live-codebuddy-adaptation.png` | `06c00b49384d72ee83f0ada2d8a476e486f7a189020ac5bf68ce28949dbfce40` |

## Explicitly pending evidence

- **Pending:** real-person pose FPS on the target device.
- **Pending:** real-person visible camera-to-game latency.
- **Pending:** real-person time to first accepted movement (TTFF).
- **Pending:** all three qualitative user trials.
- **Complete controlled agent evidence:** the current local CodeBuddy/Qwen3-VL 4B strict matrix
  generated the full loop and materially differentiated all three rooms; the synthetic-camera
  smoke separately proved labelled recovery from a non-room input.
- **Complete release evidence:** application commit `49dadbe`, Pages run 31764155833, exact public
  camera and full-session smokes, pushed `origin/main`, and the preserved anonymous export all
  passed their identity checks.
- **Complete local artifact:** 4:58 camera-free backup video, transcript, and timed captions; see below.
- **Pending:** upload that video, or a preferred live-person recording, to YouTube or Google Drive
  and verify its public URL.
- **Pending:** team-member and registered-contact portal fields.

Synthetic fixtures, keyboard telemetry, a successful deployment, and a camera-permission smoke do
not close any of those pending items.

## Camera-free backup video

| Artifact | Observation | SHA-256 |
|---|---|---|
| `../assets/submission/moverealm-guided-backup.mp4` | 4:58.834; 1440×810; H.264 + mono AAC; synthetic narration; −16.4 LUFS integrated / −1.0 dBFS true peak | `dd4d2ef14e7eed8217f45a520a056e895d098a74755d5e09c0ba9fcbe3951951` |
| `../assets/submission/moverealm-guided-backup-transcript.txt` | 784-word disclosure and narration transcript | `3ecedf106de903f9c552a4042a7c1a77e7514338a37d2c2bf3287fc2ffe3c20a` |
| `../assets/submission/moverealm-guided-backup.vtt` | 56 timed cues covering the full narration; final cue ends at 4:58.072 | `9c27775af1eaab3fb5de5b4da43f3b9cc3efef5130de85a4a2c0b0b6163c9953` |
| `../assets/submission/architecture.png` | 1440×810 code-rendered architecture slide | `f0c3f27be72d9635ee194423d48f2f4d05324a83971debc50dc8849c2e32342b` |
| `../assets/submission/backup-video-title.png` | 1440×810 baked-in camera-free disclosure card | `adc4cca02b0700610530fc690f0680e0c5af430f6fdb433fa84554fa2294c56c` |

The video covers the project overview, core agent loop, architecture/build approach, and a practical
CodeBuddy structured-output tip. It shows both `CodeBuddy live` controlled evidence and visibly
labelled guided behavior. It does not close the real-person validation items above. The official
handbook accepts a YouTube or Google Drive video link, so the local file still needs a user-owned
upload and signed-out access check.
