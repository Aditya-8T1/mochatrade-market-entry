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

export const engine: MarketEntryEngine = {
  getAllMarkets: () => ALL_MARKETS,
  getMarket: (id) => ALL_MARKETS.find((m) => m.id === id),
  computeScreeningScore: (market, weights) => scoring.computeScreeningScore(market, weights, LABELS),
  rankMarkets: (weights) => scoring.rankMarkets(ALL_MARKETS, weights, LABELS),
  recommendedSequence: (weights) => sequencing.recommendedSequence(ALL_MARKETS, weights, SEQUENCING_PARAMETERS, LABELS),
  explainDivergence: (marketId, weights) => recommendation.explainDivergence(DATA, marketId, weights),
  getRisksForMarket: (marketId) => ALL_RISKS.filter((r) => r.markets.includes(marketId)),
  getWeightPresets: () =>
    Object.fromEntries(Object.entries(PRESETS).map(([name, p]) => [name, { ...p.weights }])) as Record<string, RubricWeights>,
  getDefaultWeights: () => ({ ...PRESETS.base.weights }),
  getDimensions: () => DIMENSIONS.map((d) => ({ ...d })),
  validateWeights: weightsLib.validateWeights,
  normalizeWeights: weightsLib.normalizeWeights,
  describeWeights: (weights) => weightsLib.describeWeights(weights, PRESETS),
  getSequencingParameters: () => ({ ...SEQUENCING_PARAMETERS }),
  getRecommendation: (weights) => recommendation.getRecommendation(DATA, weights),
  getMarketRecommendation: (marketId, weights) => recommendation.getMarketRecommendation(DATA, marketId, weights),
};

export { InvalidWeightsError, DIMENSION_KEYS } from "./weights";
export * from "./types";
