# Privacy-safe real-person trial protocol

> **Status — pending human action:** No real-person trial result is recorded by this document.
> Every `—` and `[PENDING]` below means not observed. Never replace it with a target, synthetic-camera
> result, keyboard result, or estimate.

## Purpose and fixed scope

Run exactly three pre-declared trials, `T01`–`T03`, with three different consenting participants.
Each trial uses the same MacBook Pro with M1 Pro, its real webcam, the exact trial release commit
recorded in the exported evidence, and pose controls throughout. Do not switch to keyboard controls. Record the browser and
macOS versions because performance can change between environments.

These are three small product observations, not medical research or a representative user study.
Participants may stop at any time. MoveRealm is light movement for healthy adults; stop immediately
for pain, dizziness, discomfort, an unsafe floor, or withdrawn consent.

## Acceptance gates

Record the value exactly as observed, including its unit and source. A missing value is **NOT
MEASURED**, never zero and never a pass.

| Gate | PASS | FAIL | Preferred observed source |
|---|---|---|---|
| Real-webcam pose mode | Real webcam remained active; no keyboard fallback | Keyboard/demo mode used or camera path failed because of product behavior | Gameplay camera status and final postcard |
| Tracking performance | At least 120 counted pose samples and `tracking FPS p05` is **at least 20 FPS** | Numeric result is below 20 FPS | Final postcard and local JSON export |
| Visible movement response | At least 3 counted capture-to-visible samples and `Visual response p95` is **under 100 ms**, or a valid consented 60 FPS fallback is under 100 ms | Numeric result is 100 ms or more | Final postcard/export, or the consented 60 FPS fallback; do not use CodeBuddy/source latency |
| Time to first accepted movement (TTFF) | **under 45.0 seconds** | Numeric result is 45.0 seconds or more | Final postcard `First movement`, or the stopwatch fallback below |
| Session completion | All three rounds and the final postcard are reached | A valid attempt cannot complete because of product behavior | Final postcard |
| Privacy | Consent and every privacy check below pass | A privacy check fails | Operator checklist; retain no image as evidence |

An individual trial is **PASS** only when all six gates pass. It is **FAIL** when a valid attempt
produces any failed gate; retain that result and do not rerun merely to replace it. Use
**INCOMPLETE** only for withdrawn consent, an external interruption, operator timing error, or a
missing metric. Log the reason without personal detail. An incomplete slot may be repeated with a
suffix such as `T01-R1`; keep the incomplete attempt in the audit record.

The three-trial acceptance criterion is met only if `T01`, `T02`, and `T03` are all PASS, the
combined exports exercise `reach`, `squat`, and `side_step`, and the designated T02 visibility check
pauses and resumes the live pose game. Otherwise,
report the exact count, such as “2 of 3 trials passed,” without changing the threshold.

## Consent and data boundary

Before each trial, explain and record only `yes` or `no` for consent:

- Live video and pose landmarks stay in the browser. One still is processed only after the
  participant approves it for scene analysis.
- No participant name, initials, age, gender, email, account, health detail, likeness, voice, room
  description, address, or device identifier will be recorded.
- No webcam frame, approved room still, screen recording, phone recording, or room image will be
  retained as trial evidence. A participant may separately consent to a short 60 FPS latency clip;
  extract only its frame count and delete the clip immediately.
- Only anonymous metrics, pass/fail states, a non-identifying observation, and an optional
  privacy-reviewed local session export may be retained.

Confirm only that the participant is a consenting adult who considers themselves suitable for the
light-movement scope; record `eligible healthy-adult scope: yes/no`, never health details. Use only
anonymous IDs `T01`, `T02`, and `T03`. If consent is `no`, eligibility is `no`, or consent is
withdrawn, stop the camera, discard that attempt's evidence, and record only
`INCOMPLETE — consent/eligibility not provided or withdrawn`.

## Repeatable setup

For every trial:

1. Use the local Node adapter so CodeBuddy provenance and temporary-still cleanup can both be
   checked. Start the exact released client source with the release values recorded in
   [`release-checks.md`](../artifacts/validation/release-checks.md):

   ```bash
   VITE_BUILD_ID=build-31766511011 \
   VITE_COMMIT_SHA=cf2ea8bc0cced379a7cf01bc968c5fe09a6b7e62 \
   npm run dev
   ```

   Start `npm run codebuddy:local` separately and confirm `/api/health` reports
   `codeBuddyConnected: true`. Do not use the public static Pages build for a trial presented as
   live CodeBuddy; it has exact release metadata but no local adapter/upload directory.
