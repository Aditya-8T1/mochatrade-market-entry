import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Search } from "lucide-react";
import type { Market } from "../engine/types";
import type { Verdict } from "../engine/types";
import type { PublicScreenCountry, PublicScreenPartial } from "../data-provider/publicScreenProvider";
import { PUBLIC_SCREEN_LABEL, PUBLIC_SCREEN_UNAVAILABLE_LABEL, foldCountryName } from "../data-provider/publicScreenProvider";
import { SCREEN_COLOR } from "./ui/dimensionColors";
import { VerdictChip } from "./ui/verdict";

interface Props {
  markets: Market[];
  verdictOf: (id: string) => { verdict: Verdict; label: string } | undefined;
  /** Heading above the search box. */
  label?: string;
  /** Marks the currently open market in the results, if any. */
  selectedId?: string;
  onSelect: (id: string) => void;
  onScoreNew: (name: string) => void;
  /** Countries in the public-data screen (data/public-screen.json); empty when the file is absent. */
  publicScreen?: PublicScreenCountry[];
  onSelectScreen?: (c: PublicScreenCountry) => void;
  /** Tracker-only jurisdictions (no capital-controls data): offered as a prefill for "Score a new market", never added as a screen market. */
  publicScreenUnavailable?: PublicScreenPartial[];
}


const ALIASES: Record<string, string[]> = { uae: ["dubai", "emirates", "united arab emirates"] };

/**
 * The tool's front door: type a country, get its decision. Matches the
 * markets already scored (Round 1 nine plus user entries); anything else
 * hands off to "Score a new market" with the name filled in. This is the
 * brief's literal contract -- country in, verdict out -- made the first
 * thing on the page instead of something buried in a sidebar.
 */
