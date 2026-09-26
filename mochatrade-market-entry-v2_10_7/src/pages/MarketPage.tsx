import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { useAppState } from "../state/AppState";
import { Link, marketHref, navigate } from "../router";
import { PageFrame } from "./Layout";
import DecisionCard, { RiskScoreCard, verdictColor } from "../components/DecisionCard";
import RecommendationSummary from "../components/RecommendationSummary";
import ScoreCard, { scoreMatchLine } from "../components/ScoreCard";
import RiskPanel from "../components/RiskPanel";
import ComplianceChecklist from "../components/ComplianceChecklist";
import GoGateTimeline from "../components/GoGateTimeline";
import ResearchNotes from "../components/ResearchNotes";
import Gloss from "../components/ui/Glossary";
import Flag from "../components/ui/Flag";
import SourceTag from "../components/ui/SourceTag";
import { OutlineChip, VerdictChip, btnPrimary, btnSecondary, cardCls } from "../components/ui/verdict";
import { downloadBrief } from "../export/brief";
import { formatScore } from "../engine";
import type { Market } from "../engine/types";

export const TABS = ["decision", "scores", "risks", "readiness", "research"] as const;
export type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  decision: "The decision",
  scores: "How it scores",
  risks: "Risks",
  readiness: "Readiness",
  research: "Research notes",
};

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function tabsFor(market: Market): Tab[] {
  return TABS.filter((t) => t !== "research" || !!market.research);
}

export function NotFound({ what = "that market" }: { what?: string }): ReactElement {
  return (
    <PageFrame className="py-24">
      <div data-testid="market-not-found" className="max-w-[40em]">
        <h1 className="display-h1 text-[56px] font-semibold text-ink md:text-[72px]">We couldn't find {what}.</h1>
        <p className="mt-6 text-[20px] leading-relaxed text-ink-2">The link may be old, or a market you added in this browser has since been removed.</p>
        <Link to="#/plan" className={`${btnPrimary} mt-10`}>
          Back to the plan
        </Link>
      </div>
    </PageFrame>
  );
}

