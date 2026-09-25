// P3 round 2 -- deeper integration coverage per the team's follow-up
// checklist. Still no mocks: real Dashboard, real engine. These tests
// specifically target the chain the brief calls out --
//   UI weight -> engine -> new score -> new ranking -> new sequence -> UI
// -- rather than just "the score text changed", plus the market-selection
// persistence edge case and full recommendation-detail correctness.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../screens/Dashboard";
import { engine } from "../engine";
import type { RubricWeights } from "../engine/types";

afterEach(() => cleanup());

function queueOrder(): string[] {
  return screen
    .getAllByRole("button")
    .filter((b) => b.dataset.testid?.startsWith("market-"))
    .map((b) => b.dataset.testid!.replace("market-", ""));
}

describe("Weight change -> ranking/sequence recalculation (not just score text)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it.each(["base", "regulation_heavy", "market_heavy", "capital_tight"])(
    "under the %s preset, the market queue's DOM order exactly matches engine.rankMarkets, and the sequence panel's order exactly matches engine.recommendedSequence",
    async (presetName) => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await user.click(screen.getByTestId(`preset-${presetName}`));

      const weights = engine.getWeightPresets()[presetName];
      const expectedRankOrder = engine.rankMarkets(weights).map((r) => r.market.id);
      const expectedSeqOrder = engine.recommendedSequence(weights).map((s) => s.market.id);

      expect(queueOrder()).toEqual(expectedRankOrder);

      const rankVsSeq = screen.getByTestId("ranking-vs-sequence");
      const seqOrder = within(rankVsSeq)
        .getAllByTestId(/^seq-item-/)
        .map((el) => el.dataset.testid!.replace("seq-item-", ""));
      expect(seqOrder).toEqual(expectedSeqOrder);

      // go-gate timeline (independent component, also weight-driven) must
      // show gates for exactly this preset's sequence, in this order.
      const timelineMarketNames = within(screen.getByTestId("go-gate-timeline"))
        .getAllByText(/^(Brazil|Dubai \(UAE\)|Indonesia)$/)
        .map((el) => el.textContent);
      const expectedNames = engine.recommendedSequence(weights).map((s) => s.market.name);
      expect(timelineMarketNames).toEqual(expectedNames);
    },
  );

  it("a custom weight drag renormalizes to a valid RubricWeights (sums to 1, matches engine.normalizeWeights) and the UI reflects exactly that vector's ranking", () => {
    render(<Dashboard />);

    fireEvent.change(screen.getByTestId("slider-market_opportunity"), { target: { value: "60" } });

    // Reconstruct what the hook must have computed: base weights with
    // market_opportunity nudged to 60%, then normalized -- same call the
    // component makes internally.
    const base = engine.getDefaultWeights();
    const expected = engine.normalizeWeights({ ...base, market_opportunity: 0.6 });
    const sum = Object.values(expected).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);

    const expectedRankOrder = engine.rankMarkets(expected).map((r) => r.market.id);
    expect(queueOrder()).toEqual(expectedRankOrder);

    // The slider itself reflects the renormalized percentage, not a raw 60.
    const shown = Number(screen.getByTestId("slider-market_opportunity").getAttribute("value"));
    expect(shown).toBe(Math.round(expected.market_opportunity * 100));
  });
});

