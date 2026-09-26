/**
 * The public-data screen build pipeline, as pure functions (no Node
 * imports) so it is unit-tested from src/test against the fixtures in
 * src/test/fixtures/public-screen/. The CLI wrapper that reads/writes
 * files is scripts/build-public-screen.ts (`npx tsx scripts/build-public-screen.ts`).
 *
 * Joins the Atlantic Council tracker export with Chinn-Ito KAOPEN on ISO3
 * when both files carry one, otherwise on a normalised country name; logs
 * every unmatched or dropped row (never guesses). Excludes the nine Round 1
 * markets so they keep their researched scores. Band mapping lives in
 * publicScreenBands.ts.
 *
 * No dependencies: the CSV parser below handles quoted fields, doubled
 * quotes, embedded commas and CR/LF/CRLF (RFC 4180), which is all these
 * exports need.
 */
import {
  clarityBand,
  fxCustodyBand,
  legalityBand,
  licenceBand,
  screenEvidence,
  ATLANTIC_COUNCIL_SOURCE,
  CHINN_ITO_SOURCE,
  type PublicScreenCountry,
  type PublicScreenData,
  type PublicScreenPartial,
  type TrackerFlags,
  type TrackerLegalStatus,
} from "./publicScreenBands";
import { getStaticCountry } from "./countryProvider";

// ---- CSV -----------------------------------------------------------------

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CR/LF/CRLF. Returns rows of strings; blank lines dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function toRecords(rows: string[][]): { headers: string[]; records: Record<string, string>[] } {
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, records };
}

// ---- names ---------------------------------------------------------------

const NAME_ALIASES: Record<string, string> = {
  "korea rep": "south korea",
  "korea republic of": "south korea",
  "republic of korea": "south korea",
  "russian federation": "russia",
  "viet nam": "vietnam",
  "united states of america": "united states",
  usa: "united states",
  us: "united states",
  "united kingdom of great britain and northern ireland": "united kingdom",
  uk: "united kingdom",
  turkiye: "turkey",
  czechia: "czech republic",
  "hong kong sar china": "hong kong",
  "hong kong china": "hong kong",
  "hong kong sar": "hong kong",
  "iran islamic rep": "iran",
  "iran islamic republic of": "iran",
  "egypt arab rep": "egypt",
  uae: "united arab emirates",
  "dubai uae": "united arab emirates",
  dubai: "united arab emirates",
  "bahamas the": "bahamas",
  "taiwan china": "taiwan",
  "taiwan province of china": "taiwan",
  "slovak republic": "slovakia",
  "venezuela rb": "venezuela",
  "venezuela bolivarian republic of": "venezuela",
  "bolivia plurinational state of": "bolivia",
  "lao pdr": "laos",
  "kyrgyz republic": "kyrgyzstan",
  "cote divoire": "ivory coast",
  "brunei darussalam": "brunei",
  "syrian arab republic": "syria",
  "macao sar china": "macau",
  "gambia the": "gambia",
  "yemen rep": "yemen",
  "congo dem rep": "democratic republic of the congo",
  "congo rep": "republic of the congo",
  "republic of serbia": "serbia",
  "united republic of tanzania": "tanzania",
};

/** Lower-case, diacritics stripped, punctuation removed, leading "the " dropped, known aliases folded. */
export function normaliseName(raw: string): string {
  let s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (s.startsWith("the ")) s = s.slice(4);
  return NAME_ALIASES[s] ?? s;
}

// ---- column detection ----------------------------------------------------

const find = (headers: string[], re: RegExp, exclude: RegExp[] = []): string | null =>
  headers.find((h) => re.test(h) && !exclude.some((x) => x.test(h))) ?? null;

export interface TrackerColumns {
  country: string;
  iso3: string | null;
  status: string;
  tax: string | null;
  aml: string | null;
  consumer: string | null;
  licensing: string | null;
}

