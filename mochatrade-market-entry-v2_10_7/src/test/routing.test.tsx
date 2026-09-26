// v2.9.0 routing: Home / market page (tabs) / Compare / Method on a hash
// router, with state shared across pages by AppStateProvider. Real engine,
// real App; only the network is stubbed.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { screen, within, fireEvent, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { engine } from "../engine";
import { marketQueueGroups } from "../components/marketQueue";
import { go, planOrder, queueOrder, renderApp } from "./harness";

const W = engine.getDefaultWeights();

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("mochatrade.introSeen.v1", "1");
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
});

describe("Home (welcome)", () => {
  it("welcomes with one way in and shows no market data at all", async () => {
    const user = userEvent.setup();
    renderApp("#/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Where should MochaTrade go next?");
    expect(screen.getByTestId("welcome")).toHaveTextContent(`We scored ${engine.rankMarkets(W).length} countries`);
    expect(screen.getByTestId("see-plan")).toHaveAttribute("href", "#/plan");
    expect(screen.getByTestId("check-country")).toHaveAttribute("href", "#/markets");
    for (const id of ["home-plan", "market-selector", "market-finder", "scorecard", "risk-panel", "decision-card", "compliance-checklist", "ranking-vs-sequence"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    // No market names in the welcome copy (the pixel band names each column only in its hover tooltip).
    const copy = screen.getByTestId("welcome-copy");
    engine.recommendedSequence(W).forEach((s) => expect(copy).not.toHaveTextContent(s.market.name));
    await user.click(screen.getByTestId("see-plan"));
    expect(window.location.hash).toBe("#/plan");
    expect(screen.getByTestId("home-plan")).toBeInTheDocument();
  });

  it("the pixel band has one column per scored market, in rank order, with exactly the plan in rust", () => {
    renderApp("#/");
    const cols = screen.getByTestId("pixel-band").querySelectorAll("[data-band-market]");
    const ranking = engine.rankMarkets(W);
    expect(Array.from(cols).map((c) => c.getAttribute("data-band-market"))).toEqual(ranking.map((r) => r.market.id));
    const lit = Array.from(cols).filter((c) => c.getAttribute("data-tone") === "plan").map((c) => c.getAttribute("data-band-market"));
    expect(new Set(lit)).toEqual(new Set(engine.recommendedSequence(W).map((s) => s.market.id)));
  });

  it("hovering a band column spotlights it with a card; clicking opens that market", async () => {
    const user = userEvent.setup();
    renderApp("#/");
    const band = screen.getByTestId("pixel-band");
    const col = band.querySelector('[data-band-market="brazil"]')!;
    await user.hover(col);
    const tip = screen.getByTestId("band-tip");
    expect(tip).toHaveTextContent("Brazil");
    expect(tip).toHaveTextContent(engine.getDecision("brazil", W)!.verdictLabel);
    expect(tip).toHaveAttribute("href", "#/market/brazil");
    expect(band).toHaveAttribute("data-band-active");
    expect(col).toHaveAttribute("data-active");
    await user.unhover(col);
    expect(screen.queryByTestId("band-tip")).toBeNull();
    await user.click(col);
    expect(window.location.hash).toBe("#/market/brazil");
  });

  it("on touch, the first tap on a column previews it and the card opens it", async () => {
    const user = userEvent.setup();
    renderApp("#/");
    const col = screen.getByTestId("pixel-band-compact").querySelector('[data-band-market="uae"]')!;
    await user.pointer({ keys: "[TouchA]", target: col });
    expect(window.location.hash).toBe("#/");
    expect(screen.getByTestId("band-tip")).toHaveTextContent("Tap to open");
    await user.click(screen.getByTestId("band-tip"));
    expect(window.location.hash).toBe("#/market/uae");
  });

  it("pressing → on the welcome page goes to the plan, but not while typing", async () => {
    const user = userEvent.setup();
    renderApp("#/");
    await user.keyboard("{ArrowRight}");
    expect(window.location.hash).toBe("#/plan");
    // On other pages the arrow key does nothing special.
    await user.click(screen.getByTestId("finder-input"));
    await user.keyboard("{ArrowRight}");
    expect(window.location.hash).toBe("#/plan");
  });

  it("the help button goes to the welcome guide", async () => {
    const user = userEvent.setup();
    renderApp("#/market/uae");
    await user.click(screen.getByRole("link", { name: "How to find your way around" }));
    expect(window.location.hash).toBe("#/#how");
    expect(screen.getByRole("heading", { name: "Finding your way around" })).toBeInTheDocument();
    expect(screen.getByTestId("guide-markets")).toHaveAttribute("href", "#/markets");
  });
});

describe("the plan (#/plan)", () => {
  it("shows the plan in engine order, a headline built from the engine, and none of the detail panels", () => {
    renderApp("#/plan");
    const seq = engine.recommendedSequence(W);
    expect(planOrder()).toEqual(seq.map((s) => s.market.id));
    const names = seq.map((s) => s.market.name);
    expect(screen.getByTestId("home-headline")).toHaveTextContent(`${names[0]} first, then ${names[1]} and ${names[2]}.`);
    expect(screen.getByText(new RegExp(`We scored ${engine.rankMarkets(W).length} countries`))).toBeInTheDocument();
    seq.forEach((s) => {
      const d = engine.getDecision(s.market.id, W)!;
      const row = screen.getByTestId(`plan-row-${s.market.id}`);
      expect(row).toHaveAttribute("href", `#/market/${s.market.id}`);
      expect(row).toHaveTextContent(d.verdictLabel);
    });
    for (const id of ["scorecard", "risk-panel", "risk-panel-empty", "compliance-checklist", "decision-card", "go-gate-timeline", "robustness", "ranking-vs-sequence", "market-selector"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

});

describe("Markets (#/markets)", () => {
  it("filter pills narrow the market table", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("filter-cleared"));
    const cleared = marketQueueGroups(engine.rankMarkets(W).filter((r) => r.market.cleared)).ordered.map((r) => r.market.id);
    expect(queueOrder()).toEqual(cleared);
    await user.click(screen.getByTestId("filter-round2"));
    expect(queueOrder()).toHaveLength(24);
    await user.click(screen.getByTestId("filter-all"));
    expect(queueOrder()).toHaveLength(engine.getAllMarkets().length);
  });
});

describe("market page", () => {
  it("clicking a market row goes to #/market/<id>, and each tab shows its component", async () => {
    const user = userEvent.setup();
    renderApp();
    // Click the row itself (not the name link): the whole row navigates.
    const row = screen.getByTestId("market-brazil").closest("tr")!;
    await user.click(within(row).getAllByRole("cell")[3]);
    expect(window.location.hash).toBe("#/market/brazil");

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "tab-decision");
    expect(screen.getByTestId("decision-card")).toBeInTheDocument();
    expect(screen.getByTestId("recommendation-summary")).toBeInTheDocument();

    const expectations: Array<[string, string]> = [
      ["scores", "scorecard"],
      ["risks", "risk-panel"],
      ["readiness", "compliance-checklist"],
      ["decision", "decision-card"],
    ];
    for (const [tab, testId] of expectations) {
      await user.click(screen.getByTestId(`tab-${tab}`));
      expect(window.location.hash).toBe(`#/market/brazil/${tab}`);
      expect(screen.getByTestId(`tab-${tab}`)).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    // Sequenced market: readiness also shows its own timeline lane only.
    await user.click(screen.getByTestId("tab-readiness"));
    const lanes = screen.getByTestId("go-gate-timeline").querySelectorAll("[data-lane]");
    expect(Array.from(lanes).map((l) => l.getAttribute("data-lane"))).toEqual(["brazil"]);
    // Scores tab carries this market's own divergence paragraph.
    await user.click(screen.getByTestId("tab-scores"));
    expect(screen.getByTestId("market-divergence")).toHaveTextContent(engine.explainDivergence("brazil", W).explanation.slice(0, 30));
  });

  it("arrow keys move between tabs", async () => {
    const user = userEvent.setup();
    renderApp("#/market/uae");
    screen.getByTestId("tab-decision").focus();
    await user.keyboard("{ArrowRight}");
    expect(window.location.hash).toBe("#/market/uae/scores");
    expect(screen.getByTestId("tab-scores")).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(window.location.hash).toBe("#/market/uae/readiness");
  });

  it("the research tab is hidden for uae and shown for el_salvador", () => {
    renderApp("#/market/uae");
    expect(engine.getMarket("uae")!.research).toBeUndefined();
    expect(screen.queryByTestId("tab-research")).toBeNull();
    // A research URL on a market without research falls back to the decision tab, never a blank panel.
    go("#/market/uae/research");
    expect(screen.getByTestId("decision-card")).toBeInTheDocument();

    go("#/market/el_salvador/research");
    expect(screen.getByTestId("tab-research")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("research-notes")).toBeInTheDocument();
  });

  it("a direct load of #/market/brazil/risks shows Brazil's risks", () => {
    renderApp("#/market/brazil/risks");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Brazil");
    expect(screen.getByTestId("tab-risks")).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByTestId("risk-panel");
    engine.getRisksForMarket("brazil").forEach((r) => expect(panel).toHaveTextContent(r.title));
  });

  it("the sidebar shows the engine's risk score, score and rank, and prev/next follow rank order", () => {
    renderApp("#/market/indonesia");
    const d = engine.getDecision("indonesia", W)!;
    const ranking = engine.rankMarkets(W);
    const i = ranking.findIndex((r) => r.market.id === "indonesia");
    expect(within(screen.getByTestId("risk-score-panel")).getByText(String(d.risk.riskScore100))).toBeInTheDocument();
    expect(screen.getByTestId("score-summary")).toHaveTextContent(`of ${ranking.length}`);
    expect(screen.getByTestId("prev-market")).toHaveAttribute("href", `#/market/${ranking[i - 1].market.id}`);
    expect(screen.getByTestId("next-market")).toHaveAttribute("href", `#/market/${ranking[i + 1].market.id}`);
  });

  it("#/market/xyz shows the not-found state with a way home, and so does an unknown page", () => {
    renderApp("#/market/xyz");
    const nf = screen.getByTestId("market-not-found");
    expect(nf).toHaveTextContent("We couldn't find that market");
    expect(within(nf).getByRole("link", { name: /back to the plan/i })).toHaveAttribute("href", "#/plan");
    go("#/nowhere");
    expect(screen.getByTestId("market-not-found")).toHaveTextContent("We couldn't find that page");
  });
});

describe("shared state across pages", () => {
  it("changing weights on #/method changes the market order on #/markets", () => {
    renderApp();
    const before = queueOrder();
    go("#/method");
    fireEvent.change(screen.getByTestId("slider-licence"), { target: { value: "60" } });
    const w = engine.normalizeWeights({ ...W, licence: 0.6 });
    go("#/markets");
    const after = queueOrder();
    expect(after).not.toEqual(before);
    expect(after).toEqual(marketQueueGroups(engine.rankMarkets(w)).ordered.map((r) => r.market.id));
    // The plan is recomputed under the same weights (it happens to be stable -- see the robustness section).
    expect(planOrder()).toEqual(engine.recommendedSequence(w).map((s) => s.market.id));
  });

  it("a compare selection made on #/markets appears on #/compare, and the market page can add to it", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("compare-uae"));
    expect(screen.queryByTestId("compare-bar")).toBeNull(); // bar needs two
    await user.click(screen.getByTestId("compare-kenya"));
    expect(screen.getByTestId("compare-bar")).toHaveTextContent("Compare 2 markets");
    await user.click(screen.getByTestId("compare-bar"));
    expect(window.location.hash).toBe("#/compare");
    const view = screen.getByTestId("compare-view");
    expect(within(view).getByRole("link", { name: "Dubai (UAE)" })).toHaveAttribute("href", "#/market/uae");
    expect(within(view).getByRole("link", { name: "Kenya" })).toBeInTheDocument();

    go("#/market/brazil");
    await user.click(screen.getByTestId("toggle-compare"));
    expect(screen.getByTestId("toggle-compare")).toHaveTextContent("Remove from compare");
    go("#/compare");
    expect(within(screen.getByTestId("compare-view")).getByRole("link", { name: "Brazil" })).toBeInTheDocument();
  });

  it("with fewer than two picked, Compare shows a picker instead of an empty table", async () => {
    const user = userEvent.setup();
    renderApp("#/compare");
    expect(screen.getByTestId("compare-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("compare-view")).toBeNull();
    await user.type(screen.getByTestId("compare-picker-search"), "bra");
    await user.click(screen.getByTestId("picker-brazil"));
    expect(screen.getByTestId("compare-picker")).toHaveTextContent("Pick one more");
    await user.clear(screen.getByTestId("compare-picker-search"));
    await user.click(screen.getByTestId("picker-uae"));
    expect(screen.getByTestId("compare-view")).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("back navigation works", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("market-brazil"));
    await user.click(screen.getByTestId("tab-risks"));
    expect(screen.getByTestId("risk-panel")).toBeInTheDocument();

    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/market/brazil"));
    await waitFor(() => expect(screen.getByTestId("decision-card")).toBeInTheDocument());

    window.history.back();
    await waitFor(() => expect(screen.getByTestId("market-selector")).toBeInTheDocument());
  });

  it("nav links point at real routes and mark the active one", () => {
    renderApp("#/market/uae");
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "#/");
    expect(within(nav).getByRole("link", { name: "The plan" })).toHaveAttribute("href", "#/plan");
    expect(within(nav).getByRole("link", { name: "Markets" })).toHaveAttribute("href", "#/markets");
    expect(within(nav).getByRole("link", { name: "Markets" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "How we decided" })).toHaveAttribute("href", "#/method");
  });

  it("#/method#order lands on the order section, and every Method anchor exists", () => {
    renderApp("#/method#order");
    for (const id of ["rubric", "order", "robustness", "data"]) expect(document.getElementById(id)).not.toBeNull();
    expect(within(document.getElementById("order")!).getByTestId("ranking-vs-sequence")).toBeInTheDocument();
    expect(within(document.getElementById("order")!).getByTestId("go-gate-timeline")).toBeInTheDocument();
  });
});
