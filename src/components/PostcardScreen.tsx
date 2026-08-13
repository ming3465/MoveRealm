import type { SessionResult } from "./GameScreen";
import { Brand } from "./Brand";

interface PostcardScreenProps {
  result: SessionResult;
  onAgain: () => void;
  onHome: () => void;
}

export function PostcardScreen({ result, onAgain, onHome }: PostcardScreenProps) {
  const completion = result.totalTargets
    ? Math.round((result.completedTargets / result.totalTargets) * 100)
    : 0;
  const lastAdaptation = result.adaptations.at(-1);

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
            <div><strong>{result.trackingFps == null ? "N/A" : Math.round(result.trackingFps)}</strong><small>tracking FPS</small></div>
          </div>
          {lastAdaptation && (
            <div className="result-trace"><span>✦</span><p><small>Movement Director adapted</small>“{lastAdaptation.reason}”</p></div>
          )}
          <div className="result-proof">
            <span>Adventure clock <strong>{(result.plan.requestedDurationSeconds / 60).toFixed(1)} min</strong></span>
            <span>Plan + adaptation latency <strong>{Math.round(result.directorLatencyMs)} ms</strong></span>
            <span>Movement feedback <strong>{result.responseLatencyMs == null ? "N/A in keyboard mode" : `${Math.round(result.responseLatencyMs)} ms`}</strong></span>
            <span>First movement <strong>{result.timeToFirstMovementMs == null ? "No completed target" : `${(result.timeToFirstMovementMs / 1_000).toFixed(1)} s`}</strong></span>
            <span>Live video uploaded <strong>never</strong></span>
          </div>
          <button className="primary-button primary-button--large" type="button" onClick={onAgain}>Play this room again <span>↻</span></button>
          <button className="text-button" type="button" onClick={onHome}>Scan a different room</button>
        </div>
      </section>
    </main>
  );
}
