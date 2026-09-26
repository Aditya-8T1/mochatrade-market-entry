// Regression tests for the Round 2 review fixes:
//  1. a cleared public-data screen gets "shortlist", never an entry verdict
//  2. regulatory knock-out (legality <= 2 or licence <= 1) -- the Mexico case
//  3. half-up score display (South Africa 2.05 -> "2.1", matching the deck)
//  4. mitigations are scoped to the selected market
//  5. product-change checklist items are whole tasks
import { describe, it, expect } from "vitest";
import { engine, formatScore, mitigationFor, regulatoryBlocker } from "../engine";
import type { Market } from "../engine/types";
import { getPublicScreen, opportunityFill, publicScreenMarket } from "../data-provider/publicScreenProvider";

/** A public-data screen market with a fixed opportunity score, so the test does not depend on World Bank data. */
function screenMarket(iso3: string, opportunity: number): Market {
  const c = getPublicScreen(iso3)!;
  const opp = { ...opportunityFill(null, null, c.name), score: opportunity };
  const probe: Market = {
    id: "probe", name: c.name, cleared: false,
    scores: { market_opportunity: opportunity, legality: c.scores.legality, licence: c.scores.licence, fx_custody: c.scores.fx_custody, clarity: c.scores.clarity },
    evidence_confidence: "limited", screening_score_deck: 0, market_signal: "",
  };
  const baseScore = engine.computeScreeningScore(probe, engine.getDefaultWeights()).weightedScore;
  return publicScreenMarket(c, { baseScore, clearThreshold: engine.getClearThreshold(), opportunity: opp });
}

describe("review fixes", () => {
  const w = engine.getDefaultWeights();

  it("Mexico (legality 2, licence 1) is screened out on a regulatory blocker even though its score clears 3.0", () => {
    const mex = screenMarket("MEX", 4.5);
    const score = engine.computeScreeningScore(mex, w).weightedScore;
    expect(score).toBeGreaterThanOrEqual(engine.getClearThreshold());
    expect(mex.cleared).toBe(false);
    expect(mex.screened_out_reason).toMatch(/Regulatory blocker: legality 2\/5, licence 1\/5/);
    const d = engine.withMarkets([mex]).getDecision(mex.id, w)!;
    expect(d.verdict).toBe("no_go");
  });

  it("a cleared public-data screen (Canada) is 'shortlist', never an entry verdict, and never sequenced", () => {
    const can = screenMarket("CAN", 4);
    expect(can.cleared).toBe(true);
    const e2 = engine.withMarkets([can]);
    const d = e2.getDecision(can.id, w)!;
    expect(d.verdict).toBe("shortlist");
    expect(d.verdictLabel).toBe("Shortlist, research first");
    expect(e2.recommendedSequence(w).map((s) => s.market.id)).toEqual(["uae", "brazil", "indonesia"]);
  });

  it("the knock-out never affects the Round 1 cleared markets", () => {
    for (const id of ["uae", "brazil", "indonesia"]) expect(regulatoryBlocker(engine.getMarket(id)!.scores)).toBeNull();
    for (const preset of Object.values(engine.getWeightPresets())) {
      expect(engine.recommendedSequence(preset).map((s) => s.market.id)).toEqual(["uae", "brazil", "indonesia"]);
    }
  });

  it("displays scores half-up, so every screened market matches its Round 1 deck score", () => {
    expect(formatScore(2.05)).toBe("2.1");
    expect(formatScore(2.25)).toBe("2.3");
    expect(formatScore(3.75)).toBe("3.8");
    for (const m of engine.getAllMarkets()) {
      const shown = formatScore(engine.computeScreeningScore(m, w).weightedScore);
      expect(shown, m.id).toBe(m.screening_score_deck.toFixed(1));
    }
  });

  it("mitigations shown for a market never name another market's rails or partners", () => {
    const others: Record<string, RegExp> = {
      uae: /Brazil|Indonesia|Pix|QRIS|BI-FAST/,
      brazil: /Aani|QRIS|BI-FAST|Indonesia/,
      indonesia: /Aani|Pix\b|Brazil/,
    };
    for (const [id, bad] of Object.entries(others)) {
      const rec = engine.getMarketRecommendation(id, w)!;
      for (const m of rec.mitigations.filter((x) => x.source !== "if_delayed")) expect(m.text, `${id}: ${m.text}`).not.toMatch(bad);
      for (const r of engine.getRisksForMarket(id)) expect(mitigationFor(r, id)).not.toMatch(bad);
    }
    const uaeMit = engine.getMarketRecommendation("uae", w)!.mitigations;
    expect(uaeMit[uaeMit.length - 1].text).toMatch(/^Fallback if delayed: /);
  });

  it("product-change checklist items are whole tasks that start with a capital letter", () => {
    for (const id of ["uae", "brazil", "indonesia"]) {
      const items = engine.getMarketRecommendation(id, w)!.complianceAdjustments!.items;
      for (const it of items) expect(it, `${id}: ${it}`).toMatch(/^[A-Z]/);
      expect(items.join(" ")).not.toMatch(/Less revenue per user/);
    }
  });
});
