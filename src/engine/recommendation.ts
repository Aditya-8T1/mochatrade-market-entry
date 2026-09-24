// Structured recommendation: combines the raw ranking (scoring.ts) and the
// entry sequence (sequencing.ts) without merging them, and attaches the
// risks, blockers, mitigations, compliance changes, assumptions and
// route-requires-confirmation items already in data/. Generates no new
// regulatory claims -- every string is either data verbatim or a sentence
// built from engine numbers.
// Internal to the engine -- import from src/engine/index.ts instead.

import type {
  Blocker,
  DimensionInfo,
  DimensionKey,
  DivergenceExplanation,
  EntryRecommendation,
  Market,
  MarketRecommendation,
  Mitigation,
  RankedMarket,
  Risk,
  RubricWeights,
  SequencedMarket,
  SequencingParameters,
  SourceType,
  SourcedItem,
  WeightsProvenance,
} from "./types";
import { rankMarkets } from "./scoring";
import { isSequenceable, recommendedSequence } from "./sequencing";
import { DIMENSION_KEYS, assertValidWeights, describeWeights } from "./weights";

export interface WeightPreset {
  weights: RubricWeights;
  source_type: SourceType;
  note: string;
}

/** Everything the engine reads from data/, injected so the logic stays testable. */
export interface EngineData {
  markets: Market[];
  risks: Risk[];
  dimensions: DimensionInfo[];
  presets: Record<string, WeightPreset>;
  sequencingParameters: SequencingParameters;
}

const DECK_SCORE_TOLERANCE = 0.05 + 1e-9; // deck prints scores to 1 dp

const DEEP_DIVE_FIELD_LABELS: Record<string, string> = {
  crypto_route: "Crypto-derivatives route",
  equities_route: "US-equities route",
  commercial_adoption: "Commercial adoption",
};

function labelsOf(data: EngineData): Partial<Record<DimensionKey, string>> {
  return Object.fromEntries(data.dimensions.map((d) => [d.key, d.label]));
}

interface Computed {
  ranking: RankedMarket[];
  sequence: SequencedMarket[];
  rawRankAmongCleared: Map<string, number>;
}

function compute(data: EngineData, weights: RubricWeights): Computed {
  assertValidWeights(weights);
  const labels = labelsOf(data);
  const ranking = rankMarkets(data.markets, weights, labels);
  const sequence = recommendedSequence(data.markets, weights, data.sequencingParameters, labels);
  const rawRankAmongCleared = new Map<string, number>();
  ranking.filter((r) => isSequenceable(r.market)).forEach((r, i) => rawRankAmongCleared.set(r.market.id, i + 1));
  return { ranking, sequence, rawRankAmongCleared };
}

const fmt = (n: number) => n.toFixed(2);

function describeOthers(others: SequencedMarket[]): string {
  return others
    .map((o) => `${o.market.name} (penalty ${fmt(o.inputs.totalPenalty)}, priority ${fmt(o.priorityIndex)})`)
    .join(", ");
}

function divergenceFrom(c: Computed, marketId: string, data: EngineData): DivergenceExplanation {
  const ranked = c.ranking.find((r) => r.market.id === marketId);
  const market = data.markets.find((m) => m.id === marketId);
  const deckRationale = market?.sequence?.rationale ?? null;
  if (!ranked || !market) {
    return {
      marketId,
      rawRank: 0,
      sequenceRank: 0,
      diverges: false,
      sequenced: false,
      rawRankAmongCleared: null,
      deckRationale: null,
      explanation: `Unknown market "${marketId}".`,
    };
  }

  const seq = c.sequence.find((s) => s.market.id === marketId);
  if (!seq) {
    const reason = market.screened_out_reason ?? "it is missing the adaptation-cost / execution-dependency inputs sequencing needs";
    return {
      marketId,
      rawRank: ranked.rawRank,
      sequenceRank: 0,
      diverges: false,
      sequenced: false,
      rawRankAmongCleared: null,
      deckRationale,
      explanation: `${market.name} ranks #${ranked.rawRank} of ${c.ranking.length} on raw score (${fmt(ranked.screening.weightedScore)}/5) but is not in the entry sequence: ${reason}`,
    };
  }

  const rawC = c.rawRankAmongCleared.get(marketId) as number;
  const n = c.sequence.length;
  const { adaptationCost: a, executionDependency: e, totalPenalty } = seq.inputs;
  const head = `${market.name} is #${rawC} of ${n} cleared markets on raw score (${fmt(seq.screening.weightedScore)}/5) and #${seq.sequenceRank} in the entry sequence`;
  let body: string;
  if (rawC === seq.sequenceRank) {
    body = `${head} -- no divergence. Adaptation cost ${a}/5 and execution dependency ${e}/5 (penalty ${fmt(totalPenalty)}) leave its priority index at ${fmt(seq.priorityIndex)}.`;
  } else if (seq.sequenceRank > rawC) {
    const jumpedAhead = c.sequence.filter(
      (o) => o.sequenceRank < seq.sequenceRank && (c.rawRankAmongCleared.get(o.market.id) as number) > rawC,
    );
    body = `${head}: adaptation cost ${a}/5 and execution dependency ${e}/5 cost it ${fmt(totalPenalty)} points (priority index ${fmt(seq.priorityIndex)}), so ${describeOthers(jumpedAhead)} enter${jumpedAhead.length === 1 ? "s" : ""} first despite a lower raw score.`;
  } else {
    const overtaken = c.sequence.filter(
      (o) => o.sequenceRank > seq.sequenceRank && (c.rawRankAmongCleared.get(o.market.id) as number) < rawC,
    );
    body = `${head}: its lower adaptation cost ${a}/5 and execution dependency ${e}/5 (penalty ${fmt(totalPenalty)}, priority index ${fmt(seq.priorityIndex)}) put it ahead of higher-scoring ${describeOthers(overtaken)}.`;
  }
  if (seq.deckSequenceRank !== null && seq.deckSequenceRank !== seq.sequenceRank) {
    body += ` Note: under these weights the engine's position differs from the Round 1 deck (deck position #${seq.deckSequenceRank}).`;
  }
  if (deckRationale) body += ` Round 1 rationale: "${deckRationale}"`;

  return {
    marketId,
    rawRank: ranked.rawRank,
    sequenceRank: seq.sequenceRank,
    diverges: rawC !== seq.sequenceRank,
    sequenced: true,
    rawRankAmongCleared: rawC,
    deckRationale,
    explanation: body,
  };
}

