import type { RankedMarket } from "../engine/types";

/**
 * The market list's display order: the nine Round 1 markets, then the Round 2
 * research markets, then anything added in the tool (public-data screens,
 * user entries). Each group keeps the engine's rank order, so the list is
 * still "sorted by screening score" within a group.
 */
export function marketQueueGroups(ranking: RankedMarket[]) {
  const isAdded = (r: RankedMarket) => !!r.market.user_added || r.market.screen_source === "public_data";
  const isRound2 = (r: RankedMarket) => r.market.research_source === "round2";
  const core = ranking.filter((r) => !isAdded(r) && !isRound2(r));
  const round2 = ranking.filter(isRound2);
  const added = ranking.filter(isAdded);
  return { core, round2, added, ordered: [...core, ...round2, ...added] };
}
