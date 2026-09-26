import { lambdaRangeForSequence } from "./sequencing";
import { describe, expect, it } from "vitest";
// The Round 1 acceptance suite runs on the deck dataset only; Round 2 research is covered in src/test/round2-research.test.tsx.
import { round1Engine as engine, InvalidWeightsError, DIMENSION_KEYS } from "./index";
import type { Market, RubricWeights } from "./index";
import { recommendedSequence } from "./sequencing";
import { rankMarkets } from "./scoring";

const base = engine.getDefaultWeights();
const ids = (xs: Array<{ market: Market }>) => xs.map((x) => x.market.id);
const cleared = (ws: RubricWeights) => engine.rankMarkets(ws).filter((r) => r.market.cleared);

function synthetic(id: string, s: number[], extra: Partial<Market> = {}): Market {
  const [market_opportunity, legality, licence, fx_custody, clarity] = s;
  return {
    id,
    name: id,
    cleared: true,
    scores: { market_opportunity, legality, licence, fx_custody, clarity },
    evidence_confidence: "high",
    screening_score_deck: 0,
    market_signal: "",
    ...extra,
  };
}

describe("default weights", () => {
  it("are the Round 1 slide-4 weights 25/25/20/15/15", () => {
    expect(base).toEqual({ market_opportunity: 0.25, legality: 0.25, licence: 0.2, fx_custody: 0.15, clarity: 0.15 });
    expect(engine.getWeightPresets().base).toEqual(base);
    expect(engine.describeWeights(base)).toMatchObject({ preset: "base", source_type: "verified_fact" });
  });

  it("every preset is valid and carries only the 5 dimension keys", () => {
    for (const w of Object.values(engine.getWeightPresets())) {
      expect(engine.validateWeights(w).valid).toBe(true);
      expect(Object.keys(w).sort()).toEqual([...DIMENSION_KEYS].sort());
    }
  });

  it("returns a copy, so callers cannot mutate engine state", () => {
    const w = engine.getDefaultWeights();
    w.legality = 0.9;
    expect(engine.getDefaultWeights().legality).toBe(0.25);
  });
});

describe("weighted calculation", () => {
  it("computes sum(score x weight) for Brazil, Dubai and Indonesia", () => {
    const score = (id: string) => engine.computeScreeningScore(engine.getMarket(id)!, base);
    expect(score("brazil").weightedScore).toBeCloseTo(3.9, 10);
    expect(score("uae").weightedScore).toBeCloseTo(3.75, 10);
    expect(score("indonesia").weightedScore).toBeCloseTo(3.625, 10);
    expect(score("brazil").weightedScore100).toBe(78);
  });

  it("reproduces every deck-printed screening score (1 dp) at base weights", () => {
    const rec = engine.getRecommendation(base);
    for (const m of rec.markets) expect(m.score.matchesDeckScore, m.marketId).toBe(true);
  });
});

describe("dimension contributions", () => {
  it("contribution = raw x weight and contributions sum to the score", () => {
    const r = engine.computeScreeningScore(engine.getMarket("indonesia")!, base);
    expect(r.breakdown.legality).toMatchObject({ raw: 3.5, weight: 0.25, contribution: 0.875, label: "Legality" });
    expect(r.breakdown.fx_custody.contribution).toBeCloseTo(0.3, 10);
    const sum = DIMENSION_KEYS.reduce((s, k) => s + r.breakdown[k].contribution, 0);
    expect(sum).toBeCloseTo(r.weightedScore, 6);
    const shares = DIMENSION_KEYS.reduce((s, k) => s + r.breakdown[k].shareOfScore, 0);
    expect(shares).toBeCloseTo(1, 3);
  });
});

