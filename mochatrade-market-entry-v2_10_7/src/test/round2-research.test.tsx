// Round 2 research integration (data/round2-research.json, imported from the
// team's research workbook by scripts/import-round2-research.py).
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openMarket, openTab, queueOrder, renderApp } from "./harness";
import { engine, round1Engine } from "../engine";
import { buildBrief } from "../export/brief";
import { marketQueueGroups } from "../components/marketQueue";
import round2 from "../../data/round2-research.json";
import markets from "../../data/markets.json";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const w = engine.getDefaultWeights();
const R2 = round2.markets;
const r2Markets = () => engine.getAllMarkets().filter((m) => m.research_source === "round2");

describe("Round 2 research: data", () => {
  it("imports 24 markets (16 additional + 8 reserve) and research notes for the six Round 1 screened-out markets", () => {
    expect(R2.filter((m) => m.list === "additional")).toHaveLength(16);
    expect(R2.filter((m) => m.list === "reserve")).toHaveLength(8);
    expect(Object.keys(round2.round1_notes).sort()).toEqual(["nigeria", "pakistan", "philippines", "south_africa", "thailand", "vietnam"]);
    expect(engine.getAllMarkets()).toHaveLength(9 + 24);
    expect(new Set(engine.getAllMarkets().map((m) => m.id)).size).toBe(33);
  });

  it("every workbook score is reproduced by the engine on the Round 1 rubric", () => {
    for (const row of R2) {
      const score = engine.computeScreeningScore(engine.getMarket(row.id)!, w).weightedScore;
      expect(Math.abs(score - row.screening_score_sheet), row.id).toBeLessThan(0.006);
    }
  });

  it("every workbook priority index matches score - 0.35 x adaptation - 0.35 x execution", () => {
    for (const row of R2.filter((r) => "priority_index_sheet" in r) as Array<(typeof R2)[number] & { priority_index_sheet: number }>) {
      const m = engine.getMarket(row.id)!;
      const score = engine.computeScreeningScore(m, w).weightedScore;
      const pi = score - 0.35 * m.research!.adaptation_cost! - 0.35 * m.research!.execution_dependency!;
      expect(Math.abs(pi - row.priority_index_sheet), row.id).toBeLessThan(0.006);
    }
  });

  it("Round 1 markets keep their deck scores and text verbatim; research is attached alongside", () => {
    for (const deck of markets.markets) {
      const m = engine.getMarket(deck.id)!;
      expect(m.scores).toEqual(deck.scores);
      expect(m.market_signal).toBe(deck.market_signal);
      expect(m.screened_out_reason).toBe((deck as { screened_out_reason?: string }).screened_out_reason);
    }
    expect(engine.getMarket("south_africa")!.research!.deck_check).toMatch(/310 CASPs/);
    expect(engine.getMarket("uae")!.research).toBeUndefined();
  });
});

