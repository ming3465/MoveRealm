import Phaser from "phaser";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardedRef,
} from "react";
import type { Direction, QuestRound } from "../shared/contracts";
import type { MovementEvent } from "../pose/types";
import { NeonRainforestScene } from "./NeonRainforestScene";

export interface NeonGameHandle {
  setRound: (round: QuestRound) => void;
  registerMovement: (event: MovementEvent) => boolean;
  setTrackingPaused: (paused: boolean) => void;
  completeGarden: () => void;
}

interface NeonGameProps {
  round?: QuestRound;
  permittedDirections: Direction[];
  assisted: boolean;
  onTargetPresented: () => void;
  onTargetCompleted: (event: MovementEvent) => void;
}

function NeonGameComponent(
  { round, permittedDirections, assisted, onTargetPresented, onTargetCompleted }: NeonGameProps,
  ref: ForwardedRef<NeonGameHandle>,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | undefined>(undefined);
  const sceneRef = useRef<NeonRainforestScene | undefined>(undefined);
  const callbacksRef = useRef({ onTargetPresented, onTargetCompleted });
  callbacksRef.current = { onTargetPresented, onTargetCompleted };

  useEffect(() => {
    if (!hostRef.current) return;
    const scene = new NeonRainforestScene({
      onTargetPresented: () => callbacksRef.current.onTargetPresented(),
      onTargetCompleted: (event) => callbacksRef.current.onTargetCompleted(event),
    }, permittedDirections, assisted);
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: 1280,
      height: 720,
      transparent: true,
      antialias: true,
      render: { transparent: true, antialias: true, pixelArt: false },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
      },
      scene: [scene],
      audio: { noAudio: true },
    });
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = undefined;
      sceneRef.current = undefined;
    };
  }, [assisted, permittedDirections]);

  useEffect(() => {
    if (!round) return;
    sceneRef.current?.setRound(round);
  }, [round]);

  useImperativeHandle(
    ref,
    () => ({
      setRound: (nextRound) => sceneRef.current?.setRound(nextRound),
      registerMovement: (event) => sceneRef.current?.registerMovement(event) ?? false,
      setTrackingPaused: (paused) => sceneRef.current?.setTrackingPaused(paused),
      completeGarden: () => sceneRef.current?.completeGarden(),
    }),
    [],
  );

  return <div className="neon-game" ref={hostRef} aria-hidden="true" />;
}

export const NeonGame = forwardRef(NeonGameComponent);
