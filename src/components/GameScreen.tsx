import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type {
  AdaptationDecision,
  ConfirmedConstraints,
  DirectorMeta,
  DifficultyFeedback,
  QuestPlan,
  QuestRound,
  RoundTelemetry,
  UserIntent,
} from "../shared/contracts";
import { formatMovementName, validateAdaptationSafety } from "../shared/contracts";
import { createFallbackAdaptation } from "../shared/fallbacks";
import type { CalibrationProfile, MovementEvent, PoseFrame } from "../pose/types";
import { cameraCaptureToVisibleLatencyMs } from "../pose/PoseEngine";
import { MovementDetector, TrackingGate } from "../pose/movementDetectors";
import { coverTransform, pointInCover } from "../pose/coverTransform";
import { NeonGame, type NeonGameHandle } from "../game/NeonGame";
import { requestAdaptation } from "../lib/directorApi";
import { summarizeMetricSamples, type SessionResult } from "../lib/sessionEvidence";
import { Brand } from "./Brand";
import { CameraStage } from "./CameraStage";
import { DirectorBadge } from "./DirectorBadge";

interface GameScreenProps {
  plan: QuestPlan;
  planMeta: DirectorMeta;
  constraints: ConfirmedConstraints;
  intent: UserIntent;
  calibration: CalibrationProfile;
  stream?: MediaStream;
  pose?: PoseFrame;
  poseError?: string;
  demo: boolean;
  guidedDemo: boolean;
  journeyStartedAt: number;
  attachVideo: (node: HTMLVideoElement | null) => void;
  onUseKeyboard: () => void;
  onComplete: (result: SessionResult) => void;
  onExit: () => void;
}

interface MutableRoundMetrics {
  presented: number;
  completed: number;
  amplitudes: number[];
  confidences: number[];
  fps: number[];
  responseLatencies: number[];
}

export type { SessionResult } from "../lib/sessionEvidence";

const ASSIST_HELP: Record<QuestRound["movementId"], string> = {
  reach: "Tap Reach, or press ↑ or Space, when a firefly glows",
  squat: "Tap Lower, or press ↓, when a seedling needs shelter",
  side_step: "Tap Left or Right, or press ← or →, to redirect the river",
};

const ASSIST_LABEL: Record<QuestRound["movementId"], string> = {
  reach: "Reach",
  squat: "Lower",
  side_step: "Step",
};

function createMetrics(): MutableRoundMetrics {
  return {
    presented: 0,
    completed: 0,
    amplitudes: [],
    confidences: [],
    fps: [],
    responseLatencies: [],
  };
}

function average(values: number[], fallback = 0): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

