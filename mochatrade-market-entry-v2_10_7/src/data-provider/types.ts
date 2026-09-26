// Normalized contract for supplementary live/fallback FX data. This is the
// ONLY shape the rest of the app (hooks, components) should ever see --
// nothing outside src/data-provider/ should know whether a value came from
// the jsDelivr-hosted currency-api, a hardcoded fallback snapshot, or any
// future provider. The decision engine (src/engine/*) never touches this
// file and never sees an FxRate; FX is supplementary display data only.

export type FxStatus = "live" | "fallback";

export interface FxRate {
  /** ISO 4217 code, upper-case (e.g. "AED"). */
  currency: string;
  /** Units of `currency` per 1 USD. */
  ratePerUsd: number;
  /** Human-readable provenance, shown in the UI next to the value. */
  source: string;
  /** Whether this value came from the live provider or the static fallback. Never "live" for a fallback value, regardless of how fresh it looks. */
  status: FxStatus;
  /** ISO-8601 timestamp of the live fetch, or null when the value has no live timestamp (fallback). */
  fetchedAt: string | null;
}
