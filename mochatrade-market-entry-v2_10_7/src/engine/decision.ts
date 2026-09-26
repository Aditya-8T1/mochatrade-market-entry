// The "so what" layer: turns the score + sequence + deep-dive data into the
// three things the Round 2 brief asks for by name -- a regulatory risk
// score, a recommended entry approach, and a go / go-with-conditions /
// no-go verdict -- plus a robustness check across the weight presets.
// Generates no new regulatory claims: every string is data verbatim or a
// sentence built from engine numbers.
// Internal to the engine -- import from src/engine/index.ts instead.

import type {
  Decision,
  DimensionKey,
  Market,
  RegulatoryRisk,
  RiskBand,
  RobustnessReport,
  RubricWeights,
  SourceType,
  Verdict,
} from "./types";
import type { EngineData } from "./recommendation";
import { computeScreeningScore } from "./scoring";
import { recommendedSequence } from "./sequencing";
import { assertValidWeights, round } from "./weights";

/** Market opportunity is a reason to enter, not a regulatory risk -- it is excluded here on purpose. */
export const REGULATORY_DIMENSIONS: readonly DimensionKey[] = ["legality", "licence", "fx_custody", "clarity"];

export function bandOf(riskScore100: number): RiskBand {
  if (riskScore100 < 30) return "low";
  if (riskScore100 < 55) return "medium";
  return "high";
}

export function regulatoryRisk(market: Market, weights: RubricWeights, data: EngineData): RegulatoryRisk {
  assertValidWeights(weights);
  const labels = Object.fromEntries(data.dimensions.map((d) => [d.key, d.label])) as Record<DimensionKey, string>;
  let wsum = 0;
  let acc = 0;
  for (const key of REGULATORY_DIMENSIONS) {
    acc += market.scores[key] * weights[key];
    wsum += weights[key];
  }
  // If the user zeroes every regulatory weight, fall back to a plain mean so the band still means something.
  const regulatoryScore = wsum > 0 ? acc / wsum : REGULATORY_DIMENSIONS.reduce((s, k) => s + market.scores[k], 0) / REGULATORY_DIMENSIONS.length;
  const riskScore100 = round(((5 - regulatoryScore) / 4) * 100, 0);
  const drivers = REGULATORY_DIMENSIONS.map((key) => ({ key, label: labels[key] ?? key, raw: market.scores[key] })).sort(
    (a, b) => a.raw - b.raw || a.key.localeCompare(b.key),
  );
  return { regulatoryScore: round(regulatoryScore, 2), riskScore100, band: bandOf(riskScore100), drivers };
}

/** Legality at or below this, or licence at or below LICENCE_BLOCKER, screens a market out whatever its weighted score. */
export const LEGALITY_BLOCKER = 2;
export const LICENCE_BLOCKER = 1;

/**
 * Regulatory knock-out for markets that were not researched in Round 1
 * (public-data screens and user-entered markets). A high market-opportunity
 * score must not carry a market whose core product is effectively illegal or
 * unlicensable over the threshold. Consistent with Round 1: every screened
 * market with legality <= 2 or licence <= 1 was screened out; all three
 * cleared markets have legality >= 3.5 and licence >= 3.
 * Returns the reason string, or null when the market passes. Pass `detail`
 * (the country's own evidence) so each market states WHY in its own words;
 * the rule itself is then shown once, under Assumptions (KNOCKOUT_RULE).
 */
export const KNOCKOUT_RULE = `A market with legality ${LEGALITY_BLOCKER} or below, or licence ${LICENCE_BLOCKER}, is screened out whatever its weighted score (consistent with Round 1, where every such market was screened out).`;

