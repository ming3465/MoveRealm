import { useEffect, useRef } from "react";
import type { PoseFrame } from "../pose/types";
import { drawPose } from "../pose/drawPose";

interface CameraStageProps {
  stream?: MediaStream;
  pose?: PoseFrame;
  attachVideo: (node: HTMLVideoElement | null) => void;
  className?: string;
  showGuide?: boolean;
  demo?: boolean;
  children?: React.ReactNode;
}

export function CameraStage({
  stream,
  pose,
  attachVideo,
  className = "",
  showGuide = false,
  demo = false,
  children,
}: CameraStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) drawPose(canvasRef.current, pose);
  }, [pose]);

  return (
    <div className={`camera-stage ${demo ? "camera-stage--demo" : ""} ${className}`}>
      {demo ? (
        <div className="demo-room" aria-label="Illustrated constrained demo room">
          <div className="demo-room__window" />
          <div className="demo-room__desk" />
          <div className="demo-room__chair" />
          <div className="demo-room__plant" />
          <div className="demo-room__floor" />
        </div>
      ) : (
        <video
          ref={attachVideo}
          className="camera-stage__video"
          autoPlay
          muted
          playsInline
          aria-label={stream ? "Live camera preview" : "Camera preview unavailable"}
        />
      )}
      <canvas ref={canvasRef} className="camera-stage__pose" aria-hidden="true" />
      <div className="camera-stage__grade" aria-hidden="true" />
      {showGuide && (
        <div className="camera-guide" aria-hidden="true">
          <span className="camera-guide__corner camera-guide__corner--tl" />
          <span className="camera-guide__corner camera-guide__corner--tr" />
          <span className="camera-guide__corner camera-guide__corner--bl" />
          <span className="camera-guide__corner camera-guide__corner--br" />
          <span className="camera-guide__floor" />
        </div>
      )}
      {children}
    </div>
  );
}
