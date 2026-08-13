import type { DirectorMeta } from "../shared/contracts";

export function DirectorBadge({ meta, compact = false }: { meta?: DirectorMeta; compact?: boolean }) {
  if (!meta) {
    return (
      <div className={`director-badge ${compact ? "director-badge--compact" : ""}`}>
        <span className="director-badge__pulse" />
        Movement Director
      </div>
    );
  }
  return (
    <div
      className={`director-badge director-badge--${meta.source} ${compact ? "director-badge--compact" : ""}`}
      title={meta.detail}
    >
      <span className="director-badge__pulse" />
      {meta.source === "codebuddy" ? "CodeBuddy live" : meta.source === "demo" ? "Guided demo" : "Safe fallback"}
      {!compact && <span className="director-badge__latency">{meta.latencyMs} ms</span>}
    </div>
  );
}
