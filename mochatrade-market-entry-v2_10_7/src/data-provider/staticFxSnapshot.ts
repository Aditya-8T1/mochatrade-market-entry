// Static/fallback FX snapshot. Used ONLY when the live provider is
// unavailable (see staticFxProvider.ts, which is what actually enforces
// status: "fallback" on every value drawn from here).
//
// No pre-existing verified FX table exists elsewhere in this repo --
// data/markets.json's capital figures are narrative text ("AED 800k+
// (approx. US$0.2M)"), not a numeric FX table. These values are a dated
// snapshot captured from the live provider on the date below and then
// frozen; they are a fallback of last resort, not a Round-1-verified fact,
// which is why every consumer must keep tagging them "fallback" rather than
// promoting them to "verified_fact" anywhere in the UI.
//
// AED is the one figure that's a durable fact independent of any snapshot:
// the UAE dirham has been pegged to the US dollar at exactly this rate
// since 1997 (a fixed central-bank peg, not a floating market rate), so it
// won't go stale the way the other three can.
export const STATIC_FX_SNAPSHOT: { capturedAt: string; rates: Record<string, number> } = {
  capturedAt: "2026-09-24T00:00:00Z",
  rates: {
    AED: 3.6725, // fixed USD peg since 1997 -- not time-sensitive
    IDR: 17799.60242335,
    PHP: 62.62504387,
    NGN: 1324.91092885,
  },
};
