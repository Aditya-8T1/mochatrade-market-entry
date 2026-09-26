import type { ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import type { Decision, Market } from "../engine/types";
import Gloss from "./ui/Glossary";
import { PUBLIC_SCREEN_BANNER, PUBLIC_SCREEN_LABEL } from "../data-provider/publicScreenProvider";
import { RISK_BAND, VERDICT_STYLE } from "./ui/verdict";
import { DIM_COLOR } from "./ui/dimensionColors";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Friendly heading over the verdict reason. Keyed on the engine's verdict, never on its text. */
const REASON_HEADING: Record<Decision["verdict"], string> = {
  go_now: "Why it goes first",
  go_next: "Why it comes next",
  go_later: "Why it waits",
  shortlist: "Why it is only a shortlist",
  no_go: "Why not now",
};

/**
 * The decision for one market: why this verdict, when, and what has to be
 * true before launch. The market's name, verdict chip and entry approach
 * live in the page header; the regulatory-risk readout lives in the
 * sidebar (RiskScoreCard, below). Every string here comes from the engine.
 */
export default function DecisionCard({ decision, market }: { decision: Decision; market: Market }): ReactElement {
  const isScreen = market.screen_source === "public_data";
  const noGo = decision.verdict === "no_go";

  return (
    <div data-testid="decision-card" data-verdict={decision.verdict} data-screen={isScreen ? "public_data" : undefined} className="space-y-8">
      {isScreen && (
        <div data-testid="public-screen-banner" role="note" className="flex items-start gap-3 rounded-card bg-short-tint px-5 py-4 text-[17px] leading-snug text-ink">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-short" aria-hidden="true" />
          <span>
            <span className="mr-1.5 font-bold text-short">{PUBLIC_SCREEN_LABEL}.</span>
            {PUBLIC_SCREEN_BANNER}
          </span>
        </div>
      )}

      <section>
        <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">{REASON_HEADING[decision.verdict]}</h2>
        <p data-testid="verdict-reason" className="mt-3 max-w-[68ch] text-[19px] leading-relaxed text-ink-2">
          {decision.verdictReason}
        </p>
        {decision.window && (
          <p className="mt-4 text-[17px] text-ink">
            <span className="font-bold">When: </span>
            {decision.window}
            {decision.sequencePosition && <span className="text-ink-2"> — entry position #{decision.sequencePosition} in the recommended sequence</span>}
          </p>
        )}
      </section>

      {decision.whyNotNow ? (
        <WhyNotNowSection why={decision.whyNotNow} market={market} />
      ) : (
      <section className="border-t border-rule pt-8">
        <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">
          {noGo ? "What stands in the way" : "Before we launch"}
          <span className="ml-2 align-middle text-[17px] font-sans font-bold text-muted">({decision.conditions.length})</span>
        </h2>
        <ol className="mt-4 max-w-[72ch] space-y-3">
          {decision.conditions.map((c, i) => (
            <li key={i} className="grid grid-cols-[32px_1fr] gap-2 text-[17px] leading-relaxed text-ink-2">
              <span aria-hidden="true" className="font-display text-[22px] font-semibold leading-[1.2] text-coral">
                {LETTERS[i] ?? i + 1}.
              </span>
              <span>
                <Gloss text={c} />
              </span>
            </li>
          ))}
        </ol>
      </section>
      )}
    </div>
  );
}

const DIMENSION_LABEL: Record<string, string> = {
  market_opportunity: "Market Opportunity",
  legality: "Legality",
  licence: "Licence",
  fx_custody: "FX / Custody",
  clarity: "Clarity",
};

/**
 * "Why not now", rubric by rubric: each failing dimension with the score
 * the team gave it and one sentence on why, then what would have to change.
 * Text comes verbatim from data/why-not-now.json via the engine.
 */
function WhyNotNowSection({ why, market }: { why: NonNullable<Decision["whyNotNow"]>; market: Market }): ReactElement {
  return (
    <section data-testid="why-not-now" className="border-t border-rule pt-8">
      <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">
        Where it fails the rubric
        <span className="ml-2 align-middle text-[17px] font-sans font-bold text-muted">({why.dimensions.length} of 5)</span>
      </h2>
      <ol className="mt-5 max-w-[72ch] divide-y divide-rule">
        {why.dimensions.map((d) => {
          const score = market.scores[d.key];
          const color = DIM_COLOR[d.key] ?? "#4A453E";
          return (
            <li key={d.key} className="grid grid-cols-[minmax(150px,190px)_1fr] gap-4 py-4 text-[17px] leading-relaxed">
              <span className="flex flex-col gap-1">
                <span className="font-bold" style={{ color }}>{DIMENSION_LABEL[d.key] ?? d.key}</span>
                <span className="inline-flex items-center gap-2 text-[15px] text-muted">
                  <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${(score / 5) * 100}%`, background: color }} />
                  </span>
                  <span className="tabular">{score}/5</span>
                </span>
              </span>
              <span className="text-ink-2">
                <Gloss text={d.note} />
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 rounded-card bg-surface-2 px-6 py-5">
        <h3 className="text-[15px] font-bold uppercase tracking-[0.04em] text-ink-2">What would have to change</h3>
        <p className="mt-2 max-w-[68ch] text-[17px] leading-relaxed text-ink">
          <Gloss text={why.what_would_change} />
        </p>
      </div>
    </section>
  );
}

/**
 * The regulatory-risk readout, shown in the market page's sidebar. Same
 * numbers and wording as before; a public-data screen market gets a greyed
 * "indicative" figure with no band word, because its number comes from
 * capped public-data bands and must not read as a finding.
 */
export function RiskScoreCard({ decision, market }: { decision: Decision; market: Market }): ReactElement {
  const isScreen = market.screen_source === "public_data";
  const b = RISK_BAND[decision.risk.band];
  const weakest = decision.risk.drivers.slice(0, 2);
  return (
    <div data-testid="risk-score-panel" data-indicative={isScreen ? "1" : undefined}>
      {isScreen ? (
        <>
          <h2 className="text-[15px] font-bold text-ink-2">Regulatory risk (indicative)</h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-[80px] font-light leading-none tabular text-muted">{decision.risk.riskScore100}</span>
            <span className="text-[15px] text-muted">out of 100</span>
          </div>
          <span className="mt-1 block text-[17px] font-bold text-muted">indicative</span>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-muted/40" style={{ width: `${decision.risk.riskScore100}%` }} />
          </div>
          <p className="mt-3 text-[15px] leading-snug text-muted">from coarse public-data bands — not a researched risk score</p>
        </>
      ) : (
        <>
          <h2 className="text-[15px] font-bold text-ink-2">Regulatory risk</h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="font-display text-[80px] font-light leading-none tabular"
              style={{ color: b.color }}
              title={`How this is computed: (5 − weighted mean of Legality, Licence, FX/Custody, Clarity) ÷ 4 × 100. Weighted mean here = ${decision.risk.regulatoryScore}/5. Bands: <30 low, 30–54 medium, ≥55 high.`}
            >
              {decision.risk.riskScore100}
            </span>
            <span className="text-[15px] text-muted">out of 100</span>
          </div>
          <span className="mt-1 block text-[17px] font-bold" style={{ color: b.color }}>
            {b.label} risk
          </span>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="grow-x h-full rounded-full" style={{ width: `${decision.risk.riskScore100}%`, backgroundColor: b.color }} />
          </div>
          <p className="mt-3 text-[15px] leading-snug text-muted">
            Weakest: {weakest.map((d) => `${d.label} ${d.raw}/5`).join(", ")}. Built from the four regulatory dimensions; market size is not counted as risk.
          </p>
        </>
      )}
    </div>
  );
}

/** Verdict colour for the big sequence numbers and similar display type. */
export function verdictColor(v: Decision["verdict"]): string {
  return VERDICT_STYLE[v].text;
}