describe("adjustable weights", () => {
  it("changing weights recalculates scores", () => {
    const market = engine.getMarket("uae")!;
    const legalityOnly = { market_opportunity: 0, legality: 1, licence: 0, fx_custody: 0, clarity: 0 };
    expect(engine.computeScreeningScore(market, legalityOnly).weightedScore).toBe(4);
    expect(engine.computeScreeningScore(market, legalityOnly).breakdown.legality.weight).toBe(1);
  });

  it("changing weights re-ranks markets", () => {
    const licenceHeavy = { market_opportunity: 0, legality: 0, licence: 0.5, fx_custody: 0.5, clarity: 0 };
    expect(ids(cleared(licenceHeavy))).toEqual(["uae", "brazil", "indonesia"]);
    expect(ids(cleared(base))).toEqual(["brazil", "uae", "indonesia"]);
  });

  it("recognises presets and flags custom weights as an assumption", () => {
    expect(engine.describeWeights(engine.getWeightPresets().capital_tight)).toMatchObject({
      preset: "capital_tight",
      source_type: "engine_reconstruction",
    });
    const custom = engine.normalizeWeights({ market_opportunity: 1, legality: 1, licence: 1, fx_custody: 1, clarity: 1 });
    expect(custom.legality).toBeCloseTo(0.2, 10);
    expect(engine.describeWeights(custom)).toMatchObject({ preset: null, source_type: "assumption" });
  });

  it("normalizeWeights rescales slider values to sum to 1", () => {
    const w = engine.normalizeWeights({ market_opportunity: 25, legality: 25, licence: 20, fx_custody: 15, clarity: 15 });
    expect(engine.validateWeights(w).valid).toBe(true);
    expect(w.market_opportunity).toBeCloseTo(0.25, 10);
  });
});

