import { useMemo, useState } from "react";
import { useCountryLookup } from "../hooks/useCountryLookup";
import SourceTag from "./ui/SourceTag";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";
import type { DimensionInfo, DimensionKey, EntryFacts, Market, MarketEntryEngine, RubricWeights } from "../engine/types";
import { regulatoryBlocker } from "../engine";
import { DIM_COLOR, SCREEN_COLOR } from "./ui/dimensionColors";
import { getPublicScreenPrefill, PUBLIC_SCREEN_LABEL, PUBLIC_SCREEN_UNAVAILABLE_LABEL } from "../data-provider/publicScreenProvider";

interface Props {
  engine: MarketEntryEngine;
  dimensions: DimensionInfo[];
  weights: RubricWeights;
  clearThreshold: number;
  onAdd: (m: Market) => void;
  onClose: () => void;
  initialName?: string; // pre-filled from the market finder
}

const SCORE_HINT: Record<DimensionKey, [string, string]> = {
  market_opportunity: ["tiny or unreachable market", "large, reachable, on a rail we can use"],
  legality: ["our product is illegal or undefined", "a clear legal route for crypto derivatives"],
  licence: ["huge capital / local entity required", "affordable licence, no local entity"],
  fx_custody: ["strict capital controls, self-custody banned", "free flows, self-custody allowed"],
  clarity: ["rules in draft or consultation", "a licensing path we can file against today"],
};

const FACT_LABEL: Array<{ key: keyof EntryFacts; label: string; help: string }> = [
  { key: "product_rebuild", label: "Core product must be re-engineered", help: "e.g. perpetuals must become dated futures, or the app cannot operate on its own." },
  { key: "rail_via_partner", label: "Local payment rail only through a licensed partner", help: "Not a national rail we can connect to directly." },
  { key: "localisation_required", label: "New language / localisation required", help: "" },
  { key: "partner_fronted_onboarding", label: "Customers onboard through a partner, not our app", help: "" },
];

