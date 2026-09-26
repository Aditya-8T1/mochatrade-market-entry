// Deliberately its own hook, not folded into useEngine/useMarketEntry.
// FX is supplementary display data with a real async/loading lifecycle;
// the engine and its hooks stay fully synchronous. Nothing here can affect
// scoring, ranking, sequencing or any decision the engine makes.
import { useEffect, useState } from "react";
import { getFxRates } from "../data-provider";
import type { FxRate } from "../data-provider";

export interface UseFxRatesResult {
  /** Keyed by upper-case ISO 4217 code. */
  rates: Record<string, FxRate>;
  loading: boolean;
}

export function useFxRates(currencies: string[]): UseFxRatesResult {
  const key = currencies.join(",");
  const [rates, setRates] = useState<Record<string, FxRate>>({});
  const [loading, setLoading] = useState(currencies.length > 0);

  useEffect(() => {
    if (currencies.length === 0) {
      setRates({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setRates({});
    setLoading(true);
    getFxRates(currencies)
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, FxRate> = {};
        results.forEach((r) => {
          map[r.currency] = r;
        });
        setRates(map);
        setLoading(false);
      })
      .catch(() => {
        // Live failed AND the currency has no static snapshot (a config
        // gap, see getFxRates). Show "unavailable", not an endless spinner.
        if (cancelled) return;
        setRates({});
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `key` is the stable dependency; `currencies` is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { rates, loading };
}
