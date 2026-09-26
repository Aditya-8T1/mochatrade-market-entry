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

  // Screened-out markets that have research-sourced deep_dive data show
  // a "what to watch" readiness view rather than a blank. The checklist
  // items and detail rows are the same component; a banner makes clear
  // these are monitoring steps, not live go-gates.
  if (!market.cleared && !dd) {
    return (
      <div data-testid="compliance-checklist" data-mode="screened-out" className="flex items-start gap-2.5">
        <SourceTag type="calculated" compact />
        <p className="text-[17px] leading-relaxed text-ink-2">Nothing to prepare: this market is not in the entry plan.</p>
      </div>
    );
  }
  if (!market.cleared && dd) {
    // Show monitoring steps and reference data from the research workbook,
    // but mark the mode so tests and the export can label it correctly.
    return <ReadinessWatchlist market={market} dd={dd} />;
  }

  const done = checked.filter(Boolean).length;
  const readiness = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div data-testid="compliance-checklist" data-mode="full">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[14px] text-muted">Product changes and go-gates</span>
        <span className="text-[14px] tabular text-ink-2">
          {done} / {items.length}
        </span>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div data-testid="readiness-bar" className="h-full rounded-full bg-now transition-[width] duration-500 ease-out" style={{ width: `${readiness}%` }} />
        </div>
        <span className="text-[14px] tabular text-now">{readiness}% ready</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i}>
            <label className="press flex min-h-[44px] cursor-pointer items-start gap-3 rounded-chip px-2 py-2 hover:bg-surface active:bg-surface-2">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="mt-[5px] h-[18px] w-[18px] shrink-0 accent-coral-strong"
              />
              <span className={`text-[17px] leading-snug ${checked[i] ? "text-muted line-through" : "text-ink-2"}`}>
                <Gloss text={item} />
              </span>
            </label>
          </li>
        ))}
      </ul>

      {dd && (
        <div className="mt-4 space-y-2.5 border-t border-rule pt-3">
          <Row label="Capital & licensing" value={dd.capital_and_licensing} />
          {fxCurrency && <FxRow currency={fxCurrency} rate={fxRates[fxCurrency]} loading={fxLoading} capital={MARKET_CAPITAL[market.id]} />}
          <Row label="Local payment rail" value={dd.local_payment_rail} />
          <Row label="Main hurdle" value={dd.main_hurdle} accent="text-later" />
          {dd.kyc_aml && <Row label="KYC / AML" value={dd.kyc_aml} tag={dd.kyc_aml_source_type} />}
          <Row label="Crypto route" value={dd.crypto_route} tag={dd.crypto_route_source_type} />
          <Row label="Equities route" value={dd.equities_route} tag={dd.equities_route_source_type} />
        </div>
      )}
    </div>
  );
}

/** Readiness view for a screened-out market that has research-sourced deep_dive data.
 * Shows what would need to be done and what to monitor, with a clear banner. */
function ReadinessWatchlist({ market, dd }: { market: Market; dd: NonNullable<Market["deep_dive"]> }): ReactElement {
  const items = splitItems(dd.required_product_changes);
  const [checked, setChecked] = useState<boolean[]>(() => loadChecked(market.id, items.length));
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
  return (
    <div data-testid="compliance-checklist" data-mode="watchlist">
      <div className="mb-5 rounded-card border border-rule bg-surface-2 px-5 py-4 text-[15px] leading-snug text-ink-2">
        <span className="font-bold text-ink">Not in the entry plan.</span>{" "}
        These are the steps needed <em>if and when the regulatory blocker is lifted</em>. Track them as a watchlist, not a launch checklist.
      </div>
      {items.length > 0 && (
        <ul className="mb-5 space-y-1.5">
          {items.map((item, i) => (
            <li key={i}>
              <label className="press flex min-h-[44px] cursor-pointer items-start gap-3 rounded-chip px-2 py-2 hover:bg-surface active:bg-surface-2">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  className="mt-[5px] h-[18px] w-[18px] shrink-0 accent-coral-strong"
                />
                <span className={`text-[17px] leading-snug ${checked[i] ? "text-muted line-through" : "text-ink-2"}`}>
                  <Gloss text={item} />
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2.5 border-t border-rule pt-3">
        <Row label="Capital & licensing" value={dd.capital_and_licensing} />
        {dd.local_payment_rail && <Row label="Local payment rail" value={dd.local_payment_rail} />}
        <Row label="Main hurdle" value={dd.main_hurdle} accent="text-later" />
        {dd.kyc_aml && <Row label="KYC / AML" value={dd.kyc_aml} tag={dd.kyc_aml_source_type} />}
        <Row label="Crypto route" value={dd.crypto_route} tag={dd.crypto_route_source_type} />
        {dd.equities_route && <Row label="Equities route" value={dd.equities_route} tag={dd.equities_route_source_type} />}
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
  live: "text-now",
  fallback: "text-later",
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
    <div data-testid="fx-row" data-currency={currency} className="grid grid-cols-[128px_1fr] gap-3 text-[17px]">
      <span className="pt-px text-[14px] text-muted">{capital ? "Capital in USD" : "FX reference"}</span>
      <span className="leading-snug text-ink-2">
        {loading ? (
          <span className="text-muted">checking live rate…</span>
        ) : !rate ? (
          <span data-testid="fx-unavailable" className="text-muted">rate unavailable</span>
        ) : (
          <>
            {capital && (
              <span data-testid="fx-capital" className="block text-ink">
                {capital.display} ≈ {usd(capital.amount / rate.ratePerUsd)} <span className="text-ink-2">({capital.what})</span>
              </span>
            )}
            1 USD = {rate.ratePerUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })} {rate.currency}{" "}
            <span
              data-testid="fx-status"
              data-status={rate.status}
              className={`ml-1.5 text-[14px] ${FX_STATUS_STYLE[rate.status]}`}
              title={rate.source}
            >
              {rate.status}
            </span>
            <span className="ml-1.5 text-[14px] text-muted">
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
    <div className="grid grid-cols-[128px_1fr] gap-3 text-[17px]">
      <span className="pt-px text-[14px] text-muted">{label}</span>
      <span className={`leading-snug ${accent ?? "text-ink-2"}`}>
        <Gloss text={value} />
        {tag && <span className="ml-2 inline-block translate-y-[-1px]"><SourceTag type={tag} compact /></span>}
      </span>
    </div>
  );
}
