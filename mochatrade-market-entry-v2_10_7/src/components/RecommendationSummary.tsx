import type { ReactElement } from "react";
import { AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";
import type { MarketRecommendation } from "../engine/types";
import SourceTag from "./ui/SourceTag";
import Gloss from "./ui/Glossary";
import { SCREEN_COLOR } from "./ui/dimensionColors";

/**
 * Engine assumption fields that describe the method rather than the market:
 * where Round 2 data comes from, the regulatory knock-out rule, and the
 * sequencing formula. The engine attaches them to every market they apply to;
 * the UI shows them as footnotes instead of "still to confirm".
 */
export const METHOD_FIELDS = new Set(["round2_research", "knockout_rule", "sequencing_formula"]);

/**
 * Engine fields that explain how a number was derived (adaptation cost and
 * execution dependency from entry facts), and notes about the evidence
 * itself (Round 1's limited-evidence marker, Round 2's check against the
 * deck). None is an action for the team, so they are shown under "About this
 * data", not "What we still need to confirm".
 */
export const DERIVED_FIELDS = new Set(["adaptation_cost", "execution_dependency", "evidence_confidence", "research.deck_check"]);

const norm = (s: string) => s.trim().toLowerCase().replace(/[.\s]+$/, "");

/** Synthesized recommendation card: the "so what" for the selected market -- status, blockers, and what still needs confirming before it's demo-safe to state as fact. */
export default function RecommendationSummary({
  rec,
  screen = false,
  round2Shortlist = false,
  alreadyListed = [],
}: {
  rec: MarketRecommendation;
  screen?: boolean;
  round2Shortlist?: boolean;
  /** Texts already shown above (the decision card's conditions); blockers that repeat them are not shown twice. */
  alreadyListed?: readonly string[];
}): ReactElement {
  // General method notes (same text on every market they apply to) are not
  // open questions about THIS market, so they go in "About this data".
  const openItems = [...rec.requiresConfirmation, ...rec.assumptions.filter((s) => !METHOD_FIELDS.has(s.field) && !DERIVED_FIELDS.has(s.field))];
  const methodNotes = rec.assumptions.filter((s) => METHOD_FIELDS.has(s.field) || DERIVED_FIELDS.has(s.field));
  const listed = new Set(alreadyListed.map(norm));
  const blockers = rec.blockers.filter((b) => !listed.has(norm(b.text)));

  return (
    <div data-testid="recommendation-summary" data-market-id={rec.marketId} data-status={rec.status} className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        {screen ? (
          <span className="rounded-chip bg-short-tint px-2.5 py-1 text-[14px] font-bold" style={{ color: SCREEN_COLOR }} title="Coarse public-data screen: ranked, never sequenced.">
            Public-data screen
          </span>
        ) : round2Shortlist ? (
          <span data-testid="round2-shortlist-badge" className="rounded-chip bg-short-tint px-2.5 py-1 text-[14px] font-bold text-short" title="Round 2 research: clears screening, ranked but not sequenced until its entry route, timing and go-gates are defined.">
            Round 2 shortlist
          </span>
        ) : (
          <span
            className={`rounded-chip px-2.5 py-1 text-[14px] font-bold ${
              rec.status === "sequenced" ? "bg-now-tint text-now" : "bg-no-tint text-no"
            }`}
          >
            {rec.status === "sequenced" ? `Gate ${rec.sequencePosition}` : "Screened out"}
          </span>
        )}
        {rec.entryWindow && <span className="text-[15px] text-muted">{rec.entryWindow.label} · {rec.entryWindow.window}</span>}
      </div>

      {blockers.length > 0 && (
        <Section icon={<AlertTriangle className="h-5 w-5 text-later" aria-hidden="true" />} title="What could block us">
          <ul className="max-w-[72ch] space-y-2">
            {blockers.map((b, i) => (
              <li key={i} className="text-[17px] leading-relaxed text-ink-2">
                <Gloss text={b.text} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {rec.mitigations.length > 0 && (
        <Section icon={<ShieldCheck className="h-5 w-5 text-now" aria-hidden="true" />} title="How we reduce the risk">
          <ul className="max-w-[72ch] space-y-2">
            {rec.mitigations.map((m, i) => (
              <li key={i} className="text-[17px] leading-relaxed text-ink-2">
                <Gloss text={m.text} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {openItems.length > 0 && (
        <Section icon={<HelpCircle className="h-5 w-5 text-no" aria-hidden="true" />} title="What we still need to confirm">
          <ul data-testid="open-items" className="max-w-[72ch] space-y-2.5">
            {openItems.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[17px] leading-relaxed text-ink-2">
                <SourceTag type={s.source_type} compact />
                <span><Gloss text={s.statement} /></span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {methodNotes.length > 0 && (
        <section data-testid="method-notes" className="border-t border-rule pt-6">
          <h3 className="text-[15px] font-bold text-ink-2">About this data</h3>
          <ul className="mt-2 max-w-[72ch] space-y-2">
            {methodNotes.map((s) => (
              <li key={s.field} className="text-[15px] leading-relaxed text-muted">
                <span className="font-bold text-ink-2">{s.label}. </span>
                <Gloss text={s.statement} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactElement; title: string; children: ReactElement }): ReactElement {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2.5 font-display text-[24px] font-semibold text-ink">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}
