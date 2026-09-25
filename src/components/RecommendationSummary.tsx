import type { ReactElement } from "react";
import { AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";
import type { MarketRecommendation } from "../engine/types";
import SourceTag from "./ui/SourceTag";
import Gloss from "./ui/Glossary";
import { SCREEN_COLOR } from "./ui/dimensionColors";

/** Synthesized recommendation card: the "so what" for the selected market -- status, blockers, and what still needs confirming before it's demo-safe to state as fact. */
export default function RecommendationSummary({ rec, screen = false }: { rec: MarketRecommendation; screen?: boolean }): ReactElement {
  return (
    <div data-testid="recommendation-summary" data-market-id={rec.marketId} data-status={rec.status} className="space-y-4">
      <div className="flex items-center gap-2.5">
        {screen ? (
          <span className="rounded-sm px-2 py-0.5 font-mono text-[12px] uppercase tracking-wide" style={{ color: SCREEN_COLOR, backgroundColor: `${SCREEN_COLOR}1a` }} title="Coarse public-data screen: ranked, never sequenced.">
            Public-data screen
          </span>
        ) : (
          <span
            className={`rounded-sm px-2 py-0.5 font-mono text-[12px] uppercase tracking-wide ${
              rec.status === "sequenced" ? "bg-signal-green/10 text-signal-green" : "bg-signal-red/10 text-signal-red"
            }`}
          >
            {rec.status === "sequenced" ? `Gate ${rec.sequencePosition}` : "Screened out"}
          </span>
        )}
        {rec.entryWindow && <span className="font-mono text-[12px] text-paper-faint">{rec.entryWindow.label} · {rec.entryWindow.window}</span>}
      </div>

      {rec.blockers.length > 0 && (
        <Section icon={<AlertTriangle className="h-3.5 w-3.5 text-signal-amber" />} title="Blockers">
          <ul className="space-y-1">
            {rec.blockers.map((b, i) => (
              <li key={i} className="text-[14px] leading-snug text-paper-dim">
                <Gloss text={b.text} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {rec.mitigations.length > 0 && (
        <Section icon={<ShieldCheck className="h-3.5 w-3.5 text-signal-green" />} title="Mitigations">
          <ul className="space-y-1">
            {rec.mitigations.map((m, i) => (
              <li key={i} className="text-[14px] leading-snug text-paper-dim">
                <Gloss text={m.text} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(rec.assumptions.length > 0 || rec.requiresConfirmation.length > 0) && (
        <Section icon={<HelpCircle className="h-3.5 w-3.5 text-signal-red" />} title="Assumptions and open items">
          <ul className="space-y-1.5">
            {[...rec.requiresConfirmation, ...rec.assumptions].map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] leading-snug text-paper-dim">
                <SourceTag type={s.source_type} compact />
                <span><Gloss text={s.statement} /></span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactElement; title: string; children: ReactElement }): ReactElement {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        {icon}
        <span className="font-mono text-[12px] text-paper-faint">{title}</span>
      </div>
      {children}
    </div>
  );
}
