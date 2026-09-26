import { describe, it, expect } from "vitest";
import {
  clarityBand,
  fxCustodyBand,
  legalityBand,
  licenceBand,
  screenEvidence,
  LEGALITY_MAX,
  LICENCE_MAX,
  CLARITY_MAX,
  type TrackerFlags,
  type TrackerLegalStatus,
} from "../publicScreenBands";
import markets from "../../../data/markets.json";

const flags = (n: number): TrackerFlags => ({ tax: n >= 1, aml: n >= 2, consumer: n >= 3, licensing: n >= 4 });
const withLicensing = (licensing: boolean): TrackerFlags => ({ tax: false, aml: false, consumer: false, licensing });
const STATUSES: TrackerLegalStatus[] = ["legal", "partial_ban", "general_ban"];

describe("public-screen band mapping: legality", () => {
  it("General ban -> 1, Partial ban -> 2, Legal without licensing -> 3, Legal with licensing -> 4", () => {
    expect(legalityBand("general_ban", withLicensing(false))).toBe(1);
    expect(legalityBand("general_ban", withLicensing(true))).toBe(1); // a ban is a ban, licensing flag irrelevant
    expect(legalityBand("partial_ban", withLicensing(false))).toBe(2);
    expect(legalityBand("partial_ban", withLicensing(true))).toBe(2);
    expect(legalityBand("legal", withLicensing(false))).toBe(3);
    expect(legalityBand("legal", withLicensing(true))).toBe(4);
  });
  it("is never 5 (5 = retail crypto derivatives explicitly permitted, which the tracker cannot tell)", () => {
    expect(LEGALITY_MAX).toBe(4);
    for (const s of STATUSES) for (const l of [true, false]) expect(legalityBand(s, withLicensing(l))).toBeLessThanOrEqual(4);
  });
});

describe("public-screen band mapping: licence", () => {
  it("Legal + licensing -> 3, Legal no licensing -> 2, any ban -> 1", () => {
    expect(licenceBand("legal", withLicensing(true))).toBe(3);
    expect(licenceBand("legal", withLicensing(false))).toBe(2);
    expect(licenceBand("partial_ban", withLicensing(true))).toBe(1);
    expect(licenceBand("partial_ban", withLicensing(false))).toBe(1);
    expect(licenceBand("general_ban", withLicensing(true))).toBe(1);
    expect(licenceBand("general_ban", withLicensing(false))).toBe(1);
  });
  it("is never above 3 (licence burden is unknown)", () => {
    expect(LICENCE_MAX).toBe(3);
    for (const s of STATUSES) for (const l of [true, false]) expect(licenceBand(s, withLicensing(l))).toBeLessThanOrEqual(3);
  });
});

describe("public-screen band mapping: clarity", () => {
  it("counts the four rule flags: 0 -> 1, 1 -> 2, 2 -> 3, 3 -> 4, 4 -> 4", () => {
    expect(clarityBand(flags(0))).toBe(1);
    expect(clarityBand(flags(1))).toBe(2);
    expect(clarityBand(flags(2))).toBe(3);
    expect(clarityBand(flags(3))).toBe(4);
    expect(clarityBand(flags(4))).toBe(4);
  });
  it("counts any two flags the same regardless of which two", () => {
    expect(clarityBand({ tax: false, aml: true, consumer: false, licensing: true })).toBe(3);
    expect(clarityBand({ tax: true, aml: false, consumer: true, licensing: false })).toBe(3);
  });
  it("is never 5", () => {
    expect(CLARITY_MAX).toBe(4);
    for (let n = 0; n <= 4; n++) expect(clarityBand(flags(n))).toBeLessThanOrEqual(4);
  });
});

