import type { CountryIndicators } from "./worldBankProvider";

/**
 * Suggests a 1-5 market-opportunity score for a country from public data,
 * so that slider in "Score a new market" starts from evidence rather than
 * from 3. It is a SUGGESTION the user can override, and it is tagged
 * "calculated" with the formula shown.
 *
 * Reach = population × internet users %. Points for reach and for GDP per
 * capita (spending power); 1 + points, clamped to 1-5, rounded to 0.5.
 * Calibrated so the nine Round 1 markets land within one point of their
 * deck scores (see test).
 */
export interface OpportunitySuggestion {
  score: number; // 1-5, step 0.5
  internetUsers: number | null;
  reachPoints: number;
  incomePoints: number;
  formula: string;
}

const REACH_BANDS: [number, number][] = [
  [150_000_000, 2.5],
  [60_000_000, 2],
  [30_000_000, 1.5],
  [10_000_000, 1],
  [3_000_000, 0.5],
];
const INCOME_BANDS: [number, number][] = [
  [25_000, 1.5],
  [8_000, 1.25],
  [3_000, 0.5],
  [1_000, 0.25],
];

const band = (v: number | null, bands: [number, number][]) => (v === null ? 0 : (bands.find(([min]) => v >= min)?.[1] ?? 0));
const fmtM = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}bn` : `${Math.round(n / 1e6)}M`);

export function suggestMarketOpportunity(ind: Pick<CountryIndicators, "population" | "gdpPerCapitaUsd" | "internetUsersPct">): OpportunitySuggestion | null {
  const users = ind.population !== null && ind.internetUsersPct !== null ? ind.population * (ind.internetUsersPct / 100) : null;
  if (users === null && ind.gdpPerCapitaUsd === null) return null;
  const reachPoints = band(users, REACH_BANDS);
  const incomePoints = band(ind.gdpPerCapitaUsd, INCOME_BANDS);
  const raw = 1 + reachPoints + incomePoints;
  const score = Math.max(1, Math.min(5, Math.round(raw * 2) / 2));
  const parts = [
    users !== null ? `${fmtM(users)} internet users → +${reachPoints}` : "reach unknown",
    ind.gdpPerCapitaUsd !== null ? `US$${Math.round(ind.gdpPerCapitaUsd).toLocaleString()} GDP/capita → +${incomePoints}` : "income unknown",
  ];
  return { score, internetUsers: users, reachPoints, incomePoints, formula: `1 + ${parts.join(" + ")} = ${score}` };
}
