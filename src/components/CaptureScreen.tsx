import { useState } from "react";
import type { PoseFrame } from "../pose/types";
import { Brand } from "./Brand";
import { CameraStage } from "./CameraStage";

interface CaptureScreenProps {
  stream?: MediaStream;
  pose?: PoseFrame;
  poseStatus: "loading" | "ready" | "error";
  poseError?: string;
  attachVideo: (node: HTMLVideoElement | null) => void;
  onCapture: () => void;
  onBack: () => void;
  onDemo: () => void;
  capturing: boolean;
  error?: string;
}

export function CaptureScreen({
  stream,
  pose,
  poseStatus,
  poseError,
  attachVideo,
  onCapture,
  onBack,
  onDemo,
  capturing,
  error,
}: CaptureScreenProps) {
  const [previewReady, setPreviewReady] = useState(false);
  return (
    <main className="flow-screen shell">
      <header className="flow-header">
        <Brand compact />
        <div className="step-indicator"><span className="step-indicator__active" /> <span /> <span /> <small>Room scan</small></div>
        <button className="icon-button" type="button" onClick={onBack} aria-label="Go back">×</button>
      </header>

      <section className="flow-intro">
        <p className="eyebrow"><span /> First, show me your movement space</p>
        <h1>Frame the floor around you.</h1>
        <p>Step out of view if you can. Include nearby furniture and the clear floor you plan to use.</p>
      </section>

      <div className="capture-layout">
        <CameraStage stream={stream} pose={pose} attachVideo={attachVideo} showGuide className="capture-camera" onPreviewReadyChange={setPreviewReady}>
          <div className="camera-status camera-status--top">
            <span className={`status-dot status-dot--${poseStatus}`} />
            {poseStatus === "ready" ? `${Math.round(pose?.fps ?? 0)} FPS · pose local` : poseStatus === "error" ? "Camera only" : "Preparing local pose…"}
          </div>
          <div className="floor-label">Keep this floor area visible</div>
        </CameraStage>

        <aside className="capture-tips">
          <div className="tip-card"><span>1</span><div><strong>Show the floor</strong><p>Keep the movement lane in frame.</p></div></div>
          <div className="tip-card"><span>2</span><div><strong>Include obstacles</strong><p>Chairs and desk edges help constrain the plan.</p></div></div>
          <div className="tip-card"><span>3</span><div><strong>One still only</strong><p>Live camera frames never go to the agent.</p></div></div>
          {poseError && <div className="small-warning">Pose model: {poseError}</div>}
        </aside>
      </div>

      {error && <div className="inline-error capture-error" role="alert">{error}</div>}
      <div className="flow-actions">
        <button className="secondary-button" type="button" onClick={onDemo}>Use demo room</button>
        <button className="primary-button" type="button" onClick={onCapture} disabled={capturing || !stream || !previewReady}>
          <span className="button-camera" aria-hidden="true" />
          {capturing ? "Capturing…" : "Capture this room"}
        </button>
      </div>
    </main>
  );
}
