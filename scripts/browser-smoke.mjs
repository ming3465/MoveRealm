import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const targetUrl = process.env.MOVEREALM_URL ?? "http://127.0.0.1:4173";
const testCamera = process.env.MOVEREALM_CAMERA_SMOKE === "1";
const testFullSession = process.env.MOVEREALM_FULL_SMOKE === "1";
const testAdaptation = process.env.MOVEREALM_ADAPT_SMOKE === "1" || testFullSession;
const testCapture = process.env.MOVEREALM_CAPTURE_SMOKE === "1";
const expectFallback = process.env.MOVEREALM_EXPECT_FALLBACK === "1";
const expectCodeBuddy = process.env.MOVEREALM_EXPECT_CODEBUDDY === "1";
const expectedCommit = process.env.MOVEREALM_EXPECT_COMMIT;
const expectedBuildId = process.env.MOVEREALM_EXPECT_BUILD_ID;
const artifactDirectory = await mkdtemp(join(tmpdir(), "moverealm-browser-smoke-"));
const profileDirectory = join(artifactDirectory, "profile");
await mkdir(profileDirectory);

const chromeArguments = [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "--window-size=1440,1000",
    "--hide-scrollbars",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--no-default-browser-check",
    ...(testCamera
      ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]
      : []),
    targetUrl,
  ];
const chrome = spawn(
  chromePath,
  chromeArguments,
  { stdio: ["ignore", "ignore", "pipe"] },
);

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function browserEndpoint() {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error("Chrome debugging endpoint did not start.")), 10_000);
    chrome.stderr.on("data", (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve(match[1]);
    });
    chrome.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Chrome exited before startup (code ${code ?? "unknown"}).`));
    });
  });
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.events.get(message.method) ?? []) listener(message.params ?? {});
    };
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = () => reject(new Error("Could not connect to Chrome."));
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.events.get(method) ?? [];
    listeners.push(listener);
    this.events.set(method, listeners);
  }

  close() {
    this.socket.close();
  }
}

let page;
const consoleErrors = [];
const networkRequests = [];

async function evaluate(expression) {
  const response = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? "Browser evaluation failed.");
  }
  return response.result?.value;
}

async function waitFor(expression, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(120);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function clickButton(text) {
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes(${JSON.stringify(text)}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Button not found: ${text}`);
}

async function pressKey(key, code, windowsVirtualKeyCode) {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
}

async function activateButtonByKeyboard(text) {
  await evaluate("document.body.focus() || true");
  for (let index = 0; index < 18; index += 1) {
    await pressKey("Tab", "Tab", 9);
    const focused = await evaluate("document.activeElement?.textContent?.trim() ?? ''");
    if (focused.includes(text)) {
      await pressKey(" ", "Space", 32);
      return;
    }
  }
  throw new Error(`Keyboard could not reach button: ${text}`);
}

async function scoreCurrentMovement() {
  const movement = await evaluate('document.querySelector(".round-instruction small")?.textContent ?? ""');
  if (movement.includes("Squat") || movement.includes("Seedling")) {
    await pressKey("ArrowDown", "ArrowDown", 40);
  } else if (movement.includes("side-step") || movement.includes("River")) {
    await pressKey("ArrowRight", "ArrowRight", 39);
  } else {
    await pressKey(" ", "Space", 32);
  }
  return movement;
}

async function scoreAndAssert(label) {
  const before = Number((await evaluate('document.querySelector(".game-score strong")?.textContent.replace(/,/g, "")')) ?? 0);
  const movement = await scoreCurrentMovement();
  await delay(900);
  const after = Number((await evaluate('document.querySelector(".game-score strong")?.textContent.replace(/,/g, "")')) ?? 0);
  if (!(after > before)) throw new Error(`${label} movement did not score (${before} -> ${after}, ${movement}).`);
  return { label, movement, before, after };
}

async function screenshot(name) {
  const result = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const path = join(artifactDirectory, `${name}.png`);
  await writeFile(path, Buffer.from(result.data, "base64"));
  return path;
}

