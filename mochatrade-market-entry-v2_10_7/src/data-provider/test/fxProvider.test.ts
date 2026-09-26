// Tests for the data-provider layer only. Mocking `fetch` here is correct
// and deliberate -- this is exactly the seam the provider abstraction
// exists to isolate, unlike the decision engine, which these tests never
// touch or mock.
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchLiveFxRates } from "../liveFxProvider";
import { getStaticFxRates } from "../staticFxProvider";
import { getFxRates } from "../fxProvider";
import { STATIC_FX_SNAPSHOT } from "../staticFxSnapshot";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

const VALID_BODY = {
  date: "2026-09-24",
  usd: { aed: 3.6725, idr: 17799.6, php: 62.62, ngn: 1324.9, brl: 5.1, pkr: 277.3 },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchLiveFxRates (live provider)", () => {
  it("normalizes a valid response into FxRate[] with status live and a fetchedAt timestamp", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(VALID_BODY));
    const result = await fetchLiveFxRates(["AED", "IDR"], { fetchImpl });

    expect(result).toEqual([
      { currency: "AED", ratePerUsd: 3.6725, source: "jsDelivr currency-api (live)", status: "live", fetchedAt: expect.any(String) },
      { currency: "IDR", ratePerUsd: 17799.6, source: "jsDelivr currency-api (live)", status: "live", fetchedAt: expect.any(String) },
    ]);
    expect(new Date(result[0].fetchedAt!).toString()).not.toBe("Invalid Date");
  });

  it("is case-insensitive on the way in and normalizes currency codes to upper-case on the way out", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(VALID_BODY));
    const result = await fetchLiveFxRates(["aed", "Php"], { fetchImpl });
    expect(result.map((r) => r.currency)).toEqual(["AED", "PHP"]);
  });

  it("throws on a non-2xx HTTP status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    await expect(fetchLiveFxRates(["AED"], { fetchImpl })).rejects.toThrow(/HTTP 500/);
  });

  it("throws on malformed JSON (body.json() rejects)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);
    await expect(fetchLiveFxRates(["AED"], { fetchImpl })).rejects.toThrow(/malformed JSON/);
  });

  it("throws when the response is missing the expected `usd` object entirely", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ date: "2026-09-24" }));
    await expect(fetchLiveFxRates(["AED"], { fetchImpl })).rejects.toThrow(/missing the expected/);
  });

  it("throws when a specifically requested currency is missing from an otherwise-valid response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ usd: { aed: 3.6725 } }));
    await expect(fetchLiveFxRates(["AED", "XYZ"], { fetchImpl })).rejects.toThrow(/XYZ/);
  });

  it("throws when a currency's value is non-numeric, zero, negative, or non-finite (never fabricates a fallback number itself)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ usd: { aed: "not-a-number" } }));
    await expect(fetchLiveFxRates(["AED"], { fetchImpl })).rejects.toThrow();

    const fetchImplZero = vi.fn().mockResolvedValue(jsonResponse({ usd: { aed: 0 } }));
    await expect(fetchLiveFxRates(["AED"], { fetchImpl: fetchImplZero })).rejects.toThrow();
  });

  it("propagates a network failure (fetch itself rejecting) as a rejected promise", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchLiveFxRates(["AED"], { fetchImpl })).rejects.toThrow(/Failed to fetch/);
  });
});

describe("getStaticFxRates (fallback provider)", () => {
  it("returns every configured currency tagged status: fallback, with fetchedAt null", () => {
    const result = getStaticFxRates(["AED", "IDR", "PHP", "NGN"]);
    result.forEach((r) => {
      expect(r.status).toBe("fallback");
      expect(r.fetchedAt).toBeNull();
      expect(r.source).toMatch(/not live/i);
    });
  });

  it("returns exactly the values in the static snapshot -- never invents or adjusts a number", () => {
    const result = getStaticFxRates(["AED"]);
    expect(result[0].ratePerUsd).toBe(STATIC_FX_SNAPSHOT.rates.AED);
  });

  it("throws for a currency with no configured fallback, rather than silently returning nothing", () => {
    expect(() => getStaticFxRates(["ZZZ"])).toThrow(/No static fallback/);
  });
});

describe("getFxRates (orchestration: live-then-fallback)", () => {
  it("returns live data, correctly tagged, when the live provider succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(VALID_BODY));
    const result = await getFxRates(["AED"], { liveOptions: { fetchImpl } });
    expect(result[0].status).toBe("live");
    expect(result[0].ratePerUsd).toBe(3.6725);
  });

  it("falls back to static data on a network failure, and NEVER labels the fallback as live", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await getFxRates(["AED"], { liveOptions: { fetchImpl } });
    expect(result[0].status).toBe("fallback");
    expect(result[0].ratePerUsd).toBe(STATIC_FX_SNAPSHOT.rates.AED);
  });

  it("falls back to static data on an HTTP error status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 503));
    const result = await getFxRates(["NGN"], { liveOptions: { fetchImpl } });
    expect(result[0].status).toBe("fallback");
  });

  it("falls back to static data on a malformed/incomplete response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ usd: {} }));
    const result = await getFxRates(["PHP"], { liveOptions: { fetchImpl } });
    expect(result[0].status).toBe("fallback");
    expect(result[0].ratePerUsd).toBe(STATIC_FX_SNAPSHOT.rates.PHP);
  });

  it("falls back to static data when the live request times out", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const result = await getFxRates(["IDR"], { timeoutMs: 20, liveOptions: { fetchImpl } });
    expect(result[0].status).toBe("fallback");
  });

  it("returns an empty array for an empty currency list without calling the network", async () => {
    const fetchImpl = vi.fn();
    const result = await getFxRates([], { liveOptions: { fetchImpl } });
    expect(result).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back without throwing when live fails and all requested currencies have configured static snapshots", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await getFxRates(["AED", "IDR", "PHP", "NGN"], { liveOptions: { fetchImpl } });
    expect(result).toHaveLength(4);
    result.forEach((r) => expect(r.status).toBe("fallback"));
    expect(result.map((r) => r.currency)).toEqual(["AED", "IDR", "PHP", "NGN"]);
  });
});
