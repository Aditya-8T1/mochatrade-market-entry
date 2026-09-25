// "Score a new market" pre-fill from public data, through the real
// Dashboard. Only `fetch` is mocked, routed by URL: REST Countries, World
// Bank and the FX feed each get their own canned answer or failure.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../screens/Dashboard";

const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const v5 = (objects: unknown[]) => ({ data: { objects, meta: { total: objects.length } } });
const KENYA_RC = v5([{ names: { common: "Kenya", official: "Republic of Kenya" }, codes: { alpha_2: "KE", alpha_3: "KEN" }, currencies: [{ code: "KES", name: "Kenyan shilling" }], languages: [{ name: "English" }, { name: "Swahili" }], population: 53_005_614, region: "Africa" }]);
const KENYA_WB = [{ page: 1 }, [
  { indicator: { id: "SP.POP.TOTL" }, date: "2023", value: 55_100_586 },
  { indicator: { id: "NY.GDP.PCAP.CD" }, date: "2023", value: 1_949.9 },
  { indicator: { id: "IT.NET.USER.ZS" }, date: "2022", value: 40.8 },
]];
const MEXICO_RC = v5([{ names: { common: "Mexico" }, codes: { alpha_2: "MX", alpha_3: "MEX" }, currencies: [{ code: "MXN" }], languages: [{ name: "Spanish" }], population: 128_000_000 }]);
const FX = { date: "2026-09-25", usd: { kes: 129.5, aed: 3.6725, idr: 16000, mxn: 18.2 } };

function routeFetch(handlers: Record<string, (url: string) => unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [needle, h] of Object.entries(handlers)) if (url.includes(needle)) return h(url);
    throw new TypeError("Failed to fetch");
  });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("country lookup in Score a new market", () => {
  it("pre-fills market opportunity, localisation and currency from live data, and shows LIVE", async () => {
    vi.stubGlobal("fetch", routeFetch({ "restcountries.com": () => ok(KENYA_RC), "api.worldbank.org": () => ok(KENYA_WB), "jsdelivr": () => ok(FX) }));
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("open-add-market"));
    await user.type(screen.getByTestId("add-market-name"), "Kenya");

    const facts = await screen.findByTestId("country-facts", {}, { timeout: 3000 });
    await waitFor(() => expect(within(facts).getByTestId("indicator-status")).toHaveAttribute("data-status", "live"), { timeout: 3000 });
    expect(within(facts).getByTestId("country-status")).toHaveAttribute("data-status", "live");
    expect(facts).toHaveTextContent("KES");
    expect(facts).toHaveTextContent("English, Swahili");

    // 22M internet users -> +1, US$1,950 -> +0.25 => 2.25 -> 2.5
    const slider = screen.getByTestId("add-score-market_opportunity") as HTMLInputElement;
    expect(slider.value).toBe("2.5");
    expect(screen.getByTestId("opportunity-suggestion")).toHaveTextContent("Suggested from public data");
    // English is official -> localisation NOT ticked
    expect((screen.getByLabelText(/New language/) as HTMLInputElement).checked).toBe(false);

    // lift legality so the market clears screening (2.5 opportunity alone would not)
    fireEvent.change(screen.getByTestId("add-score-legality"), { target: { value: "5" } });
    await user.click(screen.getByTestId("add-market-submit"));
    expect(screen.getByTestId("market-custom_kenya")).toBeInTheDocument();
    // currency carried onto the market -> FX row appears for a custom market
    await waitFor(() => expect(screen.getByTestId("fx-row")).toHaveAttribute("data-currency", "KES"), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId("fx-status")).toHaveAttribute("data-status", "live"));
    // provenance surfaces in the assumptions panel
    expect(screen.getByTestId("recommendation-summary")).toHaveTextContent(/World Bank/);
  });

  it("ticks localisation for a non-English country and never overrides a value the user set by hand", async () => {
    vi.stubGlobal("fetch", routeFetch({ "restcountries.com": () => ok(MEXICO_RC) }));
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("open-add-market"));
    // user sets opportunity BEFORE the lookup lands
    const slider = screen.getByTestId("add-score-market_opportunity") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "4" } });
    expect(slider.value).toBe("4");
    await user.type(screen.getByTestId("add-market-name"), "Mexico");
    const facts = await screen.findByTestId("country-facts", {}, { timeout: 3000 });
    await waitFor(() => expect(within(facts).getByTestId("country-status")).toHaveAttribute("data-status", "live"), { timeout: 3000 });
    // World Bank live failed -> snapshot
    await waitFor(() => expect(within(facts).getByTestId("indicator-status")).toHaveAttribute("data-status", "fallback"), { timeout: 3000 });
    expect((screen.getByLabelText(/New language/) as HTMLInputElement).checked).toBe(true);
    expect(slider.value).toBe("4"); // user's value kept
    expect(screen.getByTestId("opportunity-suggestion")).toHaveTextContent("Your value");
  });

  it("degrades to 'score it by hand' when no source knows the country, and the form still submits", async () => {
    vi.stubGlobal("fetch", routeFetch({ "restcountries.com": () => ok(v5([])) }));
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("open-add-market"));
    await user.type(screen.getByTestId("add-market-name"), "Atlantis");
    await waitFor(() => expect(screen.getByTestId("country-facts")).toHaveAttribute("data-status", "none"), { timeout: 3000 });
    expect(screen.getByTestId("country-facts")).toHaveTextContent(/score it by hand/);
    expect((screen.getByTestId("add-score-market_opportunity") as HTMLInputElement).value).toBe("3");
    await user.click(screen.getByTestId("add-market-submit"));
    expect(screen.getByTestId("market-custom_atlantis")).toBeInTheDocument();
    expect(screen.queryByTestId("fx-row")).toBeNull();
  });
});
