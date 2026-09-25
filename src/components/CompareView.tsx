import type { ReactElement } from "react";
import { formatScore } from "../engine";
import type { Decision, Market, MarketEntryEngine, RubricWeights } from "../engine/types";
import { DIM_COLOR, SCREEN_COLOR } from "./ui/dimensionColors";
import Gloss from "./ui/Glossary";

const MARKET_COLOR = ["#34D399", "#22D3EE", "#F5A623"];
const SIZE = 260;
const C = SIZE / 2;
const R = 96;

function pt(i: number, n: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

interface Props {
  engine: MarketEntryEngine;
  weights: RubricWeights;
  ids: string[];
  onRemove: (id: string) => void;
}

/** Side-by-side: overlaid radars and one table of the things a decision actually turns on. Up to three markets. */
export default function CompareView({ engine, weights, ids, onRemove }: Props): ReactElement {
  const dims = engine.getDimensions();
  const rows = ids
    .map((id) => {
      const market = engine.getMarket(id);
      const rec = engine.getMarketRecommendation(id, weights);
      const decision = engine.getDecision(id, weights);
      return market && rec && decision ? { market, rec, decision } : null;
    })
    .filter((x): x is { market: Market; rec: NonNullable<ReturnType<MarketEntryEngine["getMarketRecommendation"]>>; decision: Decision } => x !== null);

  if (rows.length === 0) {
    return (
      <p data-testid="compare-empty" className="text-[14px] text-paper-dim">
        Tick up to three markets in the list on the left to compare them side by side.
      </p>
    );
  }

  const n = dims.length;

  return (
    <div data-testid="compare-view" className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {rows.map((r, i) => (
          <button key={r.market.id} onClick={() => onRemove(r.market.id)} className="flex items-center gap-2 rounded-sm border px-2.5 py-1 font-mono text-[12px]" style={{ borderColor: `${MARKET_COLOR[i]}66`, color: MARKET_COLOR[i] }} title="Remove from comparison">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MARKET_COLOR[i] }} />
            {r.market.name} ×
          </button>
        ))}
        {rows.length < 3 && <span className="text-[13px] text-paper-faint">Tick another market on the left to add it.</span>}
      </div>

      <div className="space-y-5">
        <svg viewBox={`-40 -10 ${SIZE + 80} ${SIZE + 20}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label="Overlaid rubric radar">
          {[1, 2, 3, 4, 5].map((ring) => (
            <polygon key={ring} points={Array.from({ length: n }, (_, i) => pt(i, n, (ring / 5) * R).join(",")).join(" ")} fill="none" stroke="#28333F" strokeWidth={ring === 5 ? 1.2 : 0.7} />
          ))}
          {dims.map((d, i) => {
            const [x, y] = pt(i, n, R + 18);
            return (
              <text key={d.key} x={x} y={y} textAnchor={Math.abs(x - C) < 4 ? "middle" : x > C ? "start" : "end"} dominantBaseline="middle" style={{ fontSize: 9.5, fill: DIM_COLOR[d.key] }} className="font-mono">
                {d.label}
              </text>
            );
          })}
          {rows.map((r, ri) => (
            <polygon
              key={r.market.id}
              points={dims.map((d, i) => pt(i, n, (r.market.scores[d.key] / 5) * R).join(",")).join(" ")}
              fill={`${MARKET_COLOR[ri]}22`}
              stroke={MARKET_COLOR[ri]}
              strokeWidth={1.75}
            />
          ))}
        </svg>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                <th className="w-[150px] py-1.5 pr-3 text-left font-mono text-[12px] font-normal text-paper-faint"></th>
                {rows.map((r, i) => (
                  <th key={r.market.id} className="px-3 py-1.5 text-left font-display text-sm font-medium" style={{ color: MARKET_COLOR[i] }}>
                    {r.market.name}
                    {r.market.screen_source === "public_data" && (
                      <span data-testid={`compare-screen-tag-${r.market.id}`} className="ml-1.5 rounded-sm border px-1 py-px font-mono text-[10px] font-normal" style={{ color: SCREEN_COLOR, borderColor: `${SCREEN_COLOR}66` }}>
                        screen
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="align-top">
              <Row label="Decision" cells={rows.map((r) => (r.market.screen_source === "public_data" ? `${r.decision.verdictLabel} (public-data screen — not a decision)` : r.decision.verdictLabel))} strong />
              <Row label="Screening score" cells={rows.map((r) => `${formatScore(r.rec.score.weightedScore)} / 5 (rank #${r.rec.rawRank})`)} />
              <Row label="Regulatory risk" cells={rows.map((r) => (r.market.screen_source === "public_data" ? `${r.decision.risk.riskScore100}/100 · indicative (public-data bands)` : `${r.decision.risk.riskScore100}/100 · ${r.decision.risk.band}`))} />
              <Row label="Entry position" cells={rows.map((r) => (r.rec.sequencePosition ? `#${r.rec.sequencePosition} · ${r.decision.window ?? ""}` : "not sequenced"))} />
              {dims.map((d) => (
                <tr key={d.key} className="border-t border-line-soft">
                  <td className="py-1.5 pr-3 font-mono text-[12px]" style={{ color: DIM_COLOR[d.key] }}>
                    {d.label}
                  </td>
                  {rows.map((r) => (
                    <td key={r.market.id} className="px-3 py-1.5 tabular text-paper-dim">
                      <span className="mr-2 inline-block h-[6px] w-[60px] overflow-hidden rounded-[1px] bg-ink-800 align-middle">
                        <span className="block h-full" style={{ width: `${(r.market.scores[d.key] / 5) * 100}%`, backgroundColor: DIM_COLOR[d.key] }} />
                      </span>
                      {r.market.scores[d.key]}
                    </td>
                  ))}
                </tr>
              ))}
              <Row label="Adaptation cost" cells={rows.map((r) => (r.rec.sequencingInputs ? `${r.rec.sequencingInputs.adaptationCost}/5` : "—"))} />
              <Row label="Execution dependency" cells={rows.map((r) => (r.rec.sequencingInputs ? `${r.rec.sequencingInputs.executionDependency}/5` : "—"))} />
              <Row label="Entry approach" cells={rows.map((r) => r.decision.entryApproach)} gloss />
              <Row label="Main hurdle" cells={rows.map((r) => r.market.deep_dive?.main_hurdle ?? r.market.screened_out_reason ?? "—")} gloss />
              <Row label="Payment rail" cells={rows.map((r) => r.market.deep_dive?.local_payment_rail ?? "—")} gloss />
              <Row label="Capital & licensing" cells={rows.map((r) => r.market.deep_dive?.capital_and_licensing ?? "—")} gloss />
              <Row label="KYC / AML" cells={rows.map((r) => r.market.deep_dive?.kyc_aml ?? "—")} gloss />
              <Row label="Product changes" cells={rows.map((r) => r.rec.complianceAdjustments ? `${r.rec.complianceAdjustments.items.length}: ${r.rec.complianceAdjustments.summary}` : "—")} gloss />
              <Row label="Conditions before launch" cells={rows.map((r) => String(r.decision.conditions.length))} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, cells, strong, gloss }: { label: string; cells: string[]; strong?: boolean; gloss?: boolean }): ReactElement {
  return (
    <tr className="border-t border-line-soft">
      <td className="py-1.5 pr-3 font-mono text-[12px] text-paper-faint">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className={`px-3 py-1.5 leading-snug ${strong ? "text-paper" : "text-paper-dim"}`}>
          {gloss ? <Gloss text={c} /> : c}
        </td>
      ))}
    </tr>
  );
}
