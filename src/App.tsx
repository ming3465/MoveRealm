import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type {
  ConfirmedConstraints,
  DirectorResponse,
  EnergyLevel,
  QuestPlan,
  SceneProfile,
  UserIntent,
} from "./shared/contracts";
import { createFallbackPlan, DEMO_SCENES } from "./shared/fallbacks";
import type { CalibrationProfile, PoseFrame } from "./pose/types";
import { PoseEngine } from "./pose/PoseEngine";
import { analyzeScene, requestPlan } from "./lib/directorApi";
import { captureStill, requestCamera, stopCamera, type CapturedStill } from "./lib/camera";
import { LandingScreen } from "./components/LandingScreen";
import { CaptureScreen } from "./components/CaptureScreen";
import { DirectorThinking } from "./components/DirectorThinking";
import { ConfirmScreen } from "./components/ConfirmScreen";
import { CalibrationScreen } from "./components/CalibrationScreen";
import type { SessionResult } from "./components/GameScreen";
import { PostcardScreen } from "./components/PostcardScreen";

type Screen =
  | "landing"
  | "capture"
  | "thinking_scene"
  | "confirm"
  | "thinking_plan"
  | "calibrate"
  | "game"
  | "postcard";

const GameScreen = lazy(() =>
  import("./components/GameScreen").then((module) => ({ default: module.GameScreen })),
);

function constraintsForScene(scene: SceneProfile): ConfirmedConstraints {
  const permitsLeft = scene.permittedDirections.includes("left");
  const permitsRight = scene.permittedDirections.includes("right");
  return {
    floorClear: false,
    noJumping: true,
    sideStepRange:
      permitsLeft && permitsRight ? (scene.spaceClass === "open" ? "wide" : "narrow") : "none",
    permittedDirections: [...scene.permittedDirections],
  };
}

