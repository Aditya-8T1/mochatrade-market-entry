import { describe, it, expect } from "vitest";
import { fetchLiveCountry, getCountry, getStaticCountry } from "../countryProvider";
import { fetchLiveIndicators, getIndicators, getStaticIndicators, STATIC_INDICATOR_SNAPSHOT } from "../worldBankProvider";
import { suggestMarketOpportunity } from "../marketOpportunity";
import { engine } from "../../engine";

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
const failing = (async () => { throw new Error("network down"); }) as unknown as typeof fetch;

describe("REST Countries v5 provider", () => {
  const v5 = (objects: unknown[]) => ({ data: { objects, meta: { total: objects.length } } });
  const kenya = v5([
    {
      names: { common: "Kenya", official: "Republic of Kenya", alternates: ["Jamhuri ya Kenya"] },
      codes: { alpha_2: "KE", alpha_3: "KEN" },
      currencies: [{ code: "KES", name: "Kenyan shilling", symbol: "Sh" }],
      languages: [{ name: "English" }, { name: "Swahili" }],
      population: 53_005_614,
      region: "Africa",
    },
  ]);

  it("parses a live response", async () => {
    const c = await fetchLiveCountry("Kenya", { fetchImpl: json(kenya) });
    expect(c).toMatchObject({ name: "Kenya", iso3: "KEN", currency: "KES", languages: ["English", "Swahili"], status: "live", source: "REST Countries v5 (live)" });
  });

  it("sends the key as a bearer token to the v5 endpoint", async () => {
    let seen: { url: string; auth: string | null } | null = null;
    const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(input), auth: new Headers(init?.headers).get("authorization") };
      return new Response(JSON.stringify(kenya), { status: 200 });
    }) as unknown as typeof fetch;
    await fetchLiveCountry("Kenya", { fetchImpl: spy, apiKey: "rc_live_abc" });
    expect(seen!.url).toMatch(/^https:\/\/api\.restcountries\.com\/countries\/v5\?q=Kenya&/);
    expect(seen!.auth).toBe("Bearer rc_live_abc");
  });

  it("prefers the exact common-name match when the API returns several", async () => {
    const many = v5([
      { names: { common: "Nigeria" }, codes: { alpha_3: "NGA" }, currencies: [{ code: "NGN" }] },
      { names: { common: "Niger" }, codes: { alpha_3: "NER" }, currencies: [{ code: "XOF" }] },
    ]);
    const c = await fetchLiveCountry("Niger", { fetchImpl: json(many) });
    expect(c?.iso3).toBe("NER");
  });

  it("ignores results that matched on a non-name field", async () => {
    // q= also matches capitals, demonyms, currency names...
    const odd = v5([{ names: { common: "Canada" }, codes: { alpha_3: "CAN" }, currencies: [{ code: "CAD" }] }]);
    expect(await fetchLiveCountry("Ottawa", { fetchImpl: json(odd) })).toBeNull();
  });

  it("treats an empty result list as 'no such country', not a failure", async () => {
    expect(await fetchLiveCountry("Atlantis", { fetchImpl: json(v5([])) })).toBeNull();
  });

  it("treats a v5 404 (bad path) as a failure", async () => {
    await expect(fetchLiveCountry("Kenya", { fetchImpl: json({ errors: [{ message: "Not found" }] }, 404) })).rejects.toThrow();
  });

  it("refuses the demo key's canned sample", async () => {
    const demo = { data: { _demo: { message: "demo" }, objects: kenya.data.objects } };
    await expect(fetchLiveCountry("Kenya", { fetchImpl: json(demo) })).rejects.toThrow(/demo/);
  });

  it("falls back to the snapshot when no key is configured", async () => {
    const c = await getCountry("Kenya", { liveOptions: { fetchImpl: json(kenya), apiKey: "" } });
    expect(c).toMatchObject({ iso3: "KEN", status: "fallback" });
  });

  it("falls back to the snapshot when live fails, tagged fallback", async () => {
    const c = await getCountry("Kenya", { liveOptions: { fetchImpl: failing } });
    expect(c).toMatchObject({ iso3: "KEN", currency: "KES", status: "fallback" });
  });

  it("resolves aliases (UAE, Dubai) via the snapshot", () => {
    expect(getStaticCountry("UAE")?.iso3).toBe("ARE");
    expect(getStaticCountry("dubai")?.currency).toBe("AED");
  });

  it("returns null for a country in neither source", async () => {
    expect(await getCountry("Atlantis", { liveOptions: { fetchImpl: failing } })).toBeNull();
  });
});

describe("World Bank provider", () => {
  const wb = [
    { page: 1 },
    [
      { indicator: { id: "SP.POP.TOTL" }, date: "2023", value: 55_100_586 },
      { indicator: { id: "NY.GDP.PCAP.CD" }, date: "2023", value: 1_949.9 },
      { indicator: { id: "IT.NET.USER.ZS" }, date: "2022", value: 40.8 },
    ],
  ];

  it("parses the [meta, rows] shape and keeps the newest non-null value per indicator", async () => {
    const i = await fetchLiveIndicators("KEN", { fetchImpl: json(wb) });
    expect(i).toMatchObject({ iso3: "KEN", population: 55_100_586, internetUsersPct: 40.8, year: 2023, status: "live" });
    expect(i.gdpPerCapitaUsd).toBeCloseTo(1949.9);
  });

  it("throws when the body has no usable values, so the caller can fall back", async () => {
    await expect(fetchLiveIndicators("KEN", { fetchImpl: json([{}, [{ indicator: { id: "SP.POP.TOTL" }, value: null }]]) })).rejects.toThrow();
  });

  it("falls back to the snapshot when live fails", async () => {
    const i = await getIndicators("KEN", { liveOptions: { fetchImpl: failing } });
    expect(i?.status).toBe("fallback");
    expect(i?.gdpPerCapitaUsd).toBe(STATIC_INDICATOR_SNAPSHOT.KEN.gdpPerCapitaUsd);
    expect(getStaticIndicators("XXX")).toBeNull();
  });
});

describe("market-opportunity suggestion", () => {
  it("lands within one point of the Round 1 deck score for every screened market", () => {
    const iso: Record<string, string> = { brazil: "BRA", uae: "ARE", indonesia: "IDN", philippines: "PHL", nigeria: "NGA", pakistan: "PAK", thailand: "THA", south_africa: "ZAF", vietnam: "VNM" };
    for (const m of engine.getAllMarkets()) {
      const s = suggestMarketOpportunity(STATIC_INDICATOR_SNAPSHOT[iso[m.id]]);
      expect(s, m.id).not.toBeNull();
      expect(Math.abs(s!.score - m.scores.market_opportunity), `${m.id}: suggested ${s!.score} vs deck ${m.scores.market_opportunity}`).toBeLessThanOrEqual(1);
    }
  });

  it("returns null with no data, and clamps to 1-5 in steps of 0.5", () => {
    expect(suggestMarketOpportunity({ population: null, gdpPerCapitaUsd: null, internetUsersPct: null })).toBeNull();
    const s = suggestMarketOpportunity({ population: 1_500_000_000, gdpPerCapitaUsd: 90_000, internetUsersPct: 100 })!;
    expect(s.score).toBe(5);
    expect(s.formula).toContain("=");
  });
});
