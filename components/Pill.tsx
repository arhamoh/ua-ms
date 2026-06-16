// A small status pill / badge. Pass the colour classes (e.g. STATUS_BADGE[x]).
export default function Pill({
  className = 'bg-slate-100 text-slate-600',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
