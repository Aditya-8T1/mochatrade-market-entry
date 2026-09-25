import type { ReactElement } from "react";
import { formatScore } from "../engine";
import type { MarketRecommendation } from "../engine/types";
import RadarChart from "./ui/RadarChart";
import SourceTag from "./ui/SourceTag";
import { DIM_COLOR, SCREEN_COLOR } from "./ui/dimensionColors";

export default function ScoreCard({ rec, userAdded = false, screen = false }: { rec: MarketRecommendation; userAdded?: boolean; screen?: boolean }): ReactElement {
  const total = rec.breakdown.reduce((s, d) => s + d.contribution, 0);

  return (
    <div data-testid="scorecard" data-market-id={rec.marketId} className="grid gap-6 sm:grid-cols-[236px_1fr] lg:grid-cols-1 xl:grid-cols-[236px_1fr]">
      <div className="flex flex-col items-center">
        <RadarChart axes={rec.breakdown.map((d) => ({ key: d.key, label: d.label, value: d.raw, weight: d.weight }))} />
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-4xl font-medium tabular text-paper">{formatScore(rec.score.weightedScore)}</span>
          <span className="font-mono text-sm text-paper-faint">/ 5.0</span>
        </div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[12px] text-paper-faint">
          <span>{rec.score.weightedScore100.toFixed(0)} / 100</span>
          <span className="text-line-strong">·</span>
          {screen ? (
            <span style={{ color: SCREEN_COLOR }}>public-data screen — not in Round 1</span>
          ) : userAdded ? (
            <span className="text-signal-violet">your entry — not in Round 1</span>
          ) : (
            <span className={rec.score.matchesDeckScore ? "text-signal-green" : "text-signal-amber"}>
              {rec.score.matchesDeckScore ? "matches Round 1 deck" : `Round 1 printed ${formatScore(rec.score.deckScore)}`}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-center gap-2.5">
        {rec.breakdown.map((d) => (
          <div key={d.key} className="grid grid-cols-[86px_1fr_auto] items-center gap-3">
            <span className="truncate font-mono text-[12px] text-paper-dim">{d.label}</span>
            <div className="h-[7px] w-full overflow-hidden rounded-[1px] bg-ink-800">
              <div
                className="h-full rounded-[1px] transition-[width]"
                style={{ width: `${(d.raw / 5) * 100}%`, backgroundColor: DIM_COLOR[d.key] }}
              />
            </div>
            <span className="w-[86px] shrink-0 text-right font-mono text-[12px] tabular text-paper-faint">
              {d.raw.toFixed(1)}/5 <span className="text-paper-faint/60">· w{(d.weight * 100).toFixed(0)}</span>
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-line-soft pt-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-paper-faint">Weighted total</span>
          <span className="font-mono text-xs tabular text-paper-dim">{total.toFixed(2)} pts</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <SourceTag type="calculated" />
          <span className="font-mono text-[11px] text-paper-faint">
            evidence: <span className={rec.evidenceConfidence === "high" ? "text-signal-green" : "text-signal-amber"}>{rec.evidenceConfidence}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
