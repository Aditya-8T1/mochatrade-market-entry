import type { FxRate } from "./types";
import { STATIC_FX_SNAPSHOT } from "./staticFxSnapshot";

const SOURCE_LABEL = `Static fallback snapshot (captured ${STATIC_FX_SNAPSHOT.capturedAt.slice(0, 10)}) — not live`;

/**
 * Always available, never network-dependent. Every value returned here is
 * tagged status: "fallback" -- this function must never claim "live",
 * regardless of how fresh the underlying snapshot happens to be.
 * Throws only if asked for a currency with no configured fallback, which
 * is a programming error (an unmapped currency), not a runtime condition
 * to swallow silently.
 */
export function getStaticFxRates(currencies: string[]): FxRate[] {
  return currencies.map((currency) => {
    const upper = currency.toUpperCase();
    const rate = STATIC_FX_SNAPSHOT.rates[upper];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`No static fallback FX rate configured for "${upper}"`);
    }
    return {
      currency: upper,
      ratePerUsd: rate,
      source: SOURCE_LABEL,
      status: "fallback",
      fetchedAt: null,
    };
  });
}
