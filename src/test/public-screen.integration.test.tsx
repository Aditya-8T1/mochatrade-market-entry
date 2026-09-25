// Public-data screen, end to end through the real Dashboard. The bundled
// data/public-screen.json is empty in this repo (no CSVs were supplied), so
// the screen is loaded from the fixture CSV pair via the build pipeline and
// injected with setPublicScreenData(); the last block checks that an empty
// screen degrades to the pre-existing behaviour.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../screens/Dashboard";
import { engine } from "../engine";
import type { Market } from "../engine/types";
import { buildBrief } from "../export/brief";
import { buildPublicScreen } from "../data-provider/publicScreenBuild";
import { getPublicScreen, getPublicScreenPrefill, listPublicScreen, listPublicScreenUnavailable, opportunityFill, publicScreenMarket, setPublicScreenData, PUBLIC_SCREEN_BANNER, PUBLIC_SCREEN_UNAVAILABLE_LABEL } from "../data-provider/publicScreenProvider";
import { getStaticIndicators, suggestMarketOpportunity } from "../data-provider";
import { isValidStoredMarket } from "../hooks/useCustomMarkets";
import markets from "../../data/markets.json";
import trackerCsv from "./fixtures/public-screen/atlantic-council-tracker.csv?raw";
import chinnItoCsv from "./fixtures/public-screen/chinn-ito.csv?raw";

const FIXTURE = buildPublicScreen({ trackerCsv, chinnItoCsv, excludeMarketNames: markets.markets.map((m) => m.name), trackerEdition: "fixture", retrieved: "2026-09-25", generated: "2026-09-25" }).data;
const STORAGE_KEY = "mochatrade.customMarkets.v1";
let restore: () => void = () => {};

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("mochatrade.introSeen.v1", "1");
  // no network in tests: World Bank falls back to its static snapshot, which knows KEN/MEX/ARG/SGP/TUR
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  restore = setPublicScreenData(FIXTURE);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  restore();
});

/** The Kenya screen market exactly as the Dashboard builds it (static World Bank snapshot). */
function kenyaScreenMarket(): Market {
  const c = getPublicScreen("KEN")!;
  const ind = getStaticIndicators("KEN");
  const opp = opportunityFill(ind, ind ? suggestMarketOpportunity(ind) : null, c.name);
  const probe: Market = { id: "probe", name: c.name, cleared: false, scores: { market_opportunity: opp.score, legality: c.scores.legality, licence: c.scores.licence, fx_custody: c.scores.fx_custody, clarity: c.scores.clarity }, evidence_confidence: "limited", screening_score_deck: 0, market_signal: "" };
  const baseScore = engine.computeScreeningScore(probe, engine.getDefaultWeights()).weightedScore;
  return publicScreenMarket(c, { baseScore, clearThreshold: engine.getClearThreshold(), opportunity: opp });
}

