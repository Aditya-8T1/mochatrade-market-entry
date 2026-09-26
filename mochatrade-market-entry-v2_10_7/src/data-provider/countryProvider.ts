/**
 * Country facts for "Score a new market": currency, official languages,
 * population. Live source is REST Countries v5 (needs an API key in
 * VITE_RESTCOUNTRIES_KEY, and the key must allow the page's hostname for
 * browser CORS); on any failure -- including a missing key -- the static
 * snapshot below answers instead, tagged status: "fallback". A country in
 * neither returns null -- the form still works, it just cannot pre-fill.
 *
 * v1-v4 of REST Countries were retired in 2026; /v3.1 now 301s to a
 * deprecation notice with no CORS header, so it can never succeed in a browser.
 */

export type CountryStatus = "live" | "fallback";

export interface CountryFacts {
  name: string; // common English name as the source spells it
  iso2: string;
  iso3: string;
  currency: string | null; // ISO 4217, e.g. "KES"
  languages: string[]; // English names, e.g. ["English", "Swahili"]
  population: number | null;
  region: string | null;
  status: CountryStatus;
  source: string;
}

export const REST_COUNTRIES_ENDPOINT = "https://api.restcountries.com/countries/v5";
const LIVE_SOURCE = "REST Countries v5 (live)";
const RESPONSE_FIELDS = [
  "names.common",
  "names.official",
  "names.alternates",
  "codes.alpha_2",
  "codes.alpha_3",
  "currencies",
  "languages",
  "population",
  "region",
].join(",");
const SNAPSHOT_CAPTURED = "2026-09-24";
const SNAPSHOT_SOURCE = `Static country snapshot (captured ${SNAPSHOT_CAPTURED}) — not live`;

type Snapshot = Omit<CountryFacts, "status" | "source">;

/** Approximate figures for the nine screened markets plus likely candidates. */
export const STATIC_COUNTRY_SNAPSHOT: Snapshot[] = [
  { name: "Brazil", iso2: "BR", iso3: "BRA", currency: "BRL", languages: ["Portuguese"], population: 216_000_000, region: "Americas" },
  { name: "United Arab Emirates", iso2: "AE", iso3: "ARE", currency: "AED", languages: ["Arabic"], population: 9_500_000, region: "Asia" },
  { name: "Indonesia", iso2: "ID", iso3: "IDN", currency: "IDR", languages: ["Indonesian"], population: 277_000_000, region: "Asia" },
  { name: "Philippines", iso2: "PH", iso3: "PHL", currency: "PHP", languages: ["English", "Filipino"], population: 117_000_000, region: "Asia" },
  { name: "Nigeria", iso2: "NG", iso3: "NGA", currency: "NGN", languages: ["English"], population: 224_000_000, region: "Africa" },
  { name: "Pakistan", iso2: "PK", iso3: "PAK", currency: "PKR", languages: ["English", "Urdu"], population: 240_000_000, region: "Asia" },
  { name: "Thailand", iso2: "TH", iso3: "THA", currency: "THB", languages: ["Thai"], population: 71_700_000, region: "Asia" },
  { name: "South Africa", iso2: "ZA", iso3: "ZAF", currency: "ZAR", languages: ["English", "Afrikaans", "Zulu", "Xhosa"], population: 60_400_000, region: "Africa" },
  { name: "Vietnam", iso2: "VN", iso3: "VNM", currency: "VND", languages: ["Vietnamese"], population: 98_900_000, region: "Asia" },
  { name: "Kenya", iso2: "KE", iso3: "KEN", currency: "KES", languages: ["English", "Swahili"], population: 55_100_000, region: "Africa" },
  { name: "Mexico", iso2: "MX", iso3: "MEX", currency: "MXN", languages: ["Spanish"], population: 128_500_000, region: "Americas" },
  { name: "Turkey", iso2: "TR", iso3: "TUR", currency: "TRY", languages: ["Turkish"], population: 85_300_000, region: "Asia" },
  { name: "Singapore", iso2: "SG", iso3: "SGP", currency: "SGD", languages: ["English", "Malay", "Chinese", "Tamil"], population: 5_900_000, region: "Asia" },
  { name: "Argentina", iso2: "AR", iso3: "ARG", currency: "ARS", languages: ["Spanish"], population: 46_600_000, region: "Americas" },
  { name: "India", iso2: "IN", iso3: "IND", currency: "INR", languages: ["English", "Hindi"], population: 1_428_000_000, region: "Asia" },
];

const ALIASES: Record<string, string> = {
  uae: "United Arab Emirates",
  dubai: "United Arab Emirates",
  "dubai (uae)": "United Arab Emirates",
  turkiye: "Turkey",
  türkiye: "Turkey",
};

const norm = (s: string) => s.trim().toLowerCase();

