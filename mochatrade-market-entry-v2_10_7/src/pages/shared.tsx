// Pieces shared by the Plan and Markets pages: every market's engine decision
// (memoised per weights), the finder wired to navigation, and the
// "Score a new market" dialog flow.
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactElement } from "react";
import { useAppState } from "../state/AppState";
import { marketHref, navigate } from "../router";
import MarketFinder from "../components/MarketFinder";
import AddMarketForm from "../components/AddMarketForm";
import { listPublicScreen, listPublicScreenUnavailable } from "../data-provider/publicScreenProvider";
import type { Decision } from "../engine/types";

export function useDecisions(): Map<string, Decision> {
  const { engine, ranking, weights } = useAppState();
  return useMemo(() => {
    const map = new Map<string, Decision>();
    for (const r of ranking) {
      const d = engine.getDecision(r.market.id, weights);
      if (d) map.set(r.market.id, d);
    }
    return map;
  }, [engine, ranking, weights]);
}

/** State + element for the "Score a new market" dialog (portalled to <body> so page transitions never shift it). Adding a market opens its page. */
export function useAddMarket(): { open: (name?: string) => void; dialog: ReactElement | null } {
  const { engine, dimensions, weights, clearThreshold, addMarket } = useAppState();
  const [showAdd, setShowAdd] = useState<false | { name: string }>(false);
  const dialog = showAdd ? createPortal(
    <AddMarketForm
      engine={engine}
      dimensions={dimensions}
      weights={weights}
      clearThreshold={clearThreshold}
      initialName={showAdd.name}
      onAdd={(m) => {
        addMarket(m);
        navigate(marketHref(m.id));
      }}
      onClose={() => setShowAdd(false)}
    />,
    document.body,
  ) : null;
  return { open: (name = "") => setShowAdd({ name }), dialog };
}

/** The country search: picking a market opens its page; unknown names go to "Score a new market". */
export function Finder({ decisions, onScoreNew, label }: { decisions: Map<string, Decision>; onScoreNew: (name: string) => void; label?: string }): ReactElement {
  const { ranking, addPublicScreenMarket } = useAppState();
  return (
    <MarketFinder
      label={label}
      markets={ranking.map((r) => r.market)}
      verdictOf={(id) => {
        const d = decisions.get(id);
        return d ? { verdict: d.verdict, label: d.verdictLabel } : undefined;
      }}
      onSelect={(id) => navigate(marketHref(id))}
      onScoreNew={onScoreNew}
      publicScreen={listPublicScreen()}
      publicScreenUnavailable={listPublicScreenUnavailable()}
      onSelectScreen={(c) => {
        void addPublicScreenMarket(c).then((m) => navigate(marketHref(m.id)));
      }}
    />
  );
}
