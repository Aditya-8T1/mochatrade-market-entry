import type { ReactElement } from "react";
import { ChevronDown } from "lucide-react";
import type { Market, Risk } from "../engine/types";
import Gloss from "./ui/Glossary";
import { mitigationFor } from "../engine";

const SEVERITY_COLOR: Record<Risk["severity"], string> = {
  high: "#B42318",
  medium: "#9A4A16",
  low: "#1E7A4C",
};

/** Risks tagged to the selected market. The clause of each risk that applies to THIS market is shown first; the cross-cutting statement and mitigation sit under it. */
export default function RiskPanel({ risks, market }: { risks: Risk[]; market?: Market }): ReactElement {
  if (risks.length === 0) {
    if (market && !market.cleared) {
      return (
        <p data-testid="risk-panel-empty" className="text-[17px] leading-relaxed text-muted">
          No cross-cutting risks are tagged to this market because it is not in the entry plan. Its regulatory blocker is on the decision tab.
        </p>
      );
    }
    return <p data-testid="risk-panel-empty" className="text-[17px] text-muted">No cross-cutting risks tagged to this market.</p>;
  }

  return (
    <div data-testid="risk-panel" className="divide-y divide-rule">
      {risks.map((risk) => {
        const color = SEVERITY_COLOR[risk.severity];
        const note = market ? risk.market_notes?.[market.id] : undefined;
        return (
          <details key={risk.id} className="group py-3 first:pt-0 last:pb-0">
            <summary className="press -mx-3 flex min-h-[44px] cursor-pointer list-none items-start gap-2.5 rounded-chip px-3 py-2 hover:bg-surface active:bg-surface-2 [&::-webkit-details-marker]:hidden">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-[17px] font-medium text-ink">{risk.title}</span>
                  <span className="shrink-0 text-[14px]" style={{ color }}>
                    {risk.severity}
                  </span>
                </span>
                <span className="mt-0.5 block text-[15px] leading-snug text-ink-2">
                  {note ? <Gloss text={note} /> : risk.subtitle}
                </span>
              </span>
              <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2.5 space-y-2 pl-4 text-[17px] leading-relaxed text-ink-2">
              {note && <p className="text-muted"><span className="text-ink-2">Across all three markets:</span> <Gloss text={risk.risk} /></p>}
              {!note && <p><Gloss text={risk.risk} /></p>}
              <p className="text-muted">
                <span className="text-ink-2">Why it matters:</span> <Gloss text={risk.why_it_matters} />
              </p>
              <p className="rounded-chip bg-surface-2 px-4 py-3">
                <span className="text-[14px] text-now">Mitigation</span>
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
