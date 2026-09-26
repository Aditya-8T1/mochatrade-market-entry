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

import type { DimensionKey, EntryFacts, Market, RubricWeights, SequencedMarket, SequencingInputs, SequencingParameters } from "./types";
import { computeScreeningScore } from "./scoring";
import { assertValidWeights, round } from "./weights";

const clamp15 = (n: number) => Math.max(1, Math.min(5, n));

/**
 * The sequencing inputs are derived from countable facts, not typed in:
 *   adaptation_cost      = 1 + 2*product_rebuild + rail_via_partner
 *   execution_dependency = 1 + partners_required + localisation_required + partner_fronted_onboarding
 * (both capped to 1-5). With the deck's own facts this gives Dubai 1/1,
 * Brazil 3/2, Indonesia 4/5 -- the sequence is explained by facts a judge
 * can check against the Round 1 deep dive, not by a number tuned to fit.
 */
export function deriveSequencingInputs(facts: EntryFacts): {
  adaptationCost: number;
  executionDependency: number;
  adaptationFormula: string;
  executionFormula: string;
} {
  const rebuild = facts.product_rebuild ? 1 : 0;
  const rail = facts.rail_via_partner ? 1 : 0;
  const loc = facts.localisation_required ? 1 : 0;
  const fronted = facts.partner_fronted_onboarding ? 1 : 0;
  const partners = Math.max(0, Math.round(facts.partners_required));
  const adaptationCost = clamp15(1 + 2 * rebuild + rail);
  const executionDependency = clamp15(1 + partners + loc + fronted);
  return {
    adaptationCost,
    executionDependency,
    adaptationFormula: `1 + 2×${rebuild} (product rebuild) + ${rail} (rail via partner) = ${adaptationCost}`,
    executionFormula: `1 + ${partners} (partners) + ${loc} (localisation) + ${fronted} (partner-fronted onboarding) = ${executionDependency}`,
  };
}

/** Effective adaptation / execution scores: derived from entry_facts when present, else the explicit numbers. */
export function sequencingScores(market: Market): { adaptationCost: number; executionDependency: number } | null {
  if (market.entry_facts) {
    const d = deriveSequencingInputs(market.entry_facts);
    return { adaptationCost: d.adaptationCost, executionDependency: d.executionDependency };
  }
  if (typeof market.adaptation_cost === "number" && typeof market.execution_dependency === "number") {
    return { adaptationCost: market.adaptation_cost, executionDependency: market.execution_dependency };
  }
  return null;
}

/** Only cleared markets with sequencing inputs (derived or explicit) can be sequenced. */
export function isSequenceable(market: Market): boolean {
  return market.cleared && sequencingScores(market) !== null;
}

export function computeSequencingInputs(
  market: Market,
  weightedScore: number,
  params: SequencingParameters,
): SequencingInputs {
  if (!isSequenceable(market)) {
    throw new Error(`Market "${market.id}" is not sequenceable (not cleared, or missing adaptation/execution inputs)`);
  }
  const { adaptationCost, executionDependency } = sequencingScores(market) as { adaptationCost: number; executionDependency: number };
  const adaptationPenalty = params.lambda_adaptation_cost * adaptationCost;
  const executionPenalty = params.lambda_execution_dependency * executionDependency;
  return {
    weightedScore,
    adaptationCost,
    executionDependency,
    adaptationPenalty: round(adaptationPenalty),
    executionPenalty: round(executionPenalty),
    totalPenalty: round(adaptationPenalty + executionPenalty),
    source_type: market.entry_facts ? market.entry_facts.source_type : market.adaptation_execution_source_type ?? "engine_reconstruction",
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
        deckSequenceRank: market.sequence?.rank || null, // 0 = user-entered, no deck position
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

/**
 * How robust is the entry order to the penalty weight? Treats the two
 * lambdas as one common value L (the data file uses equal lambdas), and
 * returns the range of L over which the given sequence keeps its order.
 * For each adjacent pair (i enters before j):
 *   score_i - L*P_i > score_j - L*P_j   where P = adaptation + execution
 * gives a lower bound when P_i < P_j and an upper bound when P_i > P_j.
 * `min` is 0 if no pair constrains it from below; `max` is null if the
 * order holds for every positive L. Used on the ranking-vs-sequence panel
 * so the lambdas read as a display choice, not a tuned number.
 */
export function lambdaRangeForSequence(
  sequence: ReadonlyArray<{ priorityIndex: number; inputs: { weightedScore: number; adaptationCost: number; executionDependency: number } }>,
): { min: number; max: number | null; holds: boolean } {
  let min = 0;
  let max: number | null = null;
  const ordered = [...sequence].sort((a, b) => b.priorityIndex - a.priorityIndex);
  for (let k = 0; k + 1 < ordered.length; k++) {
    const a = ordered[k].inputs;
    const b = ordered[k + 1].inputs;
    const pa = a.adaptationCost + a.executionDependency;
    const pb = b.adaptationCost + b.executionDependency;
    const dScore = a.weightedScore - b.weightedScore;
    if (pa === pb) {
      if (dScore <= 0) return { min: 0, max: 0, holds: false };
      continue;
    }
    const bound = dScore / (pa - pb);
    if (pa < pb) min = Math.max(min, bound); // dividing by (pa - pb) < 0 flips the inequality: L > bound
    else max = max === null ? bound : Math.min(max, bound); // L < dScore/(pa - pb)
  }
  const holds = max === null || max > min;
  return { min: Math.max(0, min), max, holds };
}
