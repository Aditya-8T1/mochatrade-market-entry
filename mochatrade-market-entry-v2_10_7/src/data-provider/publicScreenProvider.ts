/**
 * Public-data screen: coarse 1-5 bands for every country covered by the
 * Atlantic Council crypto-regulation tracker AND the Chinn-Ito KAOPEN
 * index, generated at build time by scripts/build-public-screen.ts into
 * data/public-screen.json (bundled -- no runtime network call).
 *
 * A screened country is a SHORTLIST SIGNAL, never a decision: it has no
 * entry route, no deep dive and no entry facts, so it is ranked but never
 * sequenced, and its verdict is capped at "Enter next". The Round 1 nine
 * are excluded at build time and never come from here.
 *
 * If data/public-screen.json is absent or empty, every lookup returns
 * null/[] and the app behaves exactly as before.
 */
import publicScreenJson from "../../data/public-screen.json";
import type { DimensionKey, Market } from "../engine/types";
import { regulatoryBlocker } from "../engine/decision";
import type { PublicScreenCountry, PublicScreenData, PublicScreenPartial, PublicScreenSource, ScreenDimension } from "./publicScreenBands";
import { SCREEN_DIMENSIONS } from "./publicScreenBands";
import type { OpportunitySuggestion } from "./marketOpportunity";
import type { CountryIndicators } from "./worldBankProvider";

export type { PublicScreenCountry, PublicScreenData, PublicScreenPartial, PublicScreenSource } from "./publicScreenBands";
export { PUBLIC_SCREEN_UNAVAILABLE_LABEL } from "./publicScreenBands";

export const PUBLIC_SCREEN_SIGNAL = "Public-data screen — no entry route researched";
export const PUBLIC_SCREEN_LABEL = "public-data screen";
export const PUBLIC_SCREEN_BANNER =
  "Coarse public-data screen. Legality/licence/clarity from the Atlantic Council tracker cannot distinguish crypto derivatives or retail leverage; FX from Chinn-Ito. No entry route has been researched. Treat as a shortlist signal, not a decision.";

const ALIASES: Record<string, string> = { uae: "united arab emirates", dubai: "united arab emirates", "dubai (uae)": "united arab emirates", turkiye: "turkey", "viet nam": "vietnam" };
/** Lower-case, diacritics stripped, aliases folded -- applied to BOTH the query and the stored name so "turkiye", "Türkiye" and "Turkey" meet. */
export function foldCountryName(s: string): string {
  const base = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  return ALIASES[base] ?? base;
}
const norm = foldCountryName;
const inRange = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 1 && n <= 5;

/** Accepts only well-formed countries; anything else in the file is dropped rather than crashing the engine. */
export function normalisePublicScreen(raw: unknown): PublicScreenData {
  if (!raw || typeof raw !== "object") return { countries: [] };
  const r = raw as Partial<PublicScreenData>;
  const countries = Array.isArray(r.countries)
    ? (r.countries as unknown[]).filter((c): c is PublicScreenCountry => {
        if (!c || typeof c !== "object") return false;
        const x = c as Partial<PublicScreenCountry>;
        return (
          typeof x.iso3 === "string" &&
          /^[A-Z]{3}$/.test(x.iso3) &&
          typeof x.name === "string" &&
          x.name.trim().length > 0 &&
          !!x.scores &&
          SCREEN_DIMENSIONS.every((k) => inRange(x.scores?.[k])) &&
          !!x.evidence &&
          SCREEN_DIMENSIONS.every((k) => typeof x.evidence?.[k] === "string")
        );
      })
    : [];
  const TRACKER_DIMS = ["legality", "licence", "clarity"] as const;
  const unavailable = Array.isArray(r.unavailable)
    ? (r.unavailable as unknown[]).filter((c): c is PublicScreenPartial => {
        if (!c || typeof c !== "object") return false;
        const x = c as Partial<PublicScreenPartial>;
        return (
          typeof x.iso3 === "string" &&
          /^[A-Z]{3}$/.test(x.iso3) &&
          typeof x.name === "string" &&
          x.name.trim().length > 0 &&
          !!x.scores &&
          TRACKER_DIMS.every((k) => inRange(x.scores?.[k])) &&
          !!x.evidence &&
          TRACKER_DIMS.every((k) => typeof x.evidence?.[k] === "string")
        );
      })
    : [];
  // a country can only be in one list; the full screen wins
  const fullIso = new Set(countries.map((c) => c.iso3));
  return {
    generated: typeof r.generated === "string" ? r.generated : undefined,
    sources: Array.isArray(r.sources) ? (r.sources as PublicScreenSource[]) : [],
    countries,
    unavailable: unavailable.filter((u) => !fullIso.has(u.iso3)),
  };
}

let current: PublicScreenData = normalisePublicScreen(publicScreenJson);

/** Test hook: swap the bundled data (pass null to simulate an absent/empty file). Returns a restore function. */
export function setPublicScreenData(data: unknown | null): () => void {
  const before = current;
  current = normalisePublicScreen(data ?? { countries: [] });
  return () => {
    current = before;
  };
}

export function listPublicScreen(): PublicScreenCountry[] {
  return current.countries;
}

/** Tracker jurisdictions with no Chinn-Ito value (e.g. Taiwan, Serbia). Shown in the finder as a prefill offer only. */
export function listPublicScreenUnavailable(): PublicScreenPartial[] {
  return current.unavailable ?? [];
}

