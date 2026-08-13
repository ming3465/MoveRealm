// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Production JSX is typechecked by tsconfig.app.json.
import { CaptureScreen } from "../src/components/CaptureScreen.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/pose/drawPose.js", () => ({ drawPose: vi.fn() }));

function liveStream(): MediaStream {
  return {
    getVideoTracks: () => [new EventTarget()],
  } as unknown as MediaStream;
}

describe("CaptureScreen camera readiness", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("keeps capture disabled until the preview actually plays", async () => {
    const onCapture = vi.fn();
    await act(async () => {
      root.render(createElement(CaptureScreen, {
        stream: liveStream(),
        poseStatus: "loading",
        attachVideo: vi.fn(),
        onCapture,
        onRetryCamera: vi.fn(),
        onPreviewError: vi.fn(),
        onBack: vi.fn(),
        onDemo: vi.fn(),
        capturing: false,
      }));
    });

    const capture = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Capture this room"),
    );
    expect(capture?.disabled).toBe(true);
    expect(container.querySelector("[role=status]")?.textContent).toContain(
      "Starting camera preview",
    );

    await act(async () => {
      container.querySelector("video")?.dispatchEvent(new Event("playing", { bubbles: true }));
    });

    expect(capture?.disabled).toBe(false);
  });

  it("offers a keyboard-reachable retry while keeping capture disabled after an error", async () => {
    const onRetryCamera = vi.fn();
    await act(async () => {
      root.render(createElement(CaptureScreen, {
        stream: undefined,
        poseStatus: "error",
        attachVideo: vi.fn(),
        onCapture: vi.fn(),
        onRetryCamera,
        onPreviewError: vi.fn(),
        onBack: vi.fn(),
        onDemo: vi.fn(),
        capturing: false,
        error: "The camera preview could not start. Try the camera again or use the guided demo.",
      }));
    });

    const retry = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Try camera again"),
    );
    const capture = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Capture this room"),
    );
    expect(retry).toBeDefined();
    expect(capture?.disabled).toBe(true);
    retry?.focus();
    expect(document.activeElement).toBe(retry);
    await act(async () => retry?.click());
    expect(onRetryCamera).toHaveBeenCalledOnce();
  });
});
