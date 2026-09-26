// Weighted screening score -- "how strong is this market on the Round 1
// rubric". Knows nothing about sequencing (SCORE != SEQUENCE, slide 6).
// Internal to the engine -- import from src/engine/index.ts instead.

import type { DimensionContribution, DimensionKey, Market, RankedMarket, RubricWeights, ScreeningResult } from "./types";
import { DIMENSION_KEYS, assertValidWeights, round } from "./weights";

export function computeScreeningScore(
  market: Market,
  weights: RubricWeights,
  labels: Partial<Record<DimensionKey, string>> = {},
): ScreeningResult {
  assertValidWeights(weights);

  let total = 0;
  const partial = {} as Record<DimensionKey, Omit<DimensionContribution, "shareOfScore">>;
  for (const key of DIMENSION_KEYS) {
    const raw = market.scores?.[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new Error(`Market "${market.id}" has no numeric score for "${key}"`);
    }
    const contribution = raw * weights[key];
    total += contribution;
    partial[key] = { raw, weight: weights[key], contribution: round(contribution), label: labels[key] ?? key };
  }

  const weightedScore = round(total);
  const breakdown = {} as Record<DimensionKey, DimensionContribution>;
  for (const key of DIMENSION_KEYS) {
    breakdown[key] = {
      ...partial[key],
      shareOfScore: weightedScore === 0 ? 0 : round(partial[key].contribution / weightedScore),
    };
  }

  return {
    marketId: market.id,
    weightedScore,
    weightedScore100: round((weightedScore / 5) * 100, 1),
    breakdown,
  };
}

/** Highest weighted score first; ties broken by market id so output is deterministic. */
export function rankMarkets(
  markets: Market[],
  weights: RubricWeights,
  labels: Partial<Record<DimensionKey, string>> = {},
): RankedMarket[] {
  assertValidWeights(weights);
  return markets
    .map((market) => ({ market, screening: computeScreeningScore(market, weights, labels) }))
    .sort(
      (a, b) =>
        b.screening.weightedScore - a.screening.weightedScore || a.market.id.localeCompare(b.market.id),
    )
    .map((entry, i) => ({ ...entry, rawRank: i + 1 }));
}
