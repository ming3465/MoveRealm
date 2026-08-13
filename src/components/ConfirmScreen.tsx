import type {
  ConfirmedConstraints,
  DirectorResponse,
  SceneProfile,
} from "../shared/contracts";
import type { CapturedStill } from "../lib/camera";
import { Brand } from "./Brand";
import { CameraStage } from "./CameraStage";
import { DirectorBadge } from "./DirectorBadge";

interface ConfirmScreenProps {
  scene: DirectorResponse<SceneProfile>;
  still?: CapturedStill;
  demo: boolean;
  constraints: ConfirmedConstraints;
  onConstraintsChange: (constraints: ConfirmedConstraints) => void;
  onContinue: () => void;
  onBack: () => void;
}

const DIRECTION_LABELS: Record<ConfirmedConstraints["permittedDirections"][number], string> = {
  vertical: "Up + down",
  left: "Left",
  right: "Right",
  center: "Centre",
};

export function ConfirmScreen({
  scene,
  still,
  demo,
  constraints,
  onConstraintsChange,
  onContinue,
  onBack,
}: ConfirmScreenProps) {
  const setRange = (sideStepRange: ConfirmedConstraints["sideStepRange"]) =>
    onConstraintsChange({ ...constraints, sideStepRange });
  const toggleDirection = (direction: ConfirmedConstraints["permittedDirections"][number]) => {
    const hasDirection = constraints.permittedDirections.includes(direction);
    const next = hasDirection
      ? constraints.permittedDirections.filter((item) => item !== direction)
      : [...constraints.permittedDirections, direction];
    if (next.length) onConstraintsChange({ ...constraints, permittedDirections: next });
  };

  return (
    <main className="flow-screen flow-screen--wide shell">
      <header className="flow-header">
        <Brand compact />
        <div className="step-indicator"><span className="step-indicator__complete" /> <span className="step-indicator__active" /> <span /> <small>Confirm space</small></div>
        <button className="icon-button" type="button" onClick={onBack} aria-label="Retake room still">×</button>
      </header>

      <section className="flow-intro flow-intro--split">
        <div>
          <p className="eyebrow"><span /> Room profile ready</p>
          <h1>Does this look right?</h1>
          <p>You have the final say. Correct the movement envelope before the world is planned.</p>
        </div>
        <DirectorBadge meta={scene.meta} />
      </section>

      <div className="confirm-layout">
        <div className="room-review">
          {still?.previewUrl ? (
            <img src={still.previewUrl} alt="Captured room still awaiting confirmation" />
          ) : (
            <CameraStage demo={demo} attachVideo={() => undefined} />
          )}
          <div className="room-review__grade" />
          <span className="room-chip room-chip--class">{scene.data.spaceClass} space</span>
          <span className="room-chip room-chip--confidence">{Math.round(scene.data.confidence * 100)}% confidence</span>
          {scene.data.obstacles.map((obstacle, index) => (
            <span key={`${obstacle.label}-${index}`} className={`obstacle-pin obstacle-pin--${obstacle.zone}`}>
              <i>{index + 1}</i><span>{obstacle.label}</span>
            </span>
          ))}
        </div>

        <div className="constraint-panel">
          <div className="director-summary">
            <span className="trace-avatar">✦</span>
            <div><small>Movement Director saw</small><p>“{scene.data.summary}”</p></div>
          </div>

          <fieldset className="constraint-field">
            <legend>Side-step room</legend>
            <div className="segmented-control">
              {(["none", "narrow", "wide"] as const).map((range) => (
                <button key={range} type="button" aria-pressed={constraints.sideStepRange === range} className={constraints.sideStepRange === range ? "active" : ""} onClick={() => setRange(range)}>
                  {range === "none" ? "None" : range === "narrow" ? "Small steps" : "Full steps"}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="constraint-field">
            <legend>Usable directions</legend>
            <div className="direction-grid">
              {(Object.keys(DIRECTION_LABELS) as Array<keyof typeof DIRECTION_LABELS>).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-pressed={constraints.permittedDirections.includes(direction)}
                  className={constraints.permittedDirections.includes(direction) ? "active" : ""}
                  onClick={() => toggleDirection(direction)}
                >
                  <span>{direction === "vertical" ? "↕" : direction === "left" ? "←" : direction === "right" ? "→" : "◎"}</span>
                  {DIRECTION_LABELS[direction]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className={`floor-confirm ${constraints.floorClear ? "floor-confirm--checked" : ""}`}>
            <input
              type="checkbox"
              checked={constraints.floorClear}
              onChange={(event) => onConstraintsChange({ ...constraints, floorClear: event.target.checked })}
            />
            <span className="floor-confirm__box">{constraints.floorClear ? "✓" : ""}</span>
            <span><strong>I checked the floor is clear</strong><small>No loose objects, wet patches, or unseen obstacles.</small></span>
          </label>

          <button className="primary-button primary-button--large" type="button" disabled={!constraints.floorClear} onClick={onContinue}>
            Grow my adventure <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </main>
  );
}
