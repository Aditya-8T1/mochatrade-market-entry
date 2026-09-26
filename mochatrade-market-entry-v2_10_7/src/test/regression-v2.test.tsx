// Regression suite for defects found in the v2 verification pass. Each
// block pins one fix; engine, hooks and components are real, only fetch
// and localStorage contents are controlled.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, waitFor, cleanup, within, fireEvent, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { go, openMarket, planOrder, renderApp } from "./harness";
import { engine } from "../engine";
import type { Market } from "../engine/types";
import { isValidStoredMarket } from "../hooks/useCustomMarkets";
import { useFxRates } from "../hooks/useFxRates";
import markets from "../../data/markets.json";
import risks from "../../data/risks.json";

// Mechanics test: run on the Round 1 dataset so it does not depend on which countries the Round 2 research covers (e.g. Kenya).
vi.mock("../engine", async (importOriginal) => {
  const m = await importOriginal<typeof import("../engine")>();
  return { ...m, engine: m.round1Engine };
});


const offline = () => vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("mochatrade.introSeen.v1", "1");
  offline();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function addMarket(user: ReturnType<typeof userEvent.setup>, name: string, score?: number) {
  if (!screen.queryByTestId("open-add-market")) go("#/markets");
  await user.click(screen.getByTestId("open-add-market"));
  await user.type(screen.getByTestId("add-market-name"), name);
  if (score !== undefined) {
    for (const k of ["market_opportunity", "legality", "licence", "fx_custody", "clarity"]) {
      fireEvent.change(screen.getByTestId(`add-score-${k}`), { target: { value: String(score) } });
    }
  }
  await user.click(screen.getByTestId("add-market-submit"));
}

describe("removing a user-entered market", () => {
  it("that is #1 in the sequence (and so the fallback selection) does not strand the app on 'No market selected'", async () => {
    const user = userEvent.setup();
    renderApp();
    await addMarket(user, "Kenya", 5);
    go("#/method");
    expect(screen.getAllByTestId(/^seq-item-/)[0]).toHaveAttribute("data-testid", "seq-item-custom_kenya");
    expect(planOrder()[0]).toBe("custom_kenya");
    go("#/markets");
    await user.click(screen.getByLabelText("Remove Kenya"));
    // Replaced: there is no "selected market" any more. The plan falls back to Dubai as #1, and the removed market's URL shows not-found instead of crashing.
    expect(planOrder()[0]).toBe("uae");
    await user.click(screen.getByTestId("open-first"));
    expect(screen.getByTestId("decision-card")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dubai (UAE)");
    go("#/market/custom_kenya");
    expect(screen.getByTestId("market-not-found")).toBeInTheDocument();
  });

  it("clears its checklist, so re-adding the same name starts at 0%", async () => {
    const user = userEvent.setup();
    renderApp();
    await addMarket(user, "Kenya");
    go("#/market/custom_kenya/readiness");
    await user.click(within(screen.getByTestId("compliance-checklist")).getAllByRole("checkbox")[0]);
    expect(within(screen.getByTestId("compliance-checklist")).getAllByRole("checkbox")[0]).toBeChecked();
    go("#/markets");
    await user.click(screen.getByLabelText("Remove Kenya"));
    await addMarket(user, "Kenya");
    go("#/market/custom_kenya/readiness");
    within(screen.getByTestId("compliance-checklist"))
      .getAllByRole("checkbox")
      .forEach((b) => expect(b).not.toBeChecked());
    expect(screen.getByText("0% ready")).toBeInTheDocument();
  });

  it("also drops it from compare mode", async () => {
    const user = userEvent.setup();
    renderApp();
    await addMarket(user, "Kenya");
    go("#/markets");
    await user.click(screen.getByTestId("compare-custom_kenya"));
    await user.click(screen.getByLabelText("Remove Kenya"));
    go("#/compare");
    expect(screen.getByTestId("compare-empty")).toBeInTheDocument();
  });
});

describe("persisted user markets", () => {
  it("a corrupt stored entry is dropped instead of crashing the app", async () => {
    window.localStorage.setItem(
      "mochatrade.customMarkets.v1",
      JSON.stringify([{ id: "custom_bad", name: "Bad", cleared: true, user_added: true, scores: { legality: 3 } }, "junk", null]),
    );
    renderApp();
    expect(screen.queryByTestId("market-custom_bad")).not.toBeInTheDocument();
    // Replaced: the start page no longer shows a decision card; check the markets list and a market page still render fully.
    expect(screen.getByTestId("market-selector")).toBeInTheDocument();
    go("#/market/uae/readiness");
    expect(screen.getByTestId("market-header")).toBeInTheDocument();
    await screen.findByTestId("fx-status");
  });

  it("unparseable storage is ignored", async () => {
    window.localStorage.setItem("mochatrade.customMarkets.v1", "{not json");
    renderApp();
    expect(screen.getByTestId("market-selector")).toBeInTheDocument();
    go("#/market/uae/readiness");
    await screen.findByTestId("fx-status");
  });

  it("a valid stored entry survives a remount (reload)", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp();
    await addMarket(user, "Kenya");
    unmount();
    renderApp();
    expect(screen.getByTestId("market-custom_kenya")).toBeInTheDocument();
    go("#/market/uae/readiness");
    await screen.findByTestId("fx-status");
  });

  it("validator rejects out-of-range scores and base-market ids", () => {
    const ok = { id: "custom_x", name: "X", cleared: false, user_added: true, scores: { market_opportunity: 3, legality: 3, licence: 3, fx_custody: 3, clarity: 3 } };
    expect(isValidStoredMarket(ok)).toBe(true);
    expect(isValidStoredMarket({ ...ok, scores: { ...ok.scores, clarity: 9 } })).toBe(false);
    expect(isValidStoredMarket({ ...ok, id: "brazil" })).toBe(false);
    expect(isValidStoredMarket({ ...ok, cleared: true })).toBe(false); // cleared needs entry_facts
  });
});