describe("Round 2 research: decisions", () => {
  it("clears exactly the five markets that pass the threshold and the regulatory knock-out", () => {
    const cleared = r2Markets().filter((m) => m.cleared).map((m) => m.id).sort();
    expect(cleared).toEqual(["bahrain", "el_salvador", "kazakhstan", "kenya", "peru"]);
    // Mexico scores exactly 3.0 but legality 2 -> regulatory blocker
    const mex = engine.getMarket("mexico")!;
    expect(engine.computeScreeningScore(mex, w).weightedScore).toBeCloseTo(3.0, 6);
    expect(mex.cleared).toBe(false);
    expect(mex.screened_out_reason).toMatch(/^Regulatory blocker: legality 2\/5/);
  });

  it("every screened-out market gives its own reason, not a shared template", () => {
    const reasons = engine.getAllMarkets().filter((m) => !m.cleared).map((m) => m.screened_out_reason!);
    expect(reasons.every(Boolean)).toBe(true);
    expect(new Set(reasons).size).toBe(reasons.length);
    // the country's own evidence is in the reason; the rule is stated once, under Assumptions
    expect(engine.getMarket("egypt")!.screened_out_reason).toContain("Law 194/2020");
    expect(engine.getMarket("mauritius")!.screened_out_reason).toMatch(/weakest: Market Opportunity 1\/5\. Hub\/licensing base/);
    const egyptRec = engine.getMarketRecommendation("egypt", w)!;
    expect(egyptRec.assumptions.some((a) => a.field === "knockout_rule")).toBe(true);
  });

  it("never sequences a Round 2 market: the entry plan is UAE, Brazil, Indonesia under every preset", () => {
    for (const preset of Object.values(engine.getWeightPresets())) {
      expect(engine.recommendedSequence(preset).map((s) => s.market.id)).toEqual(["uae", "brazil", "indonesia"]);
      expect(engine.recommendedSequence(preset).map((s) => s.market.id)).toEqual(round1Engine.recommendedSequence(preset).map((s) => s.market.id));
    }
  });

  it("the Round 1 markets' decisions are identical with and without the Round 2 research", () => {
    for (const id of ["uae", "brazil", "indonesia"]) {
      expect(engine.getDecision(id, w)).toEqual(round1Engine.getDecision(id, w));
    }
  });

  it("a cleared Round 2 market is 'shortlist' with an indicative priority against the plan; the rest are no_go", () => {
    for (const m of r2Markets()) {
      const d = engine.getDecision(m.id, w)!;
      expect(d.sequencePosition).toBeNull();
      if (m.cleared) {
        expect(d.verdict).toBe("shortlist");
        expect(d.verdictReason).toMatch(/Indicative entry priority -?\d+\.\d\d/);
        expect(d.conditions[d.conditions.length - 1]).toMatch(/entry route, timing window and go-gates/);
      } else {
        expect(d.verdict, m.id).toBe("no_go");
        // v2.10.5: every researched no-go carries a rubric-by-rubric "why not now";
        // its conditions are one line per failing dimension, not the blocker string.
        expect(d.whyNotNow, m.id).toBeTruthy();
        expect(d.verdictReason).toBe(m.why_not_now!.summary);
        expect(d.conditions).toHaveLength(m.why_not_now!.dimensions.length);
        expect(d.conditions[0]).toMatch(/^(Market Opportunity|Legality|Licence|FX \/ Custody|Clarity) \d(\.\d)?\/5 — /);
      }
    }
    // El Salvador's researched priority (1.65) is above Indonesia's (#3 in the plan)
    expect(engine.getDecision("el_salvador", w)!.verdictReason).toMatch(/higher than Indonesia/);
  });

  it("the brief carries the research section, sources and evidence-tag legend", () => {
    const d = engine.getDecision("kenya", w)!;
    const rec = engine.getMarketRecommendation("kenya", w)!;
    const text = buildBrief(engine.getMarket("kenya")!, d, rec, engine.getRisksForMarket("kenya"));
    expect(text).toContain("## Decision: Shortlist, research first");
    expect(text).toContain("## Round 2 research");
    expect(text).toContain("[A] assumption");
    expect(text).toMatch(/- \*\*Sources:\*\*\n {2}- https:\/\//);
  });
});

describe("Round 2 research: through the app", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("lists Round 2 markets under their own divider, after the nine Round 1 markets", () => {
    renderApp();
    const ids = queueOrder();
    const { core, round2: r2, ordered } = marketQueueGroups(engine.rankMarkets(w));
    expect(ids).toEqual(ordered.map((r) => r.market.id));
    expect(core).toHaveLength(9);
    expect(r2).toHaveLength(24);
    expect(screen.getByTestId("round2-markets-divider")).toHaveTextContent("24 markets");
  });

  it.each(["el_salvador", "kenya", "mexico", "turkey"])("selecting %s shows the research panel with no undefined/NaN", async (id) => {
    const user = userEvent.setup();
    renderApp();
    await openMarket(user, id);
    // Replaced: the R2 badge moved from the decision card into the market page header.
    expect(within(screen.getByTestId("market-header")).getByTestId("round2-badge")).toBeInTheDocument();
    // badge: a cleared Round 2 market is a shortlist, not "screened out"
    const summary = screen.getByTestId("recommendation-summary");
    if (engine.getMarket(id)!.cleared) {
      expect(within(summary).getByTestId("round2-shortlist-badge")).toHaveTextContent(/round 2 shortlist/i);
      expect(summary.textContent).not.toMatch(/screened out/i);
    } else {
      expect(summary.textContent).toMatch(/screened out/i);
    }
    await openTab(user, "research");
    const panel = screen.getByTestId("research-notes");
    expect(panel.textContent).not.toMatch(/undefined|NaN/);
    if (engine.getMarket(id)!.research_list === "reserve") {
      // the reserve sheet gives a reason, not source links
      expect(within(panel).getByTestId("research-reserve-reason").textContent).toContain(engine.getMarket(id)!.research!.reserve_reason!.slice(0, 20));
    } else {
      expect(within(panel).getByTestId("research-sources").querySelectorAll("a[href^='https://']").length).toBeGreaterThan(0);
    }
    await openTab(user, "scores");
    expect(screen.getByTestId("scorecard")).toHaveTextContent("matches research sheet");
  });

  it("general method notes are shown under 'About this data', never as open items to confirm", () => {
    const METHOD = ["round2_research", "knockout_rule", "sequencing_formula"];
    for (const m of r2Markets()) {
      cleanup();
      renderApp(`#/market/${m.id}`);
      const rec = engine.getMarketRecommendation(m.id, w)!;
      const method = rec.assumptions.filter((a) => METHOD.includes(a.field));
      const open = [...rec.requiresConfirmation, ...rec.assumptions.filter((a) => !METHOD.includes(a.field))];
      const openList = screen.queryByTestId("open-items");
      // Every engine statement is still shown somewhere on the tab...
      method.forEach((a) => expect(screen.getByTestId("method-notes")).toHaveTextContent(a.statement));
      open.forEach((a) => expect(openList).toHaveTextContent(a.statement));
      // ...but the method notes are never presented as something to confirm.
      if (openList) method.forEach((a) => expect(openList).not.toHaveTextContent(a.statement));
      else expect(open).toHaveLength(0);
    }
    // Mexico's only "open items" used to be the two method notes: now there is no confirm section.
    cleanup();
    renderApp("#/market/mexico");
    expect(screen.queryByText("What we still need to confirm")).toBeNull();
  });

  it("searching Mexico opens the researched market, not a public-data screen", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByTestId("finder-input"), "Mexico");
    expect(screen.getByTestId("finder-option-mexico")).toBeInTheDocument();
    expect(screen.queryByTestId("finder-screen-mex")).toBeNull();
  });

  it("drops a stored Mexico screen saved before the research existed", () => {
    window.localStorage.setItem(
      "mochatrade.customMarkets.v1",
      JSON.stringify([
        { id: "screen_mex", name: "Mexico", cleared: true, screen_source: "public_data", evidence_confidence: "limited", screening_score_deck: 3, market_signal: "", scores: { market_opportunity: 4.5, legality: 2, licence: 1, fx_custody: 4, clarity: 4 } },
      ]),
    );
    renderApp();
    expect(screen.queryByTestId("market-screen_mex")).toBeNull();
    expect(screen.getByTestId("market-mexico")).toBeInTheDocument();
  });

  it("shows the Round 2 deck check on a Round 1 screened-out market, next to the unchanged deck text", async () => {
    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "pakistan", "research");
    expect(screen.getByTestId("research-deck-check")).toHaveTextContent(/licensing opened Aug 2026/);
    expect(screen.queryByTestId("round2-badge")).toBeNull();
  });
});

