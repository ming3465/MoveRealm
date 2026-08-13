# Validation evidence and pending live measurements

This record deliberately separates completed automated or controlled checks from measurements that
still require a person, a real webcam, and the target device. A dash (`—`) means **not measured**; it
is not a zero and must never be replaced with an estimate.

## Evidence status

- **Recorded automated evidence** — an automated run completed and its observed scope is stated.
- **Recorded controlled evidence** — a local integration run completed, but it is not a human trial.
- **Pending human/device measurement** — requires the target laptop, a real webcam, and/or a
  consenting participant.

Automated contract tests and prerecorded landmark-shaped fixtures protect schemas and deterministic
movement behavior. Their release commands are listed in [SUBMISSION.md](SUBMISSION.md); record a
fresh terminal log before submission rather than treating the existence of a test as a passing run.

## Recorded automated evidence — 13 August 2026

### Synthetic-camera browser smoke

Environment: Apple M1 Pro, Chrome 151, and Node 24.12.

The automated synthetic-camera smoke test reached MediaPipe Worker readiness, safety confirmation,
calibration, Phaser gameplay, keyboard scoring, pause, and resume without an application error.

This evidence establishes that the browser flow and worker-readiness path completed in that
controlled run. Chrome's fake stream does not contain a trackable person, so it does **not** establish
live-person pose FPS, camera-to-visual response latency, movement accuracy, or usability.

## Recorded controlled CodeBuddy evidence — 13 August 2026

These values came from a local CodeBuddy integration run. They are agent-service observations, not
human/device performance measurements and not population results.

| Check | Observed | Status |
|---|---:|---|
| CodeBuddy scene latency | 10.70 s | recorded controlled evidence |
| CodeBuddy plan latency | 22.61 s | recorded controlled evidence |
| CodeBuddy adaptation latency | 4.39 s | recorded controlled evidence |

The run analyzed the illustrated constrained-room capture as `tight`, identified the desk and chair,
and conservatively permitted only vertical and centre movement. The resulting plan contained three
allowed rounds totaling exactly 180 seconds and no side-steps.

Given 4 of 12 targets completed plus explicit “Too hard” feedback, the adaptation kept the validated
squat movement while changing range from 0.70 to 0.50, tempo from 0.80 to 0.60, and target rate from
7 to 5. Its displayed reason was: “Only 4 of 12 targets were reached and you chose Too hard, so the
next targets are shallower and slower.”

The temporary upload directory was empty after scene analysis in this controlled run. That confirms
cleanup for this observation only; it is not a substitute for inspecting every release environment.

## Pending human/device measurements

Record these only from the actual target laptop, a real webcam, and a consenting participant.

| Check | Target | Observed | Status |
|---|---:|---:|---|
| Pose processing | at least 20 FPS on M1 Pro | — | pending human/device measurement |
| Visible response latency | under 100 ms | — | pending human/device measurement |
| Time to first movement | under 45 seconds | — | pending timed human run |

Measurement method:

1. Use the FPS and inference timing emitted by the pose Worker for pose processing.
2. Use a 60 FPS phone recording for camera-to-visual response latency if possible.
3. Start the timer before setup and stop it at the participant's first accepted movement.
4. Save the raw observation or recording reference with consent; do not transcribe a target as an
   observed result.

## Privacy checks

| Check | Observation | Status |
|---|---|---|
| Browser camera frames produce no outbound requests | — | pending real-camera network inspection |
| Server temporary room still is removed after analysis | upload directory empty after controlled run | recorded controlled evidence |
| Participant consent for retained stills or recordings | — | pending per participant |

Use browser network tooling during the real-camera run to check that live frames are not uploaded.
Inspect the server's temporary upload location after analysis. Save only consented room stills for
submission evidence, and do not retain live camera recordings unless the participant explicitly
agreed to the demo recording.

## Pending user trials

| Trial | Room | Time to first move | Completion | Confusion / quote | Change made | Status |
|---|---|---:|---:|---|---|---|
| 1 | — | — | — | — | — | pending human trial |
| 2 | — | — | — | — | — | pending human trial |
| 3 | — | — | — | — | — | pending human trial |

Report the three observations as a small qualitative sample. Do not extrapolate population results.

## Room matrix for future live runs

- Open room: check whether left/right/vertical lanes are permitted and whether the resulting target
  envelope is materially wider.
- Tight room: check whether visible obstacles produce a narrow or removed side-step envelope.
- Uncertain room: check whether the result stays in the central/vertical lane with a conservative
  plan.

These are scenarios to test, not completed live-room results. Move a row or statement into recorded
evidence only after preserving the observed output and test conditions.