function matchName<T extends { iso3: string; name: string }>(list: T[], query: string): T | null {
  const q = query.trim();
  if (!q) return null;
  if (/^[A-Za-z]{3}$/.test(q)) {
    const byIso = list.find((c) => c.iso3 === q.toUpperCase());
    if (byIso) return byIso;
  }
  const n = norm(q);
  return list.find((c) => norm(c.name) === n) ?? (n.length >= 4 ? list.find((c) => norm(c.name).startsWith(n)) ?? null : null);
}

export interface PublicScreenPrefill {
  iso3: string;
  name: string;
  /** false when fx_custody is present (full screen); true when only the three tracker dimensions are known */
  partial: boolean;
  dims: Partial<Record<ScreenDimension, { score: number; evidence: string }>>;
  reason?: string;
}

/** What "Score a new market" can prefill for a typed country: all four screen dimensions for a fully screened country, three for a tracker-only one, null otherwise. */
export function getPublicScreenPrefill(query: string): PublicScreenPrefill | null {
  const full = getPublicScreen(query);
  if (full) {
    const dims: PublicScreenPrefill["dims"] = {};
    for (const k of SCREEN_DIMENSIONS) dims[k] = { score: full.scores[k], evidence: full.evidence[k] };
    return { iso3: full.iso3, name: full.name, partial: false, dims };
  }
  const part = matchName(current.unavailable ?? [], query);
  if (!part) return null;
  return {
    iso3: part.iso3,
    name: part.name,
    partial: true,
    reason: part.reason,
    dims: {
      legality: { score: part.scores.legality, evidence: part.evidence.legality },
      licence: { score: part.scores.licence, evidence: part.evidence.licence },
      clarity: { score: part.scores.clarity, evidence: part.evidence.clarity },
    },
  };
}

export function publicScreenSources(): PublicScreenSource[] {
  return current.sources ?? [];
}

/** Lookup by ISO3 or by (alias-folded) country name; exact match, then prefix for queries of 4+ characters. */
export function getPublicScreen(query: string): PublicScreenCountry | null {
  return matchName(current.countries, query);
}

// ---- runtime Market -----------------------------------------------------

export const SCREEN_ID_PREFIX = "screen_";

export function publicScreenMarketId(c: Pick<PublicScreenCountry, "iso3">): string {
  return `${SCREEN_ID_PREFIX}${c.iso3.toLowerCase()}`;
}

export interface OpportunityFill {
  score: number;
  evidence: string;
  /** false when no indicator data existed and a neutral placeholder was used instead */
  fromData: boolean;
  indicators: CountryIndicators | null;
  suggestion: OpportunitySuggestion | null;
}

/**
 * Market opportunity is not in the file: it is filled at runtime from the
 * World Bank provider + suggestMarketOpportunity() so it stays live. When
 * neither the live API nor the static snapshot knows the country there is
 * no data to band, so a neutral 3 is used and SAID to be a placeholder --
 * never presented as evidence.
 */
export function opportunityFill(indicators: CountryIndicators | null, suggestion: OpportunitySuggestion | null, name: string): OpportunityFill {
  if (indicators && suggestion) {
    return {
      score: suggestion.score,
      evidence: `${indicators.source}${indicators.year ? ` (${indicators.year})` : ""}: market opportunity ${suggestion.formula}.`,
      fromData: true,
      indicators,
      suggestion,
    };
  }
  return {
    score: 3,
    evidence: `No World Bank indicator data found for ${name}; market opportunity set to a neutral 3 as a placeholder, not evidence — edit it in "Score a new market".`,
    fromData: false,
    indicators,
    suggestion,
  };
}

export interface ScreenMarketInputs {
  /** screening score at BASE weights, computed by the engine from the five scores */
  baseScore: number;
  clearThreshold: number;
  opportunity: OpportunityFill;
  currency?: string;
}

/** The five scores a public-screen market carries (opportunity from the runtime fill). */
export function publicScreenScores(c: PublicScreenCountry, opportunityScore: number): Record<DimensionKey, number> {
  return {
    market_opportunity: opportunityScore,
    legality: c.scores.legality,
    licence: c.scores.licence,
    fx_custody: c.scores.fx_custody,
    clarity: c.scores.clarity,
  };
}

/**
 * Builds the runtime Market for a screened country. No deep_dive, no
 * entry_facts and no sequence block, so the engine ranks it but never
 * sequences it; screen_source marks it everywhere it appears.
 */
export function publicScreenMarket(c: PublicScreenCountry, inputs: ScreenMarketInputs): Market {
  // The tracker's own words for the failing dimension, minus the source prefix, so each country's reason is specific.
  const ev = c.scores.legality <= 2 ? c.evidence.legality : c.evidence.licence;
  const blocker = regulatoryBlocker(c.scores, ev ? `Public tracker: ${ev.replace(/^[^:]*\):\s*/, "")}` : undefined);
  const cleared = inputs.baseScore >= inputs.clearThreshold && !blocker;
  return {
    id: publicScreenMarketId(c),
    name: c.name,
    cleared,
    scores: publicScreenScores(c, inputs.opportunity.score),
    evidence_confidence: "limited",
    screening_score_deck: inputs.baseScore,
    market_signal: PUBLIC_SCREEN_SIGNAL,
    user_added: false,
    screen_source: "public_data",
    iso3: c.iso3,
    screen_evidence: { ...c.evidence, market_opportunity: inputs.opportunity.evidence },
    currency: inputs.currency,
    screened_out_reason: cleared
      ? undefined
      : blocker ??
        `Public-data screen score ${inputs.baseScore.toFixed(1)}/5 at base weights is below the ${inputs.clearThreshold.toFixed(1)} clear threshold.`,
  };
}
