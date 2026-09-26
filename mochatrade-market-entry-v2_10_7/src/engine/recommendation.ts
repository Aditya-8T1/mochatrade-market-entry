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
import { deriveSequencingInputs, isSequenceable, recommendedSequence, sequencingScores } from "./sequencing";
import { DIMENSION_KEYS, assertValidWeights, describeWeights, formatScore } from "./weights";
import { KNOCKOUT_RULE, regulatoryBlocker } from "./decision";

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

// One decimal, the precision Round 1 printed (3.9 / 3.8 / 3.6). Prose
// deliberately avoids raw penalty / priority-index arithmetic: rounded
// numbers never add up on screen, and the "score minus friction" bars in
// the UI carry the magnitudes instead.
const fmt = (n: number) => formatScore(n);

function names(others: SequencedMarket[]): string {
  const n = others.map((o) => o.market.name);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

function friction(a: number, e: number): string {
  return `adaptation cost ${a}/5 and execution dependency ${e}/5`;
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
  const { adaptationCost: a, executionDependency: e } = seq.inputs;
  const head = `${market.name} is #${rawC} of ${n} cleared markets on screening score (${fmt(seq.screening.weightedScore)}/5) and #${seq.sequenceRank} to enter`;
  let body: string;
  if (rawC === seq.sequenceRank) {
    const heaviest = c.sequence.every((o) => o.inputs.totalPenalty <= seq.inputs.totalPenalty);
    const lightest = c.sequence.every((o) => o.inputs.totalPenalty >= seq.inputs.totalPenalty);
    body = `${head}, so no divergence. Its ${friction(a, e)} are ${heaviest ? "the heaviest of the cleared markets" : lightest ? "the lightest of the cleared markets" : "in line with its position"}.`;
  } else if (seq.sequenceRank > rawC) {
    const jumpedAhead = c.sequence.filter(
      (o) => o.sequenceRank < seq.sequenceRank && (c.rawRankAmongCleared.get(o.market.id) as number) > rawC,
    );
    body = `${head}: its ${friction(a, e)} outweigh its score lead, so ${names(jumpedAhead)} enter${jumpedAhead.length === 1 ? "s" : ""} first despite scoring lower.`;
  } else {
    const overtaken = c.sequence.filter(
      (o) => o.sequenceRank > seq.sequenceRank && (c.rawRankAmongCleared.get(o.market.id) as number) < rawC,
    );
    body = `${head}: its ${friction(a, e)} are low enough to put it ahead of higher-scoring ${names(overtaken)}.`;
  }
  if (seq.deckSequenceRank !== null && seq.deckSequenceRank !== seq.sequenceRank) {
    body += ` Note: under these weights the engine's position differs from the Round 1 deck (deck position #${seq.deckSequenceRank}).`;
  }
  if (deckRationale) body += market.user_added ? ` ${deckRationale}` : ` Round 1 rationale: "${deckRationale}"`;

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

/** Which of the cross-cutting risks apply to a market. A user-entered market that clears inherits the risks Round 1 tagged to every cleared market. */
/** The mitigation for this risk as it applies to one market: the market-scoped note when there is one, else the cross-cutting deck mitigation. */
export function mitigationFor(risk: Risk, marketId: string): string {
  return risk.mitigation_notes?.[marketId] ?? risk.mitigation;
}

export function risksForMarket(data: EngineData, market: Market): Risk[] {
  if (market.user_added && market.cleared) return data.risks.filter((r) => r.markets.length >= 3);
  return data.risks.filter((r) => r.markets.includes(market.id));
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
  if (market.screen_evidence) {
    const lines = Object.entries(market.screen_evidence).filter(([, v]) => !!v);
    items.push({
      field: "public_screen",
      label: "Public-data screen",
      statement: `${market.screen_source === "public_data" ? "All scores come from a coarse public-data screen, not Round 1 research. " : "Some sliders were prefilled from the public-data screen. "}${lines.map(([k, v]) => `${k}: ${v}`).join(" ")}`,
      source_type: "calculated",
    });
  }
  if (market.country_facts) {
    items.push({
      field: "country_facts",
      label: "Country data",
      statement: market.country_facts.evidence,
      source_type: market.country_facts.source_type,
    });
  }
  if (market.user_added) {
    items.push({
      field: "user_added",
      label: "User-entered market",
      statement: "Scores and entry-route facts were entered by hand in this tool, not researched in Round 1. Treat every figure as an assumption until verified.",
      source_type: "assumption",
    });
  } else if (market.research_source === "round2") {
    items.push({
      field: "round2_research",
      label: "Round 2 research",
      statement:
        "Scores and notes come from the team's Round 2 research workbook, not the Round 1 deck. Evidence tags in the text: [V] verified against a primary source, [V-secondary] verified via a secondary source, [V-draft] a draft rule not in force, [A] assumption or limited evidence, [D] derived by the researcher.",
      source_type: "calculated",
    });
  } else if (market.evidence_confidence === "limited" && market.screen_source !== "public_data") {
    items.push({
      field: "evidence_confidence",
      label: "Limited evidence",
      statement: "Round 1 marks this market's scores as limited evidence, scored conservatively (slide 4, †).",
      source_type: "calculated",
    });
  }
  if ((market.research_source === "round2" || market.screen_source === "public_data" || market.user_added) && !market.cleared && regulatoryBlocker(market.scores)) {
    items.push({ field: "knockout_rule", label: "Regulatory knock-out rule", statement: KNOCKOUT_RULE, source_type: "calculated" });
  }
  if (market.research?.deck_check) {
    items.push({
      field: "research.deck_check",
      label: "Round 2 check vs Round 1 deck",
      statement: `${market.research.deck_check} (The deck text above is kept verbatim; confirm before citing either.)`,
      source_type: "assumption",
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
    const sc = sequencingScores(market) as { adaptationCost: number; executionDependency: number };
    if (market.entry_facts) {
      const d = deriveSequencingInputs(market.entry_facts);
      const src = market.entry_facts.source_type;
      items.push({
        field: "adaptation_cost",
        label: "Adaptation cost (derived)",
        statement: `${d.adaptationCost}/5 = ${d.adaptationFormula}. ${market.entry_facts.evidence ?? ""}`.trim(),
        source_type: src,
      });
      items.push({
        field: "execution_dependency",
        label: "Execution dependency (derived)",
        statement: `${d.executionDependency}/5 = ${d.executionFormula}.`,
        source_type: src,
      });
    } else {
      const src = market.adaptation_execution_source_type ?? "engine_reconstruction";
      items.push({
        field: "adaptation_cost",
        label: "Adaptation cost score",
        statement: `${sc.adaptationCost}/5 -- ${market.adaptation_execution_rationale ?? "team estimate for the prototype"}`,
        source_type: src,
      });
      items.push({
        field: "execution_dependency",
        label: "Execution dependency score",
        statement: `${sc.executionDependency}/5 -- ${market.adaptation_execution_rationale ?? "team estimate for the prototype"}`,
        source_type: src,
      });
    }
    const p = data.sequencingParameters;
    items.push({
      field: "sequencing_formula",
      label: "Sequencing formula",
      statement: `priorityIndex = weightedScore - ${p.lambda_adaptation_cost} x adaptation_cost - ${p.lambda_execution_dependency} x execution_dependency. Built for Round 2 to quantify the deck's qualitative "score != sequence" reasoning; the two inputs are derived from countable entry facts, the lambdas are not deck numbers.`,
      source_type: p.source_type,
    });
  }
  return items;
}

function collectRequiresConfirmation(market: Market): SourcedItem[] {
  // Only cleared markets have genuine "requires confirmation" items — screened-out markets
  // with research-sourced deep_dive fields show those on the Readiness watchlist instead.
  if (!market.cleared) return [];
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
  const risks = risksForMarket(data, market);

  const blockers: Blocker[] = [];
  if (seq) {
    if (market.deep_dive?.main_hurdle) blockers.push({ kind: "main_hurdle", text: market.deep_dive.main_hurdle });
    for (const gate of market.sequence?.go_gate ?? []) {
      if (!blockers.some((b) => b.text.trim().toLowerCase() === gate.trim().toLowerCase())) blockers.push({ kind: "go_gate", text: gate });
    }
  } else if (market.screened_out_reason) {
    blockers.push({ kind: "screened_out", text: market.screened_out_reason });
  }

  const mitigations: Mitigation[] = risks.map((r) => ({ source: r.id, text: mitigationFor(r, market.id) }));
  if (market.sequence?.if_delayed) mitigations.push({ source: "if_delayed", text: `Fallback if delayed: ${market.sequence.if_delayed}` });

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