describe("public-screen band mapping: fx_custody from Chinn-Ito ka_open (stepped index)", () => {
  it("maps every observed 2023 level: 0.00 -> 1; 0.16 / 0.22 / 0.30 -> 2; 0.42 -> 2; 0.446-0.69 -> 3; 0.70-0.89 -> 4; 1.00 -> 5", () => {
    expect(fxCustodyBand(0)).toBe(1);
    expect(fxCustodyBand(0.0597)).toBe(1);
    expect(fxCustodyBand(0.1624)).toBe(2);
    expect(fxCustodyBand(0.2221)).toBe(2);
    expect(fxCustodyBand(0.2983)).toBe(2);
    expect(fxCustodyBand(0.4011)).toBe(2);
    expect(fxCustodyBand(0.4181)).toBe(2);
    expect(fxCustodyBand(0.446)).toBe(3);
    expect(fxCustodyBand(0.5393)).toBe(3);
    expect(fxCustodyBand(0.6586)).toBe(3);
    expect(fxCustodyBand(0.7017)).toBe(4);
    expect(fxCustodyBand(0.7443)).toBe(4);
    expect(fxCustodyBand(0.8376)).toBe(4);
    expect(fxCustodyBand(0.9)).toBe(5);
    expect(fxCustodyBand(1)).toBe(5);
  });
  it("is monotone and never skips outside 1-5", () => {
    let prev = 0;
    for (let v = 0; v <= 1.0001; v += 0.01) {
      const b = fxCustodyBand(Math.min(1, v)) as number;
      expect(b).toBeGreaterThanOrEqual(Math.max(1, prev));
      expect(b).toBeLessThanOrEqual(5);
      prev = b;
    }
  });
  it("is null when Chinn-Ito is missing or not numeric -- the country is not screened, never guessed", () => {
    expect(fxCustodyBand(null)).toBeNull();
    expect(fxCustodyBand(undefined)).toBeNull();
    expect(fxCustodyBand(Number.NaN)).toBeNull();
  });

  /**
   * Calibration against Round 1, same pattern as the market-opportunity
   * calibration test. ka_open values are the 2023 entries of the Chinn-Ito
   * file (kaopen_2023.xls, updated 18 Jan 2026) for the nine markets; deck
   * fx_custody scores come from data/markets.json.
   */
  const ROUND1_KA_OPEN: Record<string, number> = {
    brazil: 0.1624, uae: 1.0, indonesia: 0.4181, philippines: 0.446, nigeria: 0.2983, pakistan: 0.1624, thailand: 0.4181, south_africa: 0.1624, vietnam: 0.4181,
  };
  it("lands every one of the nine Round 1 markets within one point of its deck fx_custody score, with total |error| 4", () => {
    let total = 0;
    for (const m of markets.markets) {
      const band = fxCustodyBand(ROUND1_KA_OPEN[m.id]) as number;
      const err = Math.abs(band - m.scores.fx_custody);
      expect(err, `${m.name}: band ${band} vs deck ${m.scores.fx_custody}`).toBeLessThanOrEqual(1);
      total += err;
    }
    expect(total).toBe(4);
    expect(Object.keys(ROUND1_KA_OPEN).sort()).toEqual(markets.markets.map((m) => m.id).sort());
  });
  it("the 0.42 level maps to 2, not 3: 2 gives |error| 1 across Indonesia/Thailand/Vietnam, 3 would give 4", () => {
    const at042 = markets.markets.filter((m) => ROUND1_KA_OPEN[m.id] === 0.4181);
    expect(at042.map((m) => m.id).sort()).toEqual(["indonesia", "thailand", "vietnam"]);
    const err = (band: number) => at042.reduce((s, m) => s + Math.abs(band - m.scores.fx_custody), 0);
    expect(err(2)).toBe(1);
    expect(err(3)).toBe(4);
    expect(fxCustodyBand(0.4181)).toBe(2);
  });
});

describe("public-screen evidence lines", () => {
  it("name the dataset, the raw value and the year/edition for every banded dimension", () => {
    const e = screenEvidence("Kenya", "legal", flags(3), 0.49, 2021, "2025 export");
    expect(e.legality).toContain("Atlantic Council");
    expect(e.legality).toContain("2025 export");
    expect(e.legality).toContain('"Legal"');
    expect(e.licence).toContain("capped at 3");
    expect(e.clarity).toContain("3 of 4");
    expect(e.clarity).toContain("tax, aml, consumer");
    expect(e.fx_custody).toContain("Chinn-Ito");
    expect(e.fx_custody).toContain("0.49");
    expect(e.fx_custody).toContain("2021");
  });
});