describe("public-data screen: provider", () => {
  it("looks up by ISO3, by name and by alias; nothing for the nine Round 1 markets", () => {
    expect(listPublicScreen()).toHaveLength(5);
    expect(getPublicScreen("KEN")!.name).toBe("Kenya");
    expect(getPublicScreen("kenya")!.iso3).toBe("KEN");
    expect(getPublicScreen("turkiye")!.iso3).toBe("TUR");
    expect(getPublicScreen("Brazil")).toBeNull();
    expect(getPublicScreen("Dubai (UAE)")).toBeNull();
    expect(getPublicScreen("")).toBeNull();
  });

  it("knows tracker-only countries separately, and prefills 4 dimensions for a screened country but 3 for a tracker-only one", () => {
    expect(listPublicScreenUnavailable().map((u) => u.iso3)).toEqual(["ATL", "TWN"]);
    expect(getPublicScreen("Taiwan")).toBeNull();
    const tw = getPublicScreenPrefill("Taiwan")!;
    expect(tw.partial).toBe(true);
    expect(Object.keys(tw.dims).sort()).toEqual(["clarity", "legality", "licence"]);
    expect(tw.dims.fx_custody).toBeUndefined();
    const ke = getPublicScreenPrefill("KEN")!;
    expect(ke.partial).toBe(false);
    expect(Object.keys(ke.dims).sort()).toEqual(["clarity", "fx_custody", "legality", "licence"]);
    expect(getPublicScreenPrefill("Narnia")).toBeNull();
  });

  it("builds a Market with screen_source, limited evidence, no deep dive / entry facts, and the screen signal", () => {
    const m = kenyaScreenMarket();
    expect(m.id).toBe("screen_ken");
    expect(m.screen_source).toBe("public_data");
    expect(m.user_added).toBe(false);
    expect(m.evidence_confidence).toBe("limited");
    expect(m.deep_dive).toBeUndefined();
    expect(m.entry_facts).toBeUndefined();
    expect(m.sequence).toBeUndefined();
    expect(m.market_signal).toBe("Public-data screen — no entry route researched");
    expect(m.scores).toEqual({ market_opportunity: 2.5, legality: 4, licence: 3, fx_custody: 3, clarity: 4 });
    expect(m.cleared).toBe(true); // 3.275 at base weights
    expect(m.screen_evidence?.legality).toContain("Atlantic Council");
    expect(m.screen_evidence?.market_opportunity).toContain("market opportunity 1 +");
    expect(isValidStoredMarket(m)).toBe(true);
    // a screen market that claims to be a user entry, or carries entry facts, is rejected from storage
    expect(isValidStoredMarket({ ...m, user_added: true })).toBe(false);
    expect(isValidStoredMarket({ ...m, id: "custom_ken" })).toBe(false);
  });

  it("uses a declared neutral placeholder for market opportunity when no indicator data exists, never a guess dressed as data", () => {
    const opp = opportunityFill(null, null, "Atlantis");
    expect(opp.score).toBe(3);
    expect(opp.fromData).toBe(false);
    expect(opp.evidence).toMatch(/placeholder, not evidence/);
  });

  it("gives a cleared screen the shortlist verdict (never an entry verdict), no_go otherwise, and is never sequenced", () => {
    const w = engine.getDefaultWeights();
    const kenya = kenyaScreenMarket();
    const argentina = (() => {
      const c = getPublicScreen("ARG")!;
      const ind = getStaticIndicators("ARG");
      const opp = opportunityFill(ind, ind ? suggestMarketOpportunity(ind) : null, c.name);
      return publicScreenMarket(c, { baseScore: 2.6, clearThreshold: engine.getClearThreshold(), opportunity: opp });
    })();
    const e2 = engine.withMarkets([kenya, argentina]);
    expect(e2.getDecision("screen_ken", w)!.verdict).toBe("shortlist");
    expect(e2.getDecision("screen_ken", w)!.conditions.length).toBeGreaterThanOrEqual(3);
    expect(e2.getDecision("screen_ken", w)!.entryApproachSource).toBe("route_requires_confirmation");
    expect(e2.getDecision("screen_arg", w)!.verdict).toBe("no_go");
    expect(e2.recommendedSequence(w).map((s) => s.market.id)).toEqual(["uae", "brazil", "indonesia"]);
    // ranked, though
    expect(e2.rankMarkets(w).some((r) => r.market.id === "screen_ken")).toBe(true);
    // the assumptions panel lists the screen with its evidence
    const rec = e2.getMarketRecommendation("screen_ken", w)!;
    const item = rec.assumptions.find((a) => a.label === "Public-data screen")!;
    expect(item.source_type).toBe("calculated");
    expect(item.statement).toContain("Chinn-Ito");
    expect(item.statement).toContain("ka_open 0.49 (2021)");
    expect(rec.assumptions.some((a) => a.label === "Limited evidence")).toBe(false);
    expect(rec.assumptions.some((a) => a.label === "User-entered market")).toBe(false);
    // the base engine is untouched
    expect(engine.getAllMarkets()).toHaveLength(9);
  });
});

