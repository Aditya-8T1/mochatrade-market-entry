import { useState } from "react";
import type { ReactElement } from "react";
import type { Market, SourceType } from "../engine/types";
import SourceTag from "./ui/SourceTag";
import Gloss from "./ui/Glossary";
import { useFxRates } from "../hooks/useFxRates";
import type { FxStatus, FxRate } from "../data-provider";

function splitItems(text: string): string[] {
  return text
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Which currency (if any) is worth showing a live FX reference for, per
// market -- purely a display decision, not engine/business logic. Scoped
// to markets that are both (a) cleared -- deep_dive, and this section,
// only render for cleared markets -- and (b) cite a local-currency capital
// figure in their deep_dive text. Philippines and Nigeria also cite a
// capital figure (Php100M, N2B) but are screened out, so they never reach
// this section at all; mapping them here would be dead code.
const MARKET_CURRENCY: Record<string, string> = {
  uae: "AED",
  indonesia: "IDR",
};

// The local-currency capital figure each market's deep_dive already cites
// (Round 1 slide 5), so the FX row answers a question a finance reader
// actually has: what is that requirement in dollars today?
const MARKET_CAPITAL: Record<string, { amount: number; display: string; what: string }> = {
  uae: { amount: 800_000, display: "AED 800k", what: "VARA base capital" },
  indonesia: { amount: 100_000_000_000, display: "Rp100bn", what: "own Pedagang licence (deferred)" },
};

function usd(n: number): string {
  if (n >= 1_000_000) return `US$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `US$${Math.round(n / 1_000)}k`;
  return `US$${Math.round(n)}`;
}

/** required_product_changes per market as a checkable list, plus the capital/licensing gate and main hurdle -- this is the "can we actually ship" checklist, not the scoring rubric. */
const STORAGE_KEY = "mochatrade.checklist.v1";

function loadChecked(marketId: string, n: number): boolean[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, boolean[]>) : {};
    const saved = all[marketId];
    return Array.isArray(saved) && saved.length === n ? saved : Array.from({ length: n }, () => false);
  } catch {
    return Array.from({ length: n }, () => false);
  }
}

function saveChecked(marketId: string, checked: boolean[]): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, boolean[]>) : {};
    all[marketId] = checked;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable -- in-memory only */
  }
}

/** Forget a market's saved checklist -- used when a user-entered market is removed, so re-adding one with the same name starts clean. */
export function clearChecklistState(marketId: string): void {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Record<string, boolean[]>;
    delete all[marketId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export default function ComplianceChecklist({ market, goGates = [] }: { market: Market; goGates?: string[] }): ReactElement {
  const dd = market.deep_dive;
  const items = dd ? [...splitItems(dd.required_product_changes), ...goGates.map((g) => `Gate: ${g}`)] : [];
  const [checked, setChecked] = useState<boolean[]>(() => loadChecked(market.id, items.length));

  // The lazy initializer above only runs on this component's first mount --
  // ComplianceChecklist is never remounted when `market` changes (same
  // instance, just a new prop), so without a reset a checked box for one
  // market's Nth item would incorrectly still show checked after switching
  // to a different market's Nth item.
  //
  // This resets synchronously DURING render (React's documented pattern
  // for "adjusting state when a prop changes"), not in a useEffect. An
  // effect-based reset was tried first and rejected: it fires one commit
  // too late -- the render in between (new `items`, still-old `checked`)
  // briefly passes `checked={undefined}` to a checkbox index that only
  // exists in the new market's longer list, which is a genuine React
  // "uncontrolled input becoming controlled" bug, not just a lint warning.
  // Resetting during render lets React discard that in-between render
  // before it's ever committed to the DOM.
  const [checkedForMarketId, setCheckedForMarketId] = useState(market.id);
  if (market.id !== checkedForMarketId) {
    setCheckedForMarketId(market.id);
    setChecked(loadChecked(market.id, items.length));
  }

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = prev.map((c, idx) => (idx === i ? !c : c));
      saveChecked(market.id, next);
      return next;
    });

  const fxCurrency = MARKET_CURRENCY[market.id] ?? market.currency;
  const { rates: fxRates, loading: fxLoading } = useFxRates(fxCurrency ? [fxCurrency] : []);

  if (!market.cleared || !dd) {
    return (
      <div data-testid="compliance-checklist" data-mode="screened-out" className="flex items-start gap-2.5">
        <SourceTag type="calculated" compact />
        <p className="text-[14px] leading-relaxed text-paper-dim">Nothing to prepare: this market is not in the entry plan.</p>
      </div>
    );
  }

  const done = checked.filter(Boolean).length;
  const readiness = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div data-testid="compliance-checklist" data-mode="full">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[12px] text-paper-faint">Product changes and go-gates</span>
        <span className="font-mono text-[12px] tabular text-paper-dim">
          {done} / {items.length}
        </span>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
          <div data-testid="readiness-bar" className="h-full rounded-full bg-signal-green transition-[width]" style={{ width: `${readiness}%` }} />
        </div>
        <span className="font-mono text-[12px] tabular text-signal-green">{readiness}% ready</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-sm px-1 py-1 hover:bg-white/[0.02]">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-signal-cyan"
              />
              <span className={`text-[14px] leading-snug ${checked[i] ? "text-paper-faint line-through" : "text-paper-dim"}`}>
                <Gloss text={item} />
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2.5 border-t border-line-soft pt-3">
        <Row label="Capital & licensing" value={dd.capital_and_licensing} />
        {fxCurrency && <FxRow currency={fxCurrency} rate={fxRates[fxCurrency]} loading={fxLoading} capital={MARKET_CAPITAL[market.id]} />}
        <Row label="Local payment rail" value={dd.local_payment_rail} />
        <Row label="Main hurdle" value={dd.main_hurdle} accent="text-signal-amber" />
        {dd.kyc_aml && <Row label="KYC / AML" value={dd.kyc_aml} tag={dd.kyc_aml_source_type} />}
        <Row label="Crypto route" value={dd.crypto_route} tag={dd.crypto_route_source_type} />
        <Row label="Equities route" value={dd.equities_route} tag={dd.equities_route_source_type} />
      </div>
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

const FX_STATUS_STYLE: Record<FxStatus, string> = {
  live: "text-signal-green",
  fallback: "text-signal-amber",
};

/** Supplementary FX reference for the market's capital figure -- LIVE when the jsDelivr-hosted rate fetch succeeds, FALLBACK (a dated static snapshot, never mislabeled as live) when it doesn't. Never affects any engine value. */
function FxRow({
  currency,
  rate,
  loading,
  capital,
}: {
  currency: string;
  rate: FxRate | undefined;
  loading: boolean;
  capital?: { amount: number; display: string; what: string };
}): ReactElement {
  return (
    <div data-testid="fx-row" data-currency={currency} className="grid grid-cols-[128px_1fr] gap-3 text-[14px]">
      <span className="pt-px font-mono text-[12px] text-paper-faint">{capital ? "Capital in USD" : "FX reference"}</span>
      <span className="leading-snug text-paper-dim">
        {loading ? (
          <span className="text-paper-faint">checking live rate…</span>
        ) : !rate ? (
          <span data-testid="fx-unavailable" className="text-paper-faint">rate unavailable</span>
        ) : (
          <>
            {capital && (
              <span data-testid="fx-capital" className="block text-paper">
                {capital.display} ≈ {usd(capital.amount / rate.ratePerUsd)} <span className="text-paper-dim">({capital.what})</span>
              </span>
            )}
            1 USD = {rate.ratePerUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })} {rate.currency}{" "}
            <span
              data-testid="fx-status"
              data-status={rate.status}
              className={`ml-1.5 font-mono text-[11px] uppercase tracking-wide ${FX_STATUS_STYLE[rate.status]}`}
              title={rate.source}
            >
              {rate.status}
            </span>
            <span className="ml-1.5 text-[12px] text-paper-faint">
              {rate.status === "live" ? `· updated ${timeAgo(rate.fetchedAt)}` : "· static snapshot"}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  tag,
  accent,
}: {
  label: string;
  value: string;
  tag?: SourceType;
  accent?: string;
}): ReactElement {
  return (
    <div className="grid grid-cols-[128px_1fr] gap-3 text-[14px]">
      <span className="pt-px font-mono text-[12px] text-paper-faint">{label}</span>
      <span className={`leading-snug ${accent ?? "text-paper-dim"}`}>
        <Gloss text={value} />
        {tag && <span className="ml-2 inline-block translate-y-[-1px]"><SourceTag type={tag} compact /></span>}
      </span>
    </div>
  );
}