function slug(s: string): string {
  return "custom_" + s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * "Score a new market." The brief's literal input: a candidate country
 * that is not one of the 9 screened in Round 1. The user scores the 5
 * rubric dimensions (with the rubric definition beside each) and ticks the
 * countable entry facts; the engine derives adaptation cost and execution
 * dependency and drops the market into the ranking and sequence.
 */
export default function AddMarketForm({ engine, dimensions, weights, clearThreshold, onAdd, onClose, initialName = "" }: Props): ReactElement {
  const [name, setName] = useState(initialName);
  const [scores, setScores] = useState<Record<DimensionKey, number>>({
    market_opportunity: 3,
    legality: 3,
    licence: 3,
    fx_custody: 3,
    clarity: 3,
  });
  const [licenceModel, setLicenceModel] = useState<EntryFacts["licence_model"]>("own");
  const [partners, setPartners] = useState(0);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [signal, setSignal] = useState("");
  // which fields the user has set by hand -- the lookups never overwrite those
  const [touched, setTouched] = useState<Record<DimensionKey, boolean> & { localisation: boolean }>({
    market_opportunity: false,
    legality: false,
    licence: false,
    fx_custody: false,
    clarity: false,
    localisation: false,
  });
  const lookup = useCountryLookup(name);
  const { country, indicators, suggestion } = lookup;
  const englishOfficial = country ? country.languages.some((l) => /english/i.test(l)) : null;
  // Public-data screen (bundled, synchronous): prefills the regulatory sliders with its coarse bands -- all four for a
  // screened country, three (no fx_custody) for a tracker-only one such as Taiwan or Serbia.
  const screen = useMemo(() => (name.trim().length >= 3 ? getPublicScreenPrefill(name) : null), [name]);

  // Pre-fill from public data, once per lookup result, only for untouched fields.
  useEffect(() => {
    if (suggestion && !touched.market_opportunity) setScores((p) => (p.market_opportunity === suggestion.score ? p : { ...p, market_opportunity: suggestion.score }));
  }, [suggestion, touched.market_opportunity]);
  useEffect(() => {
    if (!screen) return;
    setScores((p) => {
      const next = { ...p };
      for (const k of ["legality", "licence", "fx_custody", "clarity"] as const) {
        const d = screen.dims[k];
        if (d && !touched[k]) next[k] = d.score;
      }
      return (["legality", "licence", "fx_custody", "clarity"] as const).every((k) => next[k] === p[k]) ? p : next;
    });
  }, [screen, touched.legality, touched.licence, touched.fx_custody, touched.clarity]);
  useEffect(() => {
    if (englishOfficial !== null && !touched.localisation) {
      setFlags((p) => (!!p.localisation_required === !englishOfficial ? p : { ...p, localisation_required: !englishOfficial }));
    }
  }, [englishOfficial, touched.localisation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const facts: EntryFacts = useMemo(
    () => ({
      licence_model: licenceModel,
      product_rebuild: !!flags.product_rebuild,
      rail_via_partner: !!flags.rail_via_partner,
      partners_required: partners,
      localisation_required: !!flags.localisation_required,
      partner_fronted_onboarding: !!flags.partner_fronted_onboarding,
      source_type: "assumption",
      evidence: "Entered by the user in the Score a new market form.",
    }),
    [licenceModel, partners, flags],
  );

  const derived = engine.deriveSequencingInputs(facts);
  const preview: Market = {
    id: slug(name || "new_market"),
    name: name.trim() || "New market",
    cleared: false,
    scores,
    evidence_confidence: "limited",
    screening_score_deck: 0,
    market_signal: signal.trim() || "User-entered candidate",
  };
  const screening = engine.computeScreeningScore(preview, weights);
  const baseScore = engine.computeScreeningScore(preview, engine.getDefaultWeights()).weightedScore;
  const blocker = regulatoryBlocker(scores);
  const cleared = baseScore >= clearThreshold && !blocker;
  const trimmed = name.trim();
  const nameError =
    trimmed.length === 0
      ? null
      : slug(trimmed) === "custom_"
      ? "Use letters or numbers in the name."
      : engine.getAllMarkets().some((m) => m.screen_source !== "public_data" && (m.name.toLowerCase() === trimmed.toLowerCase() || m.id === slug(trimmed)))
      ? `${trimmed} is already in the list.`
      : null;
  const canSubmit = trimmed.length > 1 && nameError === null;

  const submit = () => {
    if (!canSubmit) return;
    const approach =
      licenceModel === "own"
        ? "Direct entry on an own licence (user-entered route)."
        : licenceModel === "partner"
        ? `Partner-led entry through ${partners || 1} licensed local partner${partners > 1 ? "s" : ""} (user-entered route).`
        : "Own licence or licensed partner, to be confirmed (user-entered route).";
    const m: Market = {
      ...preview,
      cleared,
      screening_score_deck: baseScore,
      user_added: true,
      currency: country?.currency ?? undefined,
      country_facts: country
        ? {
            iso3: country.iso3 || null,
            languages: country.languages,
            population: indicators?.population ?? country.population,
            gdp_per_capita_usd: indicators?.gdpPerCapitaUsd ?? null,
            internet_users_pct: indicators?.internetUsersPct ?? null,
            indicator_year: indicators?.year ?? null,
            suggested_market_opportunity: suggestion?.score ?? null,
            source_type: "calculated",
            evidence: `${country.source}${indicators ? `; ${indicators.source}` : ""}${suggestion ? `; market opportunity ${suggestion.formula}` : ""}`,
          }
        : undefined,
      screen_evidence: screen
        ? Object.fromEntries(
            (["legality", "licence", "fx_custody", "clarity"] as const)
              .filter((k) => screen.dims[k] && !touched[k] && scores[k] === screen.dims[k]!.score)
              .map((k) => [k, screen.dims[k]!.evidence]),
          )
        : undefined,
      entry_facts: facts,
      entry_approach: approach,
      entry_approach_source_type: "assumption",
      screened_out_reason: cleared ? undefined : blocker ?? `Screening score ${baseScore.toFixed(1)}/5 at base weights is below the ${clearThreshold.toFixed(1)} clear threshold.`,
      sequence: cleared
        ? {
            rank: 0,
            window: "Window not yet set",
            label: "User-entered",
            go_gate: ["Regulatory route confirmed with local counsel", "Local payment rail confirmed", "Product changes scoped"],
            rationale: "User-entered market; sequence position computed from its screening score, adaptation cost and execution dependency.",
            if_delayed: "Re-score once the route is confirmed.",
          }
        : undefined,
      deep_dive: cleared
        ? {
            qualifies_reason: `Screening score ${baseScore.toFixed(1)}/5 clears the ${clearThreshold.toFixed(1)} threshold.`,
            crypto_route: "Route not yet documented — confirm with local counsel.",
            crypto_route_source_type: "route_requires_confirmation",
            equities_route: "Route not yet documented — confirm with local counsel.",
            equities_route_source_type: "route_requires_confirmation",
            required_product_changes: [
              flags.product_rebuild ? "Re-engineer the core product for local rules" : "",
              flags.rail_via_partner ? "Integrate a licensed payment partner for the local rail" : "Connect the local payment rail",
              flags.localisation_required ? "Localise the app and onboarding" : "",
              flags.partner_fronted_onboarding ? "Partner-fronted onboarding flow" : "",
              "KYC / AML and transaction monitoring live before launch",
            ]
              .filter(Boolean)
              .join("; "),
            capital_and_licensing: licenceModel === "own" ? "Own licence — capital requirement to be confirmed." : "Licensed local partner — partner terms to be confirmed.",
            commercial_adoption: signal.trim() || "Adoption to be validated.",
            local_payment_rail: "To be confirmed",
            main_hurdle: licenceModel === "own" ? "Licence application" : "Licensed partner",
          }
        : undefined,
    };
    onAdd(m);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="add-market-title">
      <div className="w-full max-w-2xl border border-line bg-ink-800 shadow-panel">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="add-market-title" className="font-display text-base font-semibold text-paper">
            Score a new market
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-paper-faint hover:text-paper">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <p className="text-[14px] text-paper-dim">Score a country that was not part of the Round 1 screen. It is ranked and sequenced with the same rubric and formula as the nine screened markets, and tagged as your entry everywhere it appears.</p>
          {screen && (
            <div data-testid="screen-prefill" data-partial={screen.partial ? "1" : "0"} className="border px-3 py-2 text-[13px] leading-snug text-paper-dim" style={{ borderColor: `${SCREEN_COLOR}66`, backgroundColor: `${SCREEN_COLOR}0f` }}>
              <span className="font-mono text-[11px] uppercase tracking-wide" style={{ color: SCREEN_COLOR }}>
                {screen.partial ? PUBLIC_SCREEN_UNAVAILABLE_LABEL : PUBLIC_SCREEN_LABEL}
              </span>{" "}
              {screen.partial
                ? `${screen.name} is in the Atlantic Council tracker but has no Chinn-Ito capital-controls value, so legality, licence and clarity start from the tracker's coarse bands and FX / custody is left for you to set. The bands cannot tell crypto derivatives or retail leverage from spot, and say nothing about licence burden — your edits always win.`
                : `${screen.name} is in the public-data screen, so the regulatory sliders start from its coarse bands (Atlantic Council tracker + Chinn-Ito). They cannot tell crypto derivatives or retail leverage from spot, and say nothing about licence burden — your edits always win.`}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[12px] text-paper-faint">Country / market</span>
              <input
                data-testid="add-market-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kenya"
                autoFocus
                aria-invalid={nameError !== null}
                aria-describedby="add-market-name-error"
                className="mt-1 w-full border border-line bg-ink-900 px-2.5 py-1.5 text-sm text-paper outline-none focus:border-signal-cyan"
              />
              {nameError && (
                <span id="add-market-name-error" data-testid="add-market-name-error" className="mt-1 block text-[13px] text-signal-red">
                  {nameError}
                </span>
              )}
            </label>
            <label className="block">
              <span className="font-mono text-[12px] text-paper-faint">One-line signal (optional)</span>
              <input value={signal} onChange={(e) => setSignal(e.target.value)} placeholder="e.g. 4M crypto users · M-Pesa rail" className="mt-1 w-full border border-line bg-ink-900 px-2.5 py-1.5 text-sm text-paper outline-none focus:border-signal-cyan" />
            </label>
          </div>

          {trimmed.length >= 3 && (
            <div data-testid="country-facts" data-status={lookup.loading ? "loading" : country ? country.status : lookup.settled ? "none" : "idle"} className="border border-line-soft bg-ink-900/60 px-3 py-2 text-[13px] leading-snug text-paper-dim">
              {lookup.loading && !country ? (
                <span className="text-paper-faint">Looking up {trimmed}…</span>
              ) : country ? (
                <>
                  <span className="text-paper">{country.name}</span>
                  {country.currency && <> · currency <span className="font-mono text-paper">{country.currency}</span></>}
                  {country.languages.length > 0 && <> · {country.languages.slice(0, 3).join(", ")}{country.languages.length > 3 ? "…" : ""}</>}
                  {indicators && (
                    <>
                      {indicators.population !== null && <> · {(indicators.population / 1e6).toFixed(0)}M people</>}
                      {indicators.gdpPerCapitaUsd !== null && <> · US${Math.round(indicators.gdpPerCapitaUsd).toLocaleString()} GDP/capita</>}
                      {indicators.internetUsersPct !== null && <> · {Math.round(indicators.internetUsersPct)}% online</>}
                    </>
                  )}
                  <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide">
                    <span data-testid="country-status" data-status={country.status} className={country.status === "live" ? "text-signal-green" : "text-signal-amber"} title={country.source}>
                      {country.status === "live" ? "live" : "snapshot"}
                    </span>
                    {indicators && (
                      <span data-testid="indicator-status" data-status={indicators.status} className={indicators.status === "live" ? "text-signal-green" : "text-signal-amber"} title={indicators.source}>
                        wb:{indicators.status === "live" ? "live" : "snapshot"}
                      </span>
                    )}
                  </span>
                  {englishOfficial === false && !touched.localisation && <span className="block text-[12px] text-paper-faint">English is not an official language, so "localisation required" has been ticked.</span>}
                </>
              ) : (
                <span className="text-paper-faint">No public data found for "{trimmed}" — score it by hand.</span>
              )}
            </div>
          )}

          <div>
            <span className="font-mono text-[12px] text-paper-faint">Rubric scores (1 = weakest, 5 = strongest)</span>
            <div className="mt-2 space-y-3">
              {dimensions.map((dim) => (
                <div key={dim.key} className="grid items-center gap-3 sm:grid-cols-[150px_1fr_28px]">
                  <div>
                    <div className="text-[14px] text-paper" style={{ color: DIM_COLOR[dim.key] }}>
                      {dim.label}
                    </div>
                    <div className="text-[12px] leading-snug text-paper-faint">{dim.definition}</div>
                  </div>
                  <div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.5}
                      value={scores[dim.key]}
                      data-testid={`add-score-${dim.key}`}
                      onChange={(e) => {
                        setTouched((t) => ({ ...t, [dim.key]: true }));
                        setScores((p) => ({ ...p, [dim.key]: Number(e.target.value) }));
                      }}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-900 accent-current"
                      style={{ color: DIM_COLOR[dim.key] }}
                      aria-label={`${dim.label} score`}
                    />
                    <div className="flex justify-between text-[11px] text-paper-faint">
                      <span>1 · {SCORE_HINT[dim.key][0]}</span>
                      <span>5 · {SCORE_HINT[dim.key][1]}</span>
                    </div>
                  </div>
                  <span className="font-mono text-sm tabular text-paper">{scores[dim.key]}</span>
                  {dim.key === "market_opportunity" && suggestion && (
                    <div data-testid="opportunity-suggestion" className="sm:col-span-3 -mt-1 flex flex-wrap items-center gap-2 text-[12px] leading-snug text-paper-faint">
                      <SourceTag type="calculated" compact />
                      <span>
                        {screen && <span className="mr-1 font-mono" style={{ color: SCREEN_COLOR }}>{PUBLIC_SCREEN_LABEL} ·</span>}
                        {touched.market_opportunity ? "Your value. " : "Suggested from public data. "}
                        {suggestion.formula}
                        {indicators?.year ? ` (${indicators.year})` : ""}
                        {touched.market_opportunity && suggestion.score !== scores.market_opportunity && (
                          <button type="button" onClick={() => { setTouched((t) => ({ ...t, market_opportunity: false })); }} className="ml-2 text-signal-cyan hover:underline">
                            use {suggestion.score}
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                  {dim.key !== "market_opportunity" && screen && screen.dims[dim.key] && (
                    <div data-testid={`screen-prefill-${dim.key}`} data-touched={touched[dim.key] ? "1" : "0"} className="sm:col-span-3 -mt-1 flex flex-wrap items-center gap-2 text-[12px] leading-snug text-paper-faint">
                      <SourceTag type="calculated" compact />
                      <span>
                        <span className="mr-1 font-mono" style={{ color: SCREEN_COLOR }}>{PUBLIC_SCREEN_LABEL} ·</span>
                        {touched[dim.key] ? "Your value. " : `Prefilled ${screen.dims[dim.key]!.score}. `}
                        {screen.dims[dim.key]!.evidence}
                        {touched[dim.key] && screen.dims[dim.key]!.score !== scores[dim.key] && (
                          <button type="button" onClick={() => setTouched((t) => ({ ...t, [dim.key]: false }))} className="ml-2 text-signal-cyan hover:underline">
                            use {screen.dims[dim.key]!.score}
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                  {dim.key === "fx_custody" && screen?.partial && (
                    <div data-testid="screen-prefill-fx_custody-missing" className="sm:col-span-3 -mt-1 text-[12px] leading-snug text-paper-faint">
                      <span className="mr-1 font-mono text-paper-faint">{PUBLIC_SCREEN_UNAVAILABLE_LABEL} ·</span>
                      no Chinn-Ito value for {screen.name} — left at the default for you to set.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="font-mono text-[12px] text-paper-faint">Entry route facts (these set adaptation cost and execution dependency)</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block text-[14px] text-paper-dim">
                Licence model
                <select value={licenceModel} onChange={(e) => setLicenceModel(e.target.value as EntryFacts["licence_model"])} className="mt-1 w-full border border-line bg-ink-900 px-2 py-1.5 text-sm text-paper">
                  <option value="own">Own licence</option>
                  <option value="partner">Through a licensed partner</option>
                  <option value="own_or_partner">Either — to be decided</option>
                </select>
              </label>
              <label className="block text-[14px] text-paper-dim">
                Licensed local partners the launch depends on
                <input type="number" min={0} max={5} value={partners} onChange={(e) => setPartners(Math.max(0, Math.min(5, Number(e.target.value))))} className="mt-1 w-full border border-line bg-ink-900 px-2 py-1.5 text-sm text-paper" />
              </label>
              {FACT_LABEL.map((f) => (
                <label key={String(f.key)} className="flex items-start gap-2 text-[14px] text-paper-dim">
                  <input type="checkbox" checked={!!flags[String(f.key)]} onChange={(e) => {
                      if (f.key === "localisation_required") setTouched((t) => ({ ...t, localisation: true }));
                      setFlags((p) => ({ ...p, [String(f.key)]: e.target.checked }));
                    }} className="mt-[3px] h-3.5 w-3.5 accent-signal-cyan" />
                  <span>
                    {f.label}
                    {f.help && <span className="block text-[12px] text-paper-faint">{f.help}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2 border-t border-line-soft pt-3 font-mono text-[13px] text-paper-dim sm:grid-cols-3">
            <div>
              Screening score <span className="text-paper">{screening.weightedScore.toFixed(2)}/5</span>
              <div className={cleared ? "text-signal-green" : "text-signal-amber"}>{cleared ? "clears screening" : blocker ? "regulatory blocker — screened out" : `below ${clearThreshold.toFixed(1)} — screened out`}</div>
            </div>
            <div>
              Adaptation cost <span className="text-paper">{derived.adaptationCost}/5</span>
              <div className="text-[11px] text-paper-faint">{derived.adaptationFormula}</div>
            </div>
            <div>
              Execution dependency <span className="text-paper">{derived.executionDependency}/5</span>
              <div className="text-[11px] text-paper-faint">{derived.executionFormula}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button onClick={onClose} className="rounded-sm border border-line px-3 py-1.5 font-mono text-[13px] text-paper-dim hover:text-paper">
            Cancel
          </button>
          <button
            data-testid="add-market-submit"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-sm border border-signal-cyan/60 bg-signal-cyan/10 px-3 py-1.5 font-mono text-[13px] text-signal-cyan disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add to ranking
          </button>
        </div>
      </div>
    </div>
  );
}