describe("public-data screen: brief export", () => {
  it("carries the banner text, the decision cap and the evidence lines", () => {
    const w = engine.getDefaultWeights();
    const kenya = kenyaScreenMarket();
    const e2 = engine.withMarkets([kenya]);
    const text = buildBrief(kenya, e2.getDecision("screen_ken", w)!, e2.getMarketRecommendation("screen_ken", w)!, e2.getRisksForMarket("screen_ken"), new Date("2026-09-25T00:00:00Z"));
    expect(text).toContain("# Kenya — market entry brief");
    expect(text).toContain("PUBLIC-DATA SCREEN");
    expect(text).toContain(PUBLIC_SCREEN_BANNER);
    expect(text).toContain("## Decision: Shortlist, research first");
    expect(text).toContain("Regulatory risk (indicative)");
    expect(text).not.toMatch(/weakest:/i);
    expect(text).toContain("Public-data screen");
    expect(text).toContain("Atlantic Council");
    expect(text).not.toContain("## Product and compliance changes");
    expect(text).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe("public-data screen: through the Dashboard", () => {
  it("finder shows a screen option (distinct from a scored market) ahead of 'score as new'; picking it yields a decision card with the banner, verdict shortlist, not in the sequence panel, persisted and removable", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.type(screen.getByTestId("finder-input"), "Kenya");
    const opt = await screen.findByTestId("finder-screen-ken");
    expect(opt).toHaveTextContent("public-data screen");
    expect(screen.queryByTestId(/^finder-option-/)).toBeNull();
    const list = screen.getByTestId("finder-results");
    const items = within(list).getAllByRole("option");
    expect(items[0]).toBe(opt);
    expect(items[items.length - 1]).toHaveAttribute("data-testid", "finder-score-new");

    await user.click(opt);
    await waitFor(() => expect(screen.getByTestId("decision-card")).toHaveAttribute("data-screen", "public_data"), { timeout: 3000 });
    expect(screen.getByTestId("public-screen-banner")).toHaveTextContent("Coarse public-data screen");
    expect(screen.getByTestId("public-screen-banner")).toHaveTextContent("Treat as a shortlist signal, not a decision");
    expect(["shortlist", "no_go"]).toContain(screen.getByTestId("decision-card").getAttribute("data-verdict"));
    expect(screen.getByTestId("decision-card").getAttribute("data-verdict")).toBe("shortlist");
    expect(screen.getByTestId("verdict-reason")).toHaveTextContent("no entry route has been researched");
    // the risk panel must not read as a finding: no Low/Medium/High word, no "Weakest:" line, number marked indicative
    const risk = screen.getByTestId("risk-score-panel");
    expect(risk).toHaveAttribute("data-indicative", "1");
    expect(risk).toHaveTextContent("indicative");
    expect(risk).toHaveTextContent("from coarse public-data bands — not a researched risk score");
    expect(risk).not.toHaveTextContent(/(Low|Medium|High) risk/);
    expect(risk).not.toHaveTextContent("Weakest:");

    // in the market list with a screen tag, but NOT in the sequence panel
    expect(screen.getByTestId("market-screen_ken")).toBeInTheDocument();
    expect(screen.getByTestId("screen-tag-screen_ken")).toHaveTextContent("screen");
    expect(within(screen.getByTestId("ranking-vs-sequence")).queryByTestId("seq-item-screen_ken")).toBeNull();
    expect(screen.queryByTestId("friction-screen_ken")).toBeNull();
    const seqIds = within(screen.getByTestId("ranking-vs-sequence"))
      .getAllByTestId(/^seq-item-/)
      .map((el) => el.getAttribute("data-testid"));
    expect(seqIds).toEqual(["seq-item-uae", "seq-item-brazil", "seq-item-indonesia"]);
    expect(screen.getByTestId("recommendation-summary")).toHaveTextContent("Public-data screen");
    expect(screen.getByTestId("recommendation-summary")).toHaveTextContent("Chinn-Ito");
    expect(screen.getByTestId("scorecard")).toHaveTextContent("public-data screen — not in Round 1");

    // persisted like a user entry
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Market[];
    expect(stored.map((m) => m.id)).toEqual(["screen_ken"]);
    expect(stored[0].screen_source).toBe("public_data");

    // compare view carries a screen tag
    await user.click(screen.getByTestId("compare-screen_ken"));
    expect(await screen.findByTestId("compare-screen-tag-screen_ken")).toHaveTextContent("screen");
    expect(screen.getByTestId("compare-view")).toHaveTextContent("not a decision");
    expect(screen.getByTestId("compare-view")).toHaveTextContent("indicative (public-data bands)");
    await user.click(screen.getByTestId("view-market"));

    // removable
    await user.click(screen.getByRole("button", { name: "Remove Kenya" }));
    expect(screen.queryByTestId("market-screen_ken")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([]);
  });

  it("the Export brief button exports the screen banner for a screen market", async () => {
    const user = userEvent.setup();
    let blobText = "";
    // capture the brief text at Blob construction (jsdom's Blob has no reliable .text())
    vi.stubGlobal(
      "Blob",
      class FakeBlob {
        constructor(parts: unknown[]) {
          blobText = parts.map(String).join("");
        }
      },
    );
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Dashboard />);
    await user.type(screen.getByTestId("finder-input"), "Kenya");
    await user.click(await screen.findByTestId("finder-screen-ken"));
    await waitFor(() => expect(screen.getByTestId("decision-card")).toHaveAttribute("data-screen", "public_data"), { timeout: 3000 });
    await user.click(screen.getByTestId("export-brief"));
    await waitFor(() => expect(blobText).toContain(PUBLIC_SCREEN_BANNER));
    click.mockRestore();
  });

  it("survives a reload: a stored screen market is restored and still capped", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([kenyaScreenMarket()]));
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("market-screen_ken"));
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "shortlist");
    expect(screen.getByTestId("public-screen-banner")).toBeInTheDocument();
  });

  it("'Score a new market' prefills all five sliders from the screen, each marked with its evidence; user edits win", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("open-add-market"));
    await user.type(screen.getByTestId("add-market-name"), "Kenya");
    expect(await screen.findByTestId("screen-prefill")).toHaveTextContent("public-data screen");
    expect((screen.getByTestId("add-score-legality") as HTMLInputElement).value).toBe("4");
    expect((screen.getByTestId("add-score-licence") as HTMLInputElement).value).toBe("3");
    expect((screen.getByTestId("add-score-fx_custody") as HTMLInputElement).value).toBe("3");
    expect((screen.getByTestId("add-score-clarity") as HTMLInputElement).value).toBe("4");
    expect(screen.getByTestId("screen-prefill-legality")).toHaveTextContent("Atlantic Council");
    expect(screen.getByTestId("screen-prefill-fx_custody")).toHaveTextContent("Chinn-Ito");
    // opportunity via the existing World Bank lookup (static snapshot: 2.5), marked as screen-assisted
    await waitFor(() => expect((screen.getByTestId("add-score-market_opportunity") as HTMLInputElement).value).toBe("2.5"), { timeout: 3000 });
    expect(screen.getByTestId("opportunity-suggestion")).toHaveTextContent("public-data screen");

    fireEvent.change(screen.getByTestId("add-score-legality"), { target: { value: "5" } });
    expect((screen.getByTestId("add-score-legality") as HTMLInputElement).value).toBe("5");
    expect(screen.getByTestId("screen-prefill-legality")).toHaveAttribute("data-touched", "1");
    expect(screen.getByTestId("screen-prefill-legality")).toHaveTextContent("Your value");
    // the other prefilled sliders are untouched
    expect((screen.getByTestId("add-score-licence") as HTMLInputElement).value).toBe("3");

    await user.click(screen.getByTestId("add-market-submit"));
    expect(screen.getByTestId("market-custom_kenya")).toBeInTheDocument();
    expect(screen.getByTestId("decision-card")).not.toHaveAttribute("data-screen");
    // the untouched prefilled dimensions are recorded as screen evidence under Assumptions; legality (edited) is not
    expect(screen.getByTestId("recommendation-summary")).toHaveTextContent("Some sliders were prefilled from the public-data screen");
    expect(screen.getByTestId("recommendation-summary")).toHaveTextContent("fx_custody:");
    expect(screen.getByTestId("recommendation-summary")).not.toHaveTextContent("legality:");
  });

  it("a user market with the same name is still creatable and takes precedence over the screen market", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.type(screen.getByTestId("finder-input"), "Kenya");
    await user.click(await screen.findByTestId("finder-screen-ken"));
    await screen.findByTestId("market-screen_ken", {}, { timeout: 3000 });

    // the screen market is an exact name match, yet "score by hand" is still offered and the screen option is not
    await user.type(screen.getByTestId("finder-input"), "Kenya");
    expect(await screen.findByTestId("finder-score-new")).toBeInTheDocument();
    expect(screen.queryByTestId("finder-screen-ken")).toBeNull();
    await user.click(screen.getByTestId("finder-score-new"));
    expect((screen.getByTestId("add-market-name") as HTMLInputElement).value).toBe("Kenya");
    expect(screen.queryByTestId("add-market-name-error")).toBeNull();
    fireEvent.change(screen.getByTestId("add-score-legality"), { target: { value: "5" } });
    await user.click(screen.getByTestId("add-market-submit"));

    expect(screen.getByTestId("market-custom_kenya")).toBeInTheDocument();
    expect(screen.queryByTestId("market-screen_ken")).toBeNull();
    expect(screen.getByTestId("decision-card")).not.toHaveAttribute("data-screen");
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as Market[];
    expect(stored.map((m) => m.id)).toEqual(["custom_kenya"]);

    // and the screen can no longer displace it
    await user.type(screen.getByTestId("finder-input"), "Kenya");
    expect(await screen.findByTestId("finder-option-custom_kenya")).toBeInTheDocument();
    expect(screen.queryByTestId("finder-screen-ken")).toBeNull();
  });
});