export function explainDivergence(data: EngineData, marketId: string, weights: RubricWeights): DivergenceExplanation {
  return divergenceFrom(compute(data, weights), marketId, data);
}

/** Splits the deck's "a; b; c." product-change sentence into checklist items (text otherwise verbatim). */
export function splitAdjustments(summary: string): string[] {
  return summary
    .split(";")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 0);
}

function collectAssumptions(market: Market, provenance: WeightsProvenance, data: EngineData): SourcedItem[] {
  const items: SourcedItem[] = [];
  if (provenance.source_type !== "verified_fact") {
    items.push({
      field: "weights",
      label: provenance.preset ? `Weight preset: ${provenance.preset}` : "Custom weights",
      statement: provenance.note,
      source_type: provenance.source_type,
    });
  }
  if (market.evidence_confidence === "limited") {
    items.push({
      field: "evidence_confidence",
      label: "Limited evidence",
      statement: "Round 1 marks this market's scores as limited evidence, scored conservatively (slide 4, †).",
      source_type: "calculated",
    });
  }
  const dd = market.deep_dive as unknown as Record<string, unknown> | undefined;
  if (dd) {
    for (const [field, label] of Object.entries(DEEP_DIVE_FIELD_LABELS)) {
      if (dd[`${field}_source_type`] === "assumption") {
        items.push({ field: `deep_dive.${field}`, label, statement: String(dd[field]), source_type: "assumption" });
      }
    }
  }
  if (isSequenceable(market)) {
    const src = market.adaptation_execution_source_type ?? "engine_reconstruction";
    items.push({
      field: "adaptation_cost",
      label: "Adaptation cost score",
      statement: `${market.adaptation_cost}/5 -- ${market.adaptation_execution_rationale ?? "team estimate for the prototype"}`,
      source_type: src,
    });
    items.push({
      field: "execution_dependency",
      label: "Execution dependency score",
      statement: `${market.execution_dependency}/5 -- ${market.adaptation_execution_rationale ?? "team estimate for the prototype"}`,
      source_type: src,
    });
    const p = data.sequencingParameters;
    items.push({
      field: "sequencing_formula",
      label: "Sequencing formula",
      statement: `priorityIndex = weightedScore - ${p.lambda_adaptation_cost} x adaptation_cost - ${p.lambda_execution_dependency} x execution_dependency. Built for Round 2 to quantify the deck's qualitative "score != sequence" reasoning; not a deck formula.`,
      source_type: p.source_type,
    });
  }
  return items;
}

function collectRequiresConfirmation(market: Market): SourcedItem[] {
  const dd = market.deep_dive as unknown as Record<string, unknown> | undefined;
  if (!dd) return [];
  return Object.entries(DEEP_DIVE_FIELD_LABELS)
    .filter(([field]) => dd[`${field}_source_type`] === "route_requires_confirmation")
    .map(([field, label]) => ({
      field: `deep_dive.${field}`,
      label,
      statement: String(dd[field]),
      source_type: "route_requires_confirmation" as const,
    }));
}

