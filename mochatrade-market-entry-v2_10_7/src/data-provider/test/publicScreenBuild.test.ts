import { describe, it, expect } from "vitest";
import trackerCsv from "../../test/fixtures/public-screen/atlantic-council-tracker.csv?raw";
import chinnItoCsv from "../../test/fixtures/public-screen/chinn-ito.csv?raw";
import markets from "../../../data/markets.json";
import publicScreenJson from "../../../data/public-screen.json";
import { buildPublicScreen, detectChinnItoColumns, detectTrackerColumns, normaliseName, parseCsv, parseFlag, parseLegalStatus, round1Exclusion, toRecords } from "../publicScreenBuild";
import { normalisePublicScreen } from "../publicScreenProvider";

const ROUND1_NAMES = markets.markets.map((m) => m.name);
const build = (over: Partial<Parameters<typeof buildPublicScreen>[0]> = {}) =>
  buildPublicScreen({ trackerCsv, chinnItoCsv, excludeMarketNames: ROUND1_NAMES, trackerEdition: "fixture", retrieved: "2026-09-25", generated: "2026-09-25", ...over });

describe("CSV parsing", () => {
  it("handles quoted fields with commas, doubled quotes, CRLF and a BOM", () => {
    const rows = parseCsv('\ufeffa,b,c\r\n1,"x, y","say ""hi"""\n\n2,,\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", 'say "hi"'],
      ["2", "", ""],
    ]);
    const { headers, records } = toRecords(rows);
    expect(headers).toEqual(["a", "b", "c"]);
    expect(records[0]).toEqual({ a: "1", b: "x, y", c: 'say "hi"' });
  });
});

describe("column detection and value parsing", () => {
  it("finds the tracker columns from the fixture header", () => {
    const { headers } = toRecords(parseCsv(trackerCsv));
    expect(detectTrackerColumns(headers)).toEqual({
      country: "Country",
      iso3: "ISO3",
      status: "Legal Status",
      tax: "Tax rules",
      aml: "AML/CFT rules",
      consumer: "Consumer protection rules",
      licensing: "Licensing rules",
    });
  });
  it("finds the Chinn-Ito columns (ccode, cn, year, kaopen, ka_open) and prefers ka_open over kaopen", () => {
    const { headers, records } = toRecords(parseCsv(chinnItoCsv));
    expect(detectChinnItoColumns(headers, records)).toEqual({ name: "cn", iso3: null, year: "year", kaOpen: "ka_open" });
  });
  it("copes with the 2023 edition's header, where cn is a numeric code, ccode is ISO3 and country_name is the name", () => {
    const rows = parseCsv("cn,ccode,country_name,year,kaopen,ka_open\n111,USA,United States,2023,2.28,1\n664,KEN,Kenya,2023,0.10,0.49\n");
    const { headers, records } = toRecords(rows);
    expect(detectChinnItoColumns(headers, records)).toEqual({ name: "country_name", iso3: "ccode", year: "year", kaOpen: "ka_open" });
  });
  it("throws a readable error when a required column is missing", () => {
    expect(() => detectTrackerColumns(["Country", "Tax"])).toThrow(/legal-status/);
    expect(() => detectChinnItoColumns(["cn", "year", "kaopen"])).toThrow(/ka_open/);
  });
  it("reads legal status and yes/no flags in the tracker's own words", () => {
    expect(parseLegalStatus("Legal")).toBe("legal");
    expect(parseLegalStatus("Partial ban")).toBe("partial_ban");
    expect(parseLegalStatus("General ban")).toBe("general_ban");
    expect(parseLegalStatus("Illegal")).toBe("general_ban");
    expect(parseLegalStatus("Under consultation")).toBeNull();
    expect(parseLegalStatus("")).toBeNull();
    expect(parseFlag("Yes")).toBe(true);
    expect(parseFlag("y")).toBe(true);
    expect(parseFlag("No")).toBe(false);
    expect(parseFlag("")).toBe(false);
    expect(parseFlag(undefined)).toBe(false);
  });
  it("normalises names across the two datasets' spellings", () => {
    expect(normaliseName("Türkiye")).toBe("turkey");
    expect(normaliseName("Korea, Rep.")).toBe("south korea");
    expect(normaliseName("The Bahamas")).toBe("bahamas");
    expect(normaliseName("Dubai (UAE)")).toBe("united arab emirates");
    expect(normaliseName("Viet Nam")).toBe(normaliseName("Vietnam"));
  });
});

