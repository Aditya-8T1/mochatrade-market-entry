import { useEffect, useState } from "react";
import { getCountry, getIndicators, suggestMarketOpportunity } from "../data-provider";
import type { CountryFacts, CountryIndicators, OpportunitySuggestion } from "../data-provider";

export interface CountryLookup {
  country: CountryFacts | null;
  indicators: CountryIndicators | null;
  suggestion: OpportunitySuggestion | null;
  loading: boolean;
  /** true once a lookup for the current name has finished (found or not) */
  settled: boolean;
}

const EMPTY: CountryLookup = { country: null, indicators: null, suggestion: null, loading: false, settled: false };

/**
 * Debounced country lookup for the add-market form: REST Countries for
 * facts, then World Bank for indicators, then the opportunity suggestion.
 * Each step degrades independently (live → snapshot → null).
 */
export function useCountryLookup(name: string, debounceMs = 450): CountryLookup {
  const [state, setState] = useState<CountryLookup>(EMPTY);
  const q = name.trim();

  useEffect(() => {
    if (q.length < 3) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, settled: false }));
    const t = setTimeout(async () => {
      const country = await getCountry(q);
      if (cancelled) return;
      if (!country) {
        setState({ country: null, indicators: null, suggestion: null, loading: false, settled: true });
        return;
      }
      const indicators = country.iso3 ? await getIndicators(country.iso3) : null;
      if (cancelled) return;
      const suggestion = indicators ? suggestMarketOpportunity(indicators) : null;
      setState({ country, indicators, suggestion, loading: false, settled: true });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, debounceMs]);

  return state;
}
