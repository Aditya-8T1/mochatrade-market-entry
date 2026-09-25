import { Fragment, type ReactElement } from "react";
import { formatScore } from "../engine";
import { Plus, Trash2 } from "lucide-react";
import type { RankedMarket, SequencedMarket } from "../engine/types";
import Gloss from "./ui/Glossary";
import { SCREEN_COLOR } from "./ui/dimensionColors";

interface MarketSelectorProps {
  ranking: RankedMarket[]; // all markets, sorted by raw rank (highest score first)
  sequence: SequencedMarket[]; // cleared markets, sorted by recommended entry order
  selectedId: string;
  onSelect: (id: string) => void;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onAddMarket: () => void;
  onRemoveMarket: (id: string) => void;
}

/**
 * The market queue. Ordered by raw screening score (so it reads as a
 * leaderboard); cleared markets additionally carry their sequence gate
 * number so the raw-vs-sequence divergence is visible before a market is
 * even opened -- Dubai sits lower in this list than Brazil, but wears gate
 * "01".
 */
export default function MarketSelector({ ranking, sequence, selectedId, onSelect, compareIds, onToggleCompare, onAddMarket, onRemoveMarket }: MarketSelectorProps): ReactElement {
  const seqRankById = new Map(sequence.map((s) => [s.market.id, s.sequenceRank]));
  // The nine Round 1 markets first; anything added in the tool (public-data
  // screens, user entries) goes below a divider so it never reads as part of
  // the researched shortlist.
  const isAdded = (r: RankedMarket) => !!r.market.user_added || r.market.screen_source === "public_data";
  const core = ranking.filter((r) => !isAdded(r));
  const added = ranking.filter(isAdded);
  const ordered = [...core, ...added];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-[12px] text-paper-dim">
          Markets <span className="text-paper-faint">({ranking.length})</span>
        </span>
        <button
          data-testid="open-add-market"
          onClick={onAddMarket}
          className="flex items-center gap-1 rounded-sm border border-signal-cyan/50 px-2 py-1 font-mono text-[12px] text-signal-cyan hover:bg-signal-cyan/10"
          title="Score a country that was not part of the Round 1 screen"
        >
          <Plus className="h-3 w-3" /> New market
        </button>
      </div>
      <div className="border-b border-line-soft px-4 py-1.5 text-[12px] leading-snug text-paper-faint">Sorted by screening score. Green number = position in the recommended entry order. Tick boxes to compare.</div>
      <div className="flex-1 overflow-y-auto">
        {ordered.map((r, idx) => {
          const market = r.market;
          const active = market.id === selectedId;
          const gate = seqRankById.get(market.id);
          const cleared = market.cleared;
          const compared = compareIds.includes(market.id);

          return (
            <Fragment key={market.id}>
            {idx === core.length && added.length > 0 && (
              <div data-testid="added-markets-divider" className="border-b border-line-soft bg-white/[0.02] px-4 py-1.5 font-mono text-[11px] uppercase tracking-wide text-paper-faint">
                Added in this tool · not researched in Round 1
              </div>
            )}
            <div className={`group relative flex items-stretch border-b border-line-soft ${active ? "bg-signal-cyan/[0.07]" : "hover:bg-white/[0.02]"}`}>
              <label className="flex cursor-pointer items-center pl-3" title="Compare this market">
                <input
                  type="checkbox"
                  data-testid={`compare-${market.id}`}
                  checked={compared}
                  onChange={() => onToggleCompare(market.id)}
                  aria-label={`Compare ${market.name}`}
                  className="h-3.5 w-3.5 accent-signal-cyan"
                />
              </label>
            <button
              data-testid={`market-${market.id}`}
              onClick={() => onSelect(market.id)}
              aria-pressed={active}
              className="relative flex min-w-0 flex-1 items-start gap-3 py-3 pl-3 pr-4 text-left transition-colors"
            >
              <span
                className={`absolute left-0 top-0 h-full w-[3px] ${
                  active ? "bg-signal-cyan" : gate ? "bg-signal-green/60" : "bg-transparent"
                }`}
              />
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular ${
                  gate
                    ? "border-signal-green/50 bg-signal-green/10 text-signal-green"
                    : cleared
                    ? "border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan"
                    : "border-line-strong text-paper-faint"
                }`}
                title={gate ? `Entry gate ${gate}` : cleared ? "Cleared" : "Screened out"}
              >
                {gate ? String(gate).padStart(2, "0") : cleared ? "\u2713" : "\u2013"}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate font-display text-sm font-medium ${cleared ? "text-paper" : "text-paper-dim"}`}>
                    {market.name}
                  </span>
                  <span className={`shrink-0 font-mono text-xs tabular ${cleared ? "text-paper-dim" : "text-paper-faint"}`}>
                    {formatScore(r.screening.weightedScore)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] leading-snug text-paper-faint">
                  {market.user_added && <span className="mr-1 text-signal-violet">your entry ·</span>}
                  {market.screen_source === "public_data" && (
                    <span data-testid={`screen-tag-${market.id}`} className="mr-1" style={{ color: SCREEN_COLOR }}>
                      screen ·
                    </span>
                  )}
                  <Gloss text={cleared ? market.market_signal : market.screened_out_reason ?? ""} />
                </span>
              </span>
            </button>
            {(market.user_added || market.screen_source === "public_data") && (
              <button onClick={() => onRemoveMarket(market.id)} aria-label={`Remove ${market.name}`} title="Remove this market" className="px-2 text-paper-faint hover:text-signal-red">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
