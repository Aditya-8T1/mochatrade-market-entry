import type { ReactElement } from "react";
import { formatScore } from "../engine";
import type { DivergenceExplanation, SequencedMarket } from "../engine/types";
import Gloss from "./ui/Glossary";
import { lambdaRangeForSequence } from "../engine/sequencing";

export interface RankVsSeqItem {
  sequenced: SequencedMarket;
  divergence: DivergenceExplanation;
}

const ROW_H = 60;
const MARKET_COLOR: Record<string, string> = {
  uae: "#34D399",
  brazil: "#22D3EE",
  indonesia: "#F5A623",
};
const USER_COLOR = "#9B8CFF";
const colorOf = (id: string) => MARKET_COLOR[id] ?? (id.startsWith("custom_") ? USER_COLOR : "#5E6C7A");

/**
 * The centerpiece: a slopegraph proving the tool understood Round 1's
 * "score does not equal sequence" finding, not just displayed it. Left
 * track = raw rank among the 3 cleared markets (by weighted score). Right
 * track = the engine's recommended entry sequence (score minus cost of getting in).
 * A market whose two positions differ gets a bent, amber connector and an
 * inline explanation pulled from engine.explainDivergence().
 */
export default function RankingVsSequence({ items }: { items: RankVsSeqItem[] }): ReactElement {
  const n = items.length;
  const height = n * ROW_H;
  const byRaw = [...items].sort((a, b) => (a.divergence.rawRankAmongCleared ?? 99) - (b.divergence.rawRankAmongCleared ?? 99));
  const bySeq = [...items].sort((a, b) => a.sequenced.sequenceRank - b.sequenced.sequenceRank);

  const rawY = new Map(byRaw.map((it, i) => [it.sequenced.market.id, i * ROW_H + ROW_H / 2]));
  const seqY = new Map(bySeq.map((it, i) => [it.sequenced.market.id, i * ROW_H + ROW_H / 2]));

  const anyDiverges = items.some((it) => it.divergence.diverges);
  const lam = lambdaRangeForSequence(items.map((it) => it.sequenced));
  const lamNow = items[0]?.sequenced.inputs.adaptationCost
    ? items[0].sequenced.inputs.adaptationPenalty / items[0].sequenced.inputs.adaptationCost
    : null;

  return (
    <div data-testid="ranking-vs-sequence">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[12px] text-paper-faint">
          <span className="text-paper-dim">By screening score</span>
          <span className="ml-2">(cleared markets only)</span>
        </div>
        <div className="text-right font-mono text-[12px] text-paper-faint">
          <span className="mr-2">(score minus cost of getting in)</span>
          <span className="text-paper-dim">Recommended entry order</span>
        </div>
      </div>

      <div className="relative" style={{ height }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
        >
          {items.map((it) => {
            const id = it.sequenced.market.id;
            const y1 = rawY.get(id)!;
            const y2 = seqY.get(id)!;
            const diverges = it.divergence.diverges;
            return (
              <path
                key={id}
                d={`M 15 ${y1} C 42 ${y1}, 58 ${y2}, 85 ${y2}`}
                vectorEffect="non-scaling-stroke"
                fill="none"
                stroke={colorOf(id)}
                strokeWidth={diverges ? 2 : 1.4}
                strokeDasharray={diverges ? "0" : "3 4"}
                opacity={diverges ? 0.85 : 0.4}
              />
            );
          })}
        </svg>

        {byRaw.map((it, i) => (
          <div
            key={it.sequenced.market.id}
            data-testid={`raw-item-${it.sequenced.market.id}`}
            className="absolute left-0 flex items-center gap-2.5"
            style={{ top: i * ROW_H, height: ROW_H }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[12px] tabular"
              style={{ borderColor: colorOf(it.sequenced.market.id), color: colorOf(it.sequenced.market.id) }}
            >
              {it.divergence.rawRankAmongCleared}
            </span>
            <div>
              <div className="font-display text-sm text-paper">{it.sequenced.market.name}</div>
              <div className="font-mono text-[11px] text-paper-faint">{formatScore(it.sequenced.screening.weightedScore)} / 5</div>
            </div>
          </div>
        ))}

        {bySeq.map((it, i) => (
          <div
            key={it.sequenced.market.id}
            data-testid={`seq-item-${it.sequenced.market.id}`}
            className="absolute right-0 flex items-center gap-2.5 text-right"
            style={{ top: i * ROW_H, height: ROW_H }}
          >
            <div>
              <div className="font-display text-sm text-paper">{it.sequenced.market.name}</div>
              <div className="font-mono text-[11px] text-paper-faint">{it.sequenced.market.sequence?.window}</div>
            </div>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-medium tabular"
              style={{ backgroundColor: `${colorOf(it.sequenced.market.id)}22`, color: colorOf(it.sequenced.market.id) }}
            >
              {it.sequenced.sequenceRank}
            </span>
          </div>
        ))}
      </div>

      <FrictionBars items={[...items].sort((a, b) => a.sequenced.sequenceRank - b.sequenced.sequenceRank)} />

      {items.length > 1 && lam.holds && (
        <p data-testid="lambda-robustness" className="mt-4 text-[13px] leading-snug text-paper-faint">
          The penalty weight is a display choice, not a tuned number: this order holds for any weight
          {lam.max === null
            ? ` above ${lam.min.toFixed(2)}`
            : lam.min > 0
              ? ` between ${lam.min.toFixed(2)} and ${lam.max.toFixed(2)}`
              : ` up to ${lam.max.toFixed(2)}`}
          {lamNow !== null ? ` (current: ${lamNow.toFixed(2)})` : ""}.
        </p>
      )}
      {anyDiverges && (
        <div className="mt-5 space-y-2 border-t border-line-soft pt-4">
          {items
            .filter((it) => it.divergence.diverges)
            .map((it) => (
              <p key={it.sequenced.market.id} className="border-l-2 pl-2.5 text-[14px] leading-relaxed text-paper-dim" style={{ borderColor: colorOf(it.sequenced.market.id) }}>
                <Gloss text={it.divergence.explanation} />
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * Makes the priority index legible without asking anyone to read it as a
 * number. Each bar is the screening score on a 0-5 track; the adaptation
 * and execution penalties are cut off its right end in two hatched
 * segments; what is left is the entry priority the order is sorted by.
 */
function FrictionBars({ items }: { items: RankVsSeqItem[] }): ReactElement {
  const pct = (n: number) => `${Math.max(0, (n / 5) * 100)}%`;
  return (
    <div data-testid="friction-bars" className="mt-6 border-t border-line-soft pt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[14px] text-paper">Score, minus the cost of getting in</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-paper-dim">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[2px] bg-paper-dim" />what is left decides the order</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[2px] friction-hatch-a" />adaptation cost</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[2px] friction-hatch-e" />execution dependency</span>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((it) => {
          const s = it.sequenced;
          const score = s.screening.weightedScore;
          const left = Math.max(0, s.priorityIndex);
          const aPen = s.inputs.adaptationPenalty;
          const ePen = s.inputs.executionPenalty;
          const color = colorOf(s.market.id);
          const title = `${s.market.name}: screening score ${score.toFixed(2)}, minus ${aPen.toFixed(2)} adaptation and ${ePen.toFixed(2)} execution = ${s.priorityIndex.toFixed(2)} entry priority`;
          return (
            <div key={s.market.id} data-testid={`friction-${s.market.id}`} className="grid grid-cols-[minmax(92px,120px)_1fr] items-center gap-3" title={title}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] tabular" style={{ color }}>#{s.sequenceRank}</span>
                <span className="truncate text-[14px] text-paper">{s.market.name}</span>
              </div>
              <div className="relative h-4 rounded-[3px] bg-ink-800" role="img" aria-label={title}>
                <div className="absolute inset-y-0 left-0 rounded-l-[3px]" style={{ width: pct(left), backgroundColor: color, opacity: 0.85 }} />
                <div className="absolute inset-y-0 friction-hatch-a" style={{ left: pct(left), width: pct(Math.min(aPen, score - left)) }} />
                <div className="absolute inset-y-0 friction-hatch-e" style={{ left: pct(left + Math.min(aPen, score - left)), width: pct(Math.max(0, score - left - Math.min(aPen, score - left))) }} />
                <div className="absolute inset-y-[-3px] w-px bg-paper" style={{ left: pct(score) }} />
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-[minmax(92px,120px)_1fr] gap-3">
          <span />
          <div className="flex justify-between font-mono text-[12px] text-paper-faint">
            <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-paper-faint">The white tick is the screening score. Hover a bar for the exact figures.</p>
    </div>
  );
}
