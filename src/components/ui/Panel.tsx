import type { ReactElement, ReactNode } from "react";

/**
 * Shared framing device for every section of the dashboard: a hairline
 * border with corner ticks and a mono readout label in the top edge --
 * the "instrument panel" motif instead of a generic rounded/shadowed card.
 * The label communicates what data lives inside, so it earns its place.
 */
export default function Panel({
  label,
  tag,
  children,
  className = "",
  bodyClassName = "",
}: {
  label: string;
  tag?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}): ReactElement {
  return (
    <div className={`relative border border-line bg-ink-700/60 ${className}`}>
      <span className="pointer-events-none absolute -left-px -top-px h-2.5 w-2.5 border-l border-t border-signal-cyan/60" />
      <span className="pointer-events-none absolute -right-px -top-px h-2.5 w-2.5 border-r border-t border-signal-cyan/60" />
      <span className="pointer-events-none absolute -left-px -bottom-px h-2.5 w-2.5 border-l border-b border-signal-cyan/60" />
      <span className="pointer-events-none absolute -right-px -bottom-px h-2.5 w-2.5 border-r border-b border-signal-cyan/60" />
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-[12px] text-paper-dim">{label}</span>
        {tag}
      </div>
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
