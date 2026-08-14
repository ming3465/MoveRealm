# MoveRealm recording checklist

Target final duration: **3 minutes 40 seconds**. The official submission window is 3–5 minutes. This
script covers the required project overview, core agent features and usage, build reflection, and a
CodeBuddy development tip.

## Choose and label the path

- **Preferred:** live CodeBuddy run. Continue only after `/api/health` shows
  `codeBuddyConnected: true` **and** a strict request returns generated output before its deadline;
  keep the `CodeBuddy live` badge visible when making live-agent claims. Health alone is insufficient.
- **Backup:** choose “Try the guided demo.” Say that it is a pre-validated profile with deterministic
  decisions and keyboard controls. Keep the `Guided demo` label visible.
- **Automatic recovery:** if the service fails and `Safe fallback` appears, keep recording only if
  you explicitly say that CodeBuddy became unavailable and the deterministic safety path took over.
  Never cut around the badge or call fallback output live AI.

## Before recording

### Release and evidence

- [x] Confirm release-application
  [Pages run 31714506917](https://github.com/ming3465/MoveRealm/actions/runs/31714506917) for commit
  `7fe9009` / build `build-31714506917` passed all 100 tests across 13 files, the production build,
  and deployment.
- [x] Confirm clean local candidate `de0b2defc22f524e29bc4ea1019e86c4d31aa915` / tree
  `25b1f5b728a0b2baaf0ba39bb5a9087e7906d998` passed `npm run test:all`: 127/127 Vitest tests
  across 16 files, 13/13 Python recovery-agent tests, and 82/82 Safety Probe tests; its strict build
  and 0-vulnerability audit also passed.
- [x] Confirm its exact-source Docker image
  `sha256:f1ac14aab1b2bf42b4a20e0ed2a53f83d74955e047d6d8560b4b76236d87dd0b`
  (343,104,634 bytes) passed health, index, exact identity, captured-room basic smoke, and cleanup.
- [x] Confirm both predecessor `cf15709` production-mode full browser routes passed under local audit build
  ID `build-20260814`—not a GitHub Actions run. Guided: three mechanics, scores 0→145→290→435,
  adaptation 64→48%, 0.90→0.77×, 7→6, no POSTs/errors. Captured fallback: camera ready, exact
  scene/plan/adapt/adapt POSTs, score 435, `Safe fallback`, adaptation 60→44%, 0.90→0.77×, 7→6,
  no errors. Both exports matched the exact identity and kept personal/media fields false and
  keyboard pose metrics unevaluated.
- [ ] Push/deploy is authorized. Push the current branch, wait for CI, and verify the resulting
  public build and pushed branch HEAD. Until then, the public app remains `7fe9009` /
  `build-31714506917`.
- [x] Confirm the free local CodeBuddy/Qwen3-VL 4B route passed both the fallback-forbidden strict
  three-room matrix and the visible fake-camera adaptation smoke. Use the preserved
  [`matrix`](../artifacts/validation/codebuddy-local-qwen-matrix-de0b2de.json) and
  [`UI record`](../artifacts/validation/codebuddy-local-ui-adaptation-de0b2de.json).
- [x] Confirm `npm audit --audit-level=low` reports 0 vulnerabilities.
- [x] Confirm the exact-release public camera basic smoke passed with Chrome's fake camera:
  `cameraReady=true`, score 0→145, API POSTs `[]`, and no console errors. This is controlled,
  non-human evidence.
- [x] Confirm the exact-release public full-smoke adaptation step passed with `Guided demo`
  provenance.
- [x] Keep the earlier Docker evidence labelled **predecessor-only**. No Docker run was performed for
  `7fe9009`; the predecessor image `moverealm:2ab9584`, ID
  `sha256:a205205819345589179d079656e0afefb38887b8b460a2c00d942dc0a11e47b6`
  (343,057,128 bytes), embeds the exact `2ab9584` commit/build identity.
- [x] Confirm its basic captured-room path passed with health true/CodeBuddy false, camera ready, safe
  defaults, `Safe fallback`, score 0→145, only scene/plan POSTs, and empty upload cleanup. The
  container stopped and its port was freed after stop escalation; do not call exit 137 graceful.
- [x] Keep the earlier Docker full fallback adaptation labelled predecessor evidence; it was not
  rerun for the current application release.
- [x] Confirm the separate exact-release public full smoke against commit `7fe9009` / run 31714506917
  / build `build-31714506917` exited 0: scores 0→145→290→435; `Guided demo` adaptation
  64→48%, 0.90→0.77×, 7→6; postcard 2.6 active minutes, 18% completion, tracking `N/A`, and
  3.0-minute clock; API POSTs `[]`; no console errors. This browser smoke was separate from CI.
- [x] Confirm that smoke downloaded anonymous keyboard evidence whose visible SHA-256
  `5a3da763a925d02c4152cd305587c3d60e20bb261e354f6372b59fb797ba4620` and exact
  build/commit identity matched, and whose real-camera pose gates remained `N/A`/`not_evaluated`.
  The preserved file is
  [`public-guided-keyboard-session-7fe9009.json`](../artifacts/validation/public-guided-keyboard-session-7fe9009.json);
  its keyboard timing is not human TTFF evidence.
- [x] Confirm the deployed predecessor and clean local candidate retain the exporter integrity boundary: trial 1–3 only, paired
  exact provenance, count/adaptation/latency consistency, and robust sanitized download behavior.
- [x] Review the [offline Shadow Judge record](EVALUATION.md): deterministic fixture, contract,
  consistency, and movement-feasibility gates remain authoritative and rejected an unsafe plan the
  advisory model scored positively. Do not present it as runtime AI, safety certification, official
  judging, or human evidence.
- [ ] Complete remaining checks in [SUBMISSION.md](SUBMISSION.md); cite
  [`artifacts/validation/release-checks.md`](../artifacts/validation/release-checks.md).
- [ ] Keep [VALIDATION.md](VALIDATION.md) open; do not quote pending human/device values as results.
- [ ] Before any real-person run, follow the consent, privacy, evidence-export, and exact result
  rules in [TRIAL_PROTOCOL.md](TRIAL_PROTOCOL.md). All three human trials remain pending.
- [ ] Open <https://ming3465.github.io/MoveRealm/> in a signed-out browser and verify the guided flow.
- [ ] Keep <https://github.com/ming3465/MoveRealm> ready as the source link.
- [ ] Remember that GitHub Pages is the static guided demo; use the local/production Node adapter for
  any segment presented as live CodeBuddy.
- [ ] Verify the demo video destination is **[PENDING YOUTUBE OR GOOGLE DRIVE URL]**.
- [x] Keep the 4:58.834 camera-free backup at
  `assets/submission/moverealm-guided-backup.mp4`; it includes the required overview, agent
  features, build reflection, development tip, and explicit synthetic/keyboard disclosure.
- [x] Prepare the 16:9 cover image at `assets/submission/moverealm-cover-380x216.png`.
- [x] Confirm six consent-free guided screenshots exist at `assets/submission/screenshots/*.png`.
- [x] Confirm two additional synthetic fake-camera CodeBuddy UI captures show health connectivity,
  visible `CodeBuddy live` scene/adaptation provenance, and empty temporary-upload cleanup. Treat
  them as controlled evidence, not as a real-person run or final-video proof.

Still explicitly pending before a final evidence-complete submission: a public YouTube or Google
Drive URL for the backup or a preferred live-person take, all three user trials, real-person pose
FPS, real-person visible response latency, real-person time to first accepted movement (TTFF), a
the authorized candidate push/deployment, and team/contact portal fields. Do not substitute
synthetic-camera or keyboard values.

The Pages workflow ignores docs- and artifacts-only pushes. This documentation follow-up does not
redeploy the app; release identity remains commit `7fe9009`, run 31714506917, build
`build-31714506917`.

### Live path

- [ ] Start Ollama, run `npm run director:local:setup` once, then start CodeBuddy with
  `npm run codebuddy:local` in a persistent terminal (or use `npm run codebuddy` for a signed-in
  upstream model).
- [ ] Set `CODEBUDDY_PASSWORD` server-side if authentication is enabled; never show `.env` or the
  terminal line containing a secret.
- [ ] Start MoveRealm, open `/api/health`, and capture `codeBuddyConnected: true` without exposing
  credentials.
- [ ] Complete one strict scene request and require `CodeBuddy live`; if it reaches the 45-second
  bound or shows `Safe fallback`, use the fallback script and do not narrate it as live AI.
- [ ] Place one visible chair or desk edge in a deliberately constrained camera lane.
- [ ] Confirm the returned room analysis on screen before narrating its classification or obstacles.
- [ ] Rehearse one difficult first round so the visible adaptation has real telemetry to explain.

### Camera, consent, and presentation

- [ ] Obtain explicit consent from every identifiable participant before recording.
- [ ] Frame out private photos, addresses, notifications, emails, tokens, and unrelated browser tabs.
- [ ] Use a clean floor, stable camera, audible microphone, 1080p capture, and large cursor.
- [ ] Disable notifications and verify no password, bearer token, redemption code, or account email
  appears.
- [ ] Keep one static/local guided-demo tab ready as the backup path.
- [ ] Reset the app and begin on the landing screen with the source badge visible.

## Exact 3:40 narrative and shot list

Read the quoted lines exactly. Perform the on-screen action before advancing. If the actual live
output contradicts a line, stop and restart the take; do not narrate a result that is not visible.

### 0:00–0:15 — Problem

On screen: landing page, three-minute duration, energy choices, and no-jumping lock.

> A movement session often fails before it starts: not enough time, uncertain floor space, or no
> motivation. MoveRealm turns the room already around you into the controller for one focused,
> three-minute adventure.

Evidence gate: show “3 minutes” and “No jumping” while saying them.

### 0:15–0:40 — Observe

On screen: choose an energy level, select “Scan my room,” preview the still, and approve it.

> I choose my energy and approve one room still. This is the only image sent for scene analysis.
> Live camera frames and pose landmarks stay in this browser, so CodeBuddy never receives a live
> video feed.

Evidence gate: show the still-approval step; do not imply that an unapproved frame was uploaded.

### 0:40–1:05 — Constrain

On screen: room classification, obstacle pins, permitted directions, floor-clear control, and
side-step range.

> The Movement Director turns what it can see into explicit constraints. Here it marks the usable
> lane and the nearby obstacle. I still make the final safety decision: the floor is clear, and my
> side-step range is limited to the space I can actually use.

Evidence gate: point only to classification, obstacles, and directions visible in this take. If the
scene is uncertain, say “uncertain” and show the conservative central lane.

### 1:05–1:25 — Plan

On screen: `CodeBuddy live` badge, generated quest, source latency, and safety note.

> CodeBuddy now builds a constrained Neon Rainforest quest. Only three validated movements can
> appear: reach, squat, and side-step. The AI proposes the plan, but typed safety contracts decide
> what is allowed, including exactly three rounds totaling one hundred and eighty seconds.

Evidence gate: the badge must say `CodeBuddy live`. If it does not, use the applicable fallback
disclosure below.

### 1:25–1:40 — Calibrate

On screen: T-pose calibration followed by one comfortable side-step.

> A short T-pose establishes camera framing, then one comfortable side-step sets my personal range.
> The room constraint stays in control even if the model asks for more.

Evidence gate: show calibration completing rather than cutting directly to gameplay.

### 1:40–2:25 — Play and tracking safety

On screen: complete near targets, intentionally miss wider targets, briefly leave the frame, then
return until play resumes.

> In the rainforest, reaches collect fireflies, squats shelter seedlings, and permitted side-steps
> redirect the river. Pose inference runs in a MediaPipe Worker on this device. I will miss the wider
> targets so the next decision has real evidence. When I leave the frame, low confidence pauses the
> world instead of guessing. Three reliable frames are required before it resumes.

Evidence gate: capture the visible pause and resume. Do not claim live-person FPS or latency unless
the values were recorded and moved out of pending status in `VALIDATION.md`.

### 2:25–2:55 — Re-plan

On screen: choose “Too hard,” then hold on the explanation and before/after parameters.

> I add explicit feedback: Too hard. The visible trace explains the next decision using completed
> and missed targets plus my feedback. The next validated movement stays the same; only its target
> envelope, tempo, and target rate may change. That makes adaptation observable without letting the
> agent invent a new exercise.

Evidence gate: read only the adjustments actually displayed. If `Safe fallback` appears, use the
fallback disclosure and do not imply this decision came from CodeBuddy.

### 2:55–3:15 — Result

On screen: final garden postcard, active time, completion, and any measured runtime statistic.

> The session ends with a garden postcard, active time, completion, and measured runtime telemetry.
> This run reports 2.6 active minutes inside the complete 3.0-minute adventure: three 52-second
> movement rounds plus two 12-second rests. This is light movement for healthy adults, not medical
> or rehabilitation guidance. Stop if you feel pain, dizziness, or unwell.

Evidence gate: show both `2.6 active minutes` and `Adventure clock 3.0 min`. Do not call 2.6 active
minutes three active minutes, and do not convert any pending human measurement into a result. For a
consenting live-person trial, download the anonymous local evidence only under
[TRIAL_PROTOCOL.md](TRIAL_PROTOCOL.md); the passing keyboard-export smoke is exporter evidence, not
human FPS, latency, or TTFF evidence.

### 3:15–3:40 — Architecture, build reflection, and value

On screen: architecture diagram or a clean split view of the app and the relevant source map.

> The key build choice was to treat agent output as untrusted. CodeBuddy makes bounded decisions;
> Zod enforces room and movement rules; MediaPipe keeps live pose local; and fallback stays visible.
> My CodeBuddy tip is to request strict structured output and design its failure path together.
> MoveRealm starts consumer-first, with wellness and hospitality licensing to validate next.

Evidence gate: show truthful CodeBuddy usage evidence during this section or immediately after it.

## Exact contingency disclosures

Use one of these lines immediately when its condition occurs.

### Guided demo

> This is the guided backup, not a live agent result. It uses a pre-validated tight-room profile,
> deterministic director decisions, and keyboard controls so judges can still inspect the complete
> interaction flow.

### Safe fallback

> CodeBuddy is unavailable in this run, so MoveRealm has visibly switched to its deterministic safe
> fallback. The same movement contracts and confirmed room constraints still apply, but this result
> is not live AI output.

### Uncertain room

> The room analysis is uncertain, so MoveRealm keeps movement in the conservative central and
> vertical lane instead of guessing about lateral space.

### Live tracking measurement still pending

> This run demonstrates the interaction path. Live-person pose FPS and camera-to-visual latency are
> still pending measured device validation, as is time to first movement, so I am not presenting
> target or keyboard values as real-person results.

## After recording

- [x] Final backup duration is between 3:00 and 5:00: 4:58.834.
- [x] Opening establishes the problem and target user within 15 seconds.
- [x] `CodeBuddy live`, `Guided demo`, or `Safe fallback` is readable whenever agent provenance matters.
- [x] One still versus local live video is clearly explained.
- [ ] Floor confirmation, low-confidence pause, and visible adaptation are shown rather than asserted.
- [x] Health scope and stop guidance are audible.
- [x] Build reflection and one CodeBuddy development tip are included.
- [x] The result distinguishes 2.6 active minutes from the complete 3.0-minute adventure.
- [x] No pending measurement is spoken as an observed value.
- [x] No secret, personal notification, participant image without consent, or private CodeBuddy
  history is visible.
- [ ] Captions match the spoken disclosures and do not overstate live-agent behavior.
- [ ] Upload privacy is set so judges can open the link without requesting access.
- [ ] Test the video and public app URLs in a signed-out browser.
- [x] Compute the final video checksum and update [SUBMISSION.md](SUBMISSION.md).
- [x] Keep real-person FPS, visible latency, TTFF, and all three user trials pending unless the raw
  observations are captured and linked.
- [ ] For a live-person take, privacy-review the downloaded local JSON and record its visible
  SHA-256 exactly as specified by [TRIAL_PROTOCOL.md](TRIAL_PROTOCOL.md).
