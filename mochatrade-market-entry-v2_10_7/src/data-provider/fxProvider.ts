import type { FxRate } from "./types";
import { fetchLiveFxRates, type FetchLiveFxOptions } from "./liveFxProvider";
import { getStaticFxRates } from "./staticFxProvider";

export interface GetFxRatesOptions {
  timeoutMs?: number;
  /** Test/advanced use only -- see fetchLiveFxRates. */
  liveOptions?: Omit<FetchLiveFxOptions, "signal">;
}

/**
 * The one function the rest of the app should call for FX. Attempts the
 * live provider first; on ANY live-provider failure -- network error,
 * timeout, non-2xx, malformed body, missing currency -- the requested
 * currencies fall back to the static snapshot instead, each tagged
 * status: "fallback". Never mixes live and fallback values within one
 * call: the whole batch is live, or the whole batch is fallback.
 *
 * This does NOT guarantee it never throws: the static snapshot only
 * covers a fixed, configured set of currencies (see staticFxSnapshot.ts),
 * so requesting an unconfigured/unknown currency is a configuration error
 * and will throw once the live fetch fails, same as getStaticFxRates does.
 * Every currency this app actually requests is configured, so in practice
 * that path isn't hit -- but the function itself makes no such promise.
 */
export async function getFxRates(currencies: string[], opts: GetFxRatesOptions = {}): Promise<FxRate[]> {
  if (currencies.length === 0) return [];

  const timeoutMs = opts.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchLiveFxRates(currencies, { ...opts.liveOptions, signal: controller.signal });
  } catch {
    return getStaticFxRates(currencies);
  } finally {
    clearTimeout(timer);
  }
}
