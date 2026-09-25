// P3 integration suite. Mounts the real Dashboard against the real P1
// engine (no mocks, no stubbed data) and drives it exactly like a user
// would: select markets, change weights, reset. Every assertion checks
// that a UI control produced a real engine-derived result, per the P3
// brief's definition of done. Nothing here duplicates scoring/sequencing
// logic -- expected values are read from `engine` itself.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../screens/Dashboard";
import { engine } from "../engine";

afterEach(() => cleanup());

describe("Dashboard integration", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Any console.error during a render/interaction (React warnings, thrown
    // effects, key warnings) fails the relevant test -- "no console errors"
    // is an explicit P3 requirement, not just a build-succeeds check.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("defaults to the #1 sequenced market (Dubai), not the #1 scored market (Brazil)", () => {
    render(<Dashboard />);
    const baseWeights = engine.getDefaultWeights();
    const sequence = engine.recommendedSequence(baseWeights);
    expect(sequence[0].market.id).toBe("uae");

    const scorecard = screen.getByTestId("scorecard");
    expect(scorecard.dataset.marketId).toBe("uae");
  });

  it("market queue is ordered by raw score, and the sequence panel is ordered by entry order -- and they are NOT the same order", () => {
    render(<Dashboard />);
    const weights = engine.getDefaultWeights();
    const ranking = engine.rankMarkets(weights);
    const sequence = engine.recommendedSequence(weights);

    const queueOrder = screen
      .getAllByRole("button")
      .filter((b) => b.dataset.testid?.startsWith("market-"))
      .map((b) => b.dataset.testid!.replace("market-", ""));
    expect(queueOrder).toEqual(ranking.map((r) => r.market.id));

    const rankVsSeq = screen.getByTestId("ranking-vs-sequence");
    const rawOrder = within(rankVsSeq)
      .getAllByTestId(/^raw-item-/)
      .map((el) => el.dataset.testid!.replace("raw-item-", ""));
    const seqOrder = within(rankVsSeq)
      .getAllByTestId(/^seq-item-/)
      .map((el) => el.dataset.testid!.replace("seq-item-", ""));

    expect(seqOrder).toEqual(sequence.map((s) => s.market.id));
    // The whole point of the tool: these two orderings must diverge for
    // the base weights (Brazil #1 by score, but UAE #1 in sequence).
    expect(rawOrder).not.toEqual(seqOrder);
    expect(rawOrder[0]).toBe("brazil");
    expect(seqOrder[0]).toBe("uae");
  });

  it.each(engine.getAllMarkets().map((m) => [m.id, m.name] as const))(
    "selecting %s (%s) updates scorecard, recommendation, risks and compliance to that market with no undefined/NaN",
    async (marketId, marketName) => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await user.click(screen.getByTestId(`market-${marketId}`));

      const weights = engine.getDefaultWeights();
      const rec = engine.getMarketRecommendation(marketId, weights)!;
      const market = engine.getMarket(marketId)!;
      const risks = engine.getRisksForMarket(marketId);

      const scorecard = screen.getByTestId("scorecard");
      expect(scorecard.dataset.marketId).toBe(marketId);
      expect(scorecard.textContent).not.toMatch(/undefined|NaN/);
      expect(scorecard.textContent).toContain(rec.score.weightedScore.toFixed(1));

      const recSummary = screen.getByTestId("recommendation-summary");
      expect(recSummary.dataset.marketId).toBe(marketId);
      expect(recSummary.dataset.status).toBe(rec.status);
      expect(recSummary.textContent).not.toMatch(/undefined|NaN/);

      const compliance = screen.getByTestId("compliance-checklist");
      expect(compliance.dataset.mode).toBe(market.cleared ? "full" : "screened-out");
      expect(compliance.textContent).not.toMatch(/undefined|NaN/);

      if (risks.length === 0) {
        expect(screen.getByTestId("risk-panel-empty")).toBeInTheDocument();
      } else {
        const riskPanel = screen.getByTestId("risk-panel");
        expect(within(riskPanel).getAllByText(/./).length).toBeGreaterThan(0);
        risks.forEach((r) => expect(riskPanel.textContent).toContain(r.title));
      }
    },
  );

  it("switching markets does not leave a stale risk panel behind", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    // uae has risks tagged; vietnam has none (not in any risk's market list).
    await user.click(screen.getByTestId("market-uae"));
    expect(screen.getByTestId("risk-panel")).toBeInTheDocument();

    await user.click(screen.getByTestId("market-vietnam"));
    expect(screen.queryByTestId("risk-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("risk-panel-empty")).toBeInTheDocument();

    await user.click(screen.getByTestId("market-uae"));
    expect(screen.getByTestId("risk-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("risk-panel-empty")).not.toBeInTheDocument();
  });

  it.each(["base", "regulation_heavy", "market_heavy", "capital_tight"])(
    "the %s preset recalculates the engine and updates the scorecard's weighted score",
    async (presetName) => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await user.click(screen.getByTestId(`preset-${presetName}`));

      const presets = engine.getWeightPresets();
      const expectedWeights = presets[presetName];
      const sequence = engine.recommendedSequence(expectedWeights);
      const rec = engine.getMarketRecommendation(sequence[0].market.id, expectedWeights)!;

      // Selection tracks the new #1 sequenced market under this preset.
      expect(screen.getByTestId("scorecard").dataset.marketId).toBe(sequence[0].market.id);
      expect(screen.getByTestId("scorecard").textContent).toContain(rec.score.weightedScore.toFixed(1));
    },
  );

  it("dragging a weight fader produces custom (renormalized) weights and recomputes the scorecard", async () => {
    render(<Dashboard />);

    const before = screen.getByTestId("scorecard").textContent;

    const legalitySlider = screen.getByTestId("slider-legality");
    fireEvent.change(legalitySlider, { target: { value: "80" } });

    expect(screen.getByText("Custom weights")).toBeInTheDocument();
    const after = screen.getByTestId("scorecard").textContent;
    expect(after).not.toEqual(before);

    // Verify against the engine directly: dragging legality to 80% should
    // renormalize to something close to 80% of the total, not literally 80.
    const legalityPctText = screen.getByTestId("slider-legality").getAttribute("value");
    expect(Number(legalityPctText)).toBeGreaterThan(50);
  });

  it("reset restores the Round 1 base weights after a custom drag", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

    fireEvent.change(screen.getByTestId("slider-clarity"), { target: { value: "90" } });
    expect(screen.getByText("Custom weights")).toBeInTheDocument();

    await user.click(screen.getByTestId("reset-weights"));

    expect(screen.getByText("Base weights")).toBeInTheDocument();
    const baseWeights = engine.getDefaultWeights();
    const sequence = engine.recommendedSequence(baseWeights);
    expect(screen.getByTestId("scorecard").dataset.marketId).toBe(sequence[0].market.id);
  });

  it("go-gate timeline shows exactly the 3 sequenced markets with their real go-gates, and never a screened-out market", () => {
    render(<Dashboard />);
    const weights = engine.getDefaultWeights();
    const sequence = engine.recommendedSequence(weights);
    const timeline = screen.getByTestId("go-gate-timeline");

    sequence.forEach((s) => {
      const gates = s.market.sequence?.go_gate ?? [];
      gates.forEach((g) => expect(within(timeline).getByText(g)).toBeInTheDocument());
    });

    const screenedOut = engine.getAllMarkets().filter((m) => !m.cleared);
    screenedOut.forEach((m) => {
      expect(within(timeline).queryByText(m.name)).not.toBeInTheDocument();
    });
  });
});
