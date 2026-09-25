// Plain-language definitions for every regulator, licence and rail the
// Round 1 deck names. <Gloss text="..."/> renders any string with those
// terms underlined; hovering (or focusing) shows the definition. This is
// what lets someone unfamiliar with the case read the tool without the deck.
import type { ReactElement } from "react";

export const GLOSSARY: Record<string, string> = {
  VARA: "Virtual Assets Regulatory Authority — Dubai's crypto regulator.",
  ETD: "Exchange-Traded Derivatives — VARA's rulebook section (Part V) that permits retail perpetuals.",
  SCA: "Securities and Commodities Authority — UAE federal securities regulator (needed for US-equities brokerage).",
  DFSA: "Dubai Financial Services Authority — regulator of the DIFC financial free zone.",
  DIFC: "Dubai International Financial Centre — a financial free zone with its own regulator (DFSA).",
  Aani: "UAE's instant payment rail run by the central bank.",
  AED: "UAE dirham, pegged to the US dollar.",
  BCB: "Banco Central do Brasil — Brazil's central bank, which licenses crypto service providers.",
  SPSAV: "Brazil's licence for virtual-asset service providers, created by BCB Resolutions 519–521 (2025).",
  VASP: "Virtual Asset Service Provider — a licensed crypto business.",
  CVM: "Comissão de Valores Mobiliários — Brazil's securities regulator.",
  B3: "Brazil's stock and derivatives exchange, where regulated crypto futures trade.",
  Pix: "Brazil's national instant payment system (148M+ users).",
  OJK: "Otoritas Jasa Keuangan — Indonesia's financial services authority, now the crypto regulator.",
  POJK: "OJK regulation; POJK 23/2025 is the rule governing crypto asset trading.",
  Pedagang: "Indonesian licensed crypto trader (Pedagang Fisik Aset Kripto).",
  PAKD: "Pedagang Aset Kripto Digital — Indonesia's licensed digital-crypto-asset trader tier.",
  CFX: "Indonesia's regulated crypto futures exchange.",
  QRIS: "Indonesia's national QR payment standard.",
  "BI-FAST": "Bank Indonesia's real-time retail payment rail.",
  Rp: "Indonesian rupiah.",
  BSP: "Bangko Sentral ng Pilipinas — the Philippine central bank.",
  UPI: "India's Unified Payments Interface — MochaTrade's current funding rail.",
  LRS: "India's Liberalised Remittance Scheme — caps overseas remittance and bars margin/derivatives funding.",
  FEMA: "India's Foreign Exchange Management Act.",
  KYC: "Know Your Customer — identity verification at onboarding.",
  AML: "Anti-Money-Laundering controls.",
  perpetuals: "Crypto futures with no expiry date — MochaTrade's current core product.",
  "dated futures": "Futures with a fixed expiry, the only crypto derivative form B3 allows.",
  "self-custody": "Users holding crypto in their own wallets rather than with the platform.",
  leverage: "Borrowed exposure — 5x means a trader controls 5× their margin.",
  "introducing-broker": "A local broker that onboards clients and passes orders to a licensed executing broker.",
  "priority index": "Screening score minus penalties for adaptation cost and execution dependency — the number the entry order is sorted by.",
  "adaptation cost": "How much MochaTrade's product must change to be legal in this market (1 = almost nothing, 5 = a rebuild).",
  "execution dependency": "How much the launch depends on third parties, new rails and localisation (1 = none, 5 = several partners).",
};

const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const PATTERN = new RegExp(`(${TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`, "g");

export function glossify(text: string): Array<string | { term: string }> {
  const out: Array<string | { term: string }> = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const i = m.index ?? 0;
    const prev = text[i - 1];
    if (prev && /[\w-]/.test(prev)) continue; // inside another word
    if (i > last) out.push(text.slice(last, i));
    out.push({ term: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Gloss({ text, className }: { text: string; className?: string }): ReactElement {
  const parts = glossify(text);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <abbr key={i} title={GLOSSARY[p.term]} tabIndex={0} className="cursor-help decoration-dotted decoration-signal-cyan/60 underline-offset-2">
            {p.term}
          </abbr>
        ),
      )}
    </span>
  );
}