export function regulatoryBlocker(scores: Pick<Record<DimensionKey, number>, "legality" | "licence">, detail?: string): string | null {
  if (scores.legality > LEGALITY_BLOCKER && scores.licence > LICENCE_BLOCKER) return null;
  const failing = [
    scores.legality <= LEGALITY_BLOCKER ? "no defensible legal route" : null,
    scores.licence <= LICENCE_BLOCKER ? "no workable licence" : null,
  ].filter(Boolean).join(" and ");
  const head = `Regulatory blocker: legality ${scores.legality}/5, licence ${scores.licence}/5 (${failing}).`;
  const d = detail?.trim();
  return d ? `${head} ${d}` : `${head} ${KNOCKOUT_RULE}`;
}

export const VERDICT_WORD: Record<Verdict, string> = {
  go_now: "Enter now",
  go_next: "Enter next",
  go_later: "Enter later",
  shortlist: "Shortlist, research first",
  no_go: "Do not enter now",
};

/** What a public-data screen must close before it can even be scored like a Round 1 market. */
export const PUBLIC_SCREEN_CONDITIONS: readonly string[] = [
  "Confirm the crypto-derivatives route (perpetuals / retail leverage) with local counsel — the tracker only says whether crypto is legal",
  "Confirm licence burden, capital requirement and local-entity rules — the tracker only says whether a licensing rule exists",
  "Confirm the local payment rail and self-custody rules",
  "Re-score all five dimensions by hand in \"Score a new market\" and add entry-route facts so it can be sequenced",
];

/**
 * Indicative priority of a Round 2 market on the same formula the sequence
 * uses (score - lambda_a x adaptation - lambda_e x execution), compared with
 * the last market in the plan. The Round 2 inputs are the researcher's [D]
 * ratings, the Round 1 ones are derived from entry facts, so this is a signal
 * for the team, never a sequence position.
 */
export function round2Priority(data: EngineData, market: Market, weights: RubricWeights): number | null {
  const r = market.research;
  if (!r || r.adaptation_cost == null || r.execution_dependency == null) return null;
  const score = computeScreeningScore(market, weights).weightedScore;
  const p = data.sequencingParameters;
  return score - p.lambda_adaptation_cost * r.adaptation_cost - p.lambda_execution_dependency * r.execution_dependency;
}

function round2PriorityNote(data: EngineData, market: Market, weights: RubricWeights): string {
  const pi = round2Priority(data, market, weights);
  const plan = recommendedSequence(data.markets, weights, data.sequencingParameters);
  const last = plan[plan.length - 1];
  if (pi == null || !last) return "";
  const ahead = plan.filter((s) => pi > s.priorityIndex);
  const where = ahead.length
    ? `higher than ${ahead.map((s) => `${s.market.name} (${s.priorityIndex.toFixed(2)})`).join(", ")}, so it would enter the plan ahead of ${ahead.length === 1 ? "it" : "them"} once its route is confirmed`
    : `below ${last.market.name} (${last.priorityIndex.toFixed(2)}), so it would join the plan after the current markets`;
  return ` Indicative entry priority ${pi.toFixed(2)}: ${where}. Its adaptation and execution ratings are the researcher's, not derived from entry facts, so treat this as a signal for the team, not a sequence position.`;
}

