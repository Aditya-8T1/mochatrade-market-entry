import type { ReactElement } from "react";
import { CircleDot, Clock3, PlayCircle, XCircle } from "lucide-react";
import type { Decision, Market } from "../engine/types";
import Gloss from "./ui/Glossary";
import SourceTag from "./ui/SourceTag";
import { AlertTriangle } from "lucide-react";
import { PUBLIC_SCREEN_BANNER, PUBLIC_SCREEN_LABEL } from "../data-provider/publicScreenProvider";
import { SCREEN_COLOR } from "./ui/dimensionColors";

const BAND = {
  low: { label: "Low", color: "#34D399" },
  medium: { label: "Medium", color: "#F5A623" },
  high: { label: "High", color: "#F4635A" },
};

const VERDICT = {
  go_now: { color: "#34D399", Icon: PlayCircle },
  go_next: { color: "#22D3EE", Icon: CircleDot },
  go_later: { color: "#F5A623", Icon: Clock3 },
  shortlist: { color: SCREEN_COLOR, Icon: AlertTriangle },
  no_go: { color: "#F4635A", Icon: XCircle },
};

/**
 * The decision, before the evidence. One card that answers the brief's
 * three questions for the selected market -- regulatory risk score,
 * recommended entry approach, and what has to be true before launch --
 * so a reader can act without assembling it from five panels.
 */
export default function DecisionCard({ decision, market }: { decision: Decision; market: Market }): ReactElement {
  const v = VERDICT[decision.verdict];
  const b = BAND[decision.risk.band];
  const Icon = v.Icon;
  const weakest = decision.risk.drivers.slice(0, 2);

  const isScreen = market.screen_source === "public_data";

  return (
    <div data-testid="decision-card" data-verdict={decision.verdict} data-screen={isScreen ? "public_data" : undefined} className="grid gap-5 md:grid-cols-[1fr_200px] lg:grid-cols-1 xl:grid-cols-[1fr_200px]">
      {isScreen && (
        <div
          data-testid="public-screen-banner"
          role="note"
          className="flex items-start gap-2.5 border px-3 py-2.5 text-[13px] leading-snug md:col-span-2 lg:col-span-1 xl:col-span-2"
          style={{ borderColor: `${SCREEN_COLOR}99`, backgroundColor: `${SCREEN_COLOR}14`, color: "#E7ECF2" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SCREEN_COLOR }} />
          <span>
            <span className="mr-1.5 font-mono text-[11px] uppercase tracking-wide" style={{ color: SCREEN_COLOR }}>
              {PUBLIC_SCREEN_LABEL}
            </span>
            {PUBLIC_SCREEN_BANNER}
          </span>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 shrink-0" style={{ color: v.color }} />
          <h2 className="font-display text-2xl font-semibold leading-tight text-paper">
            <span style={{ color: v.color }}>{decision.verdictLabel}</span>
            <span className="text-paper-dim">: </span>
            {market.name}
          </h2>
          {market.user_added && <span className="rounded-sm border border-signal-violet/40 px-1.5 py-0.5 font-mono text-[11px] text-signal-violet">your entry</span>}
          {isScreen && (
            <span className="rounded-sm border px-1.5 py-0.5 font-mono text-[11px]" style={{ color: SCREEN_COLOR, borderColor: `${SCREEN_COLOR}66` }}>
              screen
            </span>
          )}
        </div>
        <p data-testid="verdict-reason" className="mt-1.5 pl-[30px] text-[15px] leading-snug text-paper-dim">{decision.verdictReason}</p>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-[130px_1fr]">
          <span className="font-mono text-[12px] text-paper-faint">Entry approach</span>
          <p className="leading-relaxed text-paper">
            <Gloss text={decision.entryApproach} />{" "}
            <span className="ml-1 inline-block translate-y-[-1px]"><SourceTag type={decision.entryApproachSource} compact /></span>
          </p>

          {decision.window && (
            <>
              <span className="font-mono text-[12px] text-paper-faint">When</span>
              <p className="text-paper">
                {decision.window}
                {decision.sequencePosition && <span className="text-paper-dim"> — entry position #{decision.sequencePosition} in the recommended sequence</span>}
              </p>
            </>
          )}

          <span className="font-mono text-[12px] text-paper-faint">
            {decision.verdict === "no_go" ? "Why not" : `Before launch (${decision.conditions.length})`}
          </span>
          <ol className={`space-y-1 text-paper-dim ${decision.verdict === "no_go" ? "" : "list-decimal pl-4"}`}>
            {decision.conditions.map((c, i) => (
              <li key={i} className="leading-snug">
                <Gloss text={c} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div data-testid="risk-score-panel" data-indicative={isScreen ? "1" : undefined} className="flex flex-col justify-center border-t border-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        {isScreen ? (
          // A screen market's number comes from capped public-data bands (licence can never exceed 3), so a band
          // word or a "weakest dimension" line would read as a finding. Show the figure greyed and say what it is.
          <>
            <span className="font-mono text-[12px] text-paper-faint">Regulatory risk (indicative)</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-medium tabular text-paper-faint">{decision.risk.riskScore100}</span>
              <span className="font-mono text-sm text-paper-faint">/ 100</span>
            </div>
            <span className="font-display text-sm font-medium text-paper-faint">indicative</span>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
              <div className="h-full rounded-full bg-paper-faint/40" style={{ width: `${decision.risk.riskScore100}%` }} />
            </div>
            <p className="mt-2 text-[13px] leading-snug text-paper-faint">from coarse public-data bands — not a researched risk score</p>
          </>
        ) : (
          <>
            <span className="font-mono text-[12px] text-paper-faint">Regulatory risk</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="font-mono text-4xl font-medium tabular"
                style={{ color: b.color }}
                title={`How this is computed: (5 − weighted mean of Legality, Licence, FX/Custody, Clarity) ÷ 4 × 100. Weighted mean here = ${decision.risk.regulatoryScore}/5. Bands: <30 low, 30–54 medium, ≥55 high.`}
              >
                {decision.risk.riskScore100}
              </span>
              <span className="font-mono text-sm text-paper-faint">/ 100</span>
            </div>
            <span className="font-display text-sm font-medium" style={{ color: b.color }}>
              {b.label} risk
            </span>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
              <div className="h-full rounded-full" style={{ width: `${decision.risk.riskScore100}%`, backgroundColor: b.color }} />
            </div>
            <p className="mt-2 text-[13px] leading-snug text-paper-faint">
              Weakest: {weakest.map((d) => `${d.label} ${d.raw}/5`).join(", ")}. Built from the four regulatory dimensions; market size is not counted as risk.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