describe("public-data screen: risk panel stays a finding for researched markets", () => {
  it("a Round 1 market still shows the band word and the weakest dimensions", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("market-brazil"));
    const risk = screen.getByTestId("risk-score-panel");
    expect(risk).not.toHaveAttribute("data-indicative");
    expect(risk).toHaveTextContent(/(Low|Medium|High) risk/);
    expect(risk).toHaveTextContent("Weakest:");
    expect(risk).not.toHaveTextContent("indicative");
  });
});

describe("public-data screen: tracker-only country (Taiwan)", () => {
  it("appears in the finder as 'unavailable', opens the form with legality/licence/clarity prefilled and fx_custody left at the default", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.type(screen.getByTestId("finder-input"), "Taiwan");
    const opt = await screen.findByTestId("finder-screen-unavailable-twn");
    expect(opt).toHaveTextContent(PUBLIC_SCREEN_UNAVAILABLE_LABEL);
    expect(screen.queryByTestId(/^finder-screen-[a-z]{3}$/)).toBeNull(); // not offered as a full screen
    expect(screen.queryByTestId(/^finder-option-/)).toBeNull();
    await user.click(opt);

    expect((screen.getByTestId("add-market-name") as HTMLInputElement).value).toBe("Taiwan");
    expect(await screen.findByTestId("screen-prefill")).toHaveAttribute("data-partial", "1");
    expect(screen.getByTestId("screen-prefill")).toHaveTextContent("no Chinn-Ito capital-controls value");
    expect((screen.getByTestId("add-score-legality") as HTMLInputElement).value).toBe("4");
    expect((screen.getByTestId("add-score-licence") as HTMLInputElement).value).toBe("3");
    expect((screen.getByTestId("add-score-clarity") as HTMLInputElement).value).toBe("4");
    expect((screen.getByTestId("add-score-fx_custody") as HTMLInputElement).value).toBe("3"); // untouched default
    expect(screen.getByTestId("screen-prefill-legality")).toHaveTextContent("Atlantic Council");
    expect(screen.queryByTestId("screen-prefill-fx_custody")).toBeNull();
    expect(screen.getByTestId("screen-prefill-fx_custody-missing")).toHaveTextContent("left at the default");
    // no screen market was created; it is a plain user entry once submitted
    expect(screen.queryByTestId("market-screen_twn")).toBeNull();
    fireEvent.change(screen.getByTestId("add-score-fx_custody"), { target: { value: "4" } });
    await user.click(screen.getByTestId("add-market-submit"));
    expect(screen.getByTestId("market-custom_taiwan")).toBeInTheDocument();
    expect(screen.getByTestId("decision-card")).not.toHaveAttribute("data-screen");
    expect(screen.getByTestId("recommendation-summary")).toHaveTextContent("Some sliders were prefilled from the public-data screen");
    expect(screen.getByTestId("recommendation-summary")).not.toHaveTextContent("fx_custody:");
  });
});

