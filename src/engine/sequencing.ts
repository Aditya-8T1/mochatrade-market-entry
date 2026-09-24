// Recommended entry sequence -- "in what order should MochaTrade enter".
// Deliberately separate from scoring.ts: the screening score is one input,
// adaptation cost and execution dependency pull it down.
//
//   priorityIndex = weightedScore
//                 - lambda_adaptation_cost      * adaptation_cost
//                 - lambda_execution_dependency * execution_dependency
//
// The formula, the lambdas and the 1-5 adaptation/execution scores are all
// engine_reconstruction (docs/round1-source-map.md), not deck numbers.
// Internal to the engine -- import from src/engine/index.ts instead.

import type { DimensionKey, Market, RubricWeights, SequencedMarket, SequencingInputs, SequencingParameters } from "./types";
import { computeScreeningScore } from "./scoring";
import { assertValidWeights, round } from "./weights";

/** Only cleared markets with both sequencing inputs can be sequenced. */
export function isSequenceable(market: Market): boolean {
  return (
    market.cleared &&
    typeof market.adaptation_cost === "number" &&
    typeof market.execution_dependency === "number"
  );
}

export function computeSequencingInputs(
  market: Market,
  weightedScore: number,
  params: SequencingParameters,
): SequencingInputs {
  if (!isSequenceable(market)) {
    throw new Error(`Market "${market.id}" is not sequenceable (not cleared, or missing adaptation/execution inputs)`);
  }
  const adaptationCost = market.adaptation_cost as number;
  const executionDependency = market.execution_dependency as number;
  const adaptationPenalty = params.lambda_adaptation_cost * adaptationCost;
  const executionPenalty = params.lambda_execution_dependency * executionDependency;
  return {
    weightedScore,
    adaptationCost,
    executionDependency,
    adaptationPenalty: round(adaptationPenalty),
    executionPenalty: round(executionPenalty),
    totalPenalty: round(adaptationPenalty + executionPenalty),
    source_type: market.adaptation_execution_source_type ?? "engine_reconstruction",
  };
}

/** Highest priorityIndex first; ties -> higher weighted score, then market id. */
export function recommendedSequence(
  markets: Market[],
  weights: RubricWeights,
  params: SequencingParameters,
  labels: Partial<Record<DimensionKey, string>> = {},
): SequencedMarket[] {
  assertValidWeights(weights);
  return markets
    .filter(isSequenceable)
    .map((market) => {
      const screening = computeScreeningScore(market, weights, labels);
      const inputs = computeSequencingInputs(market, screening.weightedScore, params);
      return {
        market,
        screening,
        inputs,
        priorityIndex: round(screening.weightedScore - inputs.totalPenalty),
        deckSequenceRank: market.sequence?.rank ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.priorityIndex - a.priorityIndex ||
        b.screening.weightedScore - a.screening.weightedScore ||
        a.market.id.localeCompare(b.market.id),
    )
    .map((entry, i) => ({ ...entry, sequenceRank: i + 1 }));
}
