import type { FxRate } from "./types";

// The endpoint uses the provider's v1 API path. The response is still
// validated because this is an external dependency. @latest keeps the
// feed current; the static snapshot remains the fallback.
const LIVE_ENDPOINT = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const SOURCE_LABEL = "jsDelivr currency-api (live)";

interface RawUsdResponse {
  date?: unknown;
  usd?: Record<string, unknown>;
}

function isValidRawResponse(data: unknown): data is RawUsdResponse {
  if (typeof data !== "object" || data === null) return false;
  const usd = (data as Record<string, unknown>).usd;
  return typeof usd === "object" && usd !== null && !Array.isArray(usd);
}

export interface FetchLiveFxOptions {
  signal?: AbortSignal;
  endpoint?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetches live FX rates and normalizes them into FxRate[]. Throws on any
 * network error, non-2xx status, malformed JSON, a response missing the
 * expected `usd` object, or any requested currency missing/invalid within
 * it. All-or-nothing by design: callers get every requested currency live,
 * or none (an exception to catch and fall back on) -- never a silently
 * partial mix of live and missing values.
 */
export async function fetchLiveFxRates(currencies: string[], opts: FetchLiveFxOptions = {}): Promise<FxRate[]> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const res = await fetchFn(opts.endpoint ?? LIVE_ENDPOINT, { signal: opts.signal });

  if (!res.ok) {
    throw new Error(`Live FX provider returned HTTP ${res.status}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Live FX provider returned malformed JSON");
  }

  if (!isValidRawResponse(data)) {
    throw new Error('Live FX provider response is missing the expected "usd" rates object');
  }

  const usdRates = (data as RawUsdResponse).usd as Record<string, unknown>;
  const fetchedAt = new Date().toISOString();

  return currencies.map((currency) => {
    const raw = usdRates[currency.toLowerCase()];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      throw new Error(`Live FX provider is missing a valid rate for "${currency}"`);
    }
    return {
      currency: currency.toUpperCase(),
      ratePerUsd: raw,
      source: SOURCE_LABEL,
      status: "live",
      fetchedAt,
    };
  });
}