2. Plug the M1 Pro into power, close unrelated high-load applications, and use the same stable
   browser channel and secure local/HTTPS origin.
3. Reset MoveRealm to the landing screen and reset camera permission to **Ask** so every participant
   receives the same permission step.
4. Use the same operator script and **Balanced** energy choice. Do not coach after timing begins,
   except to stop an unsafe action.
5. Position the laptop stably with a clear floor and ordinary usable lighting. Ensure at least one
   predeclared trial has a genuinely clear lateral lane so all three validated mechanics can be
   exercised without overriding the room analysis. Record only `floor confirmed: yes/no`; do not
   describe or photograph the room.
6. Open browser Network tools without preserving response bodies. Clear the request list immediately
   before the trial.
7. Prepare a stopwatch that records no audio or video. Do not start it yet.

## Trial procedure

1. Assign the next anonymous trial ID and complete the pending environment/consent fields.
2. Start the stopwatch at the same moment the participant activates **Scan my room**. This matches
   the application's journey start.
3. Let the participant grant camera permission, approve the single still, confirm the floor, and
   complete calibration without keyboard fallback.
4. Stop the stopwatch when the first target is visibly accepted: the score increases or the target
   completion effect appears. Record the raw stopwatch value to 0.1 seconds but use it only under
   the fallback rule below.
5. Let the participant complete all three rounds. Record one concise, non-identifying observation
   about confusion or ease; paraphrase rather than preserving a personal quote.
   During T02 only, after one accepted target, ask the participant to step fully out of view, verify
   the world and countdown pause, then return and verify reliable tracking resumes before continuing.
6. On the final postcard, transcribe exactly the displayed `tracking FPS p05`, `Visual response p95`,
   `Pose inference p95`, sample counts, `First movement`, completion rate, and CodeBuddy source
   latencies. Do not infer decimals that the UI does not display. The export must show at least 120
   tracking/inference samples and 3 response samples for the automated thresholds to be evaluated.
7. Stop camera access. In Network tools, confirm there was no continuing upload of live frames. The
   single participant-approved scene request is expected; do not save its request or response body.
8. Confirm the server temporary-upload directory is empty after scene analysis by running
   `npm run trial:check-uploads`. Its output must say `0 retained items`. If it does not,
   mark privacy FAIL, stop, and remove the retained still through the approved cleanup process.
9. Complete the gate and overall status fields immediately. Never backfill a missing measurement
   from memory.

### Stopwatch fallback for TTFF

Prefer the postcard's `First movement` value. Use the stopwatch only when that field is unavailable
or says no completed target even though the operator visibly observed one. Record both the stopwatch
value and `source: stopwatch fallback`; do not average the two. If the operator missed either timing
event, record TTFF as **NOT MEASURED** and the trial as **INCOMPLETE**.

The stopwatch cannot substitute for FPS or visible latency. If either of those UI values is missing,
use only the 60 FPS fallback below for visible latency. FPS has no manual substitute; if FPS is
missing or has fewer than 120 counted samples, that gate is NOT MEASURED and the trial cannot pass.

### 60 FPS visible-latency fallback

Use this only when the postcard explicitly says capture metadata was unavailable and the participant
separately consented before the run. Place a phone so one early movement and the score/target effect
are visible in the same 60 FPS frame. Count the frame intervals from the first frame where the body
crosses the visible target threshold to the first frame showing feedback, then calculate
`intervals / recorded FPS × 1000`. Record the interval count, actual clip FPS, calculated milliseconds,
and `source: consented 60 FPS fallback`. Delete the clip immediately after a second operator checks
the count. A result equal to or above 100 ms fails; an ambiguous boundary is NOT MEASURED, not a pass.

## Local session evidence export

The final postcard provides a local anonymous JSON download built by
[`sessionEvidence.ts`](../src/lib/sessionEvidence.ts). It preserves counted aggregate samples,
threshold decisions, round results, and director provenance while excluding media, identifiers,
room text, agent prose, paths, and raw landmarks.

1. Finish the session; the app stops the camera before the postcard appears.
2. Enter only `1`, `2`, or `3` as the anonymous trial number and select **Download local run evidence**.
3. Preview or inspect the local file before retaining it. Allow only the anonymous trial ID,
   release/environment labels, completion counts, tracking FPS, movement-response latency, TTFF,
   and gate results.
4. Reject and delete the export if it contains names, account data, exact location/time metadata,
   file-system paths, prompts, tokens, room descriptions, images, video, audio, landmarks, masks,
   or camera frames.