export function getStaticCountry(name: string): CountryFacts | null {
  const q = ALIASES[norm(name)] ? norm(ALIASES[norm(name)]) : norm(name);
  const hit = STATIC_COUNTRY_SNAPSHOT.find((c) => norm(c.name) === q) ?? STATIC_COUNTRY_SNAPSHOT.find((c) => norm(c.name).startsWith(q) && q.length >= 4);
  return hit ? { ...hit, status: "fallback", source: SNAPSHOT_SOURCE } : null;
}

export interface FetchCountryOptions {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  signal?: AbortSignal;
  /** Defaults to import.meta.env.VITE_RESTCOUNTRIES_KEY. */
  apiKey?: string;
}

/** v5 record, trimmed to the fields requested via response_fields. */
interface RestCountryV5 {
  names?: { common?: string; official?: string; alternates?: string[] };
  codes?: { alpha_2?: string; alpha_3?: string };
  currencies?: { code?: string; name?: string; symbol?: string }[];
  languages?: { name?: string }[];
  population?: number;
  region?: string;
}

interface RestCountriesV5Body {
  data?: { objects?: unknown; _demo?: unknown };
}

/**
 * Name matches only. v5's q= searches every property (capitals, demonyms,
 * currency names...), so "first result" is not a safe fallback: typing
 * "Indonesian" must not resolve to whatever else mentions it.
 */
function pickBest(list: RestCountryV5[], query: string): RestCountryV5 | null {
  const q = norm(query);
  const common = (c: RestCountryV5) => norm(c.names?.common ?? "");
  const official = (c: RestCountryV5) => norm(c.names?.official ?? "");
  const alternates = (c: RestCountryV5) => (c.names?.alternates ?? []).map(norm);
  return (
    list.find((c) => common(c) === q) ??
    list.find((c) => official(c) === q) ??
    list.find((c) => alternates(c).includes(q)) ??
    list.find((c) => common(c).startsWith(q)) ??
    list.find((c) => common(c).includes(q) || official(c).includes(q)) ??
    null
  );
}

export async function fetchLiveCountry(name: string, opts: FetchCountryOptions = {}): Promise<CountryFacts | null> {
  const q = ALIASES[norm(name)] ?? name.trim();
  if (q.length < 2) return null;
  const apiKey = opts.apiKey ?? import.meta.env.VITE_RESTCOUNTRIES_KEY;
  if (!apiKey) throw new Error("VITE_RESTCOUNTRIES_KEY is not set");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${opts.endpoint ?? REST_COUNTRIES_ENDPOINT}?q=${encodeURIComponent(q)}&limit=25&response_fields=${RESPONSE_FIELDS}`;
  const res = await fetchImpl(url, { signal: opts.signal, headers: { Authorization: `Bearer ${apiKey}` } });
  // v5: 404 means a bad path, not "no such country" (that is an empty list).
  if (!res.ok) throw new Error(`REST Countries returned HTTP ${res.status}`);
  let body: RestCountriesV5Body;
  try {
    body = (await res.json()) as RestCountriesV5Body;
  } catch {
    throw new Error("REST Countries returned malformed JSON");
  }
  // The demo key answers every query with the same Canada sample.
  if (body?.data?._demo) throw new Error("REST Countries demo key in use -- not real data");
  const list = body?.data?.objects;
  if (!Array.isArray(list)) throw new Error("REST Countries response has no data.objects list");
  if (list.length === 0) return null; // no such country -- a definitive answer, not a failure
  const best = pickBest(list as RestCountryV5[], q);
  if (!best) return null;
  if (typeof best.codes?.alpha_3 !== "string" || !best.names?.common) throw new Error("REST Countries response is missing required fields");
  return {
    name: best.names.common,
    iso2: best.codes.alpha_2 ?? "",
    iso3: best.codes.alpha_3,
    currency: best.currencies?.[0]?.code ?? null,
    languages: (best.languages ?? []).map((l) => l.name).filter((n): n is string => typeof n === "string" && n.length > 0),
    population: typeof best.population === "number" ? best.population : null,
    region: best.region ?? null,
    status: "live",
    source: LIVE_SOURCE,
  };
}

export interface GetCountryOptions {
  timeoutMs?: number;
  liveOptions?: Omit<FetchCountryOptions, "signal">;
}

/**
 * Live first; on any live failure, the static snapshot. A live "no match"
 * (empty list) still consults the snapshot so an alias like "UAE" resolves.
 */
export async function getCountry(name: string, opts: GetCountryOptions = {}): Promise<CountryFacts | null> {
  if (name.trim().length < 2) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const live = await fetchLiveCountry(name, { ...opts.liveOptions, signal: controller.signal });
    return live ?? getStaticCountry(name);
  } catch {
    return getStaticCountry(name);
  } finally {
    clearTimeout(timer);
  }
}