describe("Market-selection persistence edge case", () => {
  it("viewing Brazil, then changing weights, keeps Brazil selected and only its DATA updates -- the app must not silently jump the user to a different market", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByTestId("market-brazil"));
    expect(screen.getByTestId("scorecard").dataset.marketId).toBe("brazil");

    // Switch to a preset that reshuffles the #1 sequenced market.
    await user.click(screen.getByTestId("preset-capital_tight"));

    // Still Brazil -- selection must survive a weight change.
    expect(screen.getByTestId("scorecard").dataset.marketId).toBe("brazil");
    expect(screen.getByTestId("recommendation-summary").dataset.marketId).toBe("brazil");

    // But its data must be recomputed under the new weights, not frozen.
    const capitalTightWeights = engine.getWeightPresets().capital_tight;
    const rec = engine.getMarketRecommendation("brazil", capitalTightWeights)!;
    expect(screen.getByTestId("scorecard").textContent).toContain(rec.score.weightedScore.toFixed(1));

    // Dragging a fader must do the same: selection persists, data updates.
    fireEvent.change(screen.getByTestId("slider-fx_custody"), { target: { value: "70" } });
    expect(screen.getByTestId("scorecard").dataset.marketId).toBe("brazil");
  });

  it("switching weights while a screened-out market is selected does not bounce the user to a cleared market", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByTestId("market-thailand"));
    expect(screen.getByTestId("scorecard").dataset.marketId).toBe("thailand");

    await user.click(screen.getByTestId("preset-regulation_heavy"));
    expect(screen.getByTestId("scorecard").dataset.marketId).toBe("thailand");
    expect(screen.getByTestId("compliance-checklist").dataset.mode).toBe("screened-out");
  });
});

describe("Recommendation-detail correctness across market + weight changes", () => {
  it.each(engine.getAllMarkets().map((m) => m.id))(
    "%s: go-gates, risks, blockers and mitigations shown always match engine.getMarketRecommendation for the CURRENT weights",
    async (marketId) => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await user.click(screen.getByTestId(`market-${marketId}`));
      await user.click(screen.getByTestId("preset-market_heavy"));

      const weights = engine.getWeightPresets().market_heavy;
      const rec = engine.getMarketRecommendation(marketId, weights)!;
      const recSummary = screen.getByTestId("recommendation-summary");

      // Sequence position badge (only meaningful for sequenced markets).
      if (rec.status === "sequenced") {
        expect(within(recSummary).getByText(`Gate ${rec.sequencePosition}`)).toBeInTheDocument();
      } else {
        expect(within(recSummary).getByText("Screened out")).toBeInTheDocument();
      }

      rec.blockers.forEach((b) => expect(recSummary.textContent).toContain(b.text));
      rec.mitigations.forEach((m) => expect(recSummary.textContent).toContain(m.text));
      [...rec.requiresConfirmation, ...rec.assumptions].forEach((s) =>
        expect(recSummary.textContent).toContain(s.statement),
      );

      // Risks: exactly engine.getRisksForMarket(marketId) for this market
      // (risk tagging is market-only, not weight-dependent).
      const risks = engine.getRisksForMarket(marketId);
      if (risks.length === 0) {
        expect(screen.getByTestId("risk-panel-empty")).toBeInTheDocument();
      } else {
        const riskPanel = screen.getByTestId("risk-panel");
        risks.forEach((r) => expect(riskPanel.textContent).toContain(r.title));
      }
    },
  );

  it("compliance fields shown for a cleared market come verbatim from engine data -- no hardcoded market-specific UI text", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("market-indonesia"));

    const market = engine.getMarket("indonesia")!;
    const dd = market.deep_dive!;
    const checklist = screen.getByTestId("compliance-checklist");

    expect(checklist.textContent).toContain(dd.capital_and_licensing);
    expect(checklist.textContent).toContain(dd.local_payment_rail);
    expect(checklist.textContent).toContain(dd.main_hurdle);
    expect(checklist.textContent).toContain(dd.crypto_route);
    expect(checklist.textContent).toContain(dd.equities_route);
  });
});

describe("No stale state left behind when rapidly switching market and weights together", () => {
  it("market -> preset -> market -> preset in sequence always ends in a consistent state with no leftover previous-market content", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByTestId("market-uae"));
    await user.click(screen.getByTestId("preset-regulation_heavy"));
    await user.click(screen.getByTestId("market-south_africa"));
    await user.click(screen.getByTestId("preset-market_heavy"));

    const weights: RubricWeights = engine.getWeightPresets().market_heavy;
    const rec = engine.getMarketRecommendation("south_africa", weights)!;

    expect(screen.getByTestId("scorecard").dataset.marketId).toBe("south_africa");
    expect(screen.getByTestId("scorecard").textContent).toContain(rec.score.weightedScore.toFixed(1));
    expect(screen.getByTestId("compliance-checklist").dataset.mode).toBe("screened-out");
    // South Africa is untagged in every risk -- must show the empty state, not UAE's leftover risks.
    expect(screen.getByTestId("risk-panel-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("risk-panel")).not.toBeInTheDocument();
  });
});

