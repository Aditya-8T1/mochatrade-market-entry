// Presentational mapping for the engine's verdicts and risk bands. Labels
// always come from the engine (decision.verdictLabel); this file only picks
// colours.
import type { ReactElement } from "react";
import type { Verdict } from "../../engine/types";

export const VERDICT_STYLE: Record<Verdict, { text: string; tint: string; className: string }> = {
  go_now: { text: "#1E7A4C", tint: "#DDF2E4", className: "text-now bg-now-tint" },
  go_next: { text: "#1F5FA8", tint: "#DDEBFB", className: "text-next bg-next-tint" },
  go_later: { text: "#9A4A16", tint: "#FDE9D6", className: "text-later bg-later-tint" },
  shortlist: { text: "#8A5A00", tint: "#FBEFD2", className: "text-short bg-short-tint" },
  no_go: { text: "#B42318", tint: "#FDE4E1", className: "text-no bg-no-tint" },
};

export const RISK_BAND: Record<"low" | "medium" | "high", { label: string; color: string }> = {
  low: { label: "Low", color: "#1E7A4C" },
  medium: { label: "Medium", color: "#9A4A16" },
  high: { label: "High", color: "#B42318" },
};

/** "Months 0-9" -> "months 0–9" (display only; the engine string is unchanged elsewhere). */
export function fmtWindow(window: string | null | undefined): string | null {
  if (!window) return null;
  const range = window.replace(/^months?\s*/i, "").replace(/(\d)\s*-\s*(\d)/g, "$1–$2");
  return /^\d/.test(range) ? `months ${range}` : window;
}

export function VerdictChip({ verdict, label, window, className = "" }: { verdict: Verdict; label: string; window?: string | null; className?: string }): ReactElement {
  const w = fmtWindow(window);
  return (
    <span data-verdict-chip={verdict} className={`inline-flex items-center whitespace-nowrap rounded-chip px-2.5 py-1 text-[14px] font-bold leading-tight ${VERDICT_STYLE[verdict].className} ${className}`}>
      {label}
      {w && <span className="font-medium">&nbsp;· {w}</span>}
    </span>
  );
}

/** Small outline chip for provenance badges ("R2 research", "screen", "your entry"). */
export function OutlineChip({ children, testId, title }: { children: string; testId?: string; title?: string }): ReactElement {
  return (
    <span data-testid={testId} title={title} className="inline-flex items-center rounded-chip border-1.5 border-rule bg-surface px-2 py-0.5 text-[14px] font-bold text-ink-2">
      {children}
    </span>
  );
}

export const btnPrimary =
  "press lift inline-flex min-h-[52px] items-center justify-center gap-2 rounded-btn bg-coral-strong px-6 text-[17px] font-bold text-white shadow-btn hover:shadow-btn-hover active:shadow-btn-quiet disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "press lift inline-flex min-h-[52px] items-center justify-center gap-2 rounded-btn border-1.5 border-ink bg-surface px-6 text-[17px] font-bold text-ink shadow-btn-quiet hover:shadow-lift active:shadow-none disabled:cursor-not-allowed disabled:opacity-50";
export const btnSmall =
  "press inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-btn border-1.5 border-rule bg-surface px-3.5 text-[15px] font-bold text-ink-2 shadow-btn-quiet hover:border-ink hover:text-ink";
export const inputCls =
  "min-h-[54px] w-full rounded-btn border-1.5 border-rule bg-surface px-4 text-[17px] text-ink outline-none placeholder:text-muted focus:border-ink";
export const cardCls = "rounded-card border-1.5 border-rule bg-surface shadow-card";