export default function MarketFinder({ markets, verdictOf, label = "Check any other country", selectedId = "", onSelect, onScoreNew, publicScreen = [], onSelectScreen, publicScreenUnavailable = [] }: Props): ReactElement {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const trimmed = q.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!trimmed) return [];
    return markets
      .filter((m) => m.name.toLowerCase().includes(trimmed) || (ALIASES[m.id] ?? []).some((a) => a.includes(trimmed)))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(trimmed)) - Number(a.name.toLowerCase().startsWith(trimmed)))
      .slice(0, 6);
  }, [markets, trimmed]);

  // Public-data screen countries that are NOT already a market (Round 1, a
  // user entry, or a screen already added). A user market with the same
  // name always wins, so the screen option disappears once one exists.
  const screenMatches = useMemo(() => {
    if (!trimmed || trimmed.length < 2 || publicScreen.length === 0) return [];
    const q = foldCountryName(trimmed);
    const taken = new Set(markets.map((m) => foldCountryName(m.name)));
    const folded = (c: PublicScreenCountry) => foldCountryName(c.name);
    return publicScreen
      .filter((c) => !taken.has(folded(c)) && (folded(c).includes(q) || c.iso3.toLowerCase() === q))
      .sort((a, b) => Number(folded(b).startsWith(q)) - Number(folded(a).startsWith(q)))
      .slice(0, 4);
  }, [publicScreen, markets, trimmed]);

  // A public-data screen market does not block "score it by hand": a user market with the same name is always creatable and takes precedence.
  const partialMatches = useMemo(() => {
    if (!trimmed || trimmed.length < 2 || publicScreenUnavailable.length === 0) return [];
    const q = foldCountryName(trimmed);
    const taken = new Set(markets.map((m) => foldCountryName(m.name)));
    return publicScreenUnavailable
      .filter((c) => !taken.has(foldCountryName(c.name)) && (foldCountryName(c.name).includes(q) || c.iso3.toLowerCase() === q))
      .slice(0, 2);
  }, [publicScreenUnavailable, markets, trimmed]);

  const exact = matches.find((m) => m.name.toLowerCase() === trimmed && m.screen_source !== "public_data");
  const canScoreNew = trimmed.length >= 3 && !exact;
  const partialStart = matches.length + screenMatches.length;
  const scoreNewIndex = partialStart + partialMatches.length;
  const rows = scoreNewIndex + (canScoreNew ? 1 : 0);

  useEffect(() => setCursor(0), [trimmed]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (i: number) => {
    if (i < matches.length) {
      onSelect(matches[i].id);
    } else if (i < partialStart) {
      onSelectScreen?.(screenMatches[i - matches.length]);
    } else if (i < scoreNewIndex) {
      onScoreNew(partialMatches[i - partialStart].name); // opens the form; the tracker's three bands prefill there
    } else if (canScoreNew) {
      onScoreNew(q.trim());
    }
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} data-testid="market-finder" className="relative print:hidden">
      <label className="block">
        <span className="block text-[17px] font-bold text-ink">{label}</span>
        <span className="block text-[15px] text-muted">Type a name to open its decision. Not in the list? You can score it.</span>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            data-testid="finder-input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(rows - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter" && rows > 0) {
                e.preventDefault();
                pick(cursor);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="e.g. Mexico, Kenya, Vietnam"
            role="combobox"
            aria-expanded={open && rows > 0}
            aria-controls="finder-results"
            aria-autocomplete="list"
            className="min-h-[54px] w-full rounded-btn border-1.5 border-rule bg-surface py-3 pl-12 pr-4 text-[17px] text-ink outline-none placeholder:text-muted transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-lift"
          />
        </div>
      </label>
      {open && rows > 0 && (
        <ul id="finder-results" role="listbox" data-testid="finder-results" className="pop-in absolute left-0 right-0 z-30 mt-2 max-h-96 overflow-y-auto rounded-card border-1.5 border-rule bg-surface py-2 shadow-float">
          {matches.map((m, i) => {
            const v = verdictOf(m.id);
            return (
              <li
                key={m.id}
                role="option"
                aria-selected={i === cursor}
                data-testid={`finder-option-${m.id}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(i);
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 min-h-[48px] ${i === cursor ? "bg-surface-2" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[17px] text-ink">{m.name}</span>
                  {m.id === selectedId && <span className="text-[14px] text-muted">selected</span>}
                  {m.user_added && <span className="text-[14px] text-plum">your entry</span>}
                  {m.research_source === "round2" && <span className="text-[14px] text-coral-strong">R2 research</span>}
                  {m.screen_source === "public_data" && (
                    <span className="text-[14px]" style={{ color: SCREEN_COLOR }}>
                      screen
                    </span>
                  )}
                </span>
                {v && <VerdictChip verdict={v.verdict} label={v.label} />}
              </li>
            );
          })}
          {screenMatches.map((c, j) => {
            const i = matches.length + j;
            return (
              <li
                key={`screen-${c.iso3}`}
                role="option"
                aria-selected={i === cursor}
                data-testid={`finder-screen-${c.iso3.toLowerCase()}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(i);
                }}
                title="Coarse bands from the Atlantic Council crypto-regulation tracker and Chinn-Ito. A shortlist signal, not a decision."
                className={`flex cursor-pointer items-center justify-between gap-3 border-t border-rule px-4 py-2.5 min-h-[48px] ${i === cursor ? "bg-surface-2" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[17px] text-ink">{c.name}</span>
                  <span className="rounded-chip border px-1.5 py-0.5 text-[14px]" style={{ color: SCREEN_COLOR, borderColor: SCREEN_COLOR }}>
                    {PUBLIC_SCREEN_LABEL}
                  </span>
                </span>
                <span className="text-[14px] text-muted">pre-screened, not researched</span>
              </li>
            );
          })}
          {partialMatches.map((c, j) => {
            const i = partialStart + j;
            return (
              <li
                key={`partial-${c.iso3}`}
                role="option"
                aria-selected={i === cursor}
                data-testid={`finder-screen-unavailable-${c.iso3.toLowerCase()}`}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(i);
                }}
                title={`${c.reason}. Selecting opens "Score a new market" with legality, licence and clarity prefilled from the tracker; set FX / custody yourself.`}
                className={`flex cursor-pointer items-center justify-between gap-3 border-t border-rule px-4 py-2.5 min-h-[48px] ${i === cursor ? "bg-surface-2" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[17px] text-ink">{c.name}</span>
                  <span className="rounded-chip border border-rule px-1.5 py-0.5 text-[14px] text-muted">{PUBLIC_SCREEN_UNAVAILABLE_LABEL}</span>
                </span>
                <span className="text-[14px] text-muted">score it — 3 of 5 prefilled</span>
              </li>
            );
          })}
          {canScoreNew && (
            <li
              role="option"
              aria-selected={cursor === scoreNewIndex}
              data-testid="finder-score-new"
              onMouseEnter={() => setCursor(scoreNewIndex)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(scoreNewIndex);
              }}
              className={`flex cursor-pointer items-center gap-2 border-t border-rule px-4 py-2.5 min-h-[48px] text-[17px] ${cursor === scoreNewIndex ? "bg-surface-2" : ""}`}
            >
              <span className="text-coral-strong">+</span>
              <span className="text-ink">
                Score <span className="font-medium">{q.trim()}</span> as a new market
              </span>
              <span className="ml-auto text-[14px] text-muted">not in Round 1</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
