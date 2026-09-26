import type { ReactElement } from "react";
import { formatScore } from "../engine";
import type { MarketRecommendation } from "../engine/types";
import RadarChart from "./ui/RadarChart";
import SourceTag from "./ui/SourceTag";
import { DIM_COLOR, SCREEN_COLOR } from "./ui/dimensionColors";

export interface ScoreProvenance {
  userAdded?: boolean;
  screen?: boolean;
  round2?: boolean;
}

/**
 * Where the score came from, in one line: "matches Round 1 deck", "matches
 * research sheet", or a note that it is a screen / user entry. Shared by
 * the ScoreCard and the market page's sidebar so the logic lives once.
 */
export function scoreMatchLine(rec: MarketRecommendation, { userAdded = false, screen = false, round2 = false }: ScoreProvenance): { text: string; color: string } {
  if (screen) return { text: "public-data screen — not in Round 1", color: SCREEN_COLOR };
  if (userAdded) return { text: "your entry — not in Round 1", color: "#7A4FB0" };
  const ok = rec.score.matchesDeckScore;
  const color = ok ? "#1E7A4C" : "#9A4A16";
  if (round2) return { text: ok ? "matches research sheet" : `research sheet printed ${formatScore(rec.score.deckScore)}`, color };
  return { text: ok ? "matches Round 1 deck" : `Round 1 printed ${formatScore(rec.score.deckScore)}`, color };
}

export default function ScoreCard({ rec, userAdded = false, screen = false, round2 = false }: { rec: MarketRecommendation; userAdded?: boolean; screen?: boolean; round2?: boolean }): ReactElement {
  const total = rec.breakdown.reduce((s, d) => s + d.contribution, 0);
  const line = scoreMatchLine(rec, { userAdded, screen, round2 });

  return (
    <div data-testid="scorecard" data-market-id={rec.marketId} className="grid gap-10">
      <div className="flex flex-col items-center sm:items-start">
        <RadarChart axes={rec.breakdown.map((d) => ({ key: d.key, label: d.label, value: d.raw, weight: d.weight }))} />
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-[52px] font-semibold leading-none tabular text-ink">{formatScore(rec.score.weightedScore)}</span>
          <span className="text-[17px] text-muted">/ 5.0</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-[15px] text-muted">
          <span className="tabular">{rec.score.weightedScore100.toFixed(0)} / 100</span>
          <span aria-hidden="true">·</span>
          <span style={{ color: line.color }}>{line.text}</span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-4">
        {rec.breakdown.map((d) => (
          <div key={d.key} className="grid grid-cols-[minmax(120px,160px)_1fr_auto] items-center gap-4">
            <span className="text-[16px] font-medium text-ink">{d.label}</span>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="grow-x h-full rounded-full transition-[width] duration-500" style={{ width: `${(d.raw / 5) * 100}%`, backgroundColor: DIM_COLOR[d.key] }} />
            </div>
            <span className="w-[96px] shrink-0 text-right text-[15px] tabular text-ink-2">
              {d.raw.toFixed(1)}/5 <span className="text-muted">· w{(d.weight * 100).toFixed(0)}</span>
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-rule pt-3">
          <span className="text-[15px] font-bold text-ink-2">Weighted total</span>
          <span className="text-[15px] tabular text-ink-2">{total.toFixed(2)} pts</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SourceTag type="calculated" />
          <span className="text-[15px] text-muted">
            evidence: <span className={rec.evidenceConfidence === "high" ? "text-now" : "text-later"}>{rec.evidenceConfidence}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