export function GameScreen({
  plan,
  planMeta,
  constraints,
  intent,
  calibration,
  stream,
  pose,
  poseError,
  demo,
  guidedDemo,
  journeyStartedAt,
  attachVideo,
  onUseKeyboard,
  onComplete,
  onExit,
}: GameScreenProps) {
  const [rounds, setRounds] = useState(plan.rounds);
  const [roundIndex, setRoundIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(plan.rounds[0].durationSeconds);
  const [score, setScore] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);
  const [trackingPaused, setTrackingPaused] = useState(false);
  const [phase, setPhase] = useState<"playing" | "feedback" | "adapting" | "trace" | "rest">("playing");
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [feedback, setFeedback] = useState<DifficultyFeedback>();
  const [trace, setTrace] = useState<AdaptationDecision>();
  const [traceMeta, setTraceMeta] = useState<DirectorMeta>();
  const [traceSeed, setTraceSeed] = useState<QuestRound>();
  const [telemetry, setTelemetry] = useState<RoundTelemetry[]>([]);
  const [adaptations, setAdaptations] = useState<AdaptationDecision[]>([]);
  const gameRef = useRef<NeonGameHandle>(null);
  const detectorRef = useRef(new MovementDetector(calibration));
  const gateRef = useRef(new TrackingGate());
  const metricsRef = useRef<MutableRoundMetrics>(createMetrics());
  const adaptationLatencyRef = useRef(0);
  const lastPoseAtRef = useRef(performance.now());
  const firstMovementAtRef = useRef<number | undefined>(undefined);
  const responseLatenciesRef = useRef<number[]>([]);
  const trackingFpsSamplesRef = useRef<number[]>([]);
  const inferenceSamplesRef = useRef<number[]>([]);
  const adaptationMetasRef = useRef<DirectorMeta[]>([]);
  const pendingVisualLatencyRef = useRef<
    Pick<NonNullable<MovementEvent["poseTiming"]>, "cameraCaptureAt"> | undefined
  >(undefined);
  const roundStartedAtRef = useRef(performance.now());
  const endedRef = useRef(false);
  // Seconds actually spent in a playing round, accumulated as each round closes.
  const activeSecondsRef = useRef(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentRound = rounds[roundIndex];
  const globallyPaused = manualPaused || trackingPaused || phase !== "playing";

  const activeTotal = plan.requestedDurationSeconds;
  const completedDuration =
    rounds.slice(0, roundIndex).reduce((sum, round) => sum + round.durationSeconds, 0) +
    plan.restBetweenRoundsSeconds * roundIndex;
  const elapsedInRound = currentRound.durationSeconds - secondsLeft;
  const elapsedInCurrentPhase = phase === "rest"
    ? plan.restBetweenRoundsSeconds - restSecondsLeft
    : elapsedInRound;
  const progress = Math.min(1, (completedDuration + elapsedInCurrentPhase) / activeTotal);

  const registerMovement = useCallback((event: MovementEvent) => {
    if (globallyPaused) return;
    metricsRef.current.amplitudes.push(event.amplitude);
    const completed = gameRef.current?.registerMovement(event) ?? false;
    if (completed) {
      const completedAt = performance.now();
      metricsRef.current.completed += 1;
      if (!firstMovementAtRef.current) firstMovementAtRef.current = completedAt;
      if (!demo) {
        if (event.poseTiming?.cameraCaptureAt != null) {
          pendingVisualLatencyRef.current = {
            cameraCaptureAt: event.poseTiming.cameraCaptureAt,
          };
        }
      }
      setScore((value) => value + 120 + Math.round(event.amplitude * 30));
    }
  }, [demo, globallyPaused]);

  useEffect(() => {
    const timing = pendingVisualLatencyRef.current;
    if (!timing) return;
    pendingVisualLatencyRef.current = undefined;
    const frame = window.requestAnimationFrame(() => {
      const latency = cameraCaptureToVisibleLatencyMs(timing, performance.now());
      if (latency != null) {
        metricsRef.current.responseLatencies.push(latency);
        responseLatenciesRef.current.push(latency);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [score]);

  useEffect(() => {
    if (!pose || demo) return;
    lastPoseAtRef.current = performance.now();
    if (phase !== "playing") return;
    const lost = gateRef.current.update(pose.confidence, pose.timestamp);
    setTrackingPaused(lost);
    if (!lost && phase === "playing") {
      if (performance.now() - roundStartedAtRef.current >= 2_000) {
        metricsRef.current.confidences.push(pose.confidence);
        metricsRef.current.fps.push(pose.fps);
        if (pose.fps > 0) trackingFpsSamplesRef.current.push(pose.fps);
        if (pose.inferenceMs >= 0) inferenceSamplesRef.current.push(pose.inferenceMs);
      }
      const event = detectorRef.current.process(pose, currentRound.movementId, currentRound.rangeScale);
      if (event) {
        const cover = coverTransform(
          pose.sourceWidth,
          pose.sourceHeight,
          window.innerWidth,
          window.innerHeight,
        );
        const displayPoint = pointInCover(
          event.x,
          event.y,
          cover,
          window.innerWidth,
          window.innerHeight,
        );
        registerMovement({ ...event, ...displayPoint });
      }
    }
  }, [currentRound.movementId, currentRound.rangeScale, demo, phase, pose, registerMovement]);

  useEffect(() => {
    if (demo || phase !== "playing") return;
    const monitor = window.setInterval(() => {
      if (performance.now() - lastPoseAtRef.current <= 900) return;
      gateRef.current.markUnavailable();
      setTrackingPaused(true);
    }, 250);
    return () => window.clearInterval(monitor);
  }, [demo, phase]);

  useEffect(() => {
    if (!demo) return;
    gateRef.current.reset();
    setTrackingPaused(false);
  }, [demo]);

  const overlayVisible = trackingPaused || manualPaused || phase !== "playing";
  useEffect(() => {
    if (!overlayVisible) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
    const frame = window.requestAnimationFrame(() => {
      const overlay = overlayRef.current;
      const firstControl = overlay?.querySelector<HTMLElement>(
        "button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])",
      );
      (firstControl ?? overlay)?.focus();
    });
    const keepFocusInsideOverlay = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const controls = Array.from(overlay.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      )).filter((control) => !control.hidden && control.getAttribute("aria-hidden") !== "true");
      if (controls.length === 0) {
        event.preventDefault();
        overlay.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const focused = document.activeElement;
      if (event.shiftKey && (focused === first || !overlay.contains(focused))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (focused === last || !overlay.contains(focused))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInsideOverlay, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keepFocusInsideOverlay, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [manualPaused, overlayVisible, phase, trackingPaused]);

  useEffect(() => {
    gameRef.current?.setTrackingPaused(globallyPaused);
  }, [globallyPaused]);

  // Close the current round and move to the feedback step, recording only the
  // seconds actually played. Used by the round clock and by the skip control.
  const endRound = useCallback(
    (secondsRemaining: number) => {
      activeSecondsRef.current += Math.max(
        0,
        currentRound.durationSeconds - Math.max(0, secondsRemaining),
      );
      setSecondsLeft(0);
      setPhase("feedback");
    },
    [currentRound.durationSeconds],
  );

  const skipRound = useCallback(() => {
    if (phase !== "playing") return;
    setManualPaused(false);
    setTrackingPaused(false);
    endRound(secondsLeft);
  }, [endRound, phase, secondsLeft]);

  useEffect(() => {
    if (globallyPaused) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [globallyPaused, roundIndex]);

  // Closing the round is a side effect, so it runs here rather than inside the
  // countdown updater, which must stay pure.
  useEffect(() => {
    if (phase !== "playing" || secondsLeft > 0) return;
    endRound(0);
  }, [endRound, phase, secondsLeft]);

  useEffect(() => {
    if (phase !== "rest") return;
    if (restSecondsLeft <= 0) {
      beginNextRound();
      return;
    }
    const timer = window.setTimeout(() => setRestSecondsLeft((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [phase, restSecondsLeft]);

  // One dispatch for every assisted input. A phone has no arrow keys, so touch and
  // keyboard must produce identical telemetry rather than two divergent paths.
  const triggerAssist = useCallback(
    (side?: "left" | "right") => {
      if (!demo || globallyPaused) return;
      registerMovement({
        movementId: currentRound.movementId,
        timestamp: performance.now(),
        amplitude: 0.82,
        x: side === "left" ? 0.28 : side === "right" ? 0.72 : 0.5,
        y: currentRound.movementId === "squat" ? 0.76 : 0.28,
        ...(side ? { side } : {}),
      });
    },
    [currentRound.movementId, demo, globallyPaused, registerMovement],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!demo || globallyPaused || event.repeat) return;
      const target = event.target;
      if (
        [" ", "Enter"].includes(event.key) &&
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("button, a, input, select, textarea, [role='button']"))
      ) {
        return;
      }
      const matches =
        (currentRound.movementId === "reach" && ["ArrowUp", " "].includes(event.key)) ||
        (currentRound.movementId === "squat" && event.key === "ArrowDown") ||
        (currentRound.movementId === "side_step" && ["ArrowLeft", "ArrowRight"].includes(event.key));
      if (!matches) return;
      event.preventDefault();
      triggerAssist(
        event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : undefined,
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentRound.movementId, demo, globallyPaused, triggerAssist]);

  // Pointer events cover touch, pen, and mouse in one path and fire without the
  // click delay some mobile browsers still apply. preventDefault keeps focus off
  // the control so the global key handler is not disabled after a tap.
  const assistControlProps = (side?: "left" | "right") => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      triggerAssist(side);
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      triggerAssist(side);
    },
  });

  const buildTelemetry = (selectedFeedback: DifficultyFeedback): RoundTelemetry => {
    const metrics = metricsRef.current;
    return {
      roundId: currentRound.id,
      movementId: currentRound.movementId,
      completionRate: metrics.presented ? Math.min(1, metrics.completed / metrics.presented) : 0,
      movementRange: Math.min(1.5, average(metrics.amplitudes, demo ? 0.82 : 0)),
      poseConfidence: demo ? 0 : average(metrics.confidences, 0),
      trackingFps: demo ? 0 : average(metrics.fps, 0),
      trackingMode: demo ? "keyboard" : "pose",
      targetsPresented: metrics.presented,
      targetsCompleted: metrics.completed,
      feedback: selectedFeedback,
    };
  };

  const finishSession = (allTelemetry: RoundTelemetry[], allAdaptations: AdaptationDecision[]) => {
    if (endedRef.current) return;
    endedRef.current = true;
    gameRef.current?.completeGarden();
    window.setTimeout(() => {
      onComplete({
        plan: { ...plan, rounds },
        telemetry: allTelemetry,
        adaptations: allAdaptations,
        // Time actually spent moving, not time the plan asked for. A skipped round
        // must shorten this: the evidence exporter deliberately refuses a session
        // that did not complete its full active duration, and quietly reporting the
        // planned figure would turn a partial run into false trial evidence.
        activeSeconds: Math.round(activeSecondsRef.current),
        totalTargets: allTelemetry.reduce((sum, round) => sum + round.targetsPresented, 0),
        completedTargets: allTelemetry.reduce((sum, round) => sum + round.targetsCompleted, 0),
        timeToFirstMovementMs: firstMovementAtRef.current == null
          ? null
          : Math.max(0, firstMovementAtRef.current - journeyStartedAt),
        directorLatencyMs: planMeta.latencyMs + adaptationLatencyRef.current,
        poseMetricSummaries: demo
          ? {}
          : {
              trackingFps: summarizeMetricSamples(trackingFpsSamplesRef.current),
              inferenceMs: summarizeMetricSamples(inferenceSamplesRef.current),
              visibleResponseLatencyMs: summarizeMetricSamples(responseLatenciesRef.current),
            },
        directorMetas: {
          plan: planMeta,
          adaptations: [...adaptationMetasRef.current],
        },
        journeyDurationMs: Math.max(0, performance.now() - journeyStartedAt),
      });
    }, 900);
  };

  const continueAfterRound = async () => {
    if (!feedback) return;
    const currentTelemetry = buildTelemetry(feedback);
    const nextTelemetry = [...telemetry, currentTelemetry];
    setTelemetry(nextTelemetry);
    if (roundIndex >= rounds.length - 1) {
      finishSession(nextTelemetry, adaptations);
      return;
    }

    const adaptationRequest = {
      telemetry: currentTelemetry,
      nextRoundSeed: rounds[roundIndex + 1],
      constraints,
      intent,
    };
    setTraceSeed(rounds[roundIndex + 1]);
    setPhase("adapting");
    const response = guidedDemo
      ? {
          data: validateAdaptationSafety(
            createFallbackAdaptation(adaptationRequest),
            adaptationRequest,
          ),
          meta: {
            source: "demo" as const,
            latencyMs: 0,
            label: "Guided demo",
            detail: "A deterministic rule uses target completion and your explicit feedback; no pose metrics are claimed.",
          },
        }
      : await requestAdaptation(adaptationRequest);
    adaptationLatencyRef.current += response.meta.latencyMs;
    adaptationMetasRef.current.push(response.meta);
    const decision = response.data;
    const nextRounds = rounds.map((round, index) => (index === roundIndex + 1 ? decision.nextRound : round));
    setRounds(nextRounds);
    setTrace(decision);
    setTraceMeta(response.meta);
    setAdaptations((items) => [...items, decision]);
    setPhase("trace");
  };

  const beginNextRound = () => {
    const nextIndex = roundIndex + 1;
    const nextRound = rounds[nextIndex];
    metricsRef.current = createMetrics();
    roundStartedAtRef.current = performance.now();
    detectorRef.current.reset();
    gateRef.current.reset();
    setRoundIndex(nextIndex);
    setSecondsLeft(nextRound.durationSeconds);
    setFeedback(undefined);
    setTrackingPaused(false);
    setPhase("playing");
  };

  const beginRest = () => {
    if (plan.restBetweenRoundsSeconds <= 0) {
      beginNextRound();
      return;
    }
    setRestSecondsLeft(plan.restBetweenRoundsSeconds);
    setPhase("rest");
  };

  return (
    <main className="game-screen">
      <div className="game-content" inert={overlayVisible} aria-hidden={overlayVisible || undefined}>
        <CameraStage stream={stream} pose={pose} demo={demo} attachVideo={attachVideo} className="game-camera" />
        <NeonGame
          ref={gameRef}
          round={currentRound}
          permittedDirections={constraints.permittedDirections}
          assisted={demo}
          onTargetPresented={() => { metricsRef.current.presented += 1; }}
          onTargetCompleted={() => undefined}
        />
        <div className="game-vignette" />

        <header className="game-header">
          <Brand compact />
          <div className="game-progress">
            <div><span>Round {roundIndex + 1} of {rounds.length}</span><span>{Math.ceil(secondsLeft)}s</span></div>
            <div className="game-progress__bar"><span style={{ width: `${progress * 100}%` }} /></div>
          </div>
          <div className="game-actions">
            <div className="game-score" aria-live="polite"><small>Garden glow</small><strong>{score.toLocaleString()}</strong></div>
            {phase === "playing" && (
              <button
                className="game-skip-button"
                type="button"
                onClick={skipRound}
                aria-label={`Skip ${formatMovementName(currentRound.movementId).toLowerCase()} and go to the next stage`}
              >
                Skip round <span aria-hidden="true">→</span>
              </button>
            )}
            <button className="game-icon-button" type="button" onClick={() => setManualPaused((value) => !value)} aria-label={manualPaused ? "Resume adventure" : "Pause adventure"}>{manualPaused ? "▶" : "Ⅱ"}</button>
            <button className="game-icon-button" type="button" onClick={onExit} aria-label="Stop adventure">×</button>
          </div>
        </header>

        <div className="round-instruction" role="status" aria-live="polite">
          <span className={`movement-glyph movement-glyph--${currentRound.movementId}`} />
          <div><small>{formatMovementName(currentRound.movementId)}</small><strong>{currentRound.prompt}</strong></div>
        </div>

        <div className="game-director"><DirectorBadge meta={traceMeta ?? planMeta} compact /></div>
        {demo && !globallyPaused && (
          <div className="assist-pad" role="group" aria-label="Movement controls">
            {currentRound.movementId === "side_step" ? (
              <>
                <button
                  className="assist-key"
                  type="button"
                  aria-label="Step left"
                  {...assistControlProps("left")}
                >
                  <span aria-hidden="true">←</span>Left
                </button>
                <button
                  className="assist-key"
                  type="button"
                  aria-label="Step right"
                  {...assistControlProps("right")}
                >
                  Right<span aria-hidden="true">→</span>
                </button>
              </>
            ) : (
              <button
                className="assist-key assist-key--wide"
                type="button"
                aria-label={`${ASSIST_LABEL[currentRound.movementId]} now`}
                {...assistControlProps()}
              >
                <span aria-hidden="true">{currentRound.movementId === "squat" ? "↓" : "↑"}</span>
                {ASSIST_LABEL[currentRound.movementId]}
              </button>
            )}
          </div>
        )}
        <div className="game-signal">
          <span className={`status-dot ${trackingPaused ? "status-dot--error" : "status-dot--ready"}`} />
          {demo ? ASSIST_HELP[currentRound.movementId] : `${Math.round(pose?.fps ?? 0)} FPS · camera stays local`}
        </div>
      </div>

      {trackingPaused && phase === "playing" && (
        <div ref={overlayRef} tabIndex={-1} className="tracking-pause" role="alertdialog" aria-modal="true" aria-labelledby="tracking-title">
          <span className="tracking-pause__figure">◌</span>
          <div>
            <strong id="tracking-title">Step back into view</strong>
            <p>{poseError ?? "The world is paused because your pose is not reliably visible. Move back so your head and shoulders are in frame."}</p>
            <div className="tracking-pause__actions">
              <button className="text-button" type="button" onClick={onUseKeyboard}>Continue with tap or keyboard controls</button>
              <button className="text-button" type="button" onClick={skipRound}>Skip this round</button>
            </div>
          </div>
        </div>
      )}

      {manualPaused && !trackingPaused && phase === "playing" && (
        <div ref={overlayRef} tabIndex={-1} className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <strong id="pause-title">Adventure paused</strong>
          <p>Take your time. The countdown is stopped.</p>
          <button className="primary-button" type="button" onClick={() => setManualPaused(false)}>Resume</button>
        </div>
      )}

      {phase === "feedback" && (
        <div ref={overlayRef} tabIndex={-1} className="round-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
          <p className="eyebrow"><span /> Round {roundIndex + 1} complete</p>
          <h2 id="feedback-title">How did that feel?</h2>
          <p>{demo ? "The guided rule combines your answer with target completion and keyboard movement range." : "The Movement Director combines your answer with only movement range, completion and tracking confidence."}</p>
          <div className="feedback-options">
            {(["too_hard", "just_right", "too_easy"] as const).map((option) => (
              <button key={option} type="button" aria-pressed={feedback === option} className={feedback === option ? "active" : ""} onClick={() => setFeedback(option)}>
                {option === "too_hard" ? "Too hard" : option === "too_easy" ? "Too easy" : "Just right"}
              </button>
            ))}
          </div>
          <button className="primary-button primary-button--large" type="button" disabled={!feedback} onClick={() => void continueAfterRound()}>
            {roundIndex === rounds.length - 1 ? "Reveal my garden" : "Let the world adapt"} <span>→</span>
          </button>
        </div>
      )}

      {phase === "adapting" && (
        <div ref={overlayRef} tabIndex={-1} className="round-dialog round-dialog--thinking" role="status" aria-live="polite">
          <span className="adapt-spinner">✦</span>
          <p className="eyebrow"><span /> Movement Director</p>
          <h2>Reading the round…</h2>
          <p>{demo ? "Completion, keyboard range and your answer are becoming the next set of parameters." : "Completion, range, confidence and your answer are becoming the next set of parameters."}</p>
        </div>
      )}

      {phase === "trace" && trace && (
        <div ref={overlayRef} tabIndex={-1} className="round-dialog round-dialog--trace" role="dialog" aria-modal="true" aria-labelledby="trace-title">
          <DirectorBadge meta={traceMeta} />
          <p className="eyebrow"><span /> {trace.adjustments.includes("none") ? "The world held steady" : "The world changed"}</p>
          <h2 id="trace-title">“{trace.reason}”</h2>
          <div className="trace-parameters">
            <div><small>Range</small><strong>{traceSeed ? `${Math.round(traceSeed.rangeScale * 100)} → ` : ""}{Math.round(trace.nextRound.rangeScale * 100)}%</strong></div>
            <div><small>Tempo</small><strong>{traceSeed ? `${traceSeed.tempo.toFixed(2)} → ` : ""}{trace.nextRound.tempo.toFixed(2)}×</strong></div>
            <div><small>Targets/min</small><strong>{traceSeed ? `${traceSeed.targetRate} → ` : ""}{trace.nextRound.targetRate}</strong></div>
          </div>
          <button className="primary-button primary-button--large" type="button" onClick={beginRest}>Take the forest pause <span>→</span></button>
        </div>
      )}

      {phase === "rest" && (
        <div ref={overlayRef} tabIndex={-1} className="round-dialog round-dialog--rest" role="status" aria-live="polite">
          <p className="eyebrow"><span /> Forest pause</p>
          <h2>{restSecondsLeft}s</h2>
          <p>Breathe, return to centre, and get ready for round {roundIndex + 2}.</p>
        </div>
      )}
    </main>
  );
}
