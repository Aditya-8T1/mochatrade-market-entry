// User-entered candidate markets ("Score a new market"). Kept out of the
// base engine: useMarketEntry() builds a second engine with
// engine.withMarkets(custom) so the Round 1 data and its tests are untouched.
// Persisted in localStorage so a demo reload doesn't lose the entry.
import { useCallback, useEffect, useState } from "react";
import type { Market } from "../engine/types";
import { DIMENSION_KEYS, engine } from "../engine";

const KEY = "mochatrade.customMarkets.v1";

const inRange = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 1 && n <= 5;

/**
 * Only accept entries this app could have written -- a "Score a new market"
 * entry (custom_*, user_added) or a public-data screen market (screen_*,
 * screen_source "public_data", never sequenced so no entry_facts needed);
 * anything else (hand-edited, older schema) is dropped rather than crashing
 * the engine.
 */
export function isValidStoredMarket(m: unknown): m is Market {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  const scores = x.scores as Record<string, unknown> | undefined;
  const common =
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    x.name.trim().length > 0 &&
    typeof x.cleared === "boolean" &&
    !!scores &&
    DIMENSION_KEYS.every((k) => inRange(scores[k]));
  if (!common) return false;
  if (x.screen_source === "public_data") {
    return /^screen_[a-z0-9_]+$/.test(x.id as string) && x.user_added !== true && !x.entry_facts && !x.deep_dive;
  }
  return /^custom_[a-z0-9_]+$/.test(x.id as string) && x.user_added === true && (!x.cleared || (!!x.entry_facts && typeof x.entry_facts === "object"));
}

const sameName = (a: Market, b: Market) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

function load(): Market[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A public-data screen saved before a country was researched (e.g. Mexico
    // before Round 2) is superseded by the researched market: drop it.
    const builtIn = new Set(engine.getAllMarkets().map((m) => m.name.trim().toLowerCase()));
    return parsed.filter(isValidStoredMarket).filter((m) => !(m.screen_source === "public_data" && builtIn.has(m.name.trim().toLowerCase())));
  } catch {
    return [];
  }
}

export function useCustomMarkets() {
  const [custom, setCustom] = useState<Market[]>(() => (typeof window === "undefined" ? [] : load()));

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(custom));
    } catch {
      /* storage unavailable -- in-memory only */
    }
  }, [custom]);

  // A hand-scored user market takes precedence over a public-data screen of
  // the same country: adding one replaces the screen entry; adding a screen
  // never displaces a user entry.
  const addMarket = useCallback((m: Market) => {
    setCustom((prev) => {
      if (m.screen_source === "public_data" && prev.some((x) => x.user_added && sameName(x, m))) return prev;
      return [...prev.filter((x) => x.id !== m.id && !(m.user_added && x.screen_source === "public_data" && sameName(x, m))), m];
    });
  }, []);
  const removeMarket = useCallback((id: string) => setCustom((prev) => prev.filter((x) => x.id !== id)), []);

  return { custom, addMarket, removeMarket };
}
