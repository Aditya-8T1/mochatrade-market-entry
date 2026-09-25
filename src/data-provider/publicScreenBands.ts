/**
 * Public-data SCREEN: coarse 1-5 bands for four of the five rubric
 * dimensions, mapped from two public datasets. This is deliberately blunt.
 * The Atlantic Council tracker records whether a jurisdiction has crypto
 * legality / tax / AML / consumer / licensing rules at all -- it says
 * nothing about crypto DERIVATIVES, retail leverage or licence burden, so
 * the bands are capped well below what a researched market can score:
 *
 *   legality  never 5   (5 = "retail crypto derivatives explicitly permitted", unknowable here)
 *   licence   never > 3 (licence BURDEN is unknown)
 *   clarity   never 5
 *   fx_custody 1-5 from Chinn-Ito ka_open (the one dimension the data answers directly)
 *   market_opportunity: not banded here -- filled at runtime by the World Bank
 *                       provider + suggestMarketOpportunity() so it stays live.
 *
 * Pure functions, no I/O: shared by scripts/build-public-screen.ts (build
 * time) and by tests.
 */

export type TrackerLegalStatus = "legal" | "partial_ban" | "general_ban";

export interface TrackerFlags {
  tax: boolean;
  aml: boolean;
  consumer: boolean;
  licensing: boolean;
}

export const FLAG_KEYS: ReadonlyArray<keyof TrackerFlags> = ["tax", "aml", "consumer", "licensing"];

/** Caps that make the screen a screen. Tested. */
export const LEGALITY_MAX = 4;
export const LICENCE_MAX = 3;
export const CLARITY_MAX = 4;

/** General ban -> 1; Partial ban -> 2; Legal, no licensing rule -> 3; Legal with licensing rule -> 4. Never 5. */
export function legalityBand(status: TrackerLegalStatus, flags: Pick<TrackerFlags, "licensing">): number {
  let band: number;
  if (status === "general_ban") band = 1;
  else if (status === "partial_ban") band = 2;
  else band = flags.licensing ? 4 : 3;
  return Math.min(band, LEGALITY_MAX);
}

/** Legal + licensing rule -> 3; Legal, no licensing rule -> 2; any ban -> 1. Never above 3. */
export function licenceBand(status: TrackerLegalStatus, flags: Pick<TrackerFlags, "licensing">): number {
  let band: number;
  if (status !== "legal") band = 1;
  else band = flags.licensing ? 3 : 2;
  return Math.min(band, LICENCE_MAX);
}

/** Count of the four rule flags present: 0 -> 1, 1 -> 2, 2 -> 3, 3-4 -> 4. Never 5. */
export function clarityBand(flags: TrackerFlags): number {
  const n = FLAG_KEYS.filter((k) => flags[k]).length;
  const band = n === 0 ? 1 : n === 1 ? 2 : n === 2 ? 3 : 4;
  return Math.min(band, CLARITY_MAX);
}

/**
 * Chinn-Ito ka_open is a stepped index (built from a handful of binary
 * AREAER dummies), not a continuum: in the 2023 file the 64 screened
 * countries sit on nine levels and 84% of all countries on just four
 * (0.00, 0.16, 0.42, 0.70, 1.00). So the mapping is an explicit level
 * lookup, calibrated on the nine Round 1 markets (see the calibration test):
 *
 *   level        band   Round 1 markets at this level (deck fx_custody)
 *   0.00          1     --
 *   0.16          2     Brazil 3, Pakistan 2, South Africa 1   -> 2 (min |error|)
 *   0.22 / 0.30   2     Nigeria 2
 *   0.42          2     Indonesia 2, Thailand 2, Vietnam 1     -> 2, not 3
 *   0.45-0.69     3     Philippines (0.446) 3
 *   0.70-0.89     4     --
 *   1.00          5     Dubai 4 (its deck score also reflects self-custody rules, which the index does not measure)
 *
 * The 2023 levels 0.4181 and 0.446 straddle the boundary between bands 2
 * and 3 on purpose. Total absolute error across the nine is 4; the
 * range-based mapping in the original brief scored 6.
 */
