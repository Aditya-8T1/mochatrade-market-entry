import { Fragment, type MouseEvent, type ReactElement } from "react";
import { marketQueueGroups } from "./marketQueue";
import { formatScore } from "../engine";
import { Plus, Trash2 } from "lucide-react";
import type { Decision, RankedMarket, SequencedMarket } from "../engine/types";
import Gloss from "./ui/Glossary";
import { Link, marketHref, navigate } from "../router";
import { RISK_BAND, VerdictChip } from "./ui/verdict";

interface MarketSelectorProps {
  ranking: RankedMarket[]; // markets to list, sorted by raw rank (highest score first)
  sequence: SequencedMarket[]; // cleared markets, sorted by recommended entry order
  /** Engine decision per market (verdict + regulatory risk) for the table's chips. */
  decisionOf: (id: string) => Decision | undefined;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onAddMarket: () => void;
  onRemoveMarket: (id: string) => void;
}

/**
 * Every market as one table, ordered by raw screening score within each
 * group (Round 1, then Round 2 research, then anything added in this tool).
 * A market in the entry plan shows its plan number next to its rank, so the
 * score-vs-order gap is visible before anything is opened. Clicking a row
 * opens the market's page; the name is the real link.
 */
export default function MarketSelector({ ranking, sequence, decisionOf, compareIds, onToggleCompare, onAddMarket, onRemoveMarket }: MarketSelectorProps): ReactElement {
  const seqRankById = new Map(sequence.map((s) => [s.market.id, s.sequenceRank]));
  const { core, round2, added, ordered } = marketQueueGroups(ranking);

  const rowClick = (id: string) => (e: MouseEvent<HTMLTableRowElement>) => {
    // Let the checkbox, link and remove button do their own thing.
    if ((e.target as HTMLElement).closest("a,button,input,label")) return;
    navigate(marketHref(id));
  };

  const divider = (testId: string, text: string) => (
    <tr data-testid={testId}>
      <th colSpan={8} scope="colgroup" className="border-b border-rule pb-3 pt-10 text-left font-display text-[24px] font-semibold text-ink">
        {text}
      </th>
    </tr>
  );

  return (
    <div data-testid="market-selector">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-muted">Sorted by screening score. Tick up to three to compare.</p>
        <button data-testid="open-add-market" onClick={onAddMarket} className="press lift inline-flex min-h-[44px] items-center gap-1.5 rounded-btn border-1.5 border-ink bg-surface px-4 text-[15px] font-bold text-ink shadow-btn-quiet hover:shadow-lift" title="Score a country that was not part of the Round 1 screen">
          <Plus className="h-4 w-4" aria-hidden="true" /> Score a new market
        </button>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[16px]">
          <thead>
            <tr className="border-b-1.5 border-ink text-left text-[14px] font-bold text-muted">
              <th scope="col" className="w-10 py-3 pr-2"><span className="sr-only">Compare</span></th>
              <th scope="col" className="w-14 py-3 pr-3 tabular">Rank</th>
              <th scope="col" className="py-3 pr-4">Market</th>
              <th scope="col" className="py-3 pr-4 text-right">Score</th>
              <th scope="col" className="py-3 pr-4">Verdict</th>
              <th scope="col" className="hidden py-3 pr-4 lg:table-cell">Reg. risk</th>
              <th scope="col" className="hidden py-3 xl:table-cell">Signal</th>
              <th scope="col" className="w-12"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r, idx) => {
              const market = r.market;
              const gate = seqRankById.get(market.id);
              const compared = compareIds.includes(market.id);
              const d = decisionOf(market.id);
              const removable = market.user_added || market.screen_source === "public_data";
              const screen = market.screen_source === "public_data";
              return (
                <Fragment key={market.id}>
                  {idx === core.length && round2.length > 0 && divider("round2-markets-divider", `Round 2 research · ${round2.length} markets · ranked, not sequenced`)}
                  {idx === core.length + round2.length && added.length > 0 && divider("added-markets-divider", "Added in this tool · not researched in Round 1")}
                  <tr onClick={rowClick(market.id)} className="group cursor-pointer border-b border-rule align-middle transition-colors duration-150 hover:bg-surface-2 active:bg-rule/60">
                    <td className="py-3 pr-2">
                      <label className="flex h-11 w-9 cursor-pointer items-center justify-center" title="Compare this market">
                        <input type="checkbox" data-testid={`compare-${market.id}`} checked={compared} onChange={() => onToggleCompare(market.id)} aria-label={`Compare ${market.name}`} className="h-[18px] w-[18px] accent-coral-strong" />
                      </label>
                    </td>
                    <td className="py-3 pr-3 tabular text-ink-2">
                      {r.rawRank}
                      {gate && (
                        <span className="block whitespace-nowrap text-[13px] font-bold leading-tight text-now" title={`Number ${gate} in the entry plan`}>
                          plan {gate}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <Link to={marketHref(market.id)} data-testid={`market-${market.id}`} className="font-display text-[20px] font-semibold text-ink underline-offset-4 hover:text-coral-strong hover:underline">
                        {market.name}
                      </Link>
                      {(market.user_added || screen) && (
                        <span className="ml-2 text-[14px] font-bold">
                          {market.user_added && <span className="text-plum">your entry</span>}
                          {screen && (
                            <span data-testid={`screen-tag-${market.id}`} className="text-short">
                              screen
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className={`py-3 pr-4 text-right tabular ${market.cleared ? "text-ink" : "text-muted"}`}>{formatScore(r.screening.weightedScore)}</td>
                    <td className="py-3 pr-4">{d && <VerdictChip verdict={d.verdict} label={d.verdictLabel} />}</td>
                    <td className="hidden py-3 pr-4 tabular lg:table-cell">
                      {d &&
                        (screen ? (
                          <span className="text-muted">{d.risk.riskScore100} · indicative</span>
                        ) : (
                          <span style={{ color: RISK_BAND[d.risk.band].color }}>
                            {d.risk.riskScore100} · {RISK_BAND[d.risk.band].label.toLowerCase()}
                          </span>
                        ))}
                    </td>
                    <td className="hidden max-w-[360px] py-3 xl:table-cell">
                      <span className="flex items-center gap-2">
                        <span className="block min-w-0 flex-1 truncate text-[15px] text-ink-2">
                          <Gloss text={market.cleared || market.research_source === "round2" ? market.market_signal : market.screened_out_reason ?? ""} />
                        </span>
                      </span>
                    </td>
                    <td className="py-3 pl-2">
                      {removable && (
                        <button onClick={() => onRemoveMarket(market.id)} aria-label={`Remove ${market.name}`} title="Remove this market" className="press flex h-11 w-11 items-center justify-center rounded-btn text-muted hover:bg-no-tint hover:text-no">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