const intentForEnergy = (energy: EnergyLevel): UserIntent => ({
  durationSeconds: 180,
  energy,
  noJumping: true,
});

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [energy, setEnergy] = useState<EnergyLevel>("balanced");
  const [stream, setStream] = useState<MediaStream>();
  const [still, setStill] = useState<CapturedStill>();
  const [scene, setScene] = useState<DirectorResponse<SceneProfile>>();
  const [constraints, setConstraints] = useState<ConfirmedConstraints>();
  const [plan, setPlan] = useState<DirectorResponse<QuestPlan>>();
  const [planPending, setPlanPending] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationProfile>();
  const [calibrationReady, setCalibrationReady] = useState(false);
  const [pose, setPose] = useState<PoseFrame>();
  const [poseStatus, setPoseStatus] = useState<"loading" | "ready" | "error">("loading");
  const [poseError, setPoseError] = useState<string>();
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<SessionResult>();
  const videoRef = useRef<HTMLVideoElement | undefined>(undefined);
  const poseEngineRef = useRef<PoseEngine | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const stillRef = useRef<CapturedStill | undefined>(undefined);
  const journeyStartedAtRef = useRef(performance.now());
  const planningRequestRef = useRef(0);
  streamRef.current = stream;
  stillRef.current = still;

  useEffect(() => {
    return () => {
      stopCamera(streamRef.current);
      poseEngineRef.current?.dispose();
      if (stillRef.current?.previewUrl) URL.revokeObjectURL(stillRef.current.previewUrl);
    };
  }, []);

  useEffect(() => {
    if (calibrationReady && calibration && plan && !planPending) setScreen("game");
  }, [calibration, calibrationReady, plan, planPending]);

  const releaseStill = useCallback(() => {
    if (stillRef.current?.previewUrl) URL.revokeObjectURL(stillRef.current.previewUrl);
    stillRef.current = undefined;
    setStill(undefined);
  }, []);

  const stopLocalTracking = useCallback(() => {
    stopCamera(streamRef.current);
    streamRef.current = undefined;
    setStream(undefined);
    poseEngineRef.current?.dispose();
    poseEngineRef.current = undefined;
    setPose(undefined);
  }, []);

  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    if (!node) {
      videoRef.current = undefined;
      poseEngineRef.current?.unbindVideo();
      return;
    }
    videoRef.current = node;
    if (streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      void node.play().catch(() => undefined);
    }
    poseEngineRef.current ??= new PoseEngine();
    poseEngineRef.current.start(node, {
      onReady: () => {
        setPoseStatus("ready");
        setPoseError(undefined);
      },
      onFrame: setPose,
      onError: (message, recoverable) => {
        setPoseError(message);
        if (!recoverable) setPoseStatus("error");
      },
    });
  }, []);

  const reset = useCallback(() => {
    planningRequestRef.current += 1;
    stopCamera(streamRef.current);
    setStream(undefined);
    poseEngineRef.current?.dispose();
    poseEngineRef.current = undefined;
    setPose(undefined);
    setPoseStatus("loading");
    setPoseError(undefined);
    if (stillRef.current?.previewUrl) URL.revokeObjectURL(stillRef.current.previewUrl);
    setStill(undefined);
    setScene(undefined);
    setConstraints(undefined);
    setPlan(undefined);
    setPlanPending(false);
    setCalibration(undefined);
    setCalibrationReady(false);
    setResult(undefined);
    setDemo(false);
    setBusy(false);
    setError(undefined);
    setScreen("landing");
  }, []);

  const openCamera = async () => {
    journeyStartedAtRef.current = performance.now();
    setBusy(true);
    setError(undefined);
    try {
      const nextStream = await requestCamera();
      stopCamera(streamRef.current);
      streamRef.current = nextStream;
      setStream(nextStream);
      setDemo(false);
      setScreen("capture");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Camera permission was not granted.");
    } finally {
      setBusy(false);
    }
  };

  const useDemoRoom = () => {
    journeyStartedAtRef.current = performance.now();
    stopCamera(streamRef.current);
    setStream(undefined);
    setPose(undefined);
    setDemo(true);
    const demoScene: DirectorResponse<SceneProfile> = {
      data: DEMO_SCENES.tight,
      meta: {
        source: "demo",
        latencyMs: 36,
        label: "Guided demo",
        detail: "A pre-validated constrained-room profile is used for camera-free judging.",
      },
    };
    setScene(demoScene);
    setConstraints(constraintsForScene(demoScene.data));
    setScreen("confirm");
    setError(undefined);
  };

  const takeRoomStill = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    setError(undefined);
    try {
      const captured = await captureStill(videoRef.current);
      if (stillRef.current?.previewUrl) URL.revokeObjectURL(stillRef.current.previewUrl);
      stillRef.current = captured;
      setStill(captured);
      setScreen("thinking_scene");
      const analyzed = await analyzeScene(captured);
      setScene(analyzed);
      setConstraints(constraintsForScene(analyzed.data));
      setScreen("confirm");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The room still could not be analyzed.");
      setScreen("capture");
    } finally {
      setBusy(false);
    }
  };

  const buildQuest = async () => {
    if (!scene || !constraints?.floorClear) return;
    const request = {
      scene: scene.data,
      constraints,
      intent: intentForEnergy(energy),
    };
    const requestId = planningRequestRef.current + 1;
    planningRequestRef.current = requestId;
    setPlan({
      data: createFallbackPlan(request),
      meta: {
        source: demo ? "demo" : "fallback",
        latencyMs: 0,
        label: demo ? "Guided demo" : "Planning preview",
        detail: demo
          ? "A pre-validated deterministic plan keeps the camera-free demo independent of network services."
          : "A conservative preview is shown while the Movement Director finalizes the quest.",
      },
    });
    setCalibrationReady(false);
    setScreen("calibrate");
    setError(undefined);
    if (demo) {
      setPlanPending(false);
      releaseStill();
      return;
    }
    setPlanPending(true);
    const nextPlan = await requestPlan(request);
    if (planningRequestRef.current !== requestId) return;
    setPlan(nextPlan);
    setPlanPending(false);
    releaseStill();
  };

  const returnToCapture = () => {
    if (demo) {
      reset();
      return;
    }
    setScene(undefined);
    setConstraints(undefined);
    setPlan(undefined);
    setCalibration(undefined);
    setCalibrationReady(false);
    releaseStill();
    setScreen("capture");
  };

  const switchToKeyboard = () => {
    stopLocalTracking();
    setDemo(true);
    setPoseError(undefined);
    setPoseStatus("ready");
  };

  const playAgain = () => {
    journeyStartedAtRef.current = performance.now();
    setResult(undefined);
    setScreen("game");
  };

  return (
    <div className={`app app--${screen}`}>
      {screen === "landing" && (
        <LandingScreen
          energy={energy}
          onEnergyChange={setEnergy}
          onCamera={() => void openCamera()}
          onDemo={useDemoRoom}
          busy={busy}
          error={error}
        />
      )}
      {screen === "capture" && (
        <CaptureScreen
          stream={stream}
          pose={pose}
          poseStatus={poseStatus}
          poseError={poseError}
          attachVideo={attachVideo}
          onCapture={() => void takeRoomStill()}
          onBack={reset}
          onDemo={useDemoRoom}
          capturing={busy}
          error={error}
        />
      )}
      {screen === "thinking_scene" && <DirectorThinking mode="scene" />}
      {screen === "confirm" && scene && constraints && (
        <ConfirmScreen
          scene={scene}
          still={still}
          demo={demo}
          constraints={constraints}
          onConstraintsChange={setConstraints}
          onContinue={() => void buildQuest()}
          onBack={returnToCapture}
        />
      )}
      {screen === "thinking_plan" && <DirectorThinking mode="plan" />}
      {screen === "calibrate" && plan && constraints && (
        <CalibrationScreen
          stream={stream}
          pose={pose}
          demo={demo}
          sideStepRange={constraints.sideStepRange}
          plan={plan}
          attachVideo={attachVideo}
          onComplete={(nextCalibration) => {
            setCalibration(nextCalibration);
            setCalibrationReady(true);
          }}
          onUseDemo={switchToKeyboard}
          onBack={() => setScreen("confirm")}
          poseError={poseError}
        />
      )}
      {screen === "game" && plan && constraints && calibration && (
        <Suspense fallback={<DirectorThinking mode="plan" />}>
          <GameScreen
            key={`game-${result ? "replay" : "new"}`}
            plan={plan.data}
            planMeta={plan.meta}
            constraints={constraints}
            intent={intentForEnergy(energy)}
            calibration={calibration}
            stream={stream}
            pose={pose}
            poseError={poseError}
            demo={demo}
            journeyStartedAt={journeyStartedAtRef.current}
            attachVideo={attachVideo}
            onUseKeyboard={switchToKeyboard}
            onComplete={(nextResult) => {
              stopLocalTracking();
              releaseStill();
              setDemo(true);
              setResult(nextResult);
              setScreen("postcard");
            }}
            onExit={reset}
          />
        </Suspense>
      )}
      {screen === "postcard" && result && (
        <PostcardScreen result={result} onAgain={playAgain} onHome={reset} />
      )}
    </div>
  );
}
