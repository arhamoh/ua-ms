// The Analytics Assistant's brand mark — the UA Digital ribbon logo. We crop the
// logo.png to just the ribbon mark (dropping the "DIGITAL" wordmark) via a zoomed
// background so it reads at small sizes. Drop-in replacement for a lucide icon
// (accepts size/className) so it can sit in nav/command lists.
export default function AssistantIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="UA Digital"
      style={{
        width: size,
        height: size,
        backgroundImage: 'url(/logo.png)',
        backgroundSize: '168%',
        backgroundPosition: '50% 9%',
        backgroundRepeat: 'no-repeat',
      }}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
