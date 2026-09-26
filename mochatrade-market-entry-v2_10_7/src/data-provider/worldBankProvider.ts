/**
 * World Bank development indicators for a country (by ISO3): population,
 * GDP per capita, internet users. Live source is the World Bank Indicators
 * API v2 (no key, CORS-friendly); on failure a static snapshot answers,
 * tagged status: "fallback". Feeds the market-opportunity suggestion in
 * "Score a new market" -- see marketOpportunity.ts.
 */

export type IndicatorStatus = "live" | "fallback";

export interface CountryIndicators {
  iso3: string;
  population: number | null;
  gdpPerCapitaUsd: number | null;
  internetUsersPct: number | null; // % of population
  year: number | null; // latest year among the values
  status: IndicatorStatus;
  source: string;
}

export const WORLD_BANK_ENDPOINT = "https://api.worldbank.org/v2/country/";
export const INDICATORS = {
  population: "SP.POP.TOTL",
  gdpPerCapitaUsd: "NY.GDP.PCAP.CD",
  internetUsersPct: "IT.NET.USER.ZS",
} as const;
const LIVE_SOURCE = "World Bank Indicators API v2 (live)";
const SNAPSHOT_CAPTURED = "2026-09-24";
const SNAPSHOT_SOURCE = `Static World Bank snapshot (approx. 2023 values, captured ${SNAPSHOT_CAPTURED}) — not live`;

type Snapshot = Omit<CountryIndicators, "status" | "source">;

/** Approximate 2023 values; the live call replaces them whenever it succeeds. */
export const STATIC_INDICATOR_SNAPSHOT: Record<string, Snapshot> = {
  BRA: { iso3: "BRA", population: 216_400_000, gdpPerCapitaUsd: 10_044, internetUsersPct: 84, year: 2023 },
  ARE: { iso3: "ARE", population: 9_500_000, gdpPerCapitaUsd: 52_400, internetUsersPct: 100, year: 2023 },
  IDN: { iso3: "IDN", population: 277_500_000, gdpPerCapitaUsd: 4_940, internetUsersPct: 69, year: 2023 },
  PHL: { iso3: "PHL", population: 117_300_000, gdpPerCapitaUsd: 3_730, internetUsersPct: 75, year: 2023 },
  NGA: { iso3: "NGA", population: 223_800_000, gdpPerCapitaUsd: 1_597, internetUsersPct: 40, year: 2023 },
  PAK: { iso3: "PAK", population: 240_500_000, gdpPerCapitaUsd: 1_410, internetUsersPct: 30, year: 2023 },
  THA: { iso3: "THA", population: 71_700_000, gdpPerCapitaUsd: 7_170, internetUsersPct: 89, year: 2023 },
  ZAF: { iso3: "ZAF", population: 60_400_000, gdpPerCapitaUsd: 6_250, internetUsersPct: 75, year: 2023 },
  VNM: { iso3: "VNM", population: 98_900_000, gdpPerCapitaUsd: 4_347, internetUsersPct: 78, year: 2023 },
  KEN: { iso3: "KEN", population: 55_100_000, gdpPerCapitaUsd: 1_950, internetUsersPct: 40, year: 2023 },
  MEX: { iso3: "MEX", population: 128_500_000, gdpPerCapitaUsd: 13_900, internetUsersPct: 81, year: 2023 },
  TUR: { iso3: "TUR", population: 85_300_000, gdpPerCapitaUsd: 13_100, internetUsersPct: 86, year: 2023 },
  SGP: { iso3: "SGP", population: 5_900_000, gdpPerCapitaUsd: 84_700, internetUsersPct: 96, year: 2023 },
  ARG: { iso3: "ARG", population: 46_600_000, gdpPerCapitaUsd: 13_700, internetUsersPct: 89, year: 2023 },
  IND: { iso3: "IND", population: 1_428_000_000, gdpPerCapitaUsd: 2_480, internetUsersPct: 52, year: 2023 },
};

export function getStaticIndicators(iso3: string): CountryIndicators | null {
  const hit = STATIC_INDICATOR_SNAPSHOT[iso3.toUpperCase()];
  return hit ? { ...hit, status: "fallback", source: SNAPSHOT_SOURCE } : null;
}

export interface FetchIndicatorsOptions {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  signal?: AbortSignal;
}

interface WbRow {
  indicator?: { id?: string };
  date?: string;
  value?: number | null;
}

/**
 * One request for all three indicators (semicolon-joined ids with source=2),
 * most-recent-non-empty value per indicator. Response shape is
 * [meta, rows[]]; rows carry indicator.id, date and value.
 */
export async function fetchLiveIndicators(iso3: string, opts: FetchIndicatorsOptions = {}): Promise<CountryIndicators> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const ids = Object.values(INDICATORS).join(";");
  const url = `${opts.endpoint ?? WORLD_BANK_ENDPOINT}${encodeURIComponent(iso3)}/indicator/${ids}?source=2&format=json&mrnev=1&per_page=20`;
  const res = await fetchImpl(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`World Bank API returned HTTP ${res.status}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error("World Bank API returned malformed JSON");
  }
  if (!Array.isArray(body) || !Array.isArray(body[1])) throw new Error("World Bank API response is not [meta, rows]");
  const rows = body[1] as WbRow[];
  const out: CountryIndicators = { iso3: iso3.toUpperCase(), population: null, gdpPerCapitaUsd: null, internetUsersPct: null, year: null, status: "live", source: LIVE_SOURCE };
  const byId: Record<string, keyof typeof INDICATORS> = Object.fromEntries(Object.entries(INDICATORS).map(([k, v]) => [v, k as keyof typeof INDICATORS]));
  for (const row of rows) {
    const key = row.indicator?.id ? byId[row.indicator.id] : undefined;
    if (!key || typeof row.value !== "number" || !Number.isFinite(row.value)) continue;
    if (out[key] !== null) continue; // rows are newest-first; keep the first non-null
    out[key] = row.value;
    const y = Number(row.date);
    if (Number.isFinite(y)) out.year = out.year === null ? y : Math.max(out.year, y);
  }
  if (out.population === null && out.gdpPerCapitaUsd === null && out.internetUsersPct === null) {
    throw new Error("World Bank API returned no usable values");
  }
  return out;
}

export interface GetIndicatorsOptions {
  timeoutMs?: number;
  liveOptions?: Omit<FetchIndicatorsOptions, "signal">;
}

export async function getIndicators(iso3: string, opts: GetIndicatorsOptions = {}): Promise<CountryIndicators | null> {
  if (!iso3) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    return await fetchLiveIndicators(iso3, { ...opts.liveOptions, signal: controller.signal });
  } catch {
    return getStaticIndicators(iso3);
  } finally {
    clearTimeout(timer);
  }
}
