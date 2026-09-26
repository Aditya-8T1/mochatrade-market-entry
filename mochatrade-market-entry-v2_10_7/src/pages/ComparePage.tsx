import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Search } from "lucide-react";
import { useAppState } from "../state/AppState";
import { PageFrame } from "./Layout";
import CompareView from "../components/CompareView";
import { VerdictChip } from "../components/ui/verdict";
import { foldCountryName } from "../data-provider/publicScreenProvider";

const MAX = 3;

/** Compare: the existing side-by-side view. With fewer than two markets picked, an inline picker instead of an empty table. */
export default function ComparePage(): ReactElement {
  const { engine, weights, ranking, compareIds, toggleCompare, clearCompare } = useAppState();
  const [q, setQ] = useState("");
  const enough = compareIds.length >= 2;

  const options = useMemo(() => {
    const needle = foldCountryName(q.trim());
    return ranking.filter((r) => !needle || foldCountryName(r.market.name).includes(needle));
  }, [ranking, q]);

  return (
    <PageFrame className="pb-24 pt-12 md:pt-16">
      <p className="text-[15px] font-bold text-coral-strong">Side by side</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-h1 text-[52px] font-semibold text-ink md:text-[72px]">Compare markets</h1>
        {compareIds.length > 0 && (
          <button onClick={clearCompare} className="min-h-[44px] text-[16px] font-bold text-coral-strong underline underline-offset-4 hover:text-ink print:hidden">
            Clear all
          </button>
        )}
      </div>

      {enough ? (
        <div className="mt-12">
          <CompareView engine={engine} weights={weights} ids={compareIds} onRemove={toggleCompare} />
        </div>
      ) : (
        <section data-testid="compare-picker" className="mt-10 max-w-[760px]">
          {compareIds.length === 0 ? (
            <p data-testid="compare-empty" className="text-[20px] leading-relaxed text-ink-2">
              Pick two or three markets to see them side by side.
            </p>
          ) : (
            <p className="text-[20px] leading-relaxed text-ink-2">Pick one more market to compare.</p>
          )}
          <label className="mt-8 block">
            <span className="block text-[17px] font-bold text-ink">Find a market</span>
            <span className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Brazil" data-testid="compare-picker-search" className="min-h-[54px] w-full rounded-btn border-1.5 border-rule bg-surface py-3 pl-12 pr-4 text-[17px] text-ink outline-none placeholder:text-muted transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-lift" />
            </span>
          </label>
          <ul className="mt-4 max-h-[440px] overflow-y-auto rounded-card border-1.5 border-rule bg-surface shadow-card">
            {options.map((r) => {
              const d = engine.getDecision(r.market.id, weights);
              const on = compareIds.includes(r.market.id);
              return (
                <li key={r.market.id} className="border-b border-rule last:border-b-0">
                  <label className="press flex min-h-[56px] cursor-pointer items-center gap-4 px-4 py-2 hover:bg-surface-2 active:bg-rule/60">
                    <input type="checkbox" checked={on} disabled={!on && compareIds.length >= MAX} onChange={() => toggleCompare(r.market.id)} data-testid={`picker-${r.market.id}`} className="h-[18px] w-[18px] accent-coral-strong" />
                    <span className="min-w-0 flex-1 truncate font-display text-[19px] font-semibold text-ink">{r.market.name}</span>
                    {d && <VerdictChip verdict={d.verdict} label={d.verdictLabel} />}
                  </label>
                </li>
              );
            })}
            {options.length === 0 && <li className="px-4 py-4 text-[17px] text-muted">No market matches “{q}”.</li>}
          </ul>
        </section>
      )}
    </PageFrame>
  );
}
