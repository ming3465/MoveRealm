// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The server test typecheck has no JSX emit because production UI is checked by tsconfig.app.json.
// @ts-expect-error Importing the already app-typechecked component is intentional in this DOM test.
import { PostcardScreen } from "../src/components/PostcardScreen.js";
import {
  buildSessionEvidence,
  type SessionResult,
} from "../src/lib/sessionEvidence.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/lib/sessionEvidence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/sessionEvidence.js")>();
  return { ...actual, buildSessionEvidence: vi.fn() };
});

const result = {
  plan: { title: "Glowgarden Awakening", requestedDurationSeconds: 180 },
  telemetry: [{ trackingMode: "keyboard" }],
  adaptations: [],
  activeSeconds: 156,
  totalTargets: 10,
  completedTargets: 5,
  timeToFirstMovementMs: 4_000,
  directorLatencyMs: 0,
  poseMetricSummaries: {},
} as unknown as SessionResult;

describe("Postcard evidence download", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.mocked(buildSessionEvidence).mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderPostcard(): Promise<HTMLButtonElement> {
    await act(async () => {
      root.render(createElement(PostcardScreen, {
        result,
        sceneMeta: null,
        roomSpaceClass: null,
        onAgain: () => undefined,
        onHome: () => undefined,
      }));
    });
    const button = [...container.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("Download local run evidence"),
    );
    if (!button) throw new Error("Evidence download button was not rendered.");
    return button;
  }

  it("clicks an attached download link and reports success without Web Crypto", async () => {
    vi.mocked(buildSessionEvidence).mockReturnValue({ schemaVersion: "1.0.0" } as never);
    const createObjectUrl = vi.fn(() => "blob:test-evidence");
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    let attachedWhenClicked = false;
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function click(this: HTMLAnchorElement) {
        attachedWhenClicked = this.isConnected;
      });
    const button = await renderPostcard();

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(attachedWhenClicked).toBe(true);
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Downloaded anonymous evidence for trial 1",
    );
    expect(container.querySelector<HTMLInputElement>("#trial-number")?.max).toBe("3");
  });

  it("shows a sanitized error and does not attempt a download when evidence validation fails", async () => {
    vi.mocked(buildSessionEvidence).mockImplementation(() => {
      throw new Error("Bearer private-token at /Users/alice/room.jpg");
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click");
    const button = await renderPostcard();

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(anchorClick).not.toHaveBeenCalled();
    const status = container.querySelector('[role="status"]')?.textContent ?? "";
    expect(status).toBe(
      "Evidence export failed. No file was downloaded; restart this run and try again.",
    );
    expect(status).not.toMatch(/Bearer|private-token|Users\/|alice|room\.jpg/i);
  });
});
