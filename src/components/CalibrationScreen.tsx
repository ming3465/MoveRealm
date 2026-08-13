import { useCallback, useEffect, useRef, useState } from "react";
import type { DirectorResponse, QuestPlan } from "../shared/contracts";
import type { CalibrationProfile, PoseFrame } from "../pose/types";
import {
  SideCalibrationTracker,
  calibrationFromPose,
  isTPose,
  lateralOffset,
} from "../pose/movementDetectors";
import { formatMovementName } from "../shared/contracts";
import { Brand } from "./Brand";
import { CameraStage } from "./CameraStage";
import { DirectorBadge } from "./DirectorBadge";

interface CalibrationScreenProps {
  stream?: MediaStream;
  pose?: PoseFrame;
  demo: boolean;
  sideStepRange: "none" | "narrow" | "wide";
  plan: DirectorResponse<QuestPlan>;
  attachVideo: (node: HTMLVideoElement | null) => void;
  onComplete: (calibration: CalibrationProfile) => void;
  onUseDemo: () => void;
  onBack: () => void;
  poseError?: string;
}

type CalibrationPhase = "tpose" | "side" | "done";

const DEMO_CALIBRATION: CalibrationProfile = {
  centerX: 0.5,
  standingHipY: 0.55,
  shoulderWidth: 0.2,
  bodyHeight: 0.58,
  lateralEnvelope: 0.16,
};

export function CalibrationScreen({
  stream,
  pose,
  demo,
  sideStepRange,
  plan,
  attachVideo,
  onComplete,
  onUseDemo,
  onBack,
  poseError,
}: CalibrationScreenProps) {
  const [phase, setPhase] = useState<CalibrationPhase>("tpose");
  const [progress, setProgress] = useState(0);
  const [sideReached, setSideReached] = useState(false);
  const baselineRef = useRef<CalibrationProfile | undefined>(undefined);
  const stableFramesRef = useRef(0);
  const sideCalibrationRef = useRef<SideCalibrationTracker | undefined>(undefined);
  const completedRef = useRef(false);
  const finishTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    void import("./GameScreen");
  }, []);

  useEffect(() => () => {
    if (finishTimerRef.current !== undefined) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = undefined;
    }
  }, []);

  const finish = useCallback((calibration: CalibrationProfile) => {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase("done");
    setProgress(100);
    finishTimerRef.current = window.setTimeout(() => {
      finishTimerRef.current = undefined;
      onComplete(calibration);
    }, 650);
  }, [onComplete]);

  useEffect(() => {
    if (!demo) return;
    const first = window.setTimeout(() => {
      setProgress(58);
      setPhase(sideStepRange === "none" ? "done" : "side");
      if (sideStepRange === "none") finish(DEMO_CALIBRATION);
    }, 700);
    const second = window.setTimeout(() => {
      if (sideStepRange !== "none") finish(DEMO_CALIBRATION);
    }, 1_500);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [demo, finish, sideStepRange]);

  useEffect(() => {
    if (demo || !pose || completedRef.current) return;
    if (phase === "tpose") {
      if (isTPose(pose)) {
        stableFramesRef.current += 1;
        baselineRef.current = calibrationFromPose(pose) ?? baselineRef.current;
      } else {
        stableFramesRef.current = Math.max(0, stableFramesRef.current - 2);
      }
      setProgress(Math.min(48, stableFramesRef.current * 4));
      if (stableFramesRef.current >= 12 && baselineRef.current) {
        if (sideStepRange === "none") finish(baselineRef.current);
        else {
          setPhase("side");
          setProgress(52);
        }
      }
      return;
    }

    if (phase === "side" && baselineRef.current) {
      const threshold = Math.max(0.055, baselineRef.current.shoulderWidth * 0.38);
      sideCalibrationRef.current ??= new SideCalibrationTracker(threshold);
      const state = sideCalibrationRef.current.update(
        lateralOffset(pose, baselineRef.current.centerX),
      );
      if (state.reachedSide) setSideReached(true);
      const nextProgress = state.reachedSide
        ? 82 + (state.centerFrames / 4) * 14
        : 52 + (state.outwardFrames / 5) * 28;
      setProgress(Math.min(96, nextProgress));
      if (state.complete) {
        finish({
          ...baselineRef.current,
          lateralEnvelope: Math.max(0.08, Math.min(0.28, state.maxOffset)),
        });
      }
    }
  }, [demo, finish, phase, pose, sideStepRange]);

  const title = phase === "tpose"
    ? "Open your arms."
    : phase === "side"
      ? sideReached ? "Return to centre." : "Take one comfortable side-step."
      : "Your movement lane is ready.";
  const detail = phase === "tpose"
    ? "Stand where you will play and make a brief T-shape. Keep your wrists and feet visible."
    : phase === "side"
      ? sideReached
        ? "Hold your neutral stance briefly so we can verify the return path."
        : "Move only as far as feels natural. This sets the real target envelope."
      : "Framing and movement range captured locally.";

  return (
    <main className="flow-screen flow-screen--wide shell">
      <header className="flow-header">
        <Brand compact />
        <div className="step-indicator"><span className="step-indicator__complete" /> <span className="step-indicator__complete" /> <span className="step-indicator__active" /> <small>Calibrate</small></div>
        <button className="icon-button" type="button" onClick={onBack} aria-label="Go back">×</button>
      </header>

      <div className="calibration-layout">
        <section className="calibration-main">
          <p className="eyebrow"><span /> Ten-second calibration</p>
          <h1 aria-live="polite">{title}</h1>
          <p>{detail}</p>
          <CameraStage stream={stream} pose={pose} demo={demo} attachVideo={attachVideo} showGuide className="calibration-camera">
            <div className={`calibration-silhouette calibration-silhouette--${phase}`} aria-hidden="true">
              <span className="calibration-silhouette__head" />
              <span className="calibration-silhouette__torso" />
              <span className="calibration-silhouette__arm calibration-silhouette__arm--left" />
              <span className="calibration-silhouette__arm calibration-silhouette__arm--right" />
              <span className="calibration-silhouette__leg calibration-silhouette__leg--left" />
              <span className="calibration-silhouette__leg calibration-silhouette__leg--right" />
            </div>
            <div className="calibration-status"><span className={phase === "done" ? "status-dot status-dot--ready" : "status-dot status-dot--loading"} /> {demo ? "Guided demo signal" : phase === "done" ? "Calibrated" : "Watching locally"}</div>
          </CameraStage>
          <div className="calibration-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <span style={{ width: `${progress}%` }} />
          </div>
          {poseError && <div className="small-warning">Local pose tracking could not start: {poseError}</div>}
          {!demo && (
            <button className="text-button" type="button" onClick={onUseDemo}>Use keyboard controls for this run</button>
          )}
        </section>

        <aside className="quest-preview">
          <DirectorBadge meta={plan.meta} />
          <p className="eyebrow"><span /> Quest prepared</p>
          <h2>{plan.data.title}</h2>
          <div className="quest-preview__rounds">
            {plan.data.rounds.map((round, index) => (
              <div key={round.id}>
                <span>0{index + 1}</span>
                <div><strong>{formatMovementName(round.movementId)}</strong><small>{round.prompt}</small></div>
                <em>{round.durationSeconds}s</em>
              </div>
            ))}
          </div>
          <div className="safety-note"><span>⌁</span><p><strong>Your constraint stays in control.</strong>{plan.data.safetyNote}</p></div>
        </aside>
      </div>
    </main>
  );
}
