import type { ReactElement } from "react";
import { ExternalLink } from "lucide-react";
import type { Market } from "../engine/types";
import Gloss from "./ui/Glossary";

/** Colour for the workbook's evidence tags, so [A] (assumption) stands out from [V] (verified). */
const TAG_STYLE: Record<string, string> = {
  V: "text-now",
  A: "text-later",
  D: "text-next",
};

/** Renders text with its [V] / [V-secondary] / [A - LIMITED EVIDENCE] / [D] tags coloured. */
function Tagged({ text }: { text: string }): ReactElement {
  const parts = text.split(/(\[(?:V|A|D)(?:[^\]]*)\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[(V|A|D)/.exec(p);
        // [V-draft] is a draft rule not in force: amber like [A], not verified green.
        const style = m && /^\[V-draft/i.test(p) ? TAG_STYLE.A : m ? TAG_STYLE[m[1]] : "";
        return m ? (
          <span key={i} className={`text-[14px] font-bold ${style}`}>
            {p}
          </span>
        ) : (
          <Gloss key={i} text={p} />
        );
      })}
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const ROWS: Array<[keyof NonNullable<Market["research"]>, string]> = [
  ["capital_and_licensing", "Capital & licensing"],
  ["payment_rail", "Payment rail"],
  ["kyc_aml", "KYC / AML"],
  ["product_changes", "Product changes"],
  ["regulatory_basis", "Regulatory basis"],
];

/**
 * Round 2 research for the selected market: researched adaptation / execution,
 * licensing, rail, KYC, product notes, open flags and sources. Shown for Round 2
 * markets and for the six Round 1 screened-out markets (next to the deck text,
 * never replacing it). Renders nothing when the market has no research.
 */
export default function ResearchNotes({ market }: { market: Market }): ReactElement | null {
  const r = market.research;
  if (!r) return null;
  const round2 = market.research_source === "round2";
  return (
    <div data-testid="research-notes" className="space-y-3 text-[17px] leading-relaxed text-ink-2">
      <p className="text-[15px] text-muted">
        {round2
          ? `Round 2 research${market.research_list === "reserve" ? " · screened-out reserve" : ""} — not in the Round 1 deck. `
          : "Round 2 research on a Round 1 market — the deck's scores and text are unchanged. "}
        Tags: <span className="text-now">[V]</span> or <span className="text-now">[V-primary]</span> verified against a primary source, <span className="text-now">[V-secondary]</span> or <span className="text-now">[V-news]</span> verified via a law-firm, news or other secondary source,{" "}
        <span className="text-later">[V-draft]</span> a draft rule not in force, <span className="text-later">[A]</span> assumption or limited evidence,{" "}
        <span className="text-next">[D]</span> derived by the researcher.
      </p>

      {r.reserve_reason && (
        <p data-testid="research-reserve-reason">
          <span className="mr-1 text-[14px] text-muted">Why screened out</span>
          <Tagged text={r.reserve_reason} />
        </p>
      )}

      {(r.adaptation_cost != null || r.execution_dependency != null) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {r.adaptation_cost != null && (
            <div data-testid="research-adaptation" className="border border-rule px-3 py-2">
              <div className="text-[14px] text-muted">Adaptation cost</div>
              <div className="font-display text-lg text-ink">{r.adaptation_cost}/5</div>
              {r.adaptation_rationale && <div className="text-[15px] leading-snug"><Tagged text={r.adaptation_rationale} /></div>}
            </div>
          )}
          {r.execution_dependency != null && (
            <div data-testid="research-execution" className="border border-rule px-3 py-2">
              <div className="text-[14px] text-muted">Execution dependency</div>
              <div className="font-display text-lg text-ink">{r.execution_dependency}/5</div>
              {r.execution_rationale && <div className="text-[15px] leading-snug"><Tagged text={r.execution_rationale} /></div>}
            </div>
          )}
        </div>
      )}

      <dl className="space-y-2">
        {ROWS.filter(([k]) => r[k]).map(([k, label]) => (
          <div key={k} className="grid gap-x-3 sm:grid-cols-[150px_1fr]">
            <dt className="text-[14px] text-muted">{label}</dt>
            <dd><Tagged text={String(r[k])} /></dd>
          </div>
        ))}
      </dl>

      {r.flags && (
        <p data-testid="research-flags" className="rounded-card bg-later-tint px-5 py-4">
          <span className="mr-1 text-[14px] text-later">Open flags</span>
          <Tagged text={r.flags} />
        </p>
      )}
      {r.deck_check && (
        <p data-testid="research-deck-check" className="rounded-card bg-next-tint px-5 py-4">
          <span className="mr-1 text-[14px] font-bold text-next">Check vs Round 1 deck</span>
          <Tagged text={r.deck_check} />
        </p>
      )}

      {r.sources && r.sources.length > 0 && (
        <div data-testid="research-sources">
          <div className="mb-1 text-[14px] text-muted">Sources ({r.sources.length})</div>
          <ul className="flex flex-wrap gap-1.5">
            {r.sources.map((u) => (
              <li key={u}>
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={u}
                  className="inline-flex items-center gap-1 rounded-chip border border-rule px-1.5 py-0.5 text-[14px] text-ink-2 hover:border-ink hover:text-ink"
                >
                  {hostOf(u)} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