describe("Score a new market: validation", () => {
  it("rejects a name that already exists (base or user market), case-insensitive", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("open-add-market"));
    await user.type(screen.getByTestId("add-market-name"), "brazil");
    expect(screen.getByTestId("add-market-name-error")).toHaveTextContent("already in the list");
    expect(screen.getByTestId("add-market-submit")).toBeDisabled();
  });

  it("rejects a symbol-only name that would produce an empty id", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("open-add-market"));
    await user.type(screen.getByTestId("add-market-name"), "!!");
    expect(screen.getByTestId("add-market-submit")).toBeDisabled();
  });

  it("Escape closes the dialog without adding anything", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId("open-add-market"));
    await user.type(screen.getByTestId("add-market-name"), "Kenya");
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("add-market-name")).not.toBeInTheDocument();
    expect(screen.queryByTestId("market-custom_kenya")).not.toBeInTheDocument();
  });

  it("a screened-out entry is labelled as the user's and gets a no-go verdict", async () => {
    const user = userEvent.setup();
    renderApp();
    await addMarket(user, "Lowland", 1);
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "no_go");
    expect(screen.getByText("your entry")).toBeInTheDocument();
    expect(screen.getByText("your entry — not in Round 1")).toBeInTheDocument();
    go("#/method");
    expect(screen.queryByTestId("seq-item-custom_lowland")).not.toBeInTheDocument();
  });
});

describe("user markets never touch the static Round 1 data", () => {
  it("static JSON and the base engine are unchanged after adding, scoring and removing", async () => {
    const snapshot = JSON.stringify([markets, risks]);
    const user = userEvent.setup();
    renderApp();
    await addMarket(user, "Kenya", 5);
    go("#/method");
    await user.click(screen.getByTestId("preset-capital_tight"));
    go("#/markets");
    await user.click(screen.getByLabelText("Remove Kenya"));
    expect(JSON.stringify([markets, risks])).toBe(snapshot);
    expect(engine.getAllMarkets()).toHaveLength(9);
    expect(engine.recommendedSequence(engine.getDefaultWeights()).map((s) => s.market.id)).toEqual(["uae", "brazil", "indonesia"]);
  });

  it("risk panel and recommendation agree on which risks apply to a cleared user market", () => {
    const m: Market = {
      id: "custom_k", name: "K", cleared: true, user_added: true, evidence_confidence: "limited", screening_score_deck: 4, market_signal: "",
      scores: { market_opportunity: 4, legality: 4, licence: 4, fx_custody: 4, clarity: 4 },
      entry_facts: { licence_model: "own", product_rebuild: false, rail_via_partner: false, partners_required: 0, localisation_required: false, partner_fronted_onboarding: false, source_type: "assumption" },
    };
    const e = engine.withMarkets([m]);
    const w = e.getDefaultWeights();
    const panel = e.getRisksForMarket("custom_k").map((r) => r.id).sort();
    const rec = e.getMarketRecommendation("custom_k", w)!.risks.map((r) => r.id).sort();
    expect(rec).toEqual(panel);
    // All 7 risks have >= 3 markets, so a cleared user market gets all of them.
    expect(panel).toHaveLength(7);
  });
});

