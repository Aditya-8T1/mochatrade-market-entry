// P3 integration suite, migrated to the multi-page app (v2.9.0). Mounts the
// real App against the real P1 engine (no mocks, no stubbed data) and drives
// it like a user: open markets, switch tabs, change weights on "How we
// decided", reset. Expected values are read from `engine` itself.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen, within, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { engine, formatScore } from "../engine";
import { marketQueueGroups } from "../components/marketQueue";
import { go, openMarket, openTab, planOrder, queueOrder, renderApp } from "./harness";

afterEach(() => cleanup());

describe("App integration (was: Dashboard integration)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Any console.error during a render/interaction fails the test.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("leads with the #1 sequenced market (Dubai), not the #1 scored market (Brazil)", async () => {
    const user = userEvent.setup();
    renderApp("#/plan");
    const sequence = engine.recommendedSequence(engine.getDefaultWeights());
    expect(sequence[0].market.id).toBe("uae");
    expect(planOrder()[0]).toBe("uae");
    expect(screen.getByTestId("open-first")).toHaveAttribute("href", "#/market/uae");

    await user.click(screen.getByTestId("open-first"));
    await openTab(user, "scores");
    expect(screen.getByTestId("scorecard").dataset.marketId).toBe("uae");
  });

  it("market table is ordered by raw score, the sequence panel by entry order -- and they are NOT the same order", () => {
    renderApp();
    const weights = engine.getDefaultWeights();
    const ranking = engine.rankMarkets(weights);
    const sequence = engine.recommendedSequence(weights);

    // Round 1 markets first, then Round 2 research, each group in rank order.
    expect(queueOrder()).toEqual(marketQueueGroups(ranking).ordered.map((r) => r.market.id));
    expect(planOrder()).toEqual(sequence.map((s) => s.market.id));

    go("#/method");
    const rankVsSeq = screen.getByTestId("ranking-vs-sequence");
    const rawOrder = within(rankVsSeq).getAllByTestId(/^raw-item-/).map((el) => el.dataset.testid!.replace("raw-item-", ""));
    const seqOrder = within(rankVsSeq).getAllByTestId(/^seq-item-/).map((el) => el.dataset.testid!.replace("seq-item-", ""));

    expect(seqOrder).toEqual(sequence.map((s) => s.market.id));
    expect(rawOrder).not.toEqual(seqOrder);
    expect(rawOrder[0]).toBe("brazil");
    expect(seqOrder[0]).toBe("uae");
  });

  it.each(engine.getAllMarkets().map((m) => [m.id, m.name] as const))(
    "opening %s (%s) shows its scorecard, recommendation, risks and compliance with no undefined/NaN",
    async (marketId) => {
      const user = userEvent.setup();
      renderApp();
      await openMarket(user, marketId);
      expect(window.location.hash).toBe(`#/market/${marketId}`);

      const weights = engine.getDefaultWeights();
      const rec = engine.getMarketRecommendation(marketId, weights)!;
      const market = engine.getMarket(marketId)!;
      const risks = engine.getRisksForMarket(marketId);

      const recSummary = screen.getByTestId("recommendation-summary");
      expect(recSummary.dataset.marketId).toBe(marketId);
      expect(recSummary.dataset.status).toBe(rec.status);
      expect(recSummary.textContent).not.toMatch(/undefined|NaN/);

      await openTab(user, "scores");
      const scorecard = screen.getByTestId("scorecard");
      expect(scorecard.dataset.marketId).toBe(marketId);
      expect(scorecard.textContent).not.toMatch(/undefined|NaN/);
      expect(scorecard.textContent).toContain(formatScore(rec.score.weightedScore));

      await openTab(user, "readiness");
      const compliance = screen.getByTestId("compliance-checklist");
      const expectedMode = market.cleared && market.deep_dive ? "full" : market.deep_dive ? "watchlist" : "screened-out";
      expect(compliance.dataset.mode).toBe(expectedMode);
      expect(compliance.textContent).not.toMatch(/undefined|NaN/);

      await openTab(user, "risks");
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
    renderApp();

    // uae has risks tagged; vietnam also has risks now (no_licensed_route).
    await openMarket(user, "uae", "risks");
    expect(screen.getByTestId("risk-panel")).toBeInTheDocument();

    await openMarket(user, "vietnam", "risks");
    // Vietnam has no_licensed_route and derivatives_product_gap risks.
    expect(screen.getByTestId("risk-panel")).toBeInTheDocument();

    await openMarket(user, "uae", "risks");
    expect(screen.getByTestId("risk-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("risk-panel-empty")).not.toBeInTheDocument();
  });

  it.each(["base", "regulation_heavy", "market_heavy", "capital_tight"])(
    "the %s preset recalculates the engine; Home's #1 and its scorecard follow",
    async (presetName) => {
      const user = userEvent.setup();
      renderApp("#/method");

      await user.click(screen.getByTestId(`preset-${presetName}`));

      const expectedWeights = engine.getWeightPresets()[presetName];
      const sequence = engine.recommendedSequence(expectedWeights);
      const rec = engine.getMarketRecommendation(sequence[0].market.id, expectedWeights)!;

      go("#/markets");
      expect(planOrder()[0]).toBe(sequence[0].market.id);
      await user.click(screen.getByTestId(`plan-row-${sequence[0].market.id}`));
      await openTab(user, "scores");
      expect(screen.getByTestId("scorecard").dataset.marketId).toBe(sequence[0].market.id);
      expect(screen.getByTestId("scorecard").textContent).toContain(rec.score.weightedScore.toFixed(1));
    },
  );

  it("dragging a weight fader produces custom (renormalized) weights and recomputes the scorecard", () => {
    renderApp("#/market/uae/scores");
    const before = screen.getByTestId("scorecard").textContent;

    go("#/method");
    fireEvent.change(screen.getByTestId("slider-legality"), { target: { value: "80" } });
    expect(screen.getByText("Custom weights")).toBeInTheDocument();
    // Renormalized to close to 80% of the total, not literally 80.
    expect(Number(screen.getByTestId("slider-legality").getAttribute("value"))).toBeGreaterThan(50);

    go("#/market/uae/scores");
    expect(screen.getByTestId("scorecard").textContent).not.toEqual(before);
  });

  it("reset restores the Round 1 base weights after a custom drag", async () => {
    const user = userEvent.setup();
    renderApp("#/method");

    fireEvent.change(screen.getByTestId("slider-clarity"), { target: { value: "90" } });
    expect(screen.getByText("Custom weights")).toBeInTheDocument();

    await user.click(screen.getByTestId("reset-weights"));
    expect(screen.getByText("Base weights")).toBeInTheDocument();

    const sequence = engine.recommendedSequence(engine.getDefaultWeights());
    go("#/markets");
    expect(planOrder()).toEqual(sequence.map((s) => s.market.id));
  });

  it("go-gate timeline shows exactly the sequenced markets with their real go-gates, and never a screened-out market", () => {
    renderApp("#/method");
    const sequence = engine.recommendedSequence(engine.getDefaultWeights());
    const timeline = screen.getByTestId("go-gate-timeline");

    sequence.forEach((s) => (s.market.sequence?.go_gate ?? []).forEach((g) => expect(within(timeline).getByText(g)).toBeInTheDocument()));
    engine.getAllMarkets()
      .filter((m) => !m.cleared)
      .forEach((m) => expect(within(timeline).queryByText(m.name)).not.toBeInTheDocument());
  });
});