describe("invalid weights", () => {
  const market = engine.getMarket("brazil")!;
  const cases: Array<[string, unknown]> = [
    ["not summing to 1", { ...base, legality: 0.5 }],
    ["negative", { ...base, legality: -0.25, market_opportunity: 0.75 }],
    ["NaN", { ...base, clarity: NaN }],
    ["missing key", { market_opportunity: 0.25, legality: 0.25, licence: 0.35, fx_custody: 0.15 }],
    ["unknown key", { ...base, liquidity: 0 }],
    ["not an object", null],
  ];

  it.each(cases)("validateWeights rejects weights %s", (_, w) => {
    const r = engine.validateWeights(w);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it.each(cases)("scoring, ranking and sequencing throw on weights %s", (_, w) => {
    expect(() => engine.computeScreeningScore(market, w as RubricWeights)).toThrow(InvalidWeightsError);
    expect(() => engine.rankMarkets(w as RubricWeights)).toThrow(InvalidWeightsError);
    expect(() => engine.recommendedSequence(w as RubricWeights)).toThrow(InvalidWeightsError);
    expect(() => engine.getRecommendation(w as RubricWeights)).toThrow(InvalidWeightsError);
  });

  it("tolerates floating-point sums", () => {
    expect(engine.validateWeights({ market_opportunity: 0.1, legality: 0.2, licence: 0.3, fx_custody: 0.3, clarity: 0.1 }).valid).toBe(true);
  });

  it("normalizeWeights refuses all-zero or negative input", () => {
    expect(() => engine.normalizeWeights({})).toThrow(InvalidWeightsError);
    expect(() => engine.normalizeWeights({ legality: -1, licence: 2 })).toThrow(InvalidWeightsError);
  });
});

describe("multi-market ranking", () => {
  it("ranks all 9 markets by score, with contiguous ranks", () => {
    const r = engine.rankMarkets(base);
    expect(r).toHaveLength(9);
    expect(r.map((x) => x.rawRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].screening.weightedScore).toBeGreaterThanOrEqual(r[i].screening.weightedScore);
    }
    expect(ids(r)).toEqual([
      "brazil", "uae", "indonesia", "philippines", "nigeria", "pakistan", "thailand", "south_africa", "vietnam",
    ]);
  });

  it("is deterministic, including ties (broken by id)", () => {
    const tied = [synthetic("b", [3, 3, 3, 3, 3]), synthetic("a", [3, 3, 3, 3, 3]), synthetic("c", [4, 4, 4, 4, 4])];
    expect(ids(rankMarkets(tied, base))).toEqual(["c", "a", "b"]);
    expect(ids(rankMarkets([...tied].reverse(), base))).toEqual(["c", "a", "b"]);
    expect(engine.getRecommendation(base)).toEqual(engine.getRecommendation(base));
  });
});

describe("score vs sequence separation", () => {
  it("sequencing reorders markets that scoring ranks the other way", () => {
    const params = { lambda_adaptation_cost: 0.35, lambda_execution_dependency: 0.35, source_type: "engine_reconstruction" as const, note: "" };
    const hiScoreHiCost = synthetic("hi", [5, 5, 5, 5, 5], { adaptation_cost: 5, execution_dependency: 5 });
    const loScoreLoCost = synthetic("lo", [4, 4, 4, 4, 4], { adaptation_cost: 1, execution_dependency: 1 });
    expect(ids(rankMarkets([hiScoreHiCost, loScoreLoCost], base))).toEqual(["hi", "lo"]);
    expect(ids(recommendedSequence([hiScoreHiCost, loScoreLoCost], base, params))).toEqual(["lo", "hi"]);
  });

  it("sequence does not read the deck's hardcoded sequence.rank", () => {
    const params = { lambda_adaptation_cost: 0.35, lambda_execution_dependency: 0.35, source_type: "engine_reconstruction" as const, note: "" };
    const seqInfo = (rank: number) => ({ rank, window: "", label: "", go_gate: [], rationale: "", if_delayed: "" });
    const a = synthetic("a", [3, 3, 3, 3, 3], { adaptation_cost: 5, execution_dependency: 5, sequence: seqInfo(1) });
    const b = synthetic("b", [3, 3, 3, 3, 3], { adaptation_cost: 1, execution_dependency: 1, sequence: seqInfo(2) });
    const seq = recommendedSequence([a, b], base, params);
    expect(ids(seq)).toEqual(["b", "a"]);
    expect(seq[0].deckSequenceRank).toBe(2);
  });

  it("priorityIndex = weightedScore - lambdas x (adaptation, execution), with screening untouched", () => {
    const p = engine.getSequencingParameters();
    for (const s of engine.recommendedSequence(base)) {
      const expected = s.screening.weightedScore - p.lambda_adaptation_cost * s.inputs.adaptationCost - p.lambda_execution_dependency * s.inputs.executionDependency;
      expect(s.priorityIndex).toBeCloseTo(expected, 4);
      expect(s.screening).toEqual(engine.computeScreeningScore(s.market, base));
    }
  });

  it("only cleared markets with sequencing inputs are sequenced", () => {
    const seq = engine.recommendedSequence(base);
    expect(seq.every((s) => s.market.cleared)).toBe(true);
    expect(seq).toHaveLength(3);
    expect(engine.explainDivergence("vietnam", base)).toMatchObject({ sequenced: false, sequenceRank: 0, diverges: false });
  });

  it("the sequence responds to weights because the score is an input", () => {
    const seqBase = engine.recommendedSequence(base);
    const seqMarket = engine.recommendedSequence(engine.getWeightPresets().market_heavy);
    expect(seqMarket[0].priorityIndex).not.toBe(seqBase[0].priorityIndex);
  });
});

describe("Round 1 acceptance case", () => {
  it("raw score: Brazil > Dubai/UAE > Indonesia", () => {
    const r = cleared(base);
    expect(ids(r)).toEqual(["brazil", "uae", "indonesia"]);
    expect(r[0].screening.weightedScore).toBeGreaterThan(r[1].screening.weightedScore);
    expect(r[1].screening.weightedScore).toBeGreaterThan(r[2].screening.weightedScore);
  });

  it("strategic sequence: Dubai/UAE -> Brazil -> Indonesia", () => {
    const s = engine.recommendedSequence(base);
    expect(ids(s)).toEqual(["uae", "brazil", "indonesia"]);
    expect(s.map((x) => x.sequenceRank)).toEqual([1, 2, 3]);
    expect(s.every((x) => x.sequenceRank === x.deckSequenceRank)).toBe(true);
  });

  it("the recommendation reports score != sequence and matches the deck", () => {
    const rec = engine.getRecommendation(base);
    expect(rec.scoreOrderMatchesSequence).toBe(false);
    expect(rec.matchesDeckSequence).toBe(true);
    expect(rec.sequence.map((s) => s.marketId)).toEqual(["uae", "brazil", "indonesia"]);
    expect(rec.rawRanking.slice(0, 3).map((r) => r.marketId)).toEqual(["brazil", "uae", "indonesia"]);
  });

  it("explains the Brazil / Dubai divergence and Indonesia's non-divergence", () => {
    const brazil = engine.explainDivergence("brazil", base);
    expect(brazil).toMatchObject({ rawRank: 1, rawRankAmongCleared: 1, sequenceRank: 2, diverges: true, sequenced: true });
    expect(brazil.explanation).toContain("Dubai (UAE)");
    expect(brazil.explanation).toContain("148M+ Pix users");

    const uae = engine.explainDivergence("uae", base);
    expect(uae).toMatchObject({ rawRankAmongCleared: 2, sequenceRank: 1, diverges: true });
    expect(uae.explanation).toContain("ahead of higher-scoring Brazil");

    expect(engine.explainDivergence("indonesia", base)).toMatchObject({ rawRankAmongCleared: 3, sequenceRank: 3, diverges: false });
  });
});

describe("recommendation output", () => {
  const rec = engine.getRecommendation(base);
  const byId = (id: string) => rec.markets.find((m) => m.marketId === id)!;

  it("lists sequenced markets in entry order, then screened-out markets by raw rank", () => {
    expect(rec.markets.map((m) => m.marketId)).toEqual([
      "uae", "brazil", "indonesia", "philippines", "nigeria", "pakistan", "thailand", "south_africa", "vietnam",
    ]);
  });

  it("exposes score, breakdown, raw rank, sequence position and divergence", () => {
    const brazil = byId("brazil");
    expect(brazil).toMatchObject({
      status: "sequenced",
      rawRank: 1,
      rawRankAmongCleared: 1,
      sequencePosition: 2,
      entryWindow: { window: "Months 6-12", label: "Commercial scale", deckRank: 2 },
    });
    expect(brazil.score).toMatchObject({ weightedScore: 3.9, deckScore: 3.9, matchesDeckScore: true });
    expect(brazil.breakdown.map((b) => b.key)).toEqual([...DIMENSION_KEYS]);
    expect(brazil.priorityIndex).toBeCloseTo(2.15, 4);
    expect(brazil.sequencingInputs).toMatchObject({ adaptationCost: 3, executionDependency: 2, source_type: "calculated" });
    expect(brazil.divergence.diverges).toBe(true);
  });

  it("exposes risks, blockers, mitigations and compliance adjustments from data", () => {
    const brazil = byId("brazil");
    expect(brazil.risks.map((r) => r.id).sort()).toEqual(
      engine.getRisksForMarket("brazil").map((r) => r.id).sort(),
    );
    expect(brazil.blockers[0]).toEqual({ kind: "main_hurdle", text: "BCB SPSAV + B3 access" });
    expect(brazil.blockers.filter((b) => b.kind === "go_gate")).toHaveLength(3);
    expect(brazil.mitigations[brazil.mitigations.length - 1]).toEqual({
      source: "if_delayed",
      text: "Fallback if delayed: Hold at US equities until B3 access and product classification are confirmed.",
    });
    expect(brazil.complianceAdjustments?.items).toEqual([
      "Rebuild perpetuals as dated futures",
      "Add Pix funding and withdrawal",
      "Identify wallet owners on self-custody transfers",
      "CPF-based KYC with COAF suspicious-activity reporting",
    ]);
  });

  it("separates assumptions and route-requires-confirmation items by source_type", () => {
    const uae = byId("uae");
    expect(uae.requiresConfirmation.map((i) => i.field)).toEqual(["deep_dive.equities_route"]);
    expect(uae.assumptions.map((i) => i.field)).toEqual(
      expect.arrayContaining(["deep_dive.commercial_adoption", "adaptation_cost", "execution_dependency", "sequencing_formula"]),
    );
    const indonesia = byId("indonesia");
    expect(indonesia.requiresConfirmation.map((i) => i.field)).toEqual(["deep_dive.crypto_route", "deep_dive.equities_route"]);
    for (const m of rec.markets) {
      expect(m.requiresConfirmation.every((i) => i.source_type === "route_requires_confirmation")).toBe(true);
      expect(m.assumptions.every((i) => i.source_type !== "verified_fact")).toBe(true);
    }
    // base weights are the deck's printed weights, so they are not an assumption
    expect(uae.assumptions.some((i) => i.field === "weights")).toBe(false);
    const custom = engine.getMarketRecommendation("uae", engine.getWeightPresets().regulation_heavy)!;
    expect(custom.assumptions.find((i) => i.field === "weights")?.source_type).toBe("engine_reconstruction");
  });

  it("handles screened-out markets without inventing a sequence", () => {
    const vn = byId("vietnam");
    expect(vn).toMatchObject({
      status: "screened_out",
      sequencePosition: null,
      priorityIndex: null,
      sequencingInputs: null,
      entryWindow: null,
      complianceAdjustments: null,
      rawRankAmongCleared: null,
      evidenceConfidence: "limited",
    });
    expect(vn.blockers).toEqual([{ kind: "screened_out", text: engine.getMarket("vietnam")!.screened_out_reason }]);
    expect(vn.assumptions.map((a) => a.field)).toEqual(["evidence_confidence"]);
    expect(vn.divergence.explanation).toContain("not in the entry sequence");
  });

  it("getMarketRecommendation matches the full report and handles unknown ids", () => {
    expect(engine.getMarketRecommendation("uae", base)).toEqual(byId("uae"));
    expect(engine.getMarketRecommendation("atlantis", base)).toBeUndefined();
    expect(engine.explainDivergence("atlantis", base)).toMatchObject({ rawRank: 0, sequenced: false });
  });
});

describe("derived sequencing inputs (entry_facts)", () => {
  it("reproduces the deck's qualitative ordering from countable facts: Dubai 1/1, Brazil 3/2, Indonesia 4/5", () => {
    const seq = engine.recommendedSequence(engine.getDefaultWeights());
    const byId = Object.fromEntries(seq.map((s) => [s.market.id, [s.inputs.adaptationCost, s.inputs.executionDependency]]));
    expect(byId.uae).toEqual([1, 1]);
    expect(byId.brazil).toEqual([3, 2]);
    expect(byId.indonesia).toEqual([4, 5]);
  });

  it("caps derived scores to 1-5", () => {
    const d = engine.deriveSequencingInputs({
      licence_model: "partner",
      product_rebuild: true,
      rail_via_partner: true,
      partners_required: 9,
      localisation_required: true,
      partner_fronted_onboarding: true,
      source_type: "assumption",
    });
    expect(d.adaptationCost).toBe(4);
    expect(d.executionDependency).toBe(5);
  });
});

describe("decision layer", () => {
  const w = engine.getDefaultWeights();

  it("gives Dubai a low regulatory risk band and Vietnam a high one", () => {
    expect(engine.getRegulatoryRisk("uae", w)?.band).toBe("low");
    expect(engine.getRegulatoryRisk("vietnam", w)?.band).toBe("high");
  });

  it("issues a stage-based verdict: enter now / next / later, and no-go for screened-out markets", () => {
    expect(engine.getDecision("uae", w)?.verdict).toBe("go_now");
    expect(engine.getDecision("brazil", w)?.verdict).toBe("go_next");
    expect(engine.getDecision("indonesia", w)?.verdict).toBe("go_later");
    expect(engine.getDecision("brazil", w)?.conditions.length).toBeGreaterThan(0);
    expect(engine.getDecision("thailand", w)?.verdict).toBe("no_go");
  });

  it("gives the three cleared markets three different verdicts, each with a label and a reason", () => {
    const ds = ["uae", "brazil", "indonesia"].map((id) => engine.getDecision(id, w)!);
    expect(new Set(ds.map((d) => d.verdict)).size).toBe(3);
    for (const d of ds) {
      expect(d.verdictLabel.length).toBeGreaterThan(0);
      expect(d.verdictReason.length).toBeGreaterThan(0);
    }
  });

  it("never says 'enter now' for a #1 market whose crypto route is unconfirmed", () => {
    const withNew = engine.withMarkets([
      {
        id: "custom_topland",
        name: "Topland",
        cleared: true,
        user_added: true,
        scores: { market_opportunity: 5, legality: 5, licence: 5, fx_custody: 5, clarity: 5 },
        evidence_confidence: "limited",
        screening_score_deck: 5,
        market_signal: "test",
        entry_facts: { licence_model: "own", product_rebuild: false, rail_via_partner: false, partners_required: 0, localisation_required: false, partner_fronted_onboarding: false, source_type: "assumption", evidence: "test" },
        sequence: { rank: 0, window: "Window not yet set", label: "User-entered", go_gate: [], rationale: "test", if_delayed: "test" },
        deep_dive: {
          qualifies_reason: "test",
          crypto_route: "Route not yet documented",
          crypto_route_source_type: "route_requires_confirmation",
          equities_route: "Route not yet documented",
          equities_route_source_type: "route_requires_confirmation",
          required_product_changes: "x",
          capital_and_licensing: "x",
          commercial_adoption: "x",
          local_payment_rail: "x",
          main_hurdle: "x",
        },
      } as never,
    ]);
    const d = withNew.getDecision("custom_topland", w)!;
    expect(d.sequencePosition).toBe(1);
    expect(d.verdict).toBe("go_next");
  });

  it("divergence prose uses the deck's one-decimal precision and no raw priority-index numbers", () => {
    for (const id of ["uae", "brazil", "indonesia"]) {
      const text = engine.explainDivergence(id, w).explanation;
      expect(text).not.toMatch(/\d\.\d{2}/);
      expect(text).not.toMatch(/priority index/i);
    }
    expect(engine.explainDivergence("uae", w).explanation).toContain("3.8/5");
    expect(engine.explainDivergence("indonesia", w).explanation).toContain("3.6/5");
  });

  it("the deck sequence is stable under all four presets", () => {
    const r = engine.getRobustness();
    expect(r.stable).toBe(true);
    expect(r.perMarket.map((m) => m.marketId)).toEqual(["uae", "brazil", "indonesia"]);
  });

  it("withMarkets() adds a user-entered market without touching the base engine", () => {
    const extra = engine.withMarkets([
      {
        id: "custom_x",
        name: "Testland",
        cleared: true,
        user_added: true,
        scores: { market_opportunity: 5, legality: 5, licence: 5, fx_custody: 5, clarity: 5 },
        evidence_confidence: "limited",
        screening_score_deck: 5,
        market_signal: "user input",
        entry_facts: { licence_model: "own", product_rebuild: false, rail_via_partner: false, partners_required: 0, localisation_required: false, partner_fronted_onboarding: false, source_type: "assumption" },
      },
    ]);
    expect(extra.recommendedSequence(w)[0].market.id).toBe("custom_x");
    expect(engine.recommendedSequence(w)[0].market.id).toBe("uae");
    expect(engine.getAllMarkets().length).toBe(9);
    expect(extra.getRisksForMarket("custom_x").length).toBe(7); // 4 deck risks + 3 new cross-cutting risks (all have >= 3 markets)
  });
});

describe("lambdaRangeForSequence (v2.6.6)", () => {
  const mk = (score: number, a: number, e: number, L = 0.35) => ({
    priorityIndex: score - L * (a + e),
    inputs: { weightedScore: score, adaptationCost: a, executionDependency: e },
  });
  it("Round 1 order (Dubai 3.8/1/1, Brazil 3.9/3/2, Indonesia 3.6/4/5) holds for any lambda above ~0.033", () => {
    const r = lambdaRangeForSequence([mk(3.8, 1, 1), mk(3.9, 3, 2), mk(3.6, 4, 5)]);
    expect(r.holds).toBe(true);
    expect(r.min).toBeCloseTo(0.1 / 3, 3);
    expect(r.max).toBeNull();
  });
  it("reports an upper bound when a higher-scoring, higher-friction market sits first", () => {
    const r = lambdaRangeForSequence([mk(4.5, 3, 3, 0.1), mk(4.0, 1, 1, 0.1)]);
    expect(r.max).toBeCloseTo(0.125, 3);
    expect(r.holds).toBe(true);
  });
});