describe("Round 2 market signal (v2.10.2)", () => {
  const researched = engine.getAllMarkets().filter((m) => m.research_source === "round2");

  it("is the licensing regime and/or rail, never the researcher's working notes", () => {
    expect(researched.length).toBe(24);
    for (const m of researched) {
      expect(m.market_signal, m.id).not.toBe("");
      expect(m.market_signal, m.id).not.toMatch(/PDF|did not open|not read|certificate|by a hair|secondary source/i);
      expect(m.market_signal, m.id).not.toMatch(/\[[A-Z]/); // evidence tags stay on the Research tab
    }
    expect(engine.getMarket("bahrain")!.market_signal).toMatch(/^CBB Crypto-Asset Module/);
    expect(engine.getMarket("kenya")!.market_signal).toContain("M-Pesa");
    // Reserve markets keep the reserve sheet's own reason.
    expect(engine.getMarket("saudi_arabia")!.market_signal).toMatch(/SAMA/);
  });

  it("derived sequencing inputs are footnotes, not open items, on every plan market", async () => {
    const user = userEvent.setup();
    renderApp();
    for (const id of ["uae", "brazil", "indonesia"]) {
      await openMarket(user, id);
      const open = screen.queryByTestId("open-items")?.textContent ?? "";
      expect(open, id).not.toMatch(/\/5 = 1 \+/);
      expect(screen.getByTestId("method-notes").textContent, id).toMatch(/Adaptation cost \(derived\)/);
    }
  });

  it("verdict reasons carry the deck's rationale, not just the position (v2.10.3)", () => {
    const w = engine.getDefaultWeights();
    for (const id of ["uae", "brazil", "indonesia"]) {
      const d = engine.getDecision(id, w)!;
      expect(d.verdictReason, id).toContain(engine.getMarket(id)!.sequence!.rationale.replace(/\.$/, ""));
      expect(d.verdictReason, id).not.toMatch(/^(First|Second) in the entry sequence/);
    }
  });

  it("evidence notes and the Round 2 deck check are footnotes on screened-out Round 1 markets, not open items", async () => {
    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "philippines");
    expect(screen.queryByTestId("open-items")).toBeNull();
    expect(screen.getByTestId("method-notes").textContent).toMatch(/limited evidence/);
    await openTab(user, "risks");
    // Philippines now has no_licensed_route and derivatives_product_gap risks.
    expect(screen.getByTestId("risk-panel")).toBeInTheDocument();
  });

  it("Enter and Space also start the presentation from the welcome page", async () => {
    const user = userEvent.setup();
    renderApp("#/");
    await user.keyboard("{Enter}");
    expect(window.location.hash).toBe("#/plan");
    window.location.hash = "#/";
    await new Promise((r) => setTimeout(r, 0));
    await user.keyboard(" ");
    expect(window.location.hash).toBe("#/plan");
  });
});

