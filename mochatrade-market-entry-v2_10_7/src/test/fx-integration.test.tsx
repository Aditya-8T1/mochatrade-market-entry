// Confirms the FX integration end to end through the real app --
// not just the provider unit tests. Only `fetch` is mocked (the actual
// external boundary); the engine, hooks and components are all real.
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openMarket, renderApp } from "./harness";
import { STATIC_FX_SNAPSHOT } from "../data-provider/staticFxSnapshot";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FX badge, integrated through the real app", () => {
  it("shows LIVE with the jsDelivr source and a fresh timestamp when the live fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ date: "2026-09-24", usd: { aed: 3.6725 } }),
      }),
    );

    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "uae", "readiness");

    await waitFor(() => expect(screen.getByTestId("fx-status")).toHaveAttribute("data-status", "live"));
    const fxRow = screen.getByTestId("fx-row");
    expect(fxRow.textContent).toContain("3.6725");
    expect(fxRow.textContent).toContain("AED");
    expect(fxRow.textContent).toMatch(/updated/i);
    expect(screen.getByTestId("fx-status")).toHaveAttribute("title", expect.stringContaining("jsDelivr"));
  });

  it("shows FALLBACK with the static snapshot value -- never LIVE -- when the live fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "uae", "readiness");

    await waitFor(() => expect(screen.getByTestId("fx-status")).toHaveAttribute("data-status", "fallback"));
    const fxRow = screen.getByTestId("fx-row");
    expect(fxRow.textContent).toContain(String(STATIC_FX_SNAPSHOT.rates.AED));
    expect(fxRow.textContent).toMatch(/static snapshot/i);
    expect(fxRow.textContent).not.toMatch(/\blive\b/i);
  });

  it("shows FALLBACK when the live response is malformed (missing the usd object)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ date: "2026-09-24" }) }),
    );

    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "indonesia", "readiness");

    await waitFor(() => expect(screen.getByTestId("fx-status")).toHaveAttribute("data-status", "fallback"));
  });

  it("renders no FX row at all for a market with no mapped currency (e.g. Brazil)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ usd: {} }) }));

    const user = userEvent.setup();
    renderApp();
    await openMarket(user, "brazil", "readiness");

    expect(screen.queryByTestId("fx-row")).not.toBeInTheDocument();
  });

  it("switching from a market with FX to one without, and back, does not leave a stale FX row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ usd: { aed: 3.6725, idr: 17799.6 } }) }),
    );

    const user = userEvent.setup();
    renderApp();

    await openMarket(user, "uae", "readiness");
    await waitFor(() => expect(screen.getByTestId("fx-row")).toHaveAttribute("data-currency", "AED"));

    await openMarket(user, "brazil", "readiness");
    expect(screen.queryByTestId("fx-row")).not.toBeInTheDocument();

    await openMarket(user, "indonesia", "readiness");
    await waitFor(() => expect(screen.getByTestId("fx-row")).toHaveAttribute("data-currency", "IDR"));
  });
});
