// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_SCENES } from "../src/shared/fallbacks.js";
import { createFallbackPlan } from "../src/shared/fallbacks.js";
import type { CalibrationProfile } from "../src/pose/types.js";
// The server test typecheck has no JSX emit because production UI is checked by tsconfig.app.json.
// @ts-expect-error Importing the already app-typechecked component is intentional in this DOM test.
import { GameScreen } from "../src/components/GameScreen.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

// Phaser needs a real WebGL/canvas host, which jsdom does not provide. The scene is
// covered by its own tests; here we only care that assisted input reaches the game.
vi.mock("../src/game/NeonGame.js", () => ({ NeonGame: () => null }));
vi.mock("../src/lib/directorApi.js", () => ({
  requestAdaptation: vi.fn(async () => {
    throw new Error("not used in this test");
  }),
}));

const constraints = {
  floorClear: true,
  noJumping: true as const,
  sideStepRange: "wide" as const,
  permittedDirections: ["vertical", "left", "right", "center"] as const,
};
const intent = { durationSeconds: 180 as const, energy: "balanced" as const, noJumping: true as const };

const calibration: CalibrationProfile = {
  centerX: 0.5,
  standingHipY: 0.62,
  shoulderWidth: 0.24,
  bodyHeight: 0.5,
  lateralEnvelope: 0.3,
};

function planFor(movement: "reach" | "squat" | "side_step") {
  const plan = createFallbackPlan({
    scene: DEMO_SCENES.open,
    constraints: { ...constraints, permittedDirections: [...constraints.permittedDirections] },
    intent,
  });
  // Force round one to the movement under test without touching the validated shape.
  const mechanic = {
    reach: "collect_fireflies",
    squat: "shelter_seedlings",
    side_step: "redirect_river",
  }[movement];
  plan.rounds[0] = { ...plan.rounds[0], movementId: movement, mechanic } as typeof plan.rounds[0];
  return plan;
}

function renderGame(root: Root, movement: "reach" | "squat" | "side_step") {
  const plan = planFor(movement);
  return act(async () => {
    root.render(
      createElement(GameScreen, {
        plan,
        planMeta: { source: "demo", latencyMs: 0, label: "Guided demo" },
        constraints: { ...constraints, permittedDirections: [...constraints.permittedDirections] },
        intent,
        calibration,
        demo: true,
        guidedDemo: true,
        journeyStartedAt: 0,
        attachVideo: () => {},
        onUseKeyboard: () => {},
        onComplete: () => {},
        onExit: () => {},
      }),
    );
  });
}

function pointerDown(node: Element) {
  const event = new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
  node.dispatchEvent(event);
  return event;
}

describe("assisted movement controls", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("gives a touch-only device a control for an in-place movement", async () => {
    await renderGame(root, "reach");
    const controls = container.querySelectorAll(".assist-key");
    expect(controls).toHaveLength(1);
    expect(controls[0].getAttribute("aria-label")).toBe("Reach now");
  });

  it("gives a touch-only device both lanes for a side-step round", async () => {
    await renderGame(root, "side_step");
    const labels = [...container.querySelectorAll(".assist-key")].map((node) =>
      node.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Step left", "Step right"]);
  });

  it("labels the squat control without naming a keyboard key", async () => {
    await renderGame(root, "squat");
    const control = container.querySelector(".assist-key");
    expect(control?.getAttribute("aria-label")).toBe("Lower now");
  });

  it("cancels the default so a tap never steals focus from the key handler", async () => {
    await renderGame(root, "reach");
    const control = container.querySelector(".assist-key");
    expect(control).not.toBeNull();
    let event!: MouseEvent;
    await act(async () => {
      event = pointerDown(control as Element);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(control);
  });

  it("still tells the player both input routes", async () => {
    await renderGame(root, "reach");
    const hint = container.querySelector(".game-signal")?.textContent ?? "";
    expect(hint).toContain("Tap Reach");
    expect(hint).toContain("↑");
  });

  it("offers a way out of a round the player cannot perform", async () => {
    await renderGame(root, "squat");
    const skip = container.querySelector(".game-skip-button");
    expect(skip).not.toBeNull();
    expect(skip?.getAttribute("aria-label")).toContain("next stage");
  });

  it("leaves the round for the feedback step when the player skips", async () => {
    await renderGame(root, "reach");
    expect(container.querySelector(".assist-key")).not.toBeNull();

    await act(async () => {
      (container.querySelector(".game-skip-button") as HTMLButtonElement).click();
    });

    // Play is over: the movement controls and the skip control both retire, and the
    // round-end feedback question takes over.
    expect(container.querySelector(".assist-key")).toBeNull();
    expect(container.querySelector(".game-skip-button")).toBeNull();
    expect(container.textContent).toContain("Round 1 complete");
    expect(container.textContent).toContain("How did that feel?");
    expect(container.textContent).toContain("Let the world adapt");
  });

  it("hides the controls in camera mode, where the body is the controller", async () => {
    const plan = planFor("reach");
    await act(async () => {
      root.render(
        createElement(GameScreen, {
          plan,
          planMeta: { source: "codebuddy", latencyMs: 12, label: "CodeBuddy live" },
          constraints: { ...constraints, permittedDirections: [...constraints.permittedDirections] },
          intent,
          calibration,
          demo: false,
          guidedDemo: false,
          journeyStartedAt: 0,
          attachVideo: () => {},
          onUseKeyboard: () => {},
          onComplete: () => {},
          onExit: () => {},
        }),
      );
    });
    expect(container.querySelectorAll(".assist-key")).toHaveLength(0);
  });
});