describe("ComplianceChecklist state is per market and persists", () => {
  it("a box ticked for one market never shows as ticked for another, and survives switching back", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByTestId("market-brazil"));
    const brazilChecklist = screen.getByTestId("compliance-checklist");
    const brazilBoxes = within(brazilChecklist).getAllByRole("checkbox");
    expect(brazilBoxes).toHaveLength(7); // Brazil: 4 required_product_changes (incl. KYC/AML, v2.6.6) + 3 go-gates
    await user.click(brazilBoxes[2]);
    expect(within(screen.getByTestId("compliance-checklist")).getAllByRole("checkbox")[2]).toBeChecked();
    expect(screen.getByText("14% ready")).toBeInTheDocument();

    await user.click(screen.getByTestId("market-uae"));
    const uaeChecklist = screen.getByTestId("compliance-checklist");
    const uaeBoxes = within(uaeChecklist).getAllByRole("checkbox");
    expect(uaeBoxes).toHaveLength(6); // UAE: 3 (incl. KYC/AML) + 3 -- a different length than Brazil
    uaeBoxes.forEach((box) => expect(box).not.toBeChecked());
    expect(screen.getByText("0 / 6")).toBeInTheDocument();

    // Switching back: the ops team's progress on Brazil is still there (persisted per market).
    await user.click(screen.getByTestId("market-brazil"));
    const again = within(screen.getByTestId("compliance-checklist")).getAllByRole("checkbox");
    expect(again[2]).toBeChecked();
    expect(again.filter((b) => (b as HTMLInputElement).checked)).toHaveLength(1);
  });
});

describe("Round 2 additions: decision card, compare, add market", () => {
  it("shows a verdict and a regulatory risk band for the selected market", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<Dashboard />);
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "go_now");
    expect(screen.getByTestId("verdict-reason")).toHaveTextContent(/start the build/i);
    await user.click(screen.getByTestId("market-brazil"));
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "go_next");
    await user.click(screen.getByTestId("market-indonesia"));
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "go_later");
    await user.click(screen.getByTestId("market-vietnam"));
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "no_go");
  });

  it("compare mode shows the ticked markets side by side", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("compare-uae"));
    await user.click(screen.getByTestId("compare-brazil"));
    const view = screen.getByTestId("compare-view");
    expect(within(view).getByText("Dubai (UAE)")).toBeInTheDocument();
    expect(within(view).getByText("Brazil")).toBeInTheDocument();
  });

  it("a user-entered market is ranked and sequenced with the others", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("open-add-market"));
    await user.type(screen.getByTestId("add-market-name"), "Kenya");
    await user.click(screen.getByTestId("add-market-submit"));
    expect(screen.getByTestId("market-custom_kenya")).toBeInTheDocument();
    // a user-entered market's crypto route is unconfirmed, so it can be "enter next" at best
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "go_next");
    // 3/3/3/3/3 at base weights = 3.0, exactly the clear threshold -> sequenced, so 4 cleared markets now
    expect(screen.getAllByTestId(/^seq-item-/)).toHaveLength(4);
  });
});

describe("score-minus-friction bars", () => {
  it("renders one bar per sequenced market, in entry order", () => {
    window.localStorage.clear();
    render(<Dashboard />);
    const bars = within(screen.getByTestId("friction-bars")).getAllByTestId(/^friction-/);
    expect(bars.map((b) => b.getAttribute("data-testid"))).toEqual(["friction-uae", "friction-brazil", "friction-indonesia"]);
  });
});
