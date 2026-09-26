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
import round2 from "../../data/round2-research.json";
import whyNotNow from "../../data/why-not-now.json";
import type {
  DimensionInfo,
  DimensionKey,
  ResearchNotes,
  Market,
  MarketEntryEngine,
  Risk,
  RubricWeights,
  SequencingParameters,
  SourceType,
  WhyNotNow,
} from "./types";
import * as scoring from "./scoring";
import * as sequencing from "./sequencing";
import * as recommendation from "./recommendation";
import type { EngineData, WeightPreset } from "./recommendation";
import * as weightsLib from "./weights";
import * as decision from "./decision";

const ROUND1_MARKETS = markets.markets as unknown as Market[];
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

const CLEAR_THRESHOLD: number = (markets.rubric as unknown as { clear_threshold?: { value: number } }).clear_threshold?.value ?? 3.0;

// ---------------------------------------------------------------------------
// Round 2 research (data/round2-research.json, imported from the research
// workbook by scripts/import-round2-research.py).
//  - The six Round 1 screened-out markets get research notes attached; their
//    deck scores and text are untouched.
//  - Each Round 2 market is scored on the same rubric. It clears at base
//    weights when score >= threshold AND it passes the regulatory knock-out.
//    It is ranked but never sequenced: the workbook has no entry route,
//    timing window or go-gates, so it has no entry_facts.
// ---------------------------------------------------------------------------
interface Round2Row {
  id: string;
  name: string;
  list: "additional" | "reserve";
  scores: Record<DimensionKey, number>;
  screening_score_sheet: number;
  research: ResearchNotes;
  deep_dive?: Market["deep_dive"];
}
const ROUND2 = round2 as unknown as { round1_notes: Record<string, ResearchNotes>; markets: Round2Row[] };

const firstSentence = (s: string | undefined) => (s ?? "").split(/(?<=[.;])\s/)[0].replace(/[.;]$/, "").trim();

/** Strip evidence tags like [A], [V-primary], [A - unsourced] and trailing punctuation. */
const untag = (s: string) => s.replace(/\s*\[[A-Z][^\]]*\]/g, "").replace(/[.;:,]\s*$/, "").trim();

/**
 * One-line signal for a researched Round 2 market, in the same spirit as the
 * Round 1 signals ("Pix · SPSAV regime live"): the licensing regime named in
 * the research plus the payment rail. The researcher's flags are working
 * notes ("PDF opened is a 2022 version") and are shown on the Research tab,
 * not in the market table. Reserve markets keep the reserve sheet's reason.
 */
function round2Signal(r: ResearchNotes): string {
  if (r.reserve_reason) return firstSentence(r.reserve_reason);
  const parts: string[] = [];
  const regime = untag((r.capital_and_licensing ?? "").replace(/\s*\([^)]*\)/g, "").split(/[:;]|\.\s/)[0]);
  if (regime) parts.push(regime.length > 64 ? regime.slice(0, 61).replace(/\s+\S*$/, "") + "…" : regime);
  const rail = untag((r.payment_rail ?? "").split(/[;]/)[0]);
  if (rail && !/^not verified/i.test(rail) && !/^no named/i.test(rail)) parts.push(rail.length > 48 ? rail.slice(0, 45).replace(/\s+\S*$/, "") + "…" : rail);
  return parts.join(" · ") || firstSentence(r.flags);
}

function round2Market(row: Round2Row): Market {
  const base = { ...PRESETS.base.weights };
  const draft: Market = {
    id: row.id,
    name: row.name,
    cleared: false,
    scores: row.scores,
    evidence_confidence: "limited",
    screening_score_deck: row.screening_score_sheet,
    market_signal: round2Signal(row.research),
    research: row.research,
    research_source: "round2",
    research_list: row.list,
    deep_dive: row.deep_dive,
  };
  const score = scoring.computeScreeningScore(draft, base, {}).weightedScore;
  // The country's own reason: the reserve sheet's reason, else the researcher's flags.
  const detail = row.research.reserve_reason ?? row.research.flags;
  const blocker = decision.regulatoryBlocker(row.scores, detail);
  const cleared = score >= CLEAR_THRESHOLD - 1e-9 && !blocker;
  const low = Math.min(...Object.values(row.scores));
  const weakest = DIMENSIONS.filter((d) => row.scores[d.key] === low).map((d) => `${d.label} ${low}/5`).join(", ");
  return {
    ...draft,
    cleared,
    screened_out_reason: cleared
      ? undefined
      : blocker ??
        `Screening score ${weightsLib.formatScore(score)}/5 is below the ${CLEAR_THRESHOLD.toFixed(1)} threshold; weakest: ${weakest}.${detail ? ` ${detail}` : ""}`,
  };
}

const WHY_NOT_NOW = (whyNotNow as unknown as { markets: Record<string, WhyNotNow> }).markets;

/** Attach the rubric-by-rubric "why not now" to every screened-out market that has one. Cleared markets never carry it. */
function withWhyNotNow(m: Market): Market {
  const w = WHY_NOT_NOW[m.id];
  return w && !m.cleared ? { ...m, why_not_now: w } : m;
}

const ALL_MARKETS: Market[] = [
  ...ROUND1_MARKETS.map((m) => (ROUND2.round1_notes[m.id] ? { ...m, research: ROUND2.round1_notes[m.id] } : m)),
  ...ROUND2.markets.map(round2Market),
].map(withWhyNotNow);

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

/**
 * The Round 1 deck dataset only (the nine deck markets, no Round 2 research).
 * Used by the deck-faithfulness tests, and by UI tests of mechanics (screens,
 * user entries) that must not depend on which countries have been researched.
 */
export const round1Engine: MarketEntryEngine = createEngine({ ...DATA, markets: ROUND1_MARKETS });

export { InvalidWeightsError, DIMENSION_KEYS, formatScore } from "./weights";
export { mitigationFor } from "./recommendation";
export { regulatoryBlocker, KNOCKOUT_RULE, LEGALITY_BLOCKER, LICENCE_BLOCKER } from "./decision";
export * from "./types";
