import type { EnergyLevel } from "../shared/contracts";
import { Brand } from "./Brand";
import { DirectorBadge } from "./DirectorBadge";

interface LandingScreenProps {
  energy: EnergyLevel;
  onEnergyChange: (energy: EnergyLevel) => void;
  onCamera: () => void;
  onDemo: () => void;
  busy: boolean;
  error?: string;
}

const ENERGY_OPTIONS: Array<{ id: EnergyLevel; label: string; detail: string; icon: string }> = [
  { id: "gentle", label: "Gentle", detail: "Easy rhythm", icon: "◔" },
  { id: "balanced", label: "Balanced", detail: "Steady glow", icon: "◑" },
  { id: "bright", label: "Bright", detail: "Lively pace", icon: "●" },
];

export function LandingScreen({
  energy,
  onEnergyChange,
  onCamera,
  onDemo,
  busy,
  error,
}: LandingScreenProps) {
  return (
    <main className="landing shell">
      <nav className="landing__nav" aria-label="MoveRealm">
        <Brand />
        <DirectorBadge compact />
      </nav>

      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow"><span /> A movement adventure made for this room</p>
          <h1>Your room is about to <em>come alive.</em></h1>
          <p className="hero__lede">
            One room scan. Three minutes. A living world that learns how you move and changes with you.
          </p>

          <div className="setup-card" aria-label="Adventure setup">
            <div className="setup-card__row">
              <div>
                <span className="field-label">Adventure length</span>
                <strong className="field-value"><span className="field-value__icon">◴</span> 3 minutes</strong>
              </div>
              <span className="fixed-pill">Quick reset</span>
            </div>

            <fieldset className="energy-fieldset">
              <legend className="field-label">How is your energy?</legend>
              <div className="energy-options">
                {ENERGY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`energy-option ${energy === option.id ? "energy-option--active" : ""}`}
                    aria-pressed={energy === option.id}
                    onClick={() => onEnergyChange(option.id)}
                  >
                    <span className="energy-option__icon">{option.icon}</span>
                    <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="safety-lock">
              <span className="safety-lock__check" aria-hidden="true">✓</span>
              <span><strong>No jumping</strong><small>Always low-impact in MoveRealm</small></span>
              <span className="safety-lock__locked">Locked on</span>
            </div>

            {error && <div className="inline-error" role="alert">{error}</div>}

            <button className="primary-button primary-button--large" type="button" onClick={onCamera} disabled={busy}>
              <span className="button-camera" aria-hidden="true" />
              {busy ? "Opening camera…" : "Scan my room"}
              <span aria-hidden="true">→</span>
            </button>
            <button className="text-button" type="button" onClick={onDemo} disabled={busy}>
              No camera right now? Try the guided demo
            </button>
            <p className="privacy-note"><span aria-hidden="true">⌁</span> Live video stays on this device. Only the still you approve is analyzed.</p>
          </div>
        </div>

        <div className="hero-world" aria-label="Preview of a Neon Rainforest movement adventure">
          <div className="hero-world__halo hero-world__halo--one" />
          <div className="hero-world__halo hero-world__halo--two" />
          <div className="hero-world__moon" />
          <div className="hero-world__canopy hero-world__canopy--back" />
          <div className="hero-world__river" />
          <div className="hero-world__person" aria-hidden="true">
            <span className="person__head" />
            <span className="person__body" />
            <span className="person__arm person__arm--left" />
            <span className="person__arm person__arm--right" />
            <span className="person__leg person__leg--left" />
            <span className="person__leg person__leg--right" />
          </div>
          {Array.from({ length: 13 }).map((_, index) => (
            <span key={index} className={`hero-firefly hero-firefly--${index + 1}`} />
          ))}
          <div className="hero-world__trace">
            <span className="trace-avatar">✦</span>
            <span><small>Movement Director</small><strong>Opening the target lane…</strong></span>
          </div>
          <div className="hero-world__caption"><span>Neon Rainforest</span><strong>01</strong></div>
        </div>
      </section>

      <section className="loop-strip" aria-label="How MoveRealm works">
        <div><span>01</span><strong>See the room</strong><small>One approved still</small></div>
        <i>→</i>
        <div><span>02</span><strong>Shape the quest</strong><small>Safe, constrained plan</small></div>
        <i>→</i>
        <div><span>03</span><strong>Watch movement</strong><small>On-device pose only</small></div>
        <i>→</i>
        <div><span>04</span><strong>Adapt the world</strong><small>Observable re-planning</small></div>
      </section>
    </main>
  );
}
