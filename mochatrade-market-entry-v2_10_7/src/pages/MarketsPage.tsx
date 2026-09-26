import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactElement } from "react";
import { useAppState } from "../state/AppState";
import { Link } from "../router";
import MarketSelector from "../components/MarketSelector";
import { PageFrame } from "./Layout";
import { Finder, useAddMarket, useDecisions } from "./shared";
import { btnPrimary } from "../components/ui/verdict";
import type { RankedMarket } from "../engine/types";

type Filter = "all" | "round1" | "round2" | "cleared";

const FILTERS: Array<{ key: Filter; label: string; test: (r: RankedMarket) => boolean }> = [
  { key: "all", label: "All", test: () => true },
  { key: "round1", label: "Round 1", test: (r) => !r.market.user_added && r.market.screen_source !== "public_data" && r.market.research_source !== "round2" },
  { key: "round2", label: "Round 2", test: (r) => r.market.research_source === "round2" },
  { key: "cleared", label: "Clears screening", test: (r) => r.market.cleared },
];

/** Markets (#/markets): search any country, then every scored market in one table with filters and compare ticks. */
export default function MarketsPage(): ReactElement {
  const { ranking, sequence, compareIds, toggleCompare, removeMarket } = useAppState();
  const decisions = useDecisions();
  const add = useAddMarket();
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => ranking.filter(FILTERS.find((f) => f.key === filter)!.test), [ranking, filter]);

  return (
    <>
      <PageFrame className="pb-32 pt-12 md:pt-16">
        <p className="text-[15px] font-bold text-coral-strong">Every country we scored</p>
        <h1 className="display-h1 mt-3 text-[52px] font-semibold text-ink md:text-[72px]">All markets</h1>
        <div className="mt-10 max-w-[560px] print:hidden">
          <Finder decisions={decisions} onScoreNew={add.open} label="Find a country" />
        </div>

        <div className="mt-16 flex flex-wrap items-end justify-between gap-6 border-t border-rule pt-10">
          <h2 className="font-display text-[30px] font-semibold leading-tight text-ink">
            {visible.length} {visible.length === 1 ? "market" : "markets"}
          </h2>
          <div role="group" aria-label="Filter markets" className="flex flex-wrap gap-2 print:hidden">
            {FILTERS.map((f) => {
              const on = f.key === filter;
              return (
                <button
                  key={f.key}
                  data-testid={`filter-${f.key}`}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={on}
                  className={`press min-h-[44px] rounded-full border-1.5 px-4 text-[15px] font-bold ${on ? "border-ink bg-ink text-white shadow-btn-quiet" : "border-rule bg-surface text-ink-2 hover:border-ink hover:text-ink"}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-8">
          <MarketSelector
            ranking={visible}
            sequence={sequence}
            decisionOf={(id) => decisions.get(id)}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
            onAddMarket={() => add.open()}
            onRemoveMarket={removeMarket}
          />
        </div>
      </PageFrame>

      {compareIds.length >= 2 &&
        createPortal(
        <div className="slide-up fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-surface/95 shadow-float backdrop-blur-sm print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <PageFrame className="flex min-h-[76px] items-center justify-between gap-4">
            <span className="min-w-0 truncate text-[16px] text-ink-2">
              {compareIds
                .map((id) => ranking.find((r) => r.market.id === id)?.market.name)
                .filter(Boolean)
                .join(", ")}
            </span>
            <Link to="#/compare" data-testid="compare-bar" className={`${btnPrimary} shrink-0`}>
              Compare {compareIds.length} markets →
            </Link>
          </PageFrame>
        </div>,
        document.body,
      )}
      {add.dialog}
    </>
  );
}