export function decisionFor(data: EngineData, marketId: string, weights: RubricWeights): Decision | undefined {
  const market = data.markets.find((m) => m.id === marketId);
  if (!market) return undefined;
  const risk = regulatoryRisk(market, weights, data);
  const seq = recommendedSequence(data.markets, weights, data.sequencingParameters).find((s) => s.market.id === marketId);

  const routeConfirmations: string[] = [];
  const dd = market.deep_dive as unknown as Record<string, unknown> | undefined;
  if (dd) {
    for (const f of ["crypto_route", "equities_route"]) {
      if (dd[`${f}_source_type`] === "route_requires_confirmation") {
        routeConfirmations.push(`Confirm ${f === "crypto_route" ? "crypto-derivatives" : "US-equities"} route: ${String(dd[f])}`);
      }
    }
  }

  let verdict: Verdict;
  let verdictReason: string;
  let conditions: string[] = [];
  const coreRouteOpen = dd?.crypto_route_source_type === "route_requires_confirmation";
  if (market.screen_source === "public_data") {
    // Public-data screen: no entry route exists, so it is never sequenced and
    // never gets an entry verdict. A cleared screen is "shortlist" (research
    // first); a screen below the threshold or on a regulatory blocker is no_go.
    if (market.cleared) {
      verdict = "shortlist";
      verdictReason = "Public-data screen only: the bands clear the threshold, but no entry route has been researched. Shortlist it for a deep dive; do not commit spend.";
      // A rich, open economy can out-score a plan market on public data alone.
      // Say so, and say why that does not move it into the plan: the tracker
      // cannot see crypto derivatives or retail leverage, and nothing about
      // entry route, rail or partner has been checked.
      const own = computeScreeningScore(market, weights).weightedScore;
      const planSeq = recommendedSequence(data.markets, weights, data.sequencingParameters).filter((s) => s.market.sequence?.rank);
      const outscored = planSeq.filter((s) => computeScreeningScore(s.market, weights).weightedScore < own - 1e-9);
      if (outscored.length > 0) {
        verdictReason += ` It scores above ${outscored.map((s) => s.market.name).join(" and ")} in the plan, but on coarse public bands that cannot see whether crypto derivatives or retail leverage are allowed, so the score is not comparable until it is researched.`;
      }
      conditions = [...PUBLIC_SCREEN_CONDITIONS];
    } else {
      verdict = "no_go";
      verdictReason = "Public-data screen does not clear: see why below.";
      conditions = market.screened_out_reason ? [market.screened_out_reason] : ["Screening score below the clear threshold."];
    }
  } else if (market.research_source === "round2") {
    // Round 2 research market: researched and scored, but the workbook has no
    // entry route, timing or go-gates, so it is never sequenced. A cleared one
    // is a next-wave "shortlist"; the researched adaptation / execution give an
    // indicative priority against the Round 1 plan, never a sequence position.
    const r = market.research ?? {};
    if (market.cleared) {
      verdict = "shortlist";
      verdictReason = `Researched in Round 2 and clears screening, but it has no confirmed entry route, timing or go-gates, so it is not in the 18-month plan.${round2PriorityNote(data, market, weights)}`;
      conditions = [
        ...(r.flags ? [`Resolve the research flags: ${r.flags}`] : []),
        ...(r.adaptation_cost != null ? [`Adaptation cost ${r.adaptation_cost}/5: ${r.adaptation_rationale ?? ""}`.trim()] : []),
        ...(r.execution_dependency != null ? [`Execution dependency ${r.execution_dependency}/5: ${r.execution_rationale ?? ""}`.trim()] : []),
        "Define the entry route, timing window and go-gates so it can be sequenced",
      ];
    } else {
      verdict = "no_go";
      verdictReason = "Researched in Round 2 and does not clear screening: see why below.";
      conditions = [market.screened_out_reason ?? "Screening score below the clear threshold."];
    }
  } else if (!market.cleared || !seq) {
    verdict = "no_go";
    // Round 1 markets were screened out on a named regulatory blocker, not on
    // score alone -- so reweighting can lift the score above the threshold
    // without reopening the market. Say so, instead of claiming a threshold miss.
    verdictReason = market.user_added
      ? "Did not clear the screening threshold at base weights, so it is not in the entry plan."
      : "Screened out in Round 1 on a regulatory blocker, not on score alone, so reweighting the rubric does not reopen it.";
    conditions = market.screened_out_reason ? [market.screened_out_reason] : ["Screening score below the clear threshold."];
  } else {
    conditions = [...(market.sequence?.go_gate ?? []), ...routeConfirmations];
    // Lead with the deck's own reason for the position (sequence.rationale),
    // then what that means for spend. "First because it is first" is not a
    // reason.
    const why = (market.sequence?.rationale ?? "").trim().replace(/[.]?$/, ".");
    const lead = why.length > 1 ? `${why} ` : "";
    if (seq.sequenceRank === 1 && !coreRouteOpen) {
      verdict = "go_now";
      verdictReason = `${lead}Start the build and filing now.`;
    } else if (seq.sequenceRank <= 2) {
      verdict = "go_next";
      verdictReason = coreRouteOpen
        ? `${lead}The crypto-derivatives route is not yet confirmed: start filing now, launch once it is.`
        : `${lead}Launch once its own go-gates are closed.`;
    } else {
      verdict = "go_later";
      verdictReason = `${lead}Commit spend only after the earlier markets clear their go-gates.`;
    }
  }

  // A researched Do-not-enter market with a written "why not now" leads with
  // that summary, and its conditions become one line per failing rubric
  // dimension (label, score, note) so the card, the compare view and the
  // exported brief all carry the rubric reasoning.
  const why = verdict === "no_go" ? market.why_not_now ?? null : null;
  if (why) {
    const labels = Object.fromEntries(data.dimensions.map((d) => [d.key, d.label])) as Record<DimensionKey, string>;
    verdictReason = why.summary;
    conditions = why.dimensions.map((d) => `${labels[d.key] ?? d.key} ${market.scores[d.key]}/5 — ${d.note}`);
  }

  const entryApproach =
    market.entry_approach ??
    (market.research_source === "round2"
      ? market.cleared
        ? "Next-wave candidate from Round 2 research, not in the 18-month plan. Licensing, rail, KYC and product notes are below; the entry route still needs confirming."
        : "Not in the entry plan. See why below."
      : market.screen_source === "public_data"
      ? "Not researched — public-data screen only. Confirm the crypto-derivatives route, licence burden and payment rail with local counsel before treating this as a candidate."
      : market.cleared
      ? market.deep_dive?.capital_and_licensing ?? "Entry approach not yet defined for this market."
      : "Not in the entry plan. See why below.");
  const entryApproachSource: SourceType =
    market.entry_approach_source_type ?? (market.screen_source === "public_data" || (market.research_source === "round2" && market.cleared) ? "route_requires_confirmation" : market.cleared ? "assumption" : "calculated");
  const window = market.sequence?.window ?? null;

  let headline: string;
  if (verdict === "no_go") {
    headline = `${VERDICT_WORD.no_go}: ${market.name} ${market.user_added ? "did not clear screening" : market.research_source === "round2" ? "did not clear Round 2 screening" : "was screened out on a regulatory blocker"} (regulatory risk ${risk.band}, ${risk.riskScore100}/100).`;
  } else {
    const pos = seq ? `entry position #${seq.sequenceRank}` : "";
    headline = `${VERDICT_WORD[verdict]}: ${market.name}, ${pos}${window ? `, ${window.toLowerCase()}` : ""} — regulatory risk ${risk.band} (${risk.riskScore100}/100), ${conditions.length} condition${conditions.length === 1 ? "" : "s"} to close before launch.`;
  }

  return {
    marketId,
    verdict,
    verdictLabel: VERDICT_WORD[verdict],
    verdictReason,
    headline,
    entryApproach,
    entryApproachSource,
    window,
    conditions,
    whyNotNow: why,
    risk,
    sequencePosition: seq?.sequenceRank ?? null,
  };
}

export function robustness(data: EngineData): RobustnessReport {
  const names = Object.keys(data.presets);
  const presets = names.map((name) => ({
    name,
    order: recommendedSequence(data.markets, data.presets[name].weights, data.sequencingParameters).map((s) => s.market.id),
  }));
  const base = presets.find((p) => p.name === "base") ?? presets[0];
  const perMarket = base.order.map((id, i) => {
    const positions: Record<string, number> = {};
    let stable = 0;
    for (const p of presets) {
      positions[p.name] = p.order.indexOf(id) + 1;
      if (positions[p.name] === i + 1) stable += 1;
    }
    return {
      marketId: id,
      marketName: data.markets.find((m) => m.id === id)?.name ?? id,
      basePosition: i + 1,
      positions,
      stablePresets: stable,
      totalPresets: presets.length,
    };
  });
  return { presets, perMarket, stable: presets.every((p) => p.order.join() === base.order.join()) };
}
