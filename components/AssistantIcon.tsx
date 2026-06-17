// The Analytics Assistant's brand mark — the UA logo icon.
// Default: a brand-red rounded "chip" holding the white logo, so it stays
// visible on any background (nav, headers, light cards). `bare` renders just the
// white logo, for use on an already-coloured surface (the floating button).
export default function AssistantIcon({
  size = 18,
  className = '',
  bare = false,
}: {
  size?: number;
  className?: string;
  bare?: boolean;
}) {
  if (bare) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/ua-logo-icon.svg" alt="" width={size} className={`block shrink-0 ${className}`} />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-[28%] bg-brand ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ua-logo-icon.svg" alt="" style={{ width: Math.round(size * 0.58) }} className="block" />
    </span>
  );
}
