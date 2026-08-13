export function LeafMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`leaf-mark ${compact ? "leaf-mark--compact" : ""}`} aria-hidden="true">
      <span className="leaf-mark__orbit" />
      <span className="leaf-mark__leaf leaf-mark__leaf--one" />
      <span className="leaf-mark__leaf leaf-mark__leaf--two" />
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <LeafMark compact={compact} />
      <span>MoveRealm</span>
    </div>
  );
}
