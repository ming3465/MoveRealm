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
});
