import type { ReactElement, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useAppState } from "../state/AppState";
import { Link, marketHref } from "../router";
import { PageFrame } from "./Layout";
import { Finder, useAddMarket, useDecisions } from "./shared";
import { VERDICT_STYLE, VerdictChip, btnPrimary, btnSecondary } from "../components/ui/verdict";

/** "A", "A and B", "A, B and C" -- joins names for the headline without hardcoding any of them. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The plan (#/plan): the answer in about five seconds. The headline, the
 * ordered plan and a way into any other market. No scorecards, risks,
 * checklists or weights -- those live on each market's page and on
 * "How we decided".
 */
export default function PlanPage(): ReactElement {
  const { ranking, sequence, fullRecommendation } = useAppState();
  const decisions = useDecisions();
  const add = useAddMarket();

  const first = sequence[0];
  const firstDecision = first ? decisions.get(first.market.id) : undefined;
  const rest = sequence.slice(1).map((s) => s.market.name);

  let headline: ReactNode = "No market clears the plan yet.";
  if (first) {
    const hlClass = firstDecision?.verdict === "go_now" ? "hl hl-now" : "hl";
    headline = (
      <>
        <span className={hlClass}>{first.market.name}</span> first{rest.length ? `, then ${joinNames(rest)}` : ""}.
      </>
    );
  }

  return (
    <>
      <PageFrame className="pb-24 pt-12 md:pt-20">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <p className="text-[15px] font-bold text-coral-strong">Where should MochaTrade go next?</p>
            <h1 data-testid="home-headline" className="display-h1 mt-5 text-[52px] font-semibold text-ink sm:text-[68px] xl:text-[84px]">
              {headline}
            </h1>
            <p className="mt-8 max-w-[34em] text-[20px] leading-relaxed text-ink-2">
              We scored {ranking.length} countries on the same five questions. {sequence.length} made the plan, and the order is about how fast we can launch safely, not just who scores best.
            </p>
            <div className="mt-10 flex flex-wrap gap-4 print:hidden">
              {first && (
                <Link to={marketHref(first.market.id)} data-testid="open-first" className={btnPrimary}>
                  Open {first.market.name}
                </Link>
              )}
              <Link to="#/method#order" className={btnSecondary}>
                {fullRecommendation.scoreOrderMatchesSequence ? "How we set the order" : "Why isn't the top scorer first?"}
              </Link>
            </div>
          </div>

          <div>
            <h2 className="sr-only">The plan, in order</h2>
            <ol data-testid="home-plan" className="border-t border-rule">
              {sequence.map((s) => {
                const d = decisions.get(s.market.id);
                const color = d ? VERDICT_STYLE[d.verdict].text : undefined;
                return (
                  <li key={s.market.id} className="border-b border-rule">
                    <Link to={marketHref(s.market.id)} data-testid={`plan-row-${s.market.id}`} className="row-card group -mx-4 grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-6 sm:grid-cols-[96px_minmax(0,1fr)_auto]">
                      <span aria-hidden="true" className="font-display text-[56px] font-light leading-[0.9] tabular sm:text-[72px]" style={{ color }}>
                        {String(s.sequenceRank).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="sr-only">Number {s.sequenceRank}: </span>
                        <span className="block font-display text-[28px] font-semibold leading-tight text-ink group-hover:text-coral-strong sm:text-[34px]">{s.market.name}</span>
                        {d && (
                          <span className="mt-1 block truncate text-[17px] text-ink-2" title={d.entryApproach}>
                            {d.entryApproach}
                          </span>
                        )}
                        {d && <VerdictChip verdict={d.verdict} label={d.verdictLabel} window={d.window} className="mt-3" />}
                      </span>
                      <ArrowRight className="row-arrow mt-3 h-5 w-5 text-muted group-hover:text-coral-strong" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ol>
            <div className="mt-10 print:hidden">
              <Finder decisions={decisions} onScoreNew={add.open} />
              <Link to="#/markets" className="link mt-5 inline-block text-[16px] font-bold">
                See all {ranking.length} markets
              </Link>
            </div>
          </div>
        </div>
      </PageFrame>
      {add.dialog}
    </>
  );
}
