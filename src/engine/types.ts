// ============================================================================
// ENGINE CONTRACT -- shared types for scoring, ranking, sequencing and risk
// lookup. This is the file P2/P3 build against. P1 owns everything under
// src/engine/ -- nobody else should need to look inside scoring.ts or
// sequencing.ts, only import from src/engine/index.ts.
//
// STATUS: implemented (Milestone 1). Scoring lives in scoring.ts, sequencing
// in sequencing.ts, the structured recommendation in recommendation.ts. All
// changes to this file since the Milestone 0 stub are additive -- every
// field/function P2/P3 already used keeps its name and shape.
// ============================================================================

export type SourceType =
  | "verified_fact"
  | "calculated"
  | "assumption"
  | "route_requires_confirmation"
  | "engine_reconstruction";

export type DimensionKey =
  | "market_opportunity"
  | "legality"
  | "licence"
  | "fx_custody"
  | "clarity";

export interface RubricWeights {
  market_opportunity: number;
  legality: number;
  licence: number;
  fx_custody: number;
  clarity: number;
}

export interface DimensionInfo {
  key: DimensionKey;
  label: string;
  weight: number; // default (base) weight
  definition: string;
  source_type: SourceType;
}

export interface DeepDive {
  qualifies_reason: string;
  crypto_route: string;
  equities_route: string;
  required_product_changes: string;
  /** KYC / AML obligations for this route. Added in Round 2 (the build brief names KYC/AML as a rubric example); drafted from the deep-dive text and tagged until verified. */
  kyc_aml?: string;
  capital_and_licensing: string;
  commercial_adoption: string;
  local_payment_rail: string;
  main_hurdle: string;
  // Per-field provenance tags, present only where the deck flags a field.
  crypto_route_source_type?: SourceType;
  equities_route_source_type?: SourceType;
  commercial_adoption_source_type?: SourceType;
  kyc_aml_source_type?: SourceType;
}

export interface SequenceInfo {
  rank: number;
  window: string;
  label: string;
  go_gate: string[];
  rationale: string;
  if_delayed: string;
}

/** Countable facts about the entry route, read from the Round 1 deep dive. Sequencing inputs are DERIVED from these -- see sequencing.ts:deriveSequencingInputs(). */
export interface EntryFacts {
  licence_model: "own" | "partner" | "own_or_partner";
  product_rebuild: boolean; // core product must be re-engineered (e.g. perpetuals -> dated futures, single app -> partner-fronted)
  rail_via_partner: boolean; // local payment rail only reachable through a licensed payment partner
  partners_required: number; // count of licensed local partners the route depends on
  localisation_required: boolean; // new language / localisation load
  partner_fronted_onboarding: boolean; // customers onboard through a partner, not MochaTrade's own app
  source_type: SourceType;
  evidence?: string;
}

export interface Market {
  id: string;
  name: string;
  cleared: boolean;
  scores: Record<DimensionKey, number>;
  evidence_confidence: "high" | "limited";
  screening_score_deck: number;
  market_signal: string;
  deep_dive?: DeepDive;
  sequence?: SequenceInfo;
  adaptation_cost?: number; // 1 (lowest) - 5 (highest), only on cleared markets
  execution_dependency?: number; // 1 (lowest) - 5 (highest), only on cleared markets
  adaptation_execution_source_type?: SourceType;
  adaptation_execution_rationale?: string;
  screened_out_reason?: string; // only on cleared === false markets
  entry_facts?: EntryFacts; // when present, adaptation_cost / execution_dependency are derived from it
  entry_approach?: string; // one-sentence recommended entry approach (cleared markets)
  entry_approach_source_type?: SourceType;
  user_added?: boolean; // true for markets entered through the UI form
  /** "public_data": built at runtime from data/public-screen.json (Atlantic Council tracker + Chinn-Ito). A SCREEN, not a decision: never sequenced; a cleared screen gets "shortlist" (research first), never an entry verdict. */
  screen_source?: "public_data";
  /** Per-dimension evidence lines behind public-screen scores (also set on a user market whose sliders were prefilled from the screen). Shown under Assumptions as "Public-data screen". */
  screen_evidence?: Partial<Record<DimensionKey, string>>;
  currency?: string; // ISO 4217; set on user-entered markets from the country lookup (FX row)
  country_facts?: {
    // provenance of what the country lookup pre-filled -- data only, no engine logic reads it
    iso3: string | null;
    languages: string[];
    population: number | null;
    gdp_per_capita_usd: number | null;
    internet_users_pct: number | null;
    indicator_year: number | null;
    suggested_market_opportunity: number | null;
    source_type: SourceType;
    evidence: string;
  };
}

export interface Risk {
  id: string;
  title: string;
  subtitle: string;
  severity: "high" | "medium" | "low";
  markets: string[]; // market ids this risk applies to
  risk: string;
  why_it_matters: string;
  mitigation: string;
  market_notes?: Record<string, string>; // the clause of this risk that applies to a specific market id
  mitigation_notes?: Record<string, string>; // the mitigation scoped to a specific market id; falls back to `mitigation`
}

// ---- weights -----------------------------------------------------------

