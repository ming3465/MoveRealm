// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The server test typecheck has no JSX emit because production UI is checked by tsconfig.app.json.
// @ts-expect-error Importing the already app-typechecked component is intentional in this DOM test.
import { CameraStage } from "../src/components/CameraStage.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/pose/drawPose.js", () => ({ drawPose: vi.fn() }));

describe("CameraStage video binding", () => {
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

  it("keeps the same video binding across ordinary pose-driven renders", async () => {
    const attachVideo = vi.fn();

    await act(async () => {
      root.render(createElement(CameraStage, { attachVideo, className: "first" }));
    });

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(attachVideo).toHaveBeenCalledTimes(1);
    expect(attachVideo).toHaveBeenLastCalledWith(video);

    await act(async () => {
      root.render(createElement(CameraStage, { attachVideo, className: "second" }));
    });

    expect(attachVideo).toHaveBeenCalledTimes(1);
    expect(container.querySelector("video")).toBe(video);
  });

  it("rebinds a replacement stream and reports a later track end", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const firstTrack = new EventTarget();
    const secondTrack = new EventTarget();
    const firstStream = {
      getVideoTracks: () => [firstTrack],
    } as unknown as MediaStream;
    const secondStream = {
      getVideoTracks: () => [secondTrack],
    } as unknown as MediaStream;
    const onPreviewReadyChange = vi.fn();
    const onPreviewError = vi.fn();
    const attachVideo = vi.fn();

    await act(async () => {
      root.render(createElement(CameraStage, {
        attachVideo,
        stream: firstStream,
        onPreviewReadyChange,
        onPreviewError,
      }));
    });
    const video = container.querySelector("video")!;
    expect(video.srcObject).toBe(firstStream);
    expect(play).toHaveBeenCalledTimes(1);
    expect(attachVideo).toHaveBeenCalledWith(video);
    const initialBindings = attachVideo.mock.calls.length;

    await act(async () => {
      video.dispatchEvent(new Event("playing", { bubbles: true }));
    });
    expect(onPreviewReadyChange).toHaveBeenLastCalledWith(true);

    await act(async () => {
      root.render(createElement(CameraStage, {
        attachVideo,
        stream: secondStream,
        onPreviewReadyChange,
        onPreviewError,
      }));
    });
    expect(video.srcObject).toBe(secondStream);
    expect(play).toHaveBeenCalledTimes(2);
    expect(attachVideo.mock.calls.length).toBe(initialBindings + 1);

    await act(async () => {
      firstTrack.dispatchEvent(new Event("ended"));
    });
    expect(onPreviewError).not.toHaveBeenCalled();

    await act(async () => {
      secondTrack.dispatchEvent(new Event("ended"));
    });
    expect(onPreviewError).toHaveBeenCalledWith(
      "The camera preview stopped. Try the camera again or use the guided demo.",
    );
    expect(onPreviewReadyChange).toHaveBeenLastCalledWith(false);
  });

  it("sanitizes video playback rejection and leaves preview readiness false", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new Error("TOP_SECRET_VIDEO_DRIVER"),
    );
    const stream = {
      getVideoTracks: () => [new EventTarget()],
    } as unknown as MediaStream;
    const onPreviewReadyChange = vi.fn();
    const onPreviewError = vi.fn();

    await act(async () => {
      root.render(createElement(CameraStage, {
        attachVideo: vi.fn(),
        stream,
        onPreviewReadyChange,
        onPreviewError,
      }));
      await Promise.resolve();
    });

    expect(onPreviewError).toHaveBeenCalledWith(
      "The camera preview could not start. Try the camera again or use the guided demo.",
    );
    expect(JSON.stringify(onPreviewError.mock.calls)).not.toContain("TOP_SECRET_VIDEO_DRIVER");
    expect(onPreviewReadyChange).toHaveBeenLastCalledWith(false);
  });
});