describe("build pipeline against the fixture pair", () => {
  it("produces the expected JSON: five screened countries with banded scores, evidence and raw values", () => {
    const { data } = build();
    expect(data.generated).toBe("2026-09-25");
    expect(data.sources?.map((s) => s.name)).toEqual(["Atlantic Council Cryptocurrency Regulation Tracker", "Chinn-Ito capital account openness index (KAOPEN)"]);
    expect(data.sources?.[1].edition).toBe("KAOPEN update through 2021");
    expect(data.sources?.every((s) => s.url.startsWith("https://"))).toBe(true);
    expect(data.countries.map((c) => c.iso3)).toEqual(["ARG", "KEN", "MEX", "SGP", "TUR"]);

    const kenya = data.countries.find((c) => c.iso3 === "KEN")!;
    // Legal + licensing -> legality 4, licence 3; 3 of 4 flags -> clarity 4; latest year 2021 ka_open 0.49 -> fx 3
    expect(kenya.scores).toEqual({ legality: 4, licence: 3, clarity: 4, fx_custody: 3, market_opportunity: null });
    expect(kenya.raw).toEqual({ legal_status: "legal", flags: { tax: true, aml: true, consumer: false, licensing: true }, ka_open: 0.49, ka_year: 2021 });
    expect(kenya.evidence.fx_custody).toContain("0.49 (2021)");
    expect(kenya.evidence.legality).toContain("fixture");

    const mexico = data.countries.find((c) => c.iso3 === "MEX")!;
    expect(mexico.scores).toEqual({ legality: 4, licence: 3, clarity: 4, fx_custody: 4, market_opportunity: null });
    const argentina = data.countries.find((c) => c.iso3 === "ARG")!;
    expect(argentina.scores).toEqual({ legality: 3, licence: 2, clarity: 2, fx_custody: 2, market_opportunity: null });
    const turkey = data.countries.find((c) => c.iso3 === "TUR")!;
    expect(turkey.name).toBe("Türkiye"); // tracker spelling kept; matched to Chinn-Ito "Turkey" by normalised name
    expect(turkey.scores).toEqual({ legality: 2, licence: 1, clarity: 2, fx_custody: 3, market_opportunity: null });
    const singapore = data.countries.find((c) => c.iso3 === "SGP")!;
    expect(singapore.scores.fx_custody).toBe(5);
    // the caps hold on every screened country
    for (const c of data.countries) {
      expect(c.scores.legality).toBeLessThanOrEqual(4);
      expect(c.scores.licence).toBeLessThanOrEqual(3);
      expect(c.scores.clarity).toBeLessThanOrEqual(4);
      expect(c.scores.market_opportunity).toBeNull();
    }
    // the output passes the provider's own validation unchanged
    expect(normalisePublicScreen(data).countries).toHaveLength(5);
  });

  it("excludes the nine Round 1 markets, by ISO3 and by alias name, and says so in the log", () => {
    const r = build();
    expect(r.excluded).toEqual(["Brazil", "Dubai (UAE)"]);
    expect(r.data.countries.some((c) => c.iso3 === "BRA" || c.iso3 === "ARE")).toBe(false);
    expect(r.log.some((l) => /excluded.*Brazil/.test(l))).toBe(true);
    expect(r.log.some((l) => /excluded.*Dubai/.test(l))).toBe(true);
    const ex = round1Exclusion(ROUND1_NAMES);
    expect([...ex.iso3].sort()).toEqual(["ARE", "BRA", "IDN", "NGA", "PAK", "PHL", "THA", "VNM", "ZAF"]);
  });

  it("refuses to run if a Round 1 market cannot be resolved to an ISO3 (no silent leak of a researched market)", () => {
    expect(() => build({ excludeMarketNames: [...ROUND1_NAMES, "Narnia"] })).toThrow(/Narnia/);
  });

  it("a tracker row with no Chinn-Ito counterpart is not screened (fx_custody unknown, not guessed) but is kept as a tracker-only prefill", () => {
    const r = build();
    expect(r.unmatched).toContain("Atlantis");
    expect(r.unmatched).toContain("Taiwan");
    expect(r.data.countries.some((c) => c.name === "Atlantis" || c.name === "Taiwan")).toBe(false);
    expect(r.log.some((l) => /unmatched.*Atlantis \[ATL\]/.test(l))).toBe(true);
    expect(r.data.unavailable?.map((u) => u.iso3)).toEqual(["ATL", "TWN"]);
    const tw = r.data.unavailable!.find((u) => u.iso3 === "TWN")!;
    expect(tw.scores).toEqual({ legality: 4, licence: 3, clarity: 4 }); // Legal + licensing; 3 of 4 flags
    expect(tw.evidence.legality).toContain("Atlantic Council");
    expect(tw.raw.flags.consumer).toBe(false);
    expect(tw.reason).toMatch(/Chinn-Ito/);
    expect("fx_custody" in tw.scores).toBe(false);
    // Bolivia has no ISO3 anywhere, so it cannot even be a prefill
    expect(r.data.unavailable!.some((u) => u.name === "Bolivia")).toBe(false);
    expect(normalisePublicScreen(r.data).unavailable).toHaveLength(2);
    const messages: string[] = [];
    build({ log: (l) => messages.push(l) });
    expect(messages).toEqual(r.log);
  });

  it("drops a row whose Chinn-Ito value is blank for every year, and a row with no ISO3 anywhere", () => {
    const blank = chinnItoCsv.replace("273,Mexico,2021,1.13,0.70", "273,Mexico,2021,1.13,").replace("273,Mexico,2020,1.13,0.70", "273,Mexico,2020,1.13,");
    const r = build({ chinnItoCsv: blank });
    expect(r.unmatched).toContain("Mexico");
    expect(r.data.countries.some((c) => c.iso3 === "MEX")).toBe(false);
    expect(r.unmatched).toContain("Bolivia"); // in both files but neither carries an ISO3 and the snapshot does not know it
  });

  it("drops and logs a row whose legal status cannot be read", () => {
    const r = build();
    expect(r.invalid).toEqual(["Chile"]);
    expect(r.log.some((l) => /unreadable legal status "Under consultation".*Chile/.test(l))).toBe(true);
  });

  it("a country never appears in both lists: the full screen wins over a stale unavailable entry", () => {
    const { data } = build();
    const dup = { ...data, unavailable: [...(data.unavailable ?? []), { iso3: "KEN", name: "Kenya", scores: { legality: 1, licence: 1, clarity: 1 }, evidence: { legality: "x", licence: "x", clarity: "x" }, raw: { legal_status: "general_ban" as const, flags: { tax: false, aml: false, consumer: false, licensing: false } }, reason: "stale" }] };
    const n = normalisePublicScreen(dup);
    expect(n.countries.some((c) => c.iso3 === "KEN")).toBe(true);
    expect(n.unavailable!.some((u) => u.iso3 === "KEN")).toBe(false);
  });

  it("uses the latest year per Chinn-Ito country", () => {
    const r = build();
    expect(r.data.countries.find((c) => c.iso3 === "KEN")!.raw.ka_year).toBe(2021);
    expect(r.chinnItoCountries).toBe(9);
  });

  it("joins on ISO3 when Chinn-Ito carries one, before falling back to names", () => {
    const ISO: Record<string, string> = { Kenya: "KEN", Mexico: "MEX", Argentina: "ARG", Turkey: "TUR", Bolivia: "BOL", Singapore: "SGP", Brazil: "BRA", "United Arab Emirates": "ARE", Chile: "CHL" };
    const withIso = chinnItoCsv
      .split("\n")
      .map((line, i) => (i === 0 ? `iso3,${line}` : line ? `${ISO[line.split(",")[1]] ?? ""},${line}` : line))
      .join("\n");
    const r = build({ chinnItoCsv: withIso });
    expect(r.chinnItoColumns.iso3).toBe("iso3");
    // Bolivia now has an ISO3 (from Chinn-Ito) so it is screened
    expect(r.data.countries.map((c) => c.iso3)).toContain("BOL");
    expect(r.data.countries.find((c) => c.iso3 === "BOL")!.scores).toEqual({ legality: 1, licence: 1, clarity: 1, fx_custody: 3, market_opportunity: null });
  });
});

describe("the committed data/public-screen.json", () => {
  it("is valid input for the provider and never contains a Round 1 market", () => {
    const data = normalisePublicScreen(publicScreenJson);
    const ex = round1Exclusion(ROUND1_NAMES);
    for (const c of data.countries) {
      expect(ex.iso3.has(c.iso3)).toBe(false);
      expect(ex.names.has(normaliseName(c.name))).toBe(false);
      expect(c.scores.legality).toBeLessThanOrEqual(4);
      expect(c.scores.licence).toBeLessThanOrEqual(3);
      expect(c.scores.clarity).toBeLessThanOrEqual(4);
    }
  });
});