try {
  const browserWs = await browserEndpoint();
  const port = new URL(browserWs).port;
  let targets = [];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    if (targets.some((target) => target.type === "page")) break;
    await delay(100);
  }
  const pageTarget = targets.find((target) => target.type === "page");
  if (!pageTarget) throw new Error("Chrome page target was not created.");
  page = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await page.open();
  page.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    consoleErrors.push(exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? "runtime error");
  });
  page.on("Log.entryAdded", ({ entry }) => {
    const isTensorFlowStartupNotice = entry?.text?.includes(
      "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.",
    );
    if (entry?.level === "error" && !isTensorFlowStartupNotice) consoleErrors.push(entry.text);
  });
  page.on("Network.requestWillBeSent", ({ request }) => {
    if (!request?.url || !request?.method) return;
    networkRequests.push({ method: request.method, url: request.url });
  });
  await page.send("Runtime.enable");
  await page.send("Page.enable");
  await page.send("Log.enable");
  await page.send("Network.enable");
  await page.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: artifactDirectory,
    eventsEnabled: true,
  });

  await waitFor('document.readyState === "complete" && !!document.querySelector(".landing")');
  const landingTitle = await evaluate('document.querySelector("h1")?.innerText');
  if (!landingTitle?.includes("come alive")) throw new Error("Landing headline did not render.");
  const landingScreenshot = await screenshot("01-landing");

  let cameraScreenshot;
  if (testCamera) {
    await activateButtonByKeyboard("Scan my room");
    await waitFor('!!document.querySelector(".capture-layout") && document.querySelector("video")?.videoWidth > 0', 15_000);
    await waitFor('!!document.querySelector(".camera-status .status-dot--ready")', 25_000);
    cameraScreenshot = await screenshot("01b-camera");
    if (testCapture) {
      await clickButton("Capture this room");
      await waitFor('!!document.querySelector(".confirm-layout")', 70_000);
    } else {
      await clickButton("Use demo room");
    }
  } else {
    await activateButtonByKeyboard("Try the guided demo");
  }
  await waitFor('!!document.querySelector(".confirm-layout")');
  const confirmState = await evaluate(`({
    badge: document.querySelector(".director-badge")?.textContent.trim(),
    floorChecked: document.querySelector(".floor-confirm input")?.checked,
    continueDisabled: [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Grow my adventure"))?.disabled
  })`);
  if ((!testCapture && !confirmState.badge?.includes("Guided demo")) || confirmState.floorChecked || !confirmState.continueDisabled) {
    throw new Error(`Unsafe confirmation defaults: ${JSON.stringify(confirmState)}`);
  }
  if (expectCodeBuddy && !confirmState.badge?.includes("CodeBuddy live")) {
    throw new Error(`Captured-room analysis lost its CodeBuddy provenance: ${JSON.stringify(confirmState)}`);
  }
  const confirmScreenshot = await screenshot("02-confirm-room");

  const checked = await evaluate('document.querySelector(".floor-confirm")?.click(); true');
  if (!checked) throw new Error("Floor confirmation control was unavailable.");
  await waitFor('[...document.querySelectorAll("button")].some((button) => button.textContent.includes("Grow my adventure") && !button.disabled)');
  await clickButton("Grow my adventure");
  await waitFor('!!document.querySelector(".calibration-layout")', 38_000);
  if (testCapture) await clickButton("Use keyboard controls for this run");
  const calibrationScreenshot = await screenshot("03-calibration");

  await waitFor('!!document.querySelector(".game-screen") && !!document.querySelector(".neon-game canvas")', 75_000);
  if (expectFallback) {
    await waitFor('document.querySelector(".game-director")?.textContent.includes("Safe fallback")', 5_000);
  }
  await delay(1_000);
  const roundScores = [await scoreAndAssert("round 1")];
  const beforeScore = roundScores[0].before;
  const afterScore = roundScores[0].after;
  const gameScreenshot = await screenshot("04-game");

  const paused = await evaluate(`(() => {
    const button = document.querySelector('button[aria-label="Pause adventure"]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!paused) throw new Error("Pause control was unavailable.");
  await waitFor('!!document.querySelector(".pause-overlay")');
  const pausedAt = await evaluate('document.querySelector(".game-progress")?.textContent');
  await delay(1_500);
  const pausedAfter = await evaluate('document.querySelector(".game-progress")?.textContent');
  if (pausedAfter !== pausedAt) throw new Error(`Round timer advanced while paused (${pausedAt} -> ${pausedAfter}).`);
  await clickButton("Resume");
  await waitFor('!document.querySelector(".pause-overlay")');

  let adaptation;
  let adaptationScreenshot;
  if (testAdaptation) {
    await waitFor('!!document.querySelector(".round-dialog")', 60_000);
    await clickButton("Too hard");
    await clickButton("Let the world adapt");
    await waitFor('!!document.querySelector(".round-dialog--trace")', 15_000);
    adaptation = await evaluate(`({
      reason: document.querySelector(".round-dialog--trace h2")?.textContent.trim(),
      parameters: [...document.querySelectorAll(".trace-parameters strong")].map((item) => item.textContent.trim()),
      source: document.querySelector(".round-dialog--trace .director-badge")?.textContent.trim()
    })`);
    if (!adaptation.reason || adaptation.parameters.length !== 3) {
      throw new Error(`Adaptation trace did not render: ${JSON.stringify(adaptation)}`);
    }
    if (!adaptation.parameters.some((parameter) => parameter.includes("→"))) {
      throw new Error(`Adaptation did not expose a before/after change: ${JSON.stringify(adaptation)}`);
    }
    if (testCapture && expectFallback && !adaptation.source?.includes("Safe fallback")) {
      throw new Error(`Captured-room adaptation lost its fallback provenance: ${JSON.stringify(adaptation)}`);
    }
    if (expectCodeBuddy && !adaptation.source?.includes("CodeBuddy live")) {
      throw new Error(`Captured-room adaptation lost its CodeBuddy provenance: ${JSON.stringify(adaptation)}`);
    }
    if (!testCapture && !adaptation.source?.includes("Guided demo")) {
      throw new Error(`Guided adaptation lost its demo provenance: ${JSON.stringify(adaptation)}`);
    }
    adaptationScreenshot = await screenshot("05-adaptation");
  }

  let postcard;
  let postcardScreenshot;
  let evidenceFile;
  let evidenceSha256;
  let evidenceProduct;
  if (testFullSession) {
    await clickButton("Take the forest pause");
    await waitFor('document.querySelector(".game-progress")?.textContent.includes("Round 2 of 3")', 20_000);
    await delay(900);
    roundScores.push(await scoreAndAssert("round 2"));
    await waitFor('!!document.querySelector(".round-dialog")', 60_000);
    await clickButton("Just right");
    await clickButton("Let the world adapt");
    await waitFor('!!document.querySelector(".round-dialog--trace")', 15_000);
    await clickButton("Take the forest pause");
    await waitFor('document.querySelector(".game-progress")?.textContent.includes("Round 3 of 3")', 20_000);
    await delay(900);
    roundScores.push(await scoreAndAssert("round 3"));
    await waitFor('!!document.querySelector(".round-dialog")', 60_000);
    await clickButton("Just right");
    await clickButton("Reveal my garden");
    await waitFor('!!document.querySelector(".postcard-screen")', 8_000);
    postcard = await evaluate(`({
      title: document.querySelector(".postcard__title h1")?.textContent.trim(),
      stats: [...document.querySelectorAll(".result-stats strong")].map((item) => item.textContent.trim()),
      proof: document.querySelector(".result-proof")?.textContent.trim()
    })`);
    if (!postcard.title || postcard.stats[0] !== "2.6" || postcard.stats[2] !== "N/A" || !postcard.proof?.includes("3.0 min")) {
      throw new Error(`Postcard metrics were not honest and complete: ${JSON.stringify(postcard)}`);
    }
    await activateButtonByKeyboard("Download local run evidence");
    await waitFor('document.body.innerText.includes("Downloaded anonymous evidence for trial 1")');
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const files = await readdir(artifactDirectory);
      evidenceFile = files.find((file) => file === "moverealm-trial-1-session.json");
      if (evidenceFile) break;
      await delay(100);
    }
    if (!evidenceFile) throw new Error("Local session evidence did not download.");
    const evidenceBytes = await readFile(join(artifactDirectory, evidenceFile));
    const evidence = JSON.parse(evidenceBytes.toString("utf8"));
    evidenceProduct = evidence.product;
    evidenceSha256 = createHash("sha256").update(evidenceBytes).digest("hex");
    const visibleExportStatus = await evaluate(
      '[...document.querySelectorAll("[role=status]")].map((item) => item.textContent).find((text) => text.includes("Downloaded anonymous evidence")) ?? ""',
    );
    if (!visibleExportStatus.includes(evidenceSha256)) {
      throw new Error(`Visible evidence checksum did not match the downloaded file: ${visibleExportStatus}`);
    }
    if (
      evidence.context?.trackingMode !== "keyboard" ||
      evidence.metrics?.trackingFps !== null ||
      evidence.metrics?.visibleResponseLatencyMs !== null ||
      evidence.measurementEvidence?.trackingFps?.threshold?.status !== "not_evaluated" ||
      evidence.measurementEvidence?.timeToFirstMovementMs?.threshold?.status !== "not_evaluated" ||
      evidence.privacy?.imagesOrVideoIncluded !== false ||
      evidence.privacy?.rawPoseLandmarksIncluded !== false
    ) {
      throw new Error(`Downloaded evidence was not privacy-safe keyboard evidence: ${JSON.stringify(evidence)}`);
    }
    if (expectedCommit && evidence.product?.commitSha !== expectedCommit) {
      throw new Error(
        `Evidence commit ${evidence.product?.commitSha ?? "missing"} did not match ${expectedCommit}.`,
      );
    }
    if (expectedBuildId && evidence.product?.buildId !== expectedBuildId) {
      throw new Error(
        `Evidence build ${evidence.product?.buildId ?? "missing"} did not match ${expectedBuildId}.`,
      );
    }
    postcardScreenshot = await screenshot("06-postcard");
    await clickButton("Play this room again");
    await waitFor('!!document.querySelector(".game-screen")', 8_000);
    const stopped = await evaluate(`(() => {
      const button = document.querySelector('button[aria-label="Stop adventure"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!stopped) throw new Error("Stop control was unavailable after replay.");
    await waitFor('!!document.querySelector(".landing")', 8_000);
  }

  const apiPostRequests = networkRequests
    .filter((request) => request.method === "POST")
    .map((request) => {
      const url = new URL(request.url);
      return url.pathname;
    });
  const allowedApiPosts = new Set(["/api/scene/analyze", "/api/quest/plan", "/api/quest/adapt"]);
  const unexpectedPosts = apiPostRequests.filter((path) => !allowedApiPosts.has(path));
  if (unexpectedPosts.length) {
    throw new Error(`Unexpected browser POST requests: ${unexpectedPosts.join(", ")}`);
  }
  if (testCapture) {
    const sceneUploads = apiPostRequests.filter((path) => path === "/api/scene/analyze");
    if (sceneUploads.length !== 1) {
      throw new Error(`Captured-room flow sent ${sceneUploads.length} room stills instead of one.`);
    }
  } else if (apiPostRequests.length) {
    throw new Error(`Guided flow unexpectedly sent API POST requests: ${apiPostRequests.join(", ")}`);
  }
  if (consoleErrors.length) throw new Error(`Browser errors: ${consoleErrors.join(" | ")}`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        targetUrl,
        landingTitle,
        confirmation: confirmState,
        score: { before: beforeScore, after: afterScore },
        roundScores,
        cameraReady: testCamera,
        apiPostRequests,
        adaptation,
        postcard,
        evidenceFile: evidenceFile ? join(artifactDirectory, evidenceFile) : undefined,
        evidenceSha256,
        evidenceProduct,
        screenshots: [
          landingScreenshot,
          cameraScreenshot,
          confirmScreenshot,
          calibrationScreenshot,
          gameScreenshot,
          adaptationScreenshot,
          postcardScreenshot,
        ].filter(Boolean),
      },
      null,
      2,
    ),
  );
} catch (error) {
  let state = {};
  try {
    state = await evaluate(`({
      screen: document.querySelector(".app")?.className,
      heading: document.querySelector("h1, h2")?.textContent,
      bodyText: document.body.innerText.slice(0, 800)
    })`);
    await screenshot("99-failure");
  } catch {
    state = { unavailable: true };
  }
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        state,
        consoleErrors,
        artifactDirectory,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  page?.close();
  chrome.kill("SIGTERM");
}