export interface WeightValidationResult {
  valid: boolean;
  errors: string[];
  sum: number;
}

/** Where a weight vector came from: a named preset, or user-adjusted. */
export interface WeightsProvenance {
  preset: string | null; // "base" | "regulation_heavy" | ... | null for custom
  source_type: SourceType;
  note: string;
}

export interface SequencingParameters {
  lambda_adaptation_cost: number;
  lambda_execution_dependency: number;
  source_type: SourceType;
  note: string;
}

// ---- computed outputs -------------------------------------------------

export interface DimensionContribution {
  raw: number; // 1-5 rubric score from the data
  weight: number; // weight used for this calculation
  contribution: number; // raw * weight (points out of 5)
  label: string;
  shareOfScore: number; // contribution / weightedScore, 0-1
}

export interface ScreeningResult {
  marketId: string;
  weightedScore: number; // 0-5, using the given weights
  weightedScore100: number; // same, rescaled 0-100 for UI convenience
  breakdown: Record<DimensionKey, DimensionContribution>;
}

export interface RankedMarket {
  market: Market;
  screening: ScreeningResult;
  rawRank: number; // 1 = highest weighted score
}

export interface SequencingInputs {
  weightedScore: number;
  adaptationCost: number;
  executionDependency: number;
  adaptationPenalty: number; // lambda_adaptation_cost * adaptation_cost
  executionPenalty: number; // lambda_execution_dependency * execution_dependency
  totalPenalty: number;
  source_type: SourceType; // provenance of adaptation_cost / execution_dependency
}

export interface SequencedMarket {
  market: Market;
  screening: ScreeningResult;
  sequenceRank: number; // 1 = enters first, per the engine's recommendation
  priorityIndex: number; // the number sequencing is actually sorted by
  inputs: SequencingInputs;
  deckSequenceRank: number | null; // Round 1 deck's own position, for comparison
}

export interface DivergenceExplanation {
  marketId: string;
  rawRank: number; // rank among all markets
  sequenceRank: number; // 0 when the market is not sequenced (screened out)
  diverges: boolean;
  explanation: string; // human-readable "why", built from adaptation_cost / execution_dependency / deck rationale
  sequenced: boolean;
  rawRankAmongCleared: number | null; // raw rank among sequenceable markets; this is what sequenceRank is compared against
  deckRationale: string | null;
}

// ---- decision ---------------------------------------------------------

export type RiskBand = "low" | "medium" | "high";
/**
 * Stage-based verdict. Every cleared market has go-gates, so "go with
 * conditions" never discriminated; the verdict now says WHEN to act.
 *  go_now   -- #1 in the entry sequence and its core (crypto) route is confirmed
 *  go_next  -- #2, or #1 whose core route still needs confirming: file now, launch after
 *  go_later -- #3+: wait for the earlier markets' go-gates
 *  shortlist -- public-data screen that clears: research the route first, commit no spend
 *  no_go    -- did not clear screening, or hit a regulatory blocker
 */
export type Verdict = "go_now" | "go_next" | "go_later" | "shortlist" | "no_go";

/** Regulatory-risk score: the 4 regulatory dimensions (legality, licence, fx_custody, clarity) weighted by their relative weights, inverted to a 0-100 risk figure. Market opportunity is excluded on purpose -- it is not a risk. */
export interface RegulatoryRisk {
  regulatoryScore: number; // 1-5, weighted mean of the 4 regulatory dimensions
  riskScore100: number; // 0 (no regulatory risk) - 100
  band: RiskBand;
  drivers: Array<{ key: DimensionKey; label: string; raw: number }>; // weakest dimensions first
}

export interface Decision {
  marketId: string;
  verdict: Verdict;
  verdictLabel: string; // "Enter now" / "Enter next" / "Enter later" / "Do not enter now"
  verdictReason: string; // one plain sentence: why this stage
  headline: string; // one sentence a non-specialist can act on
  entryApproach: string;
  entryApproachSource: SourceType;
  window: string | null;
  conditions: string[]; // go-gates + route confirmations that must close before launch
  risk: RegulatoryRisk;
  sequencePosition: number | null;
}

/** Does the entry order survive the 4 weight presets? */
export interface RobustnessReport {
  presets: Array<{ name: string; order: string[] }>; // market ids in sequence order per preset
  perMarket: Array<{ marketId: string; marketName: string; basePosition: number; positions: Record<string, number>; stablePresets: number; totalPresets: number }>;
  stable: boolean; // identical order under every preset
}

// ---- recommendation ----------------------------------------------------

/** A claim plus where it came from -- never presented as fact unless tagged so. */
export interface SourcedItem {
  field: string;
  label: string;
  statement: string;
  source_type: SourceType;
}

export interface Blocker {
  kind: "main_hurdle" | "go_gate" | "screened_out";
  text: string;
}

export interface Mitigation {
  source: string; // risk id, or "if_delayed" for the deck's fallback
  text: string;
}

export interface RiskSummary {
  id: string;
  title: string;
  severity: Risk["severity"];
  risk: string;
  why_it_matters: string;
}

