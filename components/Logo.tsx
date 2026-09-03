// Keel wordmark: lowercase "keel" in Space Grotesk with the teal square
// keel-point as the period. `variant="mark"` renders just the app-icon glyph.

export default function Logo({
  className = '',
  variant = 'wordmark',
}: {
  className?: string;
  variant?: 'wordmark' | 'mark';
}) {
  if (variant === 'mark') {
    return <img src="/icon.svg" alt="Keel" className={className} />;
  }
  return (
    <span
      className={`inline-flex items-baseline font-space font-bold leading-none tracking-tight text-ink ${className}`}
    >
      keel
      <span
        aria-hidden
        className="ml-[0.06em] inline-block rounded-[0.04em] bg-brand"
        style={{ width: '0.2em', height: '0.2em' }}
      />
      <span className="sr-only">.</span>
    </span>
  );
}
