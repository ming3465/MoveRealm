import { Brand, LeafMark } from "./Brand";

export function DirectorThinking({ mode }: { mode: "scene" | "plan" }) {
  const scene = mode === "scene";
  return (
    <main className="thinking-screen">
      <header><Brand compact /></header>
      <div className="thinking-orbit">
        <span className="thinking-orbit__ring thinking-orbit__ring--one" />
        <span className="thinking-orbit__ring thinking-orbit__ring--two" />
        <LeafMark />
      </div>
      <p className="eyebrow"><span /> Movement Director</p>
      <h1>{scene ? "Reading the room…" : "Growing your adventure…"}</h1>
      <p>{scene ? "Finding clear lanes and keeping uncertain areas conservative." : "Matching three validated movements to your confirmed space."}</p>
      <div className="thinking-steps" aria-live="polite">
        <span className="thinking-steps__done">✓ {scene ? "Still received" : "Constraints confirmed"}</span>
        <span className="thinking-steps__active"><i /> {scene ? "Mapping movement space" : "Planning movement rhythm"}</span>
        <span><i /> {scene ? "Preparing confirmation" : "Checking safe duration"}</span>
      </div>
      <small className="thinking-privacy">No live video is being sent.</small>
    </main>
  );
}
