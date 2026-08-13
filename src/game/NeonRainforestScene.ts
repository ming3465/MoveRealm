import Phaser from "phaser";
import type { Direction, QuestRound } from "../shared/contracts";
import type { MovementEvent } from "../pose/types";
import {
  isMovementOnTarget,
  requiredAmplitudeForMovement,
  targetIntervalMs,
  type MovementTarget,
} from "./targetMatching";

interface SceneCallbacks {
  onTargetPresented: () => void;
  onTargetCompleted: (event: MovementEvent) => void;
}

const ACCENTS = {
  mint: { bright: 0x80ffd1, soft: 0x1de9a0 },
  orchid: { bright: 0xefb1ff, soft: 0xa65fff },
  amber: { bright: 0xffe786, soft: 0xffaa3c },
} as const;

export class NeonRainforestScene extends Phaser.Scene {
  private callbacks: SceneCallbacks;
  private permittedDirections: Direction[];
  private assisted: boolean;
  private currentRound?: QuestRound;
  private target?: Phaser.GameObjects.Container;
  private targetDescriptor?: MovementTarget;
  private targetTimer?: Phaser.Time.TimerEvent;
  private river?: Phaser.GameObjects.Graphics;
  private vines?: Phaser.GameObjects.Graphics;
  private canopy?: Phaser.GameObjects.Graphics;
  private fireflies: Phaser.GameObjects.Arc[] = [];
  private growth = 0;

  constructor(
    callbacks: SceneCallbacks,
    permittedDirections: Direction[],
    assisted: boolean,
  ) {
    super({ key: "neon-rainforest" });
    this.callbacks = callbacks;
    this.permittedDirections = permittedDirections;
    this.assisted = assisted;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("rgba(2, 18, 13, 0)");
    this.drawAtmosphere();
    this.river = this.add.graphics().setDepth(2);
    this.vines = this.add.graphics().setDepth(3);
    this.canopy = this.add.graphics().setDepth(1);
    this.drawRiver(0.5);
    this.drawCanopy();
    this.createFireflies();
    if (this.currentRound) this.applyRound();
  }

  private drawAtmosphere(): void {
    const haze = this.add.graphics().setDepth(0);
    haze.fillStyle(0x031f18, 0.28);
    haze.fillRect(0, 0, 1280, 720);
    haze.fillStyle(0x39ffb0, 0.04);
    for (let index = 0; index < 7; index += 1) {
      haze.fillCircle(100 + index * 210, 100 + (index % 3) * 180, 180);
    }
  }

  private drawCanopy(): void {
    if (!this.canopy) return;
    this.canopy.clear();
    this.canopy.fillStyle(0x0b4936, 0.56);
    for (let index = 0; index < 13; index += 1) {
      const x = -30 + index * 110;
      const y = 8 + (index % 3) * 18;
      this.canopy.fillEllipse(x, y, 210, 95);
    }
    this.canopy.lineStyle(2, 0x51ffc1, 0.16);
    for (let index = 0; index < 9; index += 1) {
      const x = 60 + index * 150;
      this.canopy.beginPath();
      this.canopy.moveTo(x, 0);
      this.canopy.lineTo(x - 10, 80 + (index % 4) * 25);
      this.canopy.strokePath();
    }
  }