export interface MarketRecommendation {
  marketId: string;
  marketName: string;
  status: "sequenced" | "screened_out";
  evidenceConfidence: Market["evidence_confidence"];
  score: {
    weightedScore: number;
    weightedScore100: number;
    deckScore: number;
    matchesDeckScore: boolean; // weightedScore rounds to the deck's printed score
  };
  breakdown: Array<DimensionContribution & { key: DimensionKey }>;
  rawRank: number;
  rawRankAmongCleared: number | null;
  sequencePosition: number | null; // null when not sequenced
  priorityIndex: number | null;
  sequencingInputs: SequencingInputs | null;
  entryWindow: { window: string; label: string; deckRank: number } | null; // deck's plan for this market
  divergence: DivergenceExplanation;
  goGates: string[];
  risks: RiskSummary[];
  blockers: Blocker[];
  mitigations: Mitigation[];
  complianceAdjustments: { summary: string; items: string[] } | null;
  assumptions: SourcedItem[];
  requiresConfirmation: SourcedItem[];
}

export interface EntryRecommendation {
  weights: RubricWeights;
  weightsProvenance: WeightsProvenance;
  sequencingParameters: SequencingParameters;
  rawRanking: Array<{ marketId: string; marketName: string; weightedScore: number; rawRank: number; cleared: boolean }>;
  sequence: Array<{ marketId: string; marketName: string; sequenceRank: number; priorityIndex: number; weightedScore: number }>;
  scoreOrderMatchesSequence: boolean; // false is the expected Round 1 result
  matchesDeckSequence: boolean; // engine sequence == deck's sequence.rank order
  markets: MarketRecommendation[]; // sequenced markets in entry order, then screened-out by raw rank
}

// ---- public engine API (implemented in index.ts) -----------------------

export interface MarketEntryEngine {
  /** All 9 markets, unmodified, straight from data/markets.json. */
  getAllMarkets(): Market[];

  /** One market by id, or undefined if not found. */
  getMarket(id: string): Market | undefined;

  /** Weighted screening score for one market under the given weights. Throws on invalid weights. */
  computeScreeningScore(market: Market, weights: RubricWeights): ScreeningResult;

  /** All markets ranked by raw weighted score, highest first. Throws on invalid weights. */
  rankMarkets(weights: RubricWeights): RankedMarket[];

  /**
   * Cleared markets (uae/brazil/indonesia) ordered by recommended entry
   * sequence -- NOT the same ordering as rankMarkets(). This must reproduce
   * Dubai -> Brazil -> Indonesia against the base weights. See
   * docs/SPEC.md for the formula.
   */
  recommendedSequence(weights: RubricWeights): SequencedMarket[];

  /** Explains why a market's raw rank and sequence rank differ (or don't). */
  explainDivergence(marketId: string, weights: RubricWeights): DivergenceExplanation;

  /** All risks tagged to a given market. */
  getRisksForMarket(marketId: string): Risk[];

  /** Named weight presets from data/markets.json (base / regulation_heavy / market_heavy / capital_tight). */
  getWeightPresets(): Record<string, RubricWeights>;

  /** The Round 1 base weights (slide 4): 25 / 25 / 20 / 15 / 15. */
  getDefaultWeights(): RubricWeights;

  /** The 5 rubric dimensions with labels, definitions and default weights. */
  getDimensions(): DimensionInfo[];

  /** Checks a weight vector: all 5 keys, finite, non-negative, summing to 1. Never throws. */
  validateWeights(weights: unknown): WeightValidationResult;

  /** Rescales non-negative weights (e.g. raw slider values) so they sum to 1. Throws if all are 0. */
  normalizeWeights(weights: Partial<RubricWeights>): RubricWeights;

  /** Which preset (if any) a weight vector matches, and its provenance. */
  describeWeights(weights: RubricWeights): WeightsProvenance;

  /** Lambdas used by the sequencing formula (engine_reconstruction). */
  getSequencingParameters(): SequencingParameters;

  /** Full structured recommendation: raw ranking, sequence, per-market detail. */
  getRecommendation(weights: RubricWeights): EntryRecommendation;

  /** Structured recommendation for one market, or undefined for an unknown id. */
  getMarketRecommendation(marketId: string, weights: RubricWeights): MarketRecommendation | undefined;

  /** Regulatory-risk score/band for a market under the given weights. */
  getRegulatoryRisk(marketId: string, weights: RubricWeights): RegulatoryRisk | undefined;

  /** The one-card decision: verdict, approach, window, conditions, risk band. */
  getDecision(marketId: string, weights: RubricWeights): Decision | undefined;

  /** Sequence under every named preset, and how stable each market's position is. */
  getRobustness(): RobustnessReport;

  /** Screening score a user-entered market must reach (at base weights) to be treated as cleared. */
  getClearThreshold(): number;

  /** A new engine over the same data plus extra (user-entered) markets. The base engine is untouched. */
  withMarkets(extra: Market[]): MarketEntryEngine;

  /** Derive adaptation_cost / execution_dependency from countable entry facts (the formula the sequence is built on). */
  deriveSequencingInputs(facts: EntryFacts): { adaptationCost: number; executionDependency: number; adaptationFormula: string; executionFormula: string };
}
