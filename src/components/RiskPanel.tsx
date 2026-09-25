import type { ReactElement } from "react";
import { ChevronDown } from "lucide-react";
import type { Market, Risk } from "../engine/types";
import Gloss from "./ui/Glossary";
import { mitigationFor } from "../engine";

const SEVERITY_COLOR: Record<Risk["severity"], string> = {
  high: "#F4635A",
  medium: "#F5A623",
  low: "#34D399",
};

/** Risks tagged to the selected market. The clause of each risk that applies to THIS market is shown first; the cross-cutting statement and mitigation sit under it. */
export default function RiskPanel({ risks, market }: { risks: Risk[]; market?: Market }): ReactElement {
  if (risks.length === 0) {
    if (market && !market.cleared) {
      return (
        <div data-testid="risk-panel-empty" className="text-[14px] leading-relaxed text-paper-dim">
          <p className="mb-1 text-signal-red">Why this market was screened out</p>
          <Gloss text={market.screened_out_reason ?? "Screening score below the clear threshold."} />
        </div>
      );
    }
    return <p data-testid="risk-panel-empty" className="text-[14px] text-paper-faint">No cross-cutting risks tagged to this market.</p>;
  }

  return (
    <div data-testid="risk-panel" className="divide-y divide-line-soft">
      {risks.map((risk) => {
        const color = SEVERITY_COLOR[risk.severity];
        const note = market ? risk.market_notes?.[market.id] : undefined;
        return (
          <details key={risk.id} className="group py-3 first:pt-0 last:pb-0">
            <summary className="flex cursor-pointer list-none items-start gap-2.5 [&::-webkit-details-marker]:hidden">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-medium text-paper">{risk.title}</span>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide" style={{ color }}>
                    {risk.severity}
                  </span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-paper-dim">
                  {note ? <Gloss text={note} /> : risk.subtitle}
                </span>
              </span>
              <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-paper-faint transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2.5 space-y-2 pl-4 text-[14px] leading-relaxed text-paper-dim">
              {note && <p className="text-paper-faint"><span className="text-paper-dim/90">Across all three markets:</span> <Gloss text={risk.risk} /></p>}
              {!note && <p><Gloss text={risk.risk} /></p>}
              <p className="text-paper-faint">
                <span className="text-paper-dim/90">Why it matters:</span> <Gloss text={risk.why_it_matters} />
              </p>
              <p className="border-l-2 pl-2.5" style={{ borderColor: `${color}55` }}>
                <span className="font-mono text-[11px] text-signal-green">Mitigation</span>
                <br />
                <Gloss text={market ? mitigationFor(risk, market.id) : risk.mitigation} />
              </p>
            </div>
          </details>
        );
      })}
    </div>
  );
}