export function detectTrackerColumns(headers: string[]): TrackerColumns {
  const iso = find(headers, /iso.?3|alpha.?3|\biso\b|iso.?code|country.?code/i);
  const country = find(headers, /country|jurisdiction|economy|name/i, [/code/i, /iso/i]);
  const status = find(headers, /legal|status|legality/i, [/tax|aml|cft|consumer|licen/i]);
  if (!country) throw new Error(`tracker: no country/jurisdiction column in [${headers.join(", ")}]`);
  if (!status) throw new Error(`tracker: no legal-status column in [${headers.join(", ")}]`);
  return {
    country,
    iso3: iso,
    status,
    tax: find(headers, /\btax/i),
    aml: find(headers, /aml|cft|money.?laundering/i),
    consumer: find(headers, /consumer/i),
    licensing: find(headers, /licen[cs]/i),
  };
}

export interface ChinnItoColumns {
  name: string;
  iso3: string | null;
  year: string;
  kaOpen: string;
}

/**
 * Header names in the Chinn-Ito file are not stable across editions: the
 * 2023 file has `cn` = numeric IMF code, `ccode` = ISO3, `country_name` =
 * name, whereas older exports use `cn` for the name. So candidates are
 * chosen by header AND confirmed against the values in `sample`.
 */
export function detectChinnItoColumns(headers: string[], sample: Record<string, string>[] = []): ChinnItoColumns {
  const byName = (cands: string[]) => headers.filter((h) => cands.includes(h.toLowerCase()));
  const values = (h: string) => sample.map((r) => (r[h] ?? "").trim()).filter((v) => v !== "");
  const mostly = (h: string, re: RegExp) => {
    const v = values(h);
    return v.length > 0 && v.filter((x) => re.test(x)).length / v.length >= 0.8;
  };
  const looksNumeric = (h: string) => mostly(h, /^-?\d+(\.\d+)?$/);
  const looksIso3 = (h: string) => mostly(h, /^[A-Za-z]{3}$/);

  const nameCands = [...byName(["country_name", "countryname", "country", "cn", "name"]), ...headers.filter((h) => /country|name/i.test(h) && !/code/i.test(h))];
  const name = nameCands.find((h) => (sample.length ? !looksNumeric(h) && !looksIso3(h) : true)) ?? null;

  const isoCands = [...headers.filter((h) => /iso.?3|alpha.?3|\biso\b|iso.?code|ccode|country.?code|^code$/i.test(h)), ...headers];
  const iso3 = isoCands.find((h) => h !== name && (sample.length ? looksIso3(h) : /iso.?3|alpha.?3|\biso\b|iso.?code/i.test(h))) ?? null;

  const year = byName(["year"])[0] ?? find(headers, /year/i);
  const kaOpen = byName(["ka_open"])[0] ?? find(headers, /ka_open/i) ?? byName(["kaopen_norm", "kaopen_normalized"])[0] ?? null;
  if (!name) throw new Error(`chinn-ito: no country-name column in [${headers.join(", ")}]`);
  if (!year) throw new Error(`chinn-ito: no year column in [${headers.join(", ")}]`);
  if (!kaOpen) throw new Error(`chinn-ito: no ka_open (0-1 normalised) column in [${headers.join(", ")}]`);
  return { name, iso3, year, kaOpen };
}

// ---- value parsing -------------------------------------------------------

export function parseLegalStatus(v: string): TrackerLegalStatus | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (/general|absolute|total|complete|illegal|banned\b|prohibit/.test(s) && !/partial|implicit/.test(s)) return "general_ban";
  if (/partial|implicit|restrict/.test(s)) return "partial_ban";
  if (/legal|permitted|allowed|regulated/.test(s)) return "legal";
  return null;
}

export function parseFlag(v: string | undefined | null): boolean {
  if (v === undefined || v === null) return false;
  const s = v.trim().toLowerCase();
  return s === "y" || s === "yes" || s === "true" || s === "1" || s === "x" || s === "✓" || s === "✔" || s === "present" || s.startsWith("yes");
}

const isIso3 = (v: string | undefined) => !!v && /^[A-Za-z]{3}$/.test(v.trim());

// ---- exclusion -----------------------------------------------------------

export interface Exclusion {
  iso3: Set<string>;
  names: Set<string>;
}

