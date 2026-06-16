// A lightweight entrance wrapper. Uses a CSS animation that ENDS visible and
// never leaves content hidden if the animation doesn't run (unlike a JS opacity
// animation, which can freeze content at opacity 0). Honors reduced-motion.

export default function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`ua-fade-in ${className ?? ''}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