export default function MarketPage({ id, tab: requestedTab }: { id: string; tab?: string }): ReactElement {
  const { engine, weights, ranking, sequence, compareIds, toggleCompare } = useAppState();

  const market = useMemo(() => engine.getMarket(id), [engine, id]);
  const rec = useMemo(() => engine.getMarketRecommendation(id, weights), [engine, id, weights]);
  const decision = useMemo(() => engine.getDecision(id, weights), [engine, id, weights]);
  const risks = useMemo(() => engine.getRisksForMarket(id), [engine, id]);
  const divergence = useMemo(() => (market ? engine.explainDivergence(id, weights) : undefined), [engine, id, weights, market]);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  // Sliding underline: measure the active tab and move one indicator to it.
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const activeTabKey = `${id}/${requestedTab ?? ""}`;
  useLayoutEffect(() => {
    const measure = () => {
      const el = Object.values(tabRefs.current).find((t) => t?.getAttribute("aria-selected") === "true");
      if (el && el.offsetWidth) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [activeTabKey]);

  if (!market || !rec || !decision) return <NotFound />;

  const tabs = tabsFor(market);
  const tab: Tab = (tabs as string[]).includes(requestedTab ?? "") ? (requestedTab as Tab) : "decision";
  const screen = market.screen_source === "public_data";
  const round2 = market.research_source === "round2";
  const seq = sequence.find((s) => s.market.id === id);
  const idx = ranking.findIndex((r) => r.market.id === id);
  const prev = idx > 0 ? ranking[idx - 1].market : null;
  const next = idx >= 0 && idx < ranking.length - 1 ? ranking[idx + 1].market : null;
  const compared = compareIds.includes(id);
  const match = scoreMatchLine(rec, { userAdded: !!market.user_added, screen, round2 });

  const onTabKey = (e: KeyboardEvent<HTMLAnchorElement>, i: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const jump = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (!dir && jump === null) return;
    e.preventDefault();
    const to = jump ?? (i + dir + tabs.length) % tabs.length;
    navigate(marketHref(id, tabs[to]));
    tabRefs.current[tabs[to]]?.focus();
  };

  return (
    <PageFrame className="pb-24 pt-8 md:pt-12">
      <Link to="#/markets" className="press group inline-flex min-h-[44px] items-center gap-2 text-[16px] font-bold text-ink-2 hover:text-ink print:hidden">
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true" /> All markets
      </Link>

      <header data-testid="market-header" className="mt-6">
        <div className="flex flex-wrap items-center gap-4">
          <Flag market={market} className="h-9 w-12" />
          {seq && (
            <span aria-hidden="true" className="font-display text-[56px] font-light leading-none tabular" style={{ color: verdictColor(decision.verdict) }}>
              {String(seq.sequenceRank).padStart(2, "0")}
            </span>
          )}
          <VerdictChip verdict={decision.verdict} label={decision.verdictLabel} window={decision.window} />
        </div>
        <h1 className="display-h1 mt-5 break-words text-[56px] font-semibold text-ink sm:text-[72px] xl:text-[96px]">{market.name}</h1>
        {(round2 || screen || market.user_added) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {round2 && <OutlineChip testId="round2-badge">R2 research</OutlineChip>}
            {screen && <OutlineChip title="Coarse public-data screen, not researched">screen</OutlineChip>}
            {market.user_added && <OutlineChip>your entry</OutlineChip>}
          </div>
        )}
        <p data-testid="entry-approach" className="mt-6 max-w-[30em] font-display text-[24px] font-light leading-snug text-ink md:text-[28px]">
          <Gloss text={decision.entryApproach} />{" "}
          <span className="inline-block align-middle">
            <SourceTag type={decision.entryApproachSource} compact />
          </span>
        </p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
        <div className="min-w-0">
          <div role="tablist" aria-label={`${market.name} sections`} className="no-scrollbar relative -mx-5 flex gap-8 overflow-x-auto border-b border-rule px-5 md:mx-0 md:px-0 print:hidden">
            {tabs.map((t, i) => {
              const on = t === tab;
              return (
                <Link
                  key={t}
                  ref={(el) => {
                    tabRefs.current[t] = el;
                  }}
                  to={marketHref(id, t)}
                  role="tab"
                  id={`tab-${t}`}
                  data-testid={`tab-${t}`}
                  aria-selected={on}
                  aria-controls={`panel-${t}`}
                  tabIndex={on ? 0 : -1}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={`press relative flex min-h-[52px] shrink-0 items-center whitespace-nowrap text-[16px] font-bold ${on ? "text-ink" : "text-muted hover:text-ink"}`}
                >
                  {TAB_LABEL[t]}
                  {on && !indicator && <span aria-hidden="true" className="absolute inset-x-0 bottom-[-1px] h-[2px] bg-coral" />}
                </Link>
              );
            })}
            {indicator && <span aria-hidden="true" className="tab-indicator absolute bottom-0 left-0 h-[2px] bg-coral" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }} />}
          </div>

          <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="fade-in pt-10 focus-visible:outline-offset-8">
            {tab === "decision" && (
              <div className="space-y-12">
                <DecisionCard decision={decision} market={market} />
                <section className="border-t border-rule pt-8">
                  <RecommendationSummary rec={rec} screen={screen} round2Shortlist={round2 && market.cleared} alreadyListed={decision.whyNotNow ? [...decision.conditions, market.screened_out_reason ?? ""] : decision.conditions} />
                </section>
              </div>
            )}
            {tab === "scores" && (
              <div className="space-y-12">
                <ScoreCard rec={rec} userAdded={!!market.user_added} screen={screen} round2={round2} />
                {divergence?.explanation && (
                  <section data-testid="market-divergence" className="border-t border-rule pt-8">
                    <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">Score versus order</h2>
                    <p className="mt-3 max-w-[68ch] text-[17px] leading-relaxed text-ink-2">
                      <Gloss text={divergence.explanation} />
                    </p>
                    <Link to="#/method#order" className="link mt-3 inline-block text-[16px] font-bold">
                      See the whole order explained
                    </Link>
                  </section>
                )}
              </div>
            )}
            {tab === "risks" && (
              <section>
                <h2 className="mb-6 font-display text-[30px] font-semibold leading-tight text-ink">What could go wrong</h2>
                <RiskPanel risks={risks} market={market} />
              </section>
            )}
            {tab === "readiness" && (
              <div className="space-y-12">
                <section>
                  <h2 className="mb-6 font-display text-[30px] font-semibold leading-tight text-ink">Can we actually ship?</h2>
                  <ComplianceChecklist market={market} goGates={rec.goGates} />
                </section>
                {seq && (
                  <section className="border-t border-rule pt-8">
                    <h2 className="mb-6 font-display text-[30px] font-semibold leading-tight text-ink">Its slot in the 18-month plan</h2>
                    <GoGateTimeline sequence={[seq]} />
                  </section>
                )}
              </div>
            )}
            {tab === "research" && market.research && (
              <section>
                <h2 className="mb-6 font-display text-[30px] font-semibold leading-tight text-ink">What the Round 2 research found</h2>
                <ResearchNotes market={market} />
              </section>
            )}
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start" aria-label={`${market.name} at a glance`}>
          <div className={`${cardCls} p-7 print-plain`}>
            <RiskScoreCard decision={decision} market={market} />
          </div>
          <div data-testid="score-summary" className={`${cardCls} p-7 print-plain`}>
            <h2 className="text-[15px] font-bold text-ink-2">Score</h2>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-[52px] font-semibold leading-none tabular text-ink">{formatScore(rec.score.weightedScore)}</span>
              <span className="text-[17px] text-muted">/ 5</span>
            </div>
            <p className="mt-2 text-[16px] text-ink">
              {ordinal(rec.rawRank)} of {ranking.length}
            </p>
            <p className="mt-1 text-[15px]" style={{ color: match.color }}>
              {match.text}
            </p>
          </div>
          <div className="space-y-3 print:hidden">
            <button
              data-testid="export-brief"
              onClick={() => downloadBrief(market, decision, rec, risks)}
              title="Download this market's decision, conditions, product changes and risks as a Markdown brief"
              className={`${btnPrimary} w-full`}
            >
              <Download className="h-5 w-5" aria-hidden="true" /> Download the brief
            </button>
            <button data-testid="toggle-compare" onClick={() => toggleCompare(id)} aria-pressed={compared} className={`${btnSecondary} w-full`}>
              {compared ? "Remove from compare" : "Add to compare"}
            </button>
            {compareIds.length >= 2 && (
              <Link to="#/compare" className="link block text-center text-[16px] font-bold">
                Compare {compareIds.length} markets
              </Link>
            )}
          </div>
        </aside>
      </div>

      <nav aria-label="Other markets" className="mt-20 flex flex-wrap justify-between gap-4 border-t border-rule pt-8 print:hidden">
        {prev ? (
          <Link to={marketHref(prev.id)} data-testid="prev-market" className="row-card group -mx-4 flex min-h-[44px] flex-col px-4 py-3">
            <span className="flex items-center gap-1.5 text-[15px] font-bold text-muted">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> previous market
            </span>
            <span className="font-display text-[24px] font-semibold text-ink group-hover:text-coral-strong">{prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={marketHref(next.id)} data-testid="next-market" className="row-card group -mx-4 flex min-h-[44px] flex-col px-4 py-3 text-right">
            <span className="flex items-center justify-end gap-1.5 text-[15px] font-bold text-muted">
              next market <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-[24px] font-semibold text-ink group-hover:text-coral-strong">{next.name}</span>
          </Link>
        )}
      </nav>
    </PageFrame>
  );
}