function buildMarketRecommendation(
  c: Computed,
  market: Market,
  weights: RubricWeights,
  data: EngineData,
): MarketRecommendation {
  const ranked = c.ranking.find((r) => r.market.id === market.id) as RankedMarket;
  const seq = c.sequence.find((s) => s.market.id === market.id);
  const provenance = describeWeights(weights, data.presets);
  const risks = data.risks.filter((r) => r.markets.includes(market.id));

  const blockers: Blocker[] = [];
  if (seq) {
    if (market.deep_dive?.main_hurdle) blockers.push({ kind: "main_hurdle", text: market.deep_dive.main_hurdle });
    for (const gate of market.sequence?.go_gate ?? []) blockers.push({ kind: "go_gate", text: gate });
  } else if (market.screened_out_reason) {
    blockers.push({ kind: "screened_out", text: market.screened_out_reason });
  }

  const mitigations: Mitigation[] = risks.map((r) => ({ source: r.id, text: r.mitigation }));
  if (market.sequence?.if_delayed) mitigations.push({ source: "if_delayed", text: market.sequence.if_delayed });

  const productChanges = market.deep_dive?.required_product_changes;

  return {
    marketId: market.id,
    marketName: market.name,
    status: seq ? "sequenced" : "screened_out",
    evidenceConfidence: market.evidence_confidence,
    score: {
      weightedScore: ranked.screening.weightedScore,
      weightedScore100: ranked.screening.weightedScore100,
      deckScore: market.screening_score_deck,
      matchesDeckScore: Math.abs(ranked.screening.weightedScore - market.screening_score_deck) <= DECK_SCORE_TOLERANCE,
    },
    breakdown: DIMENSION_KEYS.map((key) => ({ key, ...ranked.screening.breakdown[key] })),
    rawRank: ranked.rawRank,
    rawRankAmongCleared: c.rawRankAmongCleared.get(market.id) ?? null,
    sequencePosition: seq?.sequenceRank ?? null,
    priorityIndex: seq?.priorityIndex ?? null,
    sequencingInputs: seq?.inputs ?? null,
    entryWindow: market.sequence
      ? { window: market.sequence.window, label: market.sequence.label, deckRank: market.sequence.rank }
      : null,
    divergence: divergenceFrom(c, market.id, data),
    goGates: market.sequence?.go_gate ?? [],
    risks: risks.map((r) => ({ id: r.id, title: r.title, severity: r.severity, risk: r.risk, why_it_matters: r.why_it_matters })),
    blockers,
    mitigations,
    complianceAdjustments: productChanges ? { summary: productChanges, items: splitAdjustments(productChanges) } : null,
    assumptions: collectAssumptions(market, provenance, data),
    requiresConfirmation: collectRequiresConfirmation(market),
  };
}

export function getMarketRecommendation(
  data: EngineData,
  marketId: string,
  weights: RubricWeights,
): MarketRecommendation | undefined {
  const c = compute(data, weights);
  const market = data.markets.find((m) => m.id === marketId);
  return market ? buildMarketRecommendation(c, market, weights, data) : undefined;
}

export function getRecommendation(data: EngineData, weights: RubricWeights): EntryRecommendation {
  const c = compute(data, weights);
  const sequencedIds = c.sequence.map((s) => s.market.id);
  const clearedByScore = c.ranking.filter((r) => isSequenceable(r.market)).map((r) => r.market.id);
  const deckOrder = [...c.sequence]
    .filter((s) => s.deckSequenceRank !== null)
    .sort((a, b) => (a.deckSequenceRank as number) - (b.deckSequenceRank as number))
    .map((s) => s.market.id);
  const ordered = [
    ...c.sequence.map((s) => s.market),
    ...c.ranking.filter((r) => !sequencedIds.includes(r.market.id)).map((r) => r.market),
  ];

  return {
    weights: { ...weights },
    weightsProvenance: describeWeights(weights, data.presets),
    sequencingParameters: { ...data.sequencingParameters },
    rawRanking: c.ranking.map((r) => ({
      marketId: r.market.id,
      marketName: r.market.name,
      weightedScore: r.screening.weightedScore,
      rawRank: r.rawRank,
      cleared: r.market.cleared,
    })),
    sequence: c.sequence.map((s) => ({
      marketId: s.market.id,
      marketName: s.market.name,
      sequenceRank: s.sequenceRank,
      priorityIndex: s.priorityIndex,
      weightedScore: s.screening.weightedScore,
    })),
    scoreOrderMatchesSequence: clearedByScore.join() === sequencedIds.join(),
    matchesDeckSequence: deckOrder.length === sequencedIds.length && deckOrder.join() === sequencedIds.join(),
    markets: ordered.map((m) => buildMarketRecommendation(c, m, weights, data)),
  };
}
