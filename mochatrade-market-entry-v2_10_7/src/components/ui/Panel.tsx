import type { ReactElement, ReactNode } from "react";

/**
 * A titled section: a friendly Fraunces heading, an optional action on the
 * right, then the content. Sections are separated by rules, not boxes; pass
 * `card` for the few places that sit on a white card.
 */
export default function Panel({
  label,
  id,
  intro,
  tag,
  children,
  className = "",
  bodyClassName = "",
  card = false,
}: {
  label: string;
  id?: string;
  intro?: ReactNode;
  tag?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  card?: boolean;
}): ReactElement {
  return (
    <section id={id} className={`scroll-mt-24 ${card ? "rounded-card border-1.5 border-rule bg-surface p-6 shadow-card md:p-8 print-plain" : ""} ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-[30px] font-semibold leading-tight text-ink md:text-[34px]">{label}</h2>
        {tag}
      </div>
      {intro && <div className="mt-2 max-w-[68ch] text-[17px] leading-relaxed text-ink-2">{intro}</div>}
      <div className={`mt-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