  private createFireflies(): void {
    for (let index = 0; index < 26; index += 1) {
      const firefly = this.add
        .circle(
          40 + Math.random() * 1200,
          45 + Math.random() * 560,
          1.5 + Math.random() * 2.3,
          0xbaffdc,
          0.25 + Math.random() * 0.55,
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(4);
      this.fireflies.push(firefly);
      this.tweens.add({
        targets: firefly,
        x: firefly.x + Phaser.Math.Between(-45, 45),
        y: firefly.y + Phaser.Math.Between(-35, 35),
        alpha: { from: 0.2, to: 0.92 },
        duration: Phaser.Math.Between(1600, 3400),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private drawRiver(direction: number): void {
    if (!this.river) return;
    this.river.clear();
    this.river.lineStyle(44, 0x23d5c3, 0.12);
    const riverCurve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(0, 650),
      new Phaser.Math.Vector2(330, 545),
      new Phaser.Math.Vector2(660 + direction * 100, 760),
      new Phaser.Math.Vector2(1280, 575),
    );
    riverCurve.draw(this.river, 48);
    this.river.lineStyle(4, 0x72ffe7, 0.42);
    riverCurve.draw(this.river, 48);
  }

  setRound(round: QuestRound): void {
    this.currentRound = round;
    if (!this.time) return;
    this.applyRound();
  }

  private applyRound(): void {
    if (!this.currentRound) return;
    this.clearTargetTimer();
    this.target?.destroy(true);
    this.target = undefined;
    this.targetDescriptor = undefined;
    this.spawnTarget();
  }

  private clearTargetTimer(): void {
    this.targetTimer?.destroy();
    this.targetTimer = undefined;
  }

  private scheduleNextTarget(delay: number): void {
    this.clearTargetTimer();
    this.targetTimer = this.time.delayedCall(delay, () => {
      this.targetTimer = undefined;
      this.spawnTarget();
    });
  }

  private lateralDirection(): -1 | 1 | undefined {
    const left = this.permittedDirections.includes("left");
    const right = this.permittedDirections.includes("right");
    if (left && right) return Math.random() > 0.5 ? 1 : -1;
    if (left) return -1;
    if (right) return 1;
    return undefined;
  }

  private targetPosition(round: QuestRound): { x: number; y: number; side?: "left" | "right" } {
    if (round.movementId === "squat") {
      return {
        x: 640 + Phaser.Math.Between(-90, 90),
        y: 480 + round.rangeScale * 100 + Phaser.Math.Between(-12, 12),
      };
    }
    const permittedDirection = this.lateralDirection();
    const direction = permittedDirection ?? (Math.random() > 0.5 ? 1 : -1);
    if (round.movementId === "side_step") {
      return {
        x: 640 + direction * (180 + round.rangeScale * 260),
        y: 420,
        side: direction < 0 ? "left" : "right",
      };
    }
    const offset = permittedDirection == null
      ? 30 + round.rangeScale * 60
      : 130 + round.rangeScale * 300;
    return {
      x: 640 + direction * offset,
      y: 125 + Phaser.Math.Between(0, Math.round(150 * (1 - round.rangeScale))),
    };
  }

  private spawnTarget(): void {
    if (!this.currentRound) return;
    this.target?.destroy(true);
    const position = this.targetPosition(this.currentRound);
    const colors = ACCENTS[this.currentRound.accent];
    const glow = this.add.circle(0, 0, 44, colors.soft, 0.12);
    const ring = this.add.circle(0, 0, 24, colors.bright, 0.18).setStrokeStyle(2, colors.bright, 0.86);
    const core = this.add.circle(0, 0, 6, colors.bright, 0.96);
    const requiredAmplitude = requiredAmplitudeForMovement(
      this.currentRound.movementId,
      this.currentRound.rangeScale,
    );
    this.target = this.add.container(position.x, position.y, [glow, ring, core]).setDepth(8);
    this.targetDescriptor = {
      movementId: this.currentRound.movementId,
      x: position.x / 1280,
      y: position.y / 720,
      ...(position.side ? { side: position.side } : {}),
      ...(requiredAmplitude == null ? {} : { requiredAmplitude }),
    };
    this.tweens.add({
      targets: [glow, ring],
      scale: { from: 0.82, to: 1.22 },
      alpha: { from: 0.9, to: 0.28 },
      duration: 850 / this.currentRound.tempo,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.callbacks.onTargetPresented();
    this.scheduleNextTarget(
      targetIntervalMs(this.currentRound.targetRate, this.currentRound.tempo),
    );
  }

  registerMovement(event: MovementEvent): boolean {
    if (
      !this.currentRound ||
      !this.target ||
      !this.targetDescriptor ||
      !isMovementOnTarget(event, this.targetDescriptor, this.assisted)
    ) {
      return false;
    }
    const target = this.target;
    const colors = ACCENTS[this.currentRound.accent];
    this.tweens.killTweensOf(target.list);
    this.tweens.add({
      targets: target,
      scale: 1.9,
      alpha: 0,
      duration: 280,
      ease: "Cubic.easeOut",
      onComplete: () => target.destroy(true),
    });
    this.target = undefined;
    this.targetDescriptor = undefined;
    this.clearTargetTimer();
    this.growth += 1;
    this.addGrowth(event, colors.bright);
    if (event.movementId === "side_step") this.drawRiver(event.side === "left" ? -0.8 : 0.8);
    this.scheduleNextTarget(650 / this.currentRound.tempo);
    this.callbacks.onTargetCompleted(event);
    return true;
  }

  private addGrowth(event: MovementEvent, color: number): void {
    if (!this.vines) return;
    const x = Phaser.Math.Clamp(event.x * 1280, 80, 1200);
    const height = 36 + Math.min(event.amplitude, 1.2) * 42;
    this.vines.lineStyle(3, color, 0.55);
    new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(x, 700),
      new Phaser.Math.Vector2(x - 35, 670),
      new Phaser.Math.Vector2(x + 35, 650 - height / 2),
      new Phaser.Math.Vector2(x, 690 - height),
    ).draw(this.vines, 14);
    this.vines.fillStyle(color, 0.38);
    this.vines.fillEllipse(x - 12, 682 - height, 25, 10);
    this.vines.fillEllipse(x + 12, 672 - height, 25, 10);
    const burst = this.add.circle(x, 690 - height, 8, color, 0.85).setDepth(9);
    this.tweens.add({
      targets: burst,
      scale: 3.5,
      alpha: 0,
      duration: 500,
      onComplete: () => burst.destroy(),
    });
  }

  setTrackingPaused(paused: boolean): void {
    if (!this.scene) return;
    if (paused && !this.scene.isPaused()) this.scene.pause();
    if (!paused && this.scene.isPaused()) this.scene.resume();
  }

  completeGarden(): void {
    this.clearTargetTimer();
    this.target?.destroy(true);
    this.target = undefined;
    this.targetDescriptor = undefined;
    this.cameras.main.flash(750, 95, 255, 192, false);
    this.fireflies.forEach((firefly, index) => {
      this.tweens.add({
        targets: firefly,
        x: 640 + Math.cos(index * 0.9) * (120 + index * 5),
        y: 330 + Math.sin(index * 0.9) * (90 + index * 3),
        alpha: 1,
        duration: 1_200,
        ease: "Cubic.easeOut",
      });
    });
  }
}