describe("flags and glossary cards (v2.10.4)", () => {
  it("every named market and every public-data screen resolves to a flag; a user market with no country does not", async () => {
    const { iso2ForMarket, flagUrl } = await import("../components/ui/Flag");
    for (const m of engine.getAllMarkets()) {
      const iso2 = iso2ForMarket(m);
      expect(iso2, m.id).toBeTruthy();
      expect(flagUrl(iso2!), m.id).toBeTruthy();
    }
    expect(iso2ForMarket({ id: "atlantis", iso3: undefined, country_facts: undefined })).toBeNull();
    expect(iso2ForMarket({ id: "x", iso3: "PRT", country_facts: undefined })).toBe("pt");
  });

  it("the market page shows the flag at one fixed size, and the glossary shows a card on hover instead of a title tooltip", async () => {
    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "uae");
    const flag = screen.getByTestId("market-flag");
    expect(flag).toHaveAttribute("data-iso2", "ae");
    expect(flag.className).toMatch(/\bh-9\b/);
    const term = screen.getAllByTestId("gloss-term").find((t) => t.getAttribute("data-term") === "VARA")!;
    expect(term).not.toHaveAttribute("title");
    expect(screen.queryByTestId("gloss-card")).toBeNull();
    await user.hover(term);
    expect(screen.getByTestId("gloss-card").textContent).toContain("Virtual Assets Regulatory Authority");
    await user.unhover(term);
    expect(screen.queryByTestId("gloss-card")).toBeNull();
  });

  it("'why not now' exists for every researched Do-not-enter market, names only rubric dimensions, quotes each score correctly, and is never on a cleared market (v2.10.5)", async () => {
    const keys = new Set(engine.getDimensions().map((d) => d.key));
    const noGo = engine.getAllMarkets().filter((m) => !m.cleared && !m.screen_source && !m.user_added);
    expect(noGo.length).toBe(25);
    for (const m of noGo) {
      const w = m.why_not_now!;
      expect(w, m.id).toBeTruthy();
      expect(w.summary.length, m.id).toBeGreaterThan(60);
      expect(w.what_would_change.length, m.id).toBeGreaterThan(20);
      expect(w.dimensions.length, m.id).toBeGreaterThanOrEqual(2);
      for (const d of w.dimensions) {
        expect(keys.has(d.key), `${m.id}:${d.key}`).toBe(true);
        expect(m.scores[d.key], `${m.id}:${d.key}`).toBeLessThanOrEqual(3);
      }
    }
    for (const m of engine.getAllMarkets().filter((m) => m.cleared)) expect(m.why_not_now, m.id).toBeUndefined();

    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "turkey");
    const sec = screen.getByTestId("why-not-now");
    expect(sec.textContent).toMatch(/Where it fails the rubric/);
    expect(sec.textContent).toMatch(/Legality/);
    expect(sec.textContent).toMatch(/1\/5/);
    expect(sec.textContent).toMatch(/What would have to change/);
    expect(screen.getByTestId("verdict-reason").textContent).toMatch(/Law 7518/);
    // The old one-line blocker is not repeated under "What could block us".
    expect(screen.queryByText(/^Regulatory blocker:/)).toBeNull();
  });
});
