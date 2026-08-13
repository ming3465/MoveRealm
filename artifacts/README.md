# Release and validation artifacts

## Release snapshot — 13 August 2026

- Public guided demo: <https://ming3465.github.io/MoveRealm/>
- Source repository: <https://github.com/ming3465/MoveRealm>
- Release-application deployment:
  [GitHub Pages run 31682611174](https://github.com/ming3465/MoveRealm/actions/runs/31682611174)
  for commit
  [`2ab9584`](https://github.com/ming3465/MoveRealm/commit/2ab9584cff8d98bbfb41b1d7f8b9fa821257ac52)
  completed `npm ci`, **75/75 tests across 10 files**, the production build, artifact upload, and
  deployment. The deployed client carries build `build-31682611174` and the exact full commit SHA.
- Current release verification: 10 test files, **75/75 tests passed** locally and in CI.
- Dependency audit: **0 vulnerabilities**.
- Public basic smoke: **passed**.
- Exact-release public full smoke: **passed** with `Guided demo` provenance and no API POSTs or
  console errors. Its preserved anonymous keyboard export is
  [`validation/public-guided-keyboard-session-2ab9584.json`](validation/public-guided-keyboard-session-2ab9584.json).
- Exact-release Docker captured-room basic path: **passed** with `Safe fallback` provenance; one
  scene-still POST followed by the plan POST, no unexpected destination, and an empty upload
  directory. An earlier packaged full fallback adaptation is predecessor evidence, not a current-
  image full run.
- Exact-release public full smoke against commit `2ab9584` / run 31682611174: round scores
  0 → 145 → 290 → 435; adaptation
  64 → 48%, 0.90 → 0.77×, and 7 → 6; postcard 2.6 active minutes / 3.0-minute adventure /
  tracking `N/A`; replay and stop passed; no console errors. The visible and downloaded SHA-256
  both matched `00458af188807b5e2e49df994ac1581ff27608d9d1628f60d4df11158c2ef8b7`.

The preserved release command and result record belongs in
[`validation/release-checks.md`](validation/release-checks.md).

The public GitHub Pages site is the static guided-demo build. Live CodeBuddy scene, planning, and
adaptation calls require the Node adapter; static hosting uses the visibly labelled guided or safe
deterministic path and must not be described as live CodeBuddy.

## Sanitized live-agent evidence

The JSON files in `validation/` are sanitized observations from `npm run smoke:agent` on 13 August
2026. They contain synthetic fixture hashes, structured scene/plan/adaptation output, source labels,
latencies, and upload-cleanup state. They contain no room image bytes, live frames, landmarks,
credentials, run IDs, submitted model prompts, email addresses, or personal data. The structured
adaptation records do retain bounded user-facing round instructions and reasons generated from
synthetic fixtures; they are not participant text.

The current-release room matrix is preserved in
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

The exact-release guided keyboard record is preserved at
[`validation/public-guided-keyboard-session-2ab9584.json`](validation/public-guided-keyboard-session-2ab9584.json).
Its pose metrics and real-camera thresholds are explicitly `null` / `not_evaluated`; it validates
the exporter and release identity but is not a human trial.

## Reproduction commands

Start the local app in one terminal:

```bash
npm run dev
```

Run browser evidence from a second terminal:

```bash
npm run smoke:browser
MOVEREALM_FULL_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 npm run smoke:browser
MOVEREALM_CAMERA_SMOKE=1 MOVEREALM_CAPTURE_SMOKE=1 npm run smoke:browser
MOVEREALM_ADAPT_SMOKE=1 npm run smoke:browser
```

The camera smoke uses Chrome's fake media stream to check permission and Worker readiness. It does
not contain a trackable person. Its request audit verifies exactly one room-still POST in that
controlled run; the real-camera inspection remains pending. Preserve a fresh command log before
calling any individual command a final submission run.

For new live-agent artifacts, start CodeBuddy and the app, verify `/api/health` reports
`codeBuddyConnected: true`, then use `npm run smoke:agent` with an explicit fixture and evidence path.
Do not overwrite the release JSON files without reviewing their provenance and sanitization.

```bash
MOVEREALM_ROOM_MATRIX=1 \
  MOVEREALM_AGENT_EVIDENCE=artifacts/validation/live-agent-room-matrix-2ab9584.json \
  npm run smoke:agent
```

## Artifact checksums

| File | SHA-256 |
|---|---|
| `validation/public-guided-keyboard-session-2ab9584.json` | `00458af188807b5e2e49df994ac1581ff27608d9d1628f60d4df11158c2ef8b7` |
| `validation/live-agent-room-matrix-2ab9584.json` | `e4dabc45278f5be9d177c1c8d1282337d432a5cba3cbe8ebdc4c7008bfb05787` |
| `validation/live-agent-open-room.json` | `fb29536989e0c56764acdf764cf8def9e954d93ba89707bdbef30b4a368155f5` |
| `validation/live-agent-tight.json` | `340cfbed25d8a78f38f0cd2a6797202f00807ed88dbac89318cff5267f2f08d7` |
| `validation/live-agent-uncertain-room.json` | `159bfcfde10804f29b6b34f7a6ef2d00f25aa92d871777a57da2d1f53f723889` |
| `validation/live-agent-tight-room.json` | `c7bc82a101ab9b641a79f9422eecf2fb29d02d5d554fe9eb51fcbffc58f59d3d` |
| `../assets/submission/moverealm-cover-380x216.png` | `38637377111cffc7dce5c45ab3e9c0c3591fc55ce692f9af811940880b1dcf2c` |

Any edit to an artifact invalidates its listed checksum; recompute with `shasum -a 256 <file>`.

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
- **Complete local artifact:** 4:58 camera-free backup video and transcript; see below.
- **Pending:** upload that video, or a preferred live-person recording, to YouTube or Google Drive
  and verify its public URL.

Synthetic fixtures, keyboard telemetry, a successful deployment, and a camera-permission smoke do
not close any of those pending items.

## Camera-free backup video

| Artifact | Observation | SHA-256 |
|---|---|---|
| `../assets/submission/moverealm-guided-backup.mp4` | 4:58.834; 1440×810; H.264 + mono AAC; synthetic narration; −16.4 LUFS integrated / −1.0 dBFS true peak | `dd4d2ef14e7eed8217f45a520a056e895d098a74755d5e09c0ba9fcbe3951951` |
| `../assets/submission/moverealm-guided-backup-transcript.txt` | 784-word disclosure and narration transcript | `3ecedf106de903f9c552a4042a7c1a77e7514338a37d2c2bf3287fc2ffe3c20a` |
| `../assets/submission/architecture.png` | 1440×810 code-rendered architecture slide | `f0c3f27be72d9635ee194423d48f2f4d05324a83971debc50dc8849c2e32342b` |
| `../assets/submission/backup-video-title.png` | 1440×810 baked-in camera-free disclosure card | `adc4cca02b0700610530fc690f0680e0c5af430f6fdb433fa84554fa2294c56c` |

The video covers the project overview, core agent loop, architecture/build approach, and a practical
CodeBuddy structured-output tip. It shows both `CodeBuddy live` controlled evidence and visibly
labelled guided behavior. It does not close the real-person validation items above. The official
handbook accepts a YouTube or Google Drive video link, so the local file still needs a user-owned
upload and signed-out access check.