5. For the first valid attempt, keep its generated name `moverealm-trial-1-session.json` (substitute
   the trial number). If an externally interrupted attempt must be retained, add the operator-only
   suffix after download, for example `moverealm-trial-1-R1-session.json`; do not edit the JSON's
   fixed `trial-1` identifier. Record the SHA-256 shown beside the download, and do not upload it
   until a privacy review passes. If the
   browser says hashing is unavailable, run `shasum -a 256 <filename>` locally.
6. Record `export: available and privacy-reviewed`, the filename, and checksum. The export supplements
   the observed trial row; it does not override a displayed or stopwatch observation.

## Per-trial record

Copy this block once for each pre-declared trial. Do not put participant identifiers in it.

| Field | Observed value |
|---|---|
| Trial ID | `[PENDING: T01/T02/T03]` |
| Date, M1 Pro, macOS, browser, origin | `[PENDING]` |
| Release commit | `[PENDING: exact commit from export/product.commitSha]` |
| Consent | `[PENDING: yes/no]` |
| Eligible healthy-adult scope | `[PENDING: yes/no; record no health detail]` |
| Floor confirmed | `[PENDING: yes/no]` |
| Real webcam; pose mode throughout | `[PENDING: yes/no]` |
| Source badge(s) observed | `[PENDING: exact label]` |
| Tracking FPS | `— [PENDING: value, source, PASS/FAIL/NOT MEASURED]` |
| Tracking / inference sample count | `— [PENDING: counts; at least 120 each]` |
| Visible movement response | `— [PENDING: ms, source, PASS/FAIL/NOT MEASURED]` |
| Visible-response sample count | `— [PENDING: count; at least 3 unless phone fallback]` |
| Pose inference p95 | `— [PENDING: ms and source; diagnostic, not a separate overall gate]` |
| TTFF | `— [PENDING: seconds, UI/stopwatch source, PASS/FAIL/NOT MEASURED]` |
| Completion rate | `— [PENDING: exact displayed/export value]` |
| CodeBuddy scene / plan / adaptation latency | `— [PENDING: exact source labels and ms]` |
| Movements in exported rounds | `[PENDING: reach/squat/side_step IDs]` |
| T02 pose-loss pause/resume | `[PENDING: PASS/FAIL/NOT APPLICABLE for T01/T03]` |
| Three rounds and postcard completed | `[PENDING: yes/no, PASS/FAIL]` |
| No continuing live-frame upload observed | `[PENDING: PASS/FAIL/NOT CHECKED]` |
| Temporary-upload directory empty | `[PENDING: PASS/FAIL/NOT CHECKED]` |
| No identifiers or room images retained | `[PENDING: PASS/FAIL]` |
| Local export | `[PENDING: reviewed filename and SHA-256]` |
| Non-identifying observation | `[PENDING: concise paraphrase]` |
| Overall trial result | `[PENDING: PASS/FAIL/INCOMPLETE and exact reason]` |

## Three-trial report

Complete this table from the three per-trial records; never copy targets into observed columns.

| Trial | FPS / gate | Visible latency / gate | TTFF / gate | Completed | Privacy | Overall |
|---|---|---|---|---|---|---|
| T01 | `— [PENDING]` | `— [PENDING]` | `— [PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| T02 | `— [PENDING]` | `— [PENDING]` | `— [PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` |
| T03 | `— [PENDING]` | `— [PENDING]` | `— [PENDING]` | `[PENDING]` | `[PENDING]` | `[PENDING]` |

Aggregate coverage (required in addition to three PASS rows):

| Coverage item | Observed | Status |
|---|---|---|
| Union of exported movement IDs includes `reach`, `squat`, `side_step` | `[PENDING]` | `[PENDING PASS/FAIL]` |
| T02 live pose loss paused countdown/gameplay and reliable return resumed it | `[PENDING]` | `[PENDING PASS/FAIL]` |
| Three completion rates and all CodeBuddy source latencies reported | `[PENDING]` | `[PENDING PASS/FAIL]` |

Report all three raw rows and the number passing each gate. If useful, add the median and observed
range, clearly labelled `n=3`; do not hide a failed or incomplete run inside an average. Report
qualitative notes as three individual observations. Do not claim statistical significance,
population performance, accessibility coverage, safety efficacy, product-market fit, or results
beyond these three participants. Transfer confirmed values to
[`VALIDATION.md`](VALIDATION.md) only after the evidence and privacy review are complete.