/** The nine Round 1 markets: resolved to ISO3 through the country snapshot plus their normalised names. Throws if any market cannot be resolved, so a tenth market added to markets.json without a snapshot entry fails loudly. */
export function round1Exclusion(marketNames: string[]): Exclusion {
  const iso3 = new Set<string>();
  const names = new Set<string>();
  for (const name of marketNames) {
    const hit = getStaticCountry(name);
    if (!hit) throw new Error(`Cannot resolve Round 1 market "${name}" to an ISO3 code (add it to STATIC_COUNTRY_SNAPSHOT)`);
    iso3.add(hit.iso3.toUpperCase());
    names.add(normaliseName(name));
    names.add(normaliseName(hit.name));
  }
  return { iso3, names };
}

// ---- the join ------------------------------------------------------------

export interface BuildOptions {
  trackerCsv: string;
  chinnItoCsv: string;
  excludeMarketNames: string[];
  trackerEdition?: string;
  retrieved?: string; // ISO date
  generated?: string; // ISO date
  log?: (line: string) => void;
}

export interface BuildReport {
  data: PublicScreenData;
  trackerColumns: TrackerColumns;
  chinnItoColumns: ChinnItoColumns;
  trackerRows: number;
  chinnItoCountries: number;
  matched: number;
  excluded: string[]; // Round 1 markets found in the tracker and dropped
  unmatched: string[]; // tracker rows with no Chinn-Ito counterpart (not screened)
  invalid: string[]; // tracker rows with an unreadable legal status
  log: string[];
}

interface ChinnRow {
  name: string;
  iso3: string | null;
  year: number;
  kaOpen: number;
}