describe("public-data screen: absent or empty file", () => {
  it("degrades to the current behaviour: no screen options, no prefill, nothing else changes", async () => {
    restore();
    restore = setPublicScreenData(null);
    expect(listPublicScreen()).toEqual([]);
    expect(getPublicScreen("Kenya")).toBeNull();
    const user = userEvent.setup();
    render(<Dashboard />);
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "go_now"); // Dubai, as before
    await user.type(screen.getByTestId("finder-input"), "Kenya");
    expect(await screen.findByTestId("finder-score-new")).toBeInTheDocument();
    expect(screen.queryByTestId(/^finder-screen-/)).toBeNull();
    expect(listPublicScreenUnavailable()).toEqual([]);
    await user.click(screen.getByTestId("finder-score-new"));
    expect(screen.queryByTestId("screen-prefill")).toBeNull();
    expect((screen.getByTestId("add-score-legality") as HTMLInputElement).value).toBe("3");
  });

  it("the bundled JSON parses even when it is only {countries: []}, and malformed entries are dropped", () => {
    restore();
    restore = setPublicScreenData({ countries: [{ iso3: "ken", name: "Kenya" }, { iso3: "MEX", name: "Mexico", scores: { legality: 4, licence: 3, clarity: 4, fx_custody: 9, market_opportunity: null }, evidence: {} }] });
    expect(listPublicScreen()).toEqual([]);
  });
});