export const FX_LEVELS: ReadonlyArray<{ upTo: number; band: number; label: string }> = [
  { upTo: 0.1, band: 1, label: "0.00 (closed)" },
  { upTo: 0.41, band: 2, label: "0.16-0.30" },
  { upTo: 0.43, band: 2, label: "0.42" },
  { upTo: 0.69, band: 3, label: "0.45-0.69" },
  { upTo: 0.899, band: 4, label: "0.70-0.89" },
  { upTo: 1, band: 5, label: "1.00 (fully open)" },
];

export function fxCustodyBand(kaOpen: number | null | undefined): number | null {
  if (kaOpen === null || kaOpen === undefined || !Number.isFinite(kaOpen)) return null;
  const hit = FX_LEVELS.find((l) => kaOpen <= l.upTo) ?? FX_LEVELS[FX_LEVELS.length - 1];
  return hit.band;
}

// ---- data shape of data/public-screen.json ------------------------------

export type ScreenDimension = "legality" | "licence" | "clarity" | "fx_custody";
export const SCREEN_DIMENSIONS: ReadonlyArray<ScreenDimension> = ["legality", "licence", "clarity", "fx_custody"];

export interface PublicScreenSource {
  name: string;
  edition: string;
  url: string;
  retrieved: string;
}

export interface PublicScreenCountry {
  iso3: string;
  name: string;
  scores: {
    legality: number;
    licence: number;
    clarity: number;
    fx_custody: number;
    market_opportunity: null; // filled at runtime, never in the file
  };
  /** One line per banded dimension: dataset, raw value, year/edition. */
  evidence: Record<ScreenDimension, string>;
  raw: {
    legal_status: TrackerLegalStatus;
    flags: TrackerFlags;
    ka_open: number;
    ka_year: number;
  };
}

/** A tracker jurisdiction with no usable Chinn-Ito value: three bands, no fx_custody. Offered in the finder as a prefill, never built as a screen market. */
export interface PublicScreenPartial {
  iso3: string;
  name: string;
  scores: { legality: number; licence: number; clarity: number };
  evidence: Record<"legality" | "licence" | "clarity", string>;
  raw: { legal_status: TrackerLegalStatus; flags: TrackerFlags };
  reason: string;
}

export interface PublicScreenData {
  generated?: string;
  sources?: PublicScreenSource[];
  countries: PublicScreenCountry[];
  /** Tracker-only jurisdictions (no capital-controls data). Optional so older files still load. */
  unavailable?: PublicScreenPartial[];
}

export const PUBLIC_SCREEN_UNAVAILABLE_LABEL = "public-data screen unavailable — no capital-controls data";

export const ATLANTIC_COUNCIL_SOURCE = {
  name: "Atlantic Council Cryptocurrency Regulation Tracker",
  url: "https://www.atlanticcouncil.org/programs/geoeconomics-center/cryptoregulationtracker/",
};
export const CHINN_ITO_SOURCE = {
  name: "Chinn-Ito capital account openness index (KAOPEN)",
  url: "https://web.pdx.edu/~ito/Chinn-Ito_website.htm",
};

export const LEGAL_STATUS_LABEL: Record<TrackerLegalStatus, string> = {
  legal: "Legal",
  partial_ban: "Partial ban",
  general_ban: "General ban",
};

/** Builds the four evidence lines. `edition` is the tracker edition/year as read from the file or given to the script. */
export function screenEvidence(
  name: string,
  status: TrackerLegalStatus,
  flags: TrackerFlags,
  kaOpen: number,
  kaYear: number,
  trackerEdition: string,
): Record<ScreenDimension, string> {
  const present = FLAG_KEYS.filter((k) => flags[k]);
  const flagText = present.length ? present.join(", ") : "none";
  const legal = LEGAL_STATUS_LABEL[status];
  return {
    legality: `${ATLANTIC_COUNCIL_SOURCE.name} (${trackerEdition}): ${name} crypto status "${legal}", licensing rule ${flags.licensing ? "present" : "absent"}.`,
    licence: `${ATLANTIC_COUNCIL_SOURCE.name} (${trackerEdition}): status "${legal}", licensing rule ${flags.licensing ? "present" : "absent"} — licence burden unknown, capped at ${LICENCE_MAX}.`,
    clarity: `${ATLANTIC_COUNCIL_SOURCE.name} (${trackerEdition}): ${present.length} of 4 rule types present (${flagText}).`,
    fx_custody: `${CHINN_ITO_SOURCE.name}: ka_open ${kaOpen.toFixed(2)} (${kaYear}).`,
  };
}
