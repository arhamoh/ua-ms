// Thin progress bar. Pass a 0–100 `value` for a real (determinate) bar, or omit
// it for an animated indeterminate bar (used when the wait time is unknowable,
// e.g. server-side OCR / parsing).
export default function ProgressBar({
  value,
  label,
  className = '',
}: {
  value?: number | null;
  label?: string;
  className?: string;
}) {
  const indeterminate = value == null;
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{label}</span>
          {!indeterminate && <span className="tabular-nums">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        {indeterminate ? (
          <div className="animate-progress-indeterminate h-full w-1/3 rounded-full bg-brand" />
        ) : (
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
