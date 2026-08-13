import { useState } from "react";
import {
  buildSessionEvidence,
  type SessionResult,
} from "../lib/sessionEvidence";
import type { DirectorMeta, SceneProfile } from "../shared/contracts";
import { Brand } from "./Brand";

interface PostcardScreenProps {
  result: SessionResult;
  sceneMeta: DirectorMeta | null;
  roomSpaceClass: SceneProfile["spaceClass"] | null;
  onAgain: () => void;
  onHome: () => void;
}

export function PostcardScreen({
  result,
  sceneMeta,
  roomSpaceClass,
  onAgain,
  onHome,
}: PostcardScreenProps) {
  const [trialNumber, setTrialNumber] = useState(1);
  const [exportStatus, setExportStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const completion = result.totalTargets
    ? Math.round((result.completedTargets / result.totalTargets) * 100)
    : 0;
  const lastAdaptation = result.adaptations.at(-1);
  const fpsSummary = result.poseMetricSummaries.trackingFps;
  const inferenceSummary = result.poseMetricSummaries.inferenceMs;
  const responseSummary = result.poseMetricSummaries.visibleResponseLatencyMs;
  const trackingModes = new Set(result.telemetry.map((round) => round.trackingMode));
  const responseUnavailableLabel = trackingModes.size > 1
    ? "N/A after control switch"
    : trackingModes.has("pose")
      ? "N/A: capture metadata unavailable"
      : "N/A in keyboard mode";

  const downloadEvidence = async () => {
    if (exporting) return;
    setExporting(true);
    setExportStatus("Preparing anonymous evidence…");
    try {
      const evidence = buildSessionEvidence({
        trialId: `trial-${trialNumber}`,
        roomSpaceClass,
        result,
        sceneDirector: sceneMeta,
        build: {
          buildId: import.meta.env.VITE_BUILD_ID || null,
          commitSha: import.meta.env.VITE_COMMIT_SHA || null,
        },
      });
      const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
      const blob = new Blob([serialized], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `moverealm-trial-${trialNumber}-session.json`;
      link.hidden = true;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      }

      let checksum: string | null = null;
      if (globalThis.crypto?.subtle) {
        try {
          const digest = await globalThis.crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(serialized),
          );
          checksum = [...new Uint8Array(digest)]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
        } catch {
          checksum = null;
        }
      }
      setExportStatus(checksum
        ? `Downloaded anonymous evidence for trial ${trialNumber}. SHA-256 ${checksum}`
        : `Downloaded anonymous evidence for trial ${trialNumber}. SHA-256 is unavailable on this origin.`);
    } catch {
      setExportStatus("Evidence export failed. No file was downloaded; restart this run and try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="postcard-screen">
      <header><Brand compact /><span>Adventure complete</span></header>
      <section className="postcard">
        <div className="postcard__art" aria-label="Your animated Neon Rainforest garden postcard">
          <div className="postcard__moon" />
          <div className="postcard__mountain postcard__mountain--one" />
          <div className="postcard__mountain postcard__mountain--two" />
          <div className="postcard__river" />
          <div className="postcard__tree postcard__tree--left" />
          <div className="postcard__tree postcard__tree--right" />
          {Array.from({ length: 18 }).map((_, index) => <span key={index} className={`postcard-firefly postcard-firefly--${(index % 9) + 1}`} />)}
          <div className="postcard__stamp"><span>MoveRealm</span><strong>Neon<br />Rainforest</strong></div>
          <div className="postcard__title"><small>Your room became</small><h1>{result.plan.title}</h1></div>
        </div>
        <div className="postcard__details">
          <p className="eyebrow"><span /> A small world, grown by movement</p>
          <h2>Three minutes. One room. A garden that listened.</h2>
          <div className="result-stats">
            <div><strong>{(result.activeSeconds / 60).toFixed(1)}</strong><small>active minutes</small></div>
            <div><strong>{completion}%</strong><small>targets met</small></div>
            <div><strong>{fpsSummary?.p05 == null ? "N/A" : fpsSummary.p05.toFixed(1)}</strong><small>tracking FPS p05</small></div>
          </div>
          {lastAdaptation && (
            <div className="result-trace"><span>✦</span><p><small>Movement Director adapted</small>“{lastAdaptation.reason}”</p></div>
          )}
          <div className="result-proof">
            <span>Adventure clock <strong>{(result.plan.requestedDurationSeconds / 60).toFixed(1)} min</strong></span>
            <span>Plan + adaptation latency <strong>{Math.round(result.directorLatencyMs)} ms</strong></span>
            <span>Visual response p95 <strong>{responseSummary?.p95 == null ? responseUnavailableLabel : `${Math.round(responseSummary.p95)} ms`}</strong></span>
            <span>Pose inference p95 <strong>{inferenceSummary?.p95 == null ? "N/A" : `${Math.round(inferenceSummary.p95)} ms`}</strong></span>
            <span>Pose / response samples <strong>{fpsSummary?.sampleCount ?? 0} / {responseSummary?.sampleCount ?? 0}</strong></span>
            <span>First movement <strong>{result.timeToFirstMovementMs == null ? "No completed target" : `${(result.timeToFirstMovementMs / 1_000).toFixed(1)} s`}</strong></span>
            <span>Live camera handling <strong>browser-only by design</strong></span>
          </div>
          <div className="evidence-export">
            <div>
              <label htmlFor="trial-number">Anonymous trial number</label>
              <input
                id="trial-number"
                type="number"
                min={1}
                max={3}
                inputMode="numeric"
                value={trialNumber}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setTrialNumber(Number.isInteger(value) ? Math.min(3, Math.max(1, value)) : 1);
                }}
              />
            </div>
            <button className="secondary-button" type="button" disabled={exporting} onClick={() => void downloadEvidence()}>
              {exporting ? "Preparing evidence…" : "Download local run evidence"}
            </button>
            <p>This JSON stays on this device and contains aggregate metrics only—no image, video, identifiers, or landmarks.</p>
            <span role="status" aria-live="polite">{exportStatus}</span>
          </div>
          <button className="primary-button primary-button--large" type="button" onClick={onAgain}>Play this room again <span>↻</span></button>
          <button className="text-button" type="button" onClick={onHome}>Scan a different room</button>
        </div>
      </section>
    </main>
  );
}
