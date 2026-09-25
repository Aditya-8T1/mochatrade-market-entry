// ============================================================================
// PUBLIC ENGINE ENTRY POINT -- the only file P2/P3 import from.
//
//   market data -> weighted score (scoring.ts) -> raw ranking
//               -> separate strategic sequence (sequencing.ts)
//               -> structured recommendation (recommendation.ts)
//
// Pure TypeScript, no React/DOM. Every function is deterministic for a given
// weight vector. Functions that take weights throw InvalidWeightsError on an
// invalid vector -- use engine.validateWeights / engine.normalizeWeights on
// raw slider input first.
//
// Do NOT put business logic in components. Components call these functions
// and render what they return -- nothing else.
// ============================================================================

import markets from "../../data/markets.json";
import risksData from "../../data/risks.json";
import type {
  DimensionInfo,
  Market,
  MarketEntryEngine,
  Risk,
  RubricWeights,
  SequencingParameters,
  SourceType,
} from "./types";
import * as scoring from "./scoring";
import * as sequencing from "./sequencing";
import * as recommendation from "./recommendation";
import type { EngineData, WeightPreset } from "./recommendation";
import * as weightsLib from "./weights";
import * as decision from "./decision";

const ALL_MARKETS = markets.markets as unknown as Market[];
const ALL_RISKS = risksData.risks as unknown as Risk[];
const DIMENSIONS = markets.rubric.dimensions as unknown as DimensionInfo[];

const PRESETS: Record<string, WeightPreset> = Object.fromEntries(
  Object.entries(markets.rubric.weight_presets as unknown as Record<string, Record<string, unknown>>).map(
    ([name, raw]) => [
      name,
      { weights: weightsLib.pickWeights(raw), source_type: raw.source_type as SourceType, note: String(raw.note ?? "") },
    ],
  ),
);

const SEQUENCING_PARAMETERS: SequencingParameters = {
  lambda_adaptation_cost: markets.sequencing_weights.lambda_adaptation_cost,
  lambda_execution_dependency: markets.sequencing_weights.lambda_execution_dependency,
  source_type: markets.sequencing_weights.source_type as SourceType,
  note: markets.sequencing_weights.note,
};

const DATA: EngineData = {
  markets: ALL_MARKETS,
  risks: ALL_RISKS,
  dimensions: DIMENSIONS,
  presets: PRESETS,
  sequencingParameters: SEQUENCING_PARAMETERS,
};

// Fail fast at load if the data files ship a broken preset.
for (const [name, preset] of Object.entries(PRESETS)) {
  const check = weightsLib.validateWeights(preset.weights);
  if (!check.valid) throw new Error(`data/markets.json weight preset "${name}" is invalid: ${check.errors.join("; ")}`);
}

const LABELS = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.label]));

const CLEAR_THRESHOLD: number = (markets.rubric as unknown as { clear_threshold?: { value: number } }).clear_threshold?.value ?? 3.0;

/**
 * Builds an engine over a dataset. The default export `engine` is the
 * Round 1 data; `engine.withMarkets(extra)` returns a second engine that
 * also knows about markets the user entered through the UI, without ever
 * mutating the base data (so tests and the deck-reproduction guarantees
 * keep holding on `engine`).
 */
export function createEngine(data: EngineData): MarketEntryEngine {
  const all = data.markets;
  const risksFor = (marketId: string): Risk[] => {
    const m = all.find((x) => x.id === marketId);
    return m ? recommendation.risksForMarket(data, m) : [];
  };
  return {
    getAllMarkets: () => all,
    getMarket: (id) => all.find((m) => m.id === id),
    computeScreeningScore: (market, weights) => scoring.computeScreeningScore(market, weights, LABELS),
    rankMarkets: (weights) => scoring.rankMarkets(all, weights, LABELS),
    recommendedSequence: (weights) => sequencing.recommendedSequence(all, weights, data.sequencingParameters, LABELS),
    explainDivergence: (marketId, weights) => recommendation.explainDivergence(data, marketId, weights),
    getRisksForMarket: risksFor,
    getWeightPresets: () =>
      Object.fromEntries(Object.entries(data.presets).map(([name, p]) => [name, { ...p.weights }])) as Record<string, RubricWeights>,
    getDefaultWeights: () => ({ ...data.presets.base.weights }),
    getDimensions: () => data.dimensions.map((d) => ({ ...d })),
    validateWeights: weightsLib.validateWeights,
    normalizeWeights: weightsLib.normalizeWeights,
    describeWeights: (weights) => weightsLib.describeWeights(weights, data.presets),
    getSequencingParameters: () => ({ ...data.sequencingParameters }),
    getRecommendation: (weights) => recommendation.getRecommendation(data, weights),
    getMarketRecommendation: (marketId, weights) => recommendation.getMarketRecommendation(data, marketId, weights),
    getRegulatoryRisk: (marketId, weights) => {
      const m = all.find((x) => x.id === marketId);
      return m ? decision.regulatoryRisk(m, weights, data) : undefined;
    },
    getDecision: (marketId, weights) => decision.decisionFor(data, marketId, weights),
    getRobustness: () => decision.robustness(data),
    getClearThreshold: () => CLEAR_THRESHOLD,
    withMarkets: (extra) => createEngine({ ...data, markets: [...all, ...extra] }),
    deriveSequencingInputs: sequencing.deriveSequencingInputs,
  };
}

export const engine: MarketEntryEngine = createEngine(DATA);

export { InvalidWeightsError, DIMENSION_KEYS, formatScore } from "./weights";
export { mitigationFor } from "./recommendation";
export { regulatoryBlocker, LEGALITY_BLOCKER, LICENCE_BLOCKER } from "./decision";
export * from "./types";
