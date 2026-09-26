// The one place components import `engine` from -- P1 can change internals
// under src/engine/scoring.ts / sequencing.ts freely as long as the shape in
// src/engine/types.ts doesn't change, and nothing here or downstream breaks.
//
// useEngine() -- raw memoized engine access, for anything that only needs
// one-off reads (engine.getMarket(id), engine.getRisksForMarket(id), etc).
//
// useMarketEntry() -- the full integration point. Owns weight state and
// selection state (via useWeights / useSelectedMarket) and derives every
// screen's data (ranking, sequence, the selected market's recommendation,
// its risks, and the raw-rank-vs-sequence comparison) through useMemo calls
// into the engine. No scoring/sequencing logic is duplicated here -- every
// value is a direct engine call, recomputed only when its real inputs
// (weights / selectedId) change.
import { useCallback, useMemo, useState } from "react";
import { engine as engineSingleton } from "../engine";
import { useWeights } from "./useWeights";
import { useSelectedMarket } from "./useSelectedMarket";
import { useCustomMarkets } from "./useCustomMarkets";
import { clearChecklistState } from "../components/ComplianceChecklist";
import { getIndicators, getStaticCountry, suggestMarketOpportunity } from "../data-provider";
import { opportunityFill, publicScreenMarket, publicScreenMarketId, publicScreenScores } from "../data-provider/publicScreenProvider";
import type { PublicScreenCountry } from "../data-provider/publicScreenProvider";
import type { Decision, DivergenceExplanation, Market, MarketEntryEngine, RobustnessReport, SequencedMarket } from "../engine/types";

export function useEngine(): MarketEntryEngine {
  return engineSingleton;
}

export interface RankVsSeqItem {
  sequenced: SequencedMarket;
  divergence: DivergenceExplanation;
}

export interface UseMarketEntryResult {
  engine: MarketEntryEngine;
  // weights
  weights: ReturnType<typeof useWeights>["weights"];
  dimensions: ReturnType<typeof useWeights>["dimensions"];
  presets: ReturnType<typeof useWeights>["presets"];
  provenance: ReturnType<typeof useWeights>["provenance"];
  setPreset: ReturnType<typeof useWeights>["setPreset"];
  setDimensionWeight: ReturnType<typeof useWeights>["setDimensionWeight"];
  resetWeights: ReturnType<typeof useWeights>["reset"];
  // selection
  selectedId: string;
  setSelectedId: (id: string) => void;
  // derived, engine-sourced state
  ranking: ReturnType<MarketEntryEngine["rankMarkets"]>;
  sequence: ReturnType<MarketEntryEngine["recommendedSequence"]>;
  fullRecommendation: ReturnType<MarketEntryEngine["getRecommendation"]>;
  selectedMarket: ReturnType<MarketEntryEngine["getMarket"]>;
  selectedRecommendation: ReturnType<MarketEntryEngine["getMarketRecommendation"]>;
  selectedRisks: ReturnType<MarketEntryEngine["getRisksForMarket"]>;
  rankVsSeqItems: RankVsSeqItem[];
  // decision layer
  selectedDecision: Decision | undefined;
  robustness: RobustnessReport;
  clearThreshold: number;
  // user-entered markets
  customMarkets: Market[];
  addMarket: (m: Market) => void;
  /** Adds a country from the public-data screen as a runtime market (opportunity filled from the World Bank provider) and returns it. */
  addPublicScreenMarket: (c: PublicScreenCountry) => Promise<Market>;
  removeMarket: (id: string) => void;
  // compare mode (up to 3 market ids)
  compareIds: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
}

const MAX_COMPARE = 3;

export function useMarketEntry(): UseMarketEntryResult {
  const base = useEngine();
  const { custom, addMarket, removeMarket: removeCustom } = useCustomMarkets();
  const engine = useMemo(() => (custom.length ? base.withMarkets(custom) : base), [base, custom]);
  const { weights, dimensions, presets, provenance, setPreset, setDimensionWeight, reset } = useWeights();

  const ranking = useMemo(() => engine.rankMarkets(weights), [engine, weights]);
  const sequence = useMemo(() => engine.recommendedSequence(weights), [engine, weights]);
  const fullRecommendation = useMemo(() => engine.getRecommendation(weights), [engine, weights]);

  const fallbackId = sequence[0]?.market.id ?? ranking[0]?.market.id ?? "";
  const { selectedId: requestedId, setSelectedId } = useSelectedMarket(fallbackId);
  // A selection can point at a market that no longer exists (a removed
  // user-entered market). Resolve it against the current engine every
  // render so the dashboard never lands on "No market selected".
  const selectedId = engine.getMarket(requestedId) ? requestedId : fallbackId;

  const selectedMarket = useMemo(() => engine.getMarket(selectedId), [engine, selectedId]);
  const selectedRecommendation = useMemo(
    () => engine.getMarketRecommendation(selectedId, weights),
    [engine, selectedId, weights],
  );
  const selectedRisks = useMemo(() => engine.getRisksForMarket(selectedId), [engine, selectedId]);

  const rankVsSeqItems = useMemo<RankVsSeqItem[]>(
    () => sequence.map((s) => ({ sequenced: s, divergence: engine.explainDivergence(s.market.id, weights) })),
    [engine, sequence, weights],
  );

  const selectedDecision = useMemo(() => engine.getDecision(selectedId, weights), [engine, selectedId, weights]);
  const robustness = useMemo(() => engine.getRobustness(), [engine]);
  const clearThreshold = useMemo(() => engine.getClearThreshold(), [engine]);

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_COMPARE ? [...prev.slice(1), id] : [...prev, id]));
  }, []);
  const clearCompare = useCallback(() => setCompareIds([]), []);

  const addPublicScreenMarket = useCallback(
    async (c: PublicScreenCountry): Promise<Market> => {
      const existing = engine.getMarket(publicScreenMarketId(c));
      if (existing) return existing;
      // Market opportunity is not in the screen file: live World Bank -> static snapshot -> declared placeholder.
      const indicators = await getIndicators(c.iso3);
      const opportunity = opportunityFill(indicators, indicators ? suggestMarketOpportunity(indicators) : null, c.name);
      const scores = publicScreenScores(c, opportunity.score);
      const probe: Market = { id: "probe", name: c.name, cleared: false, scores, evidence_confidence: "limited", screening_score_deck: 0, market_signal: "" };
      const baseScore = base.computeScreeningScore(probe, base.getDefaultWeights()).weightedScore;
      const m = publicScreenMarket(c, { baseScore, clearThreshold: base.getClearThreshold(), opportunity, currency: getStaticCountry(c.name)?.currency ?? undefined });
      addMarket(m);
      return m;
    },
    [engine, base, addMarket],
  );

  const removeMarket = useCallback(
    (id: string) => {
      removeCustom(id);
      clearChecklistState(id);
      setCompareIds((prev) => prev.filter((x) => x !== id));
    },
    [removeCustom],
  );

  return {
    selectedDecision,
    robustness,
    clearThreshold,
    customMarkets: custom,
    addMarket,
    addPublicScreenMarket,
    removeMarket,
    compareIds,
    toggleCompare,
    clearCompare,
    engine,
    weights,
    dimensions,
    presets,
    provenance,
    setPreset,
    setDimensionWeight,
    resetWeights: reset,
    selectedId,
    setSelectedId,
    ranking,
    sequence,
    fullRecommendation,
    selectedMarket,
    selectedRecommendation,
    selectedRisks,
    rankVsSeqItems,
  };
}
