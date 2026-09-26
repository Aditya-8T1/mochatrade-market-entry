import type { ReactElement } from "react";
import { formatScore } from "../engine";
import type { Decision, Market, MarketEntryEngine, RubricWeights } from "../engine/types";
import { DIM_COLOR, SCREEN_COLOR } from "./ui/dimensionColors";
import Gloss from "./ui/Glossary";
import { Link, marketHref } from "../router";
import { VerdictChip } from "./ui/verdict";

const MARKET_COLOR = ["#1F5FA8", "#B8471F", "#1E7A4C"];
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
      <p data-testid="compare-empty" className="text-[17px] text-ink-2">
        Pick up to three markets to compare them side by side.
      </p>
    );
  }

  const n = dims.length;

  return (
    <div data-testid="compare-view" className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {rows.map((r, i) => (
          <button key={r.market.id} onClick={() => onRemove(r.market.id)} className="press flex min-h-[44px] items-center gap-2 rounded-btn border-1.5 border-rule bg-surface px-3.5 text-[15px] font-bold text-ink shadow-btn-quiet hover:border-ink" aria-label={`Remove ${r.market.name} from comparison`} title="Remove from comparison">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MARKET_COLOR[i] }} aria-hidden="true" />
            {r.market.name} ×
          </button>
        ))}
        
      </div>

      <div className="space-y-8">
        <svg viewBox={`-80 -10 ${SIZE + 160} ${SIZE + 20}`} className="mx-auto w-full max-w-[380px]" role="img" aria-label="Overlaid rubric radar">
          {[1, 2, 3, 4, 5].map((ring) => (
            <polygon key={ring} points={Array.from({ length: n }, (_, i) => pt(i, n, (ring / 5) * R).join(",")).join(" ")} fill="none" stroke="#E4DDD0" strokeWidth={ring === 5 ? 1.2 : 0.7} />
          ))}
          {dims.map((d, i) => {
            const [x, y] = pt(i, n, R + 18);
            return (
              <text key={d.key} x={x} y={y} textAnchor={Math.abs(x - C) < 4 ? "middle" : x > C ? "start" : "end"} dominantBaseline="middle" style={{ fontSize: 14, fill: DIM_COLOR[d.key], fontFamily: "Karla, sans-serif", fontWeight: 700 }}>
                {d.label}
              </text>
            );
          })}
          {rows.map((r, ri) => (
            <polygon
              key={r.market.id}
              points={dims.map((d, i) => pt(i, n, (r.market.scores[d.key] / 5) * R).join(",")).join(" ")}
              fill={`${MARKET_COLOR[ri]}1f`}
              stroke={MARKET_COLOR[ri]}
              strokeWidth={1.75}
            />
          ))}
        </svg>

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[16px]">
            <thead>
              <tr>
                <th scope="col" className="w-[180px] py-3 pr-3 text-left"><span className="sr-only">Measure</span></th>
                {rows.map((r, i) => (
                  <th key={r.market.id} scope="col" className="px-4 py-3 text-left align-bottom">
                    <span className="mb-1 block h-1 w-8 rounded-full" style={{ backgroundColor: MARKET_COLOR[i] }} aria-hidden="true" />
                    <Link to={marketHref(r.market.id)} className="font-display text-[24px] font-semibold text-ink underline-offset-4 hover:text-coral-strong hover:underline">{r.market.name}</Link>
                    {r.market.screen_source === "public_data" && (
                      <span data-testid={`compare-screen-tag-${r.market.id}`} className="ml-2 rounded-chip border-1.5 px-1.5 py-px align-middle text-[14px] font-bold" style={{ color: SCREEN_COLOR, borderColor: SCREEN_COLOR }}>
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
                <tr key={d.key} className="border-t border-rule">
                  <td className="py-3 pr-3 text-[15px] font-bold" style={{ color: DIM_COLOR[d.key] }}>
                    {d.label}
                  </td>
                  {rows.map((r) => (
                    <td key={r.market.id} className="px-4 py-3 tabular text-ink-2">
                      <span className="mr-2 inline-block h-2 w-[64px] overflow-hidden rounded-full bg-surface-2 align-middle">
                        <span className="block h-full" style={{ width: `${(r.market.scores[d.key] / 5) * 100}%`, backgroundColor: DIM_COLOR[d.key] }} />
                      </span>
                      {r.market.scores[d.key]}
                    </td>
                  ))}
                </tr>
              ))}
              <Row label="Adaptation cost" cells={rows.map((r) => (r.rec.sequencingInputs ? `${r.rec.sequencingInputs.adaptationCost}/5` : r.market.research?.adaptation_cost != null ? `${r.market.research.adaptation_cost}/5 (research)` : "—"))} />
              <Row label="Execution dependency" cells={rows.map((r) => (r.rec.sequencingInputs ? `${r.rec.sequencingInputs.executionDependency}/5` : r.market.research?.execution_dependency != null ? `${r.market.research.execution_dependency}/5 (research)` : "—"))} />
              <Row label="Entry approach" cells={rows.map((r) => r.decision.entryApproach)} gloss />
              <Row label="Main hurdle" cells={rows.map((r) => r.market.deep_dive?.main_hurdle ?? r.market.screened_out_reason ?? r.market.research?.flags ?? "—")} gloss />
              <Row label="Payment rail" cells={rows.map((r) => r.market.deep_dive?.local_payment_rail ?? r.market.research?.payment_rail ?? "—")} gloss />
              <Row label="Capital & licensing" cells={rows.map((r) => r.market.deep_dive?.capital_and_licensing ?? r.market.research?.capital_and_licensing ?? "—")} gloss />
              <Row label="KYC / AML" cells={rows.map((r) => r.market.deep_dive?.kyc_aml ?? r.market.research?.kyc_aml ?? "—")} gloss />
              <Row label="Product changes" cells={rows.map((r) => r.rec.complianceAdjustments ? `${r.rec.complianceAdjustments.items.length}: ${r.rec.complianceAdjustments.summary}` : r.market.research?.product_changes ?? "—")} gloss />
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
    <tr className="border-t border-rule">
      <td className="py-3 pr-3 align-top text-[15px] font-bold text-ink-2">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className={`px-4 py-3 leading-snug ${strong ? "font-bold text-ink" : "text-ink-2"}`}>
          {gloss ? <Gloss text={c} /> : c}
        </td>
      ))}
    </tr>
  );
}