export function buildPublicScreen(opts: BuildOptions): BuildReport {
  const log: string[] = [];
  const say = (line: string) => {
    log.push(line);
    opts.log?.(line);
  };
  const today = opts.generated ?? new Date().toISOString().slice(0, 10);

  const tracker = toRecords(parseCsv(opts.trackerCsv));
  const chinn = toRecords(parseCsv(opts.chinnItoCsv));
  const tc = detectTrackerColumns(tracker.headers);
  const cc = detectChinnItoColumns(chinn.headers, chinn.records.slice(0, 200));
  say(`tracker columns: country="${tc.country}" iso3=${tc.iso3 ? `"${tc.iso3}"` : "none"} status="${tc.status}" tax=${tc.tax ?? "none"} aml=${tc.aml ?? "none"} consumer=${tc.consumer ?? "none"} licensing=${tc.licensing ?? "none"}`);
  say(`chinn-ito columns: name="${cc.name}" iso3=${cc.iso3 ? `"${cc.iso3}"` : "none"} year="${cc.year}" ka_open="${cc.kaOpen}"`);

  // Latest year with a usable ka_open per Chinn-Ito country.
  const latest = new Map<string, ChinnRow>();
  let maxYear = 0;
  for (const r of chinn.records) {
    const name = r[cc.name];
    const year = Number(r[cc.year]);
    const ka = r[cc.kaOpen] === "" ? NaN : Number(r[cc.kaOpen]);
    if (!name || !Number.isFinite(year) || !Number.isFinite(ka)) continue;
    const key = normaliseName(name);
    const prev = latest.get(key);
    if (!prev || year > prev.year) latest.set(key, { name, iso3: cc.iso3 && isIso3(r[cc.iso3]) ? r[cc.iso3].toUpperCase() : null, year, kaOpen: ka });
    if (year > maxYear) maxYear = year;
  }
  const chinnByIso3 = new Map<string, ChinnRow>();
  for (const row of latest.values()) if (row.iso3) chinnByIso3.set(row.iso3, row);

  const exclusion = round1Exclusion(opts.excludeMarketNames);
  const trackerEdition = opts.trackerEdition ?? `export retrieved ${opts.retrieved ?? today}`;

  const countries: PublicScreenCountry[] = [];
  const unavailable: PublicScreenPartial[] = [];
  const excluded: string[] = [];
  const unmatched: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const r of tracker.records) {
    const name = r[tc.country];
    if (!name) continue;
    const iso3 = tc.iso3 && isIso3(r[tc.iso3]) ? r[tc.iso3].toUpperCase() : null;
    const key = normaliseName(name);

    if ((iso3 && exclusion.iso3.has(iso3)) || exclusion.names.has(key)) {
      excluded.push(name);
      say(`excluded (Round 1 market keeps its researched scores): ${name}`);
      continue;
    }
    const status = parseLegalStatus(r[tc.status]);
    if (!status) {
      invalid.push(name);
      say(`dropped (unreadable legal status "${r[tc.status]}"): ${name}`);
      continue;
    }
    const flags: TrackerFlags = {
      tax: parseFlag(tc.tax ? r[tc.tax] : null),
      aml: parseFlag(tc.aml ? r[tc.aml] : null),
      consumer: parseFlag(tc.consumer ? r[tc.consumer] : null),
      licensing: parseFlag(tc.licensing ? r[tc.licensing] : null),
    };
    const match = (iso3 ? chinnByIso3.get(iso3) : undefined) ?? latest.get(key);
    if (!match) {
      unmatched.push(name);
      const partialIso3 = iso3 ?? getStaticCountry(name)?.iso3 ?? null;
      const reason = "No usable Chinn-Ito ka_open value (not in the index, or blank in every year)";
      say(`unmatched (${reason.toLowerCase()} -> fx_custody unknown, kept as tracker-only prefill): ${name}${partialIso3 ? ` [${partialIso3}]` : " [no ISO3 -> dropped]"}`);
      if (partialIso3 && !seen.has(partialIso3)) {
        seen.add(partialIso3);
        const ev = screenEvidence(name, status, flags, 0, 0, trackerEdition);
        unavailable.push({
          iso3: partialIso3,
          name,
          scores: { legality: legalityBand(status, flags), licence: licenceBand(status, flags), clarity: clarityBand(flags) },
          evidence: { legality: ev.legality, licence: ev.licence, clarity: ev.clarity },
          raw: { legal_status: status, flags },
          reason,
        });
      }
      continue;
    }
    const outIso3 = iso3 ?? match.iso3 ?? getStaticCountry(name)?.iso3 ?? null;
    if (!outIso3) {
      unmatched.push(name);
      say(`dropped (no ISO3 in either file and none known): ${name}`);
      continue;
    }
    if (seen.has(outIso3)) {
      say(`duplicate tracker row ignored: ${name} [${outIso3}]`);
      continue;
    }
    seen.add(outIso3);

    const fx = fxCustodyBand(match.kaOpen);
    if (fx === null) {
      unmatched.push(name);
      say(`dropped (Chinn-Ito ka_open not numeric): ${name}`);
      continue;
    }
    countries.push({
      iso3: outIso3,
      name,
      scores: {
        legality: legalityBand(status, flags),
        licence: licenceBand(status, flags),
        clarity: clarityBand(flags),
        fx_custody: fx,
        market_opportunity: null,
      },
      evidence: screenEvidence(name, status, flags, match.kaOpen, match.year, trackerEdition),
      raw: { legal_status: status, flags, ka_open: match.kaOpen, ka_year: match.year },
    });
  }
  countries.sort((a, b) => a.name.localeCompare(b.name));
  unavailable.sort((a, b) => a.name.localeCompare(b.name));

  const data: PublicScreenData = {
    generated: today,
    sources: [
      { ...ATLANTIC_COUNCIL_SOURCE, edition: trackerEdition, retrieved: opts.retrieved ?? today },
      { ...CHINN_ITO_SOURCE, edition: maxYear ? `KAOPEN update through ${maxYear}` : "KAOPEN", retrieved: opts.retrieved ?? today },
    ],
    countries,
    unavailable,
  };
  say(`screened ${countries.length} countries; excluded ${excluded.length} Round 1 markets; unmatched ${unmatched.length} (${unavailable.length} kept as tracker-only prefill); invalid status ${invalid.length}`);
  return {
    data,
    trackerColumns: tc,
    chinnItoColumns: cc,
    trackerRows: tracker.records.length,
    chinnItoCountries: latest.size,
    matched: countries.length,
    excluded,
    unmatched,
    invalid,
    log,
  };
}
