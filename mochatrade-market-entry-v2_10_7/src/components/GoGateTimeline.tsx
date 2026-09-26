import type { ReactElement } from "react";
import type { SequencedMarket } from "../engine/types";
import Gloss from "./ui/Glossary";

const MARKET_COLOR: Record<string, string> = {
  uae: "#1E7A4C",
  brazil: "#1F5FA8",
  indonesia: "#9A4A16",
};
const USER_COLOR = "#7A4FB0";
const colorOf = (id: string) => MARKET_COLOR[id] ?? (id.startsWith("custom_") ? USER_COLOR : "#6B645A");

const TOTAL_MONTHS = 18;
const TICKS = [0, 3, 6, 9, 12, 15, 18];

/** "Months 6-12" -> [6, 12]; null when the window has no month range (e.g. a user-entered market). */
function parseWindow(window: string): [number, number] | null {
  const m = window.match(/(\d+)\s*-\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const pct = (month: number) => `${(month / TOTAL_MONTHS) * 100}%`;

/**
 * Horizontal runway: each sequenced market's execution window as a bar on
 * a shared 18-month axis, go-gates and the "if delayed" fallback beneath.
 * Lanes overlap where work runs in parallel, same as the deck's plan.
 *
 * The market's name, stage and window sit on a text row ABOVE its bar
 * rather than inside it: a bar is only as wide as its window (Indonesia's
 * is a third of the panel), so text inside it was clipped at every screen
 * width. The bar itself keeps its exact month position.
 */
export default function GoGateTimeline({ sequence }: { sequence: SequencedMarket[] }): ReactElement {
  return (
    <div data-testid="go-gate-timeline">
      <div className="relative mb-3 h-5 border-b border-rule" aria-hidden="true">
        {TICKS.map((t, i) => {
          // Anchor the edge labels inward so "M0" and "M18" are never cut off.
          const anchor = i === 0 ? "translate-x-0" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2";
          const tickPos = i === 0 ? "left-0" : i === TICKS.length - 1 ? "right-0" : "";
          return (
            <div key={t} className="absolute top-0 h-full" style={{ left: pct(t) }}>
              <span className={`absolute top-0 h-2 w-px bg-muted ${tickPos}`} />
              <span className={`absolute bottom-0.5 whitespace-nowrap text-[14px] text-muted ${anchor}`}>M{t}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-5">
        {sequence.map((s) => {
          const seq = s.market.sequence;
          if (!seq) return null;
          const range = parseWindow(seq.window);
          const color = colorOf(s.market.id);
          return (
            <div key={s.market.id} data-lane={s.market.id}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] font-medium tabular"
                  style={{ backgroundColor: `${color}30`, color }}
                >
                  {s.sequenceRank}
                </span>
                <span data-lane-text="name" className="font-display text-[17px] font-medium text-ink">
                  {s.market.name}
                </span>
                <span data-lane-text="label" className="text-[14px] text-muted">
                  {seq.label}
                </span>
                <span data-lane-text="window" className="ml-auto text-[14px] tabular" style={{ color }}>
                  {seq.window}
                </span>
              </div>

              <div className="relative mt-1.5 h-2.5 rounded-full bg-surface-2" role="img" aria-label={`${s.market.name}: ${seq.window}`}>
                {range ? (
                  <div
                    className="absolute inset-y-0 rounded-full border"
                    style={{ left: pct(range[0]), width: pct(range[1] - range[0]), borderColor: `${color}99`, backgroundColor: `${color}55` }}
                  />
                ) : (
                  // No month range yet: show the whole runway as undecided rather than a solid 0-18 bar.
                  <div className="absolute inset-0 rounded-full border border-dashed" style={{ borderColor: `${color}80` }} />
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {seq.go_gate.map((g, i) => (
                  <span key={i} className="rounded-chip border border-rule bg-surface px-2 py-0.5 text-[14px] text-ink-2">
                    {g}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[14px] leading-snug text-muted">
                <span className="text-ink-2">If delayed:</span> <Gloss text={seq.if_delayed} />
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