describe("compare mode and decision values are engine-derived, not hardcoded", () => {
  it("compare rows equal engine output under base and after a preset change", async () => {
    const user = userEvent.setup();
    renderApp();
    for (const id of ["uae", "brazil", "indonesia"]) await user.click(screen.getByTestId(`compare-${id}`));
    for (const preset of ["base", "market_heavy", "capital_tight"]) {
      go("#/method");
      await user.click(screen.getByTestId(`preset-${preset}`));
      go("#/compare");
      const w = engine.getWeightPresets()[preset];
      const row = within(screen.getByTestId("compare-view")).getByText("Screening score").closest("tr")!;
      const cells = within(row).getAllByRole("cell").slice(1).map((c) => c.textContent);
      const expected = ["uae", "brazil", "indonesia"].map((id) => {
        const r = engine.getMarketRecommendation(id, w)!;
        return `${r.score.weightedScore.toFixed(1)} / 5 (rank #${r.rawRank})`;
      });
      expect(cells).toEqual(expected);
    }
  });

  it("a 4th tick keeps the comparison at 3 markets", async () => {
    const user = userEvent.setup();
    renderApp();
    for (const id of ["uae", "brazil", "indonesia", "vietnam"]) await user.click(screen.getByTestId(`compare-${id}`));
    go("#/compare");
    expect(within(screen.getByTestId("compare-view")).getAllByRole("columnheader").slice(1)).toHaveLength(3);
  });

  it("decision card shows the engine's risk score, window and condition count for every market", async () => {
    const user = userEvent.setup();
    renderApp();
    const w = engine.getDefaultWeights();
    for (const m of engine.getAllMarkets()) {
      await openMarket(user, m.id);
      const d = engine.getDecision(m.id, w)!;
      const card = screen.getByTestId("decision-card");
      expect(card).toHaveAttribute("data-verdict", d.verdict);
      // Replaced: the risk score moved from the decision card to the sidebar's risk card on the same page.
      expect(within(screen.getByTestId("risk-score-panel")).getByText(String(d.risk.riskScore100))).toBeInTheDocument();
      if (d.window) expect(card).toHaveTextContent(d.window);
      expect(within(card).getAllByRole("listitem")).toHaveLength(d.conditions.length);
    }
  });

  it("robustness table matches engine.getRobustness() cell by cell", async () => {
    renderApp("#/method");
    const r = engine.getRobustness();
    const rows = within(screen.getByTestId("robustness")).getAllByRole("row").slice(1);
    rows.forEach((row, i) => {
      const cells = within(row).getAllByRole("cell").map((c) => c.textContent);
      const m = r.perMarket[i];
      expect(cells[0]).toBe(m.marketName);
      expect(cells.slice(1, 1 + r.presets.length)).toEqual(r.presets.map((p) => `#${m.positions[p.name]}`));
    });
    go("#/market/uae/readiness");
    await screen.findByTestId("fx-status");
  });
});

describe("FX hook edge cases", () => {
  it("an unknown currency with the live feed down ends in 'unavailable', not an endless loading state or unhandled rejection", async () => {
    const { result } = renderHook(() => useFxRates(["ZZZ"]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rates).toEqual({});
  });

  it("switching UAE -> Indonesia never shows the AED rate against IDR while loading", async () => {
    let release!: () => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((res) => {
            release = () => res({ ok: true, status: 200, json: async () => ({ usd: { aed: 3.6725, idr: 16000 } }) });
          }),
      ),
    );
    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "uae", "readiness");
    release();
    await waitFor(() => expect(screen.getByTestId("fx-row")).toHaveTextContent("AED"));
    await openMarket(user, "indonesia", "readiness");
    expect(screen.getByTestId("fx-row")).toHaveTextContent("checking live rate");
    expect(screen.getByTestId("fx-row")).not.toHaveTextContent("3.6725");
    release();
    await waitFor(() => expect(screen.getByTestId("fx-row")).toHaveTextContent("16,000 IDR"));
  });
});
