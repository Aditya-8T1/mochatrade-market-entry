import type { Decision, Market, MarketRecommendation, Risk } from "../engine/types";
import { formatScore, mitigationFor } from "../engine";
import { PUBLIC_SCREEN_BANNER } from "../data-provider/publicScreenProvider";

/**
 * The selected market's decision as a one-page Markdown brief a legal or
 * ops team can paste into an email or a ticket. Pure function so it is
 * testable; the download itself lives in downloadBrief.
 */
export function buildBrief(market: Market, decision: Decision, rec: MarketRecommendation, risks: Risk[], generatedAt = new Date()): string {
  const L: string[] = [];
  const dd = market.deep_dive;
  L.push(`# ${market.name} — market entry brief`);
  L.push(`_Generated ${generatedAt.toISOString().slice(0, 10)} by the MochaTrade Market Entry Readiness tool. Every figure carries its source tag; treat assumptions and unconfirmed routes as open items._`);
  L.push("");
  if (market.screen_source === "public_data") {
    L.push(`> **PUBLIC-DATA SCREEN.** ${PUBLIC_SCREEN_BANNER}`);
    L.push("");
  }
  L.push(`## Decision: ${decision.verdictLabel}`);
  L.push(decision.verdictReason);
  L.push("");
  L.push(`- **Entry approach:** ${decision.entryApproach} _(${decision.entryApproachSource})_`);
  if (decision.window) L.push(`- **When:** ${decision.window}${decision.sequencePosition ? ` (entry position #${decision.sequencePosition})` : ""}`);
  if (market.screen_source === "public_data") {
    L.push(`- **Regulatory risk (indicative):** ${decision.risk.riskScore100}/100 — from coarse public-data bands, not a researched risk score`);
  } else {
    L.push(`- **Regulatory risk:** ${decision.risk.riskScore100}/100 (${decision.risk.band}); weakest: ${decision.risk.drivers.slice(0, 2).map((d) => `${d.label} ${d.raw}/5`).join(", ")}`);
  }
  L.push(`- **Screening score:** ${formatScore(rec.score.weightedScore)}/5, rank #${rec.rawRank}${rec.sequencingInputs ? `; adaptation cost ${rec.sequencingInputs.adaptationCost}/5, execution dependency ${rec.sequencingInputs.executionDependency}/5` : ""}`);
  L.push("");
  L.push(`## ${decision.verdict === "no_go" ? "Why not" : `Conditions before launch (${decision.conditions.length})`}`);
  decision.conditions.forEach((c, i) => L.push(`${i + 1}. ${c}`));
  if (rec.complianceAdjustments) {
    L.push("");
    L.push("## Product and compliance changes required");
    rec.complianceAdjustments.items.forEach((c) => L.push(`- [ ] ${c}`));
    rec.goGates.forEach((g) => L.push(`- [ ] Gate: ${g}`));
  }
  if (dd) {
    L.push("");
    L.push("## Route and licensing");
    L.push(`- **Crypto-derivatives route:** ${dd.crypto_route}${dd.crypto_route_source_type === "route_requires_confirmation" ? " _(route requires confirmation)_" : ""}`);
    L.push(`- **US-equities route:** ${dd.equities_route}${dd.equities_route_source_type === "route_requires_confirmation" ? " _(route requires confirmation)_" : ""}`);
    L.push(`- **Capital and licensing:** ${dd.capital_and_licensing}`);
    if (dd.kyc_aml) L.push(`- **KYC / AML:** ${dd.kyc_aml}${dd.kyc_aml_source_type === "assumption" ? " _(assumption — verify with local counsel)_" : ""}`);
    L.push(`- **Local payment rail:** ${dd.local_payment_rail}`);
    L.push(`- **Main hurdle:** ${dd.main_hurdle}`);
  }
  const rs = market.research;
  if (rs) {
    L.push("");
    L.push(market.research_source === "round2" ? "## Round 2 research" : "## Round 2 research (alongside the Round 1 deck)");
    L.push("_Evidence tags: [V] verified, [V-secondary] secondary source, [V-draft] draft rule, [A] assumption / limited evidence, [D] derived by the researcher._");
    if (rs.reserve_reason) L.push(`- **Why screened out:** ${rs.reserve_reason}`);
    if (rs.adaptation_cost != null) L.push(`- **Adaptation cost:** ${rs.adaptation_cost}/5 — ${rs.adaptation_rationale ?? ""}`);
    if (rs.execution_dependency != null) L.push(`- **Execution dependency:** ${rs.execution_dependency}/5 — ${rs.execution_rationale ?? ""}`);
    if (rs.capital_and_licensing) L.push(`- **Capital and licensing:** ${rs.capital_and_licensing}`);
    if (rs.payment_rail) L.push(`- **Payment rail:** ${rs.payment_rail}`);
    if (rs.kyc_aml) L.push(`- **KYC / AML:** ${rs.kyc_aml}`);
    if (rs.product_changes) L.push(`- **Product changes:** ${rs.product_changes}`);
    if (rs.regulatory_basis) L.push(`- **Regulatory basis:** ${rs.regulatory_basis}`);
    if (rs.flags) L.push(`- **Open flags:** ${rs.flags}`);
    if (rs.deck_check) L.push(`- **Check vs Round 1 deck:** ${rs.deck_check}`);
    if (rs.sources?.length) {
      L.push(`- **Sources:**`);
      rs.sources.forEach((u) => L.push(`  - ${u}`));
    }
  }
  if (risks.length) {
    L.push("");
    L.push("## Risks and mitigations");
    for (const r of risks) {
      const note = r.market_notes?.[market.id];
      L.push(`- **${r.title}** (${r.severity}): ${note ?? r.risk}`);
      L.push(`  - Mitigation: ${mitigationFor(r, market.id)}`);
    }
  }
  const open = [...rec.requiresConfirmation, ...rec.assumptions];
  if (open.length) {
    L.push("");
    L.push("## Assumptions and open items");
    open.forEach((a) => L.push(`- **${a.label}** _(${a.source_type})_: ${a.statement}`));
  }
  if (market.sequence?.if_delayed) {
    L.push("");
    L.push(`**If delayed:** ${market.sequence.if_delayed}`);
  }
  return L.join("\n") + "\n";
}

export function briefFileName(market: Market, at = new Date()): string {
  return `mochatrade-brief-${market.id.replace(/^custom_/, "")}-${at.toISOString().slice(0, 10)}.md`;
}

export function downloadBrief(market: Market, decision: Decision, rec: MarketRecommendation, risks: Risk[]): void {
  const text = buildBrief(market, decision, rec, risks);
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = briefFileName(market);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
