import { useState } from "react";
import type { ReactElement } from "react";
import { Download, HelpCircle, Printer, Radio } from "lucide-react";
import { useMarketEntry } from "../hooks/useEngine";
import MarketSelector from "../components/MarketSelector";
import ScoreCard from "../components/ScoreCard";
import RankingVsSequence from "../components/RankingVsSequence";
import GoGateTimeline from "../components/GoGateTimeline";
import RiskPanel from "../components/RiskPanel";
import ComplianceChecklist from "../components/ComplianceChecklist";
import WeightControls from "../components/WeightControls";
import RecommendationSummary from "../components/RecommendationSummary";
import DecisionCard from "../components/DecisionCard";
import RobustnessStrip from "../components/RobustnessStrip";
import CompareView from "../components/CompareView";
import AddMarketForm from "../components/AddMarketForm";
import IntroOverlay from "../components/IntroOverlay";
import Panel from "../components/ui/Panel";
import MarketFinder from "../components/MarketFinder";
import { downloadBrief } from "../export/brief";
import { listPublicScreen, listPublicScreenUnavailable } from "../data-provider/publicScreenProvider";

const INTRO_KEY = "mochatrade.introSeen.v1";

function introSeen(): boolean {
  try {
    return window.localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return true;
  }
}

// P3 wiring: all state and every derived value (ranking, sequence,
// recommendation, decision, risks, divergence, robustness) comes from
// useMarketEntry(), the single integration hook over the P1 engine. This
// file only arranges P2's components; it holds no engine logic.
export default function Dashboard(): ReactElement {
  const {
    engine,
    weights,
    dimensions,
    presets,
    provenance,
    setPreset,
    setDimensionWeight,
    resetWeights,
    selectedId,
    setSelectedId,
    ranking,
    sequence,
    fullRecommendation,
    selectedMarket,
    selectedRecommendation,
    selectedRisks,
    rankVsSeqItems,
    selectedDecision,
    robustness,
    clearThreshold,
    addMarket,
    addPublicScreenMarket,
    removeMarket,
    compareIds,
    toggleCompare,
    clearCompare,
  } = useMarketEntry();

  const [showAdd, setShowAdd] = useState<false | { name: string }>(false);
  const [showIntro, setShowIntro] = useState(() => (typeof window === "undefined" ? false : !introSeen()));
  const [view, setView] = useState<"market" | "compare">("market");

  const closeIntro = () => {
    setShowIntro(false);
    try {
      window.localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!selectedMarket || !selectedRecommendation || !selectedDecision) {
    return <div className="p-8 text-paper-dim">No market selected.</div>;
  }

  const comparing = view === "compare";

  return (
    <div className="flex min-h-screen flex-col bg-ink-900 text-paper lg:h-screen print:h-auto">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 print:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-signal-cyan/50">
            <Radio className="h-3.5 w-3.5 text-signal-cyan" />
          </span>
          <div>
            <h1 className="font-display text-[15px] font-semibold leading-none text-paper">MochaTrade — Market Entry Readiness</h1>
            <p className="mt-1 font-mono text-[11px] leading-none text-paper-faint">Which country next, and how</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="hidden items-center gap-2 rounded-sm border border-signal-amber/30 bg-signal-amber/[0.06] px-3 py-1.5 md:flex"
            title={`The highest-scoring market ${fullRecommendation.scoreOrderMatchesSequence ? "is also" : "is not"} the first to enter.`}
          >
            <span className="font-mono text-[12px] text-signal-amber">
              {fullRecommendation.scoreOrderMatchesSequence ? "Entry order follows the score order" : "Highest score ≠ first to enter — see why below"}
            </span>
          </div>
          <div className="flex rounded-sm border border-line font-mono text-[12px]">
            <button data-testid="view-market" onClick={() => setView("market")} aria-pressed={!comparing} className={`px-2.5 py-1.5 ${!comparing ? "bg-signal-cyan/10 text-signal-cyan" : "text-paper-dim hover:text-paper"}`}>
              Selected market
            </button>
            <button data-testid="view-compare" onClick={() => setView("compare")} aria-pressed={comparing} className={`border-l border-line px-2.5 py-1.5 ${comparing ? "bg-signal-cyan/10 text-signal-cyan" : "text-paper-dim hover:text-paper"}`}>
              Compare{compareIds.length ? ` (${compareIds.length})` : ""}
            </button>
          </div>
          <button onClick={() => window.print()} title="Print or save this market's recommendation as PDF" className="rounded-sm border border-line p-1.5 text-paper-dim hover:text-paper" aria-label="Print">
            <Printer className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setShowIntro(true)} title="How to read this tool" className="rounded-sm border border-line p-1.5 text-paper-dim hover:text-paper" aria-label="How to read this tool">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[280px_1fr_340px] lg:grid-rows-1">
        <div className="order-2 border-y border-line lg:order-none lg:h-full lg:min-h-0 lg:border-y-0 lg:border-r print:hidden">
          <MarketSelector
            ranking={ranking}
            sequence={sequence}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setView("market");
            }}
            compareIds={compareIds}
            onToggleCompare={(id) => {
              toggleCompare(id);
              setView("compare");
            }}
            onAddMarket={() => setShowAdd({ name: "" })}
            onRemoveMarket={removeMarket}
          />
        </div>

        <main className="order-1 space-y-5 overflow-y-auto lg:order-none p-5 lg:h-full lg:min-h-0 print:h-auto print:overflow-visible">
          <MarketFinder
            markets={ranking.map((r) => r.market)}
            verdictOf={(id) => {
              const d = engine.getDecision(id, weights);
              return d ? { verdict: d.verdict, label: d.verdictLabel } : undefined;
            }}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setView("market");
            }}
            onScoreNew={(name) => setShowAdd({ name })}
            publicScreen={listPublicScreen()}
            publicScreenUnavailable={listPublicScreenUnavailable()}
            onSelectScreen={(c) => {
              void addPublicScreenMarket(c).then((m) => {
                setSelectedId(m.id);
                setView("market");
              });
            }}
          />
          {comparing ? (
            <Panel
              label="Compare markets"
              tag={
                compareIds.length ? (
                  <button onClick={clearCompare} className="font-mono text-[11px] text-paper-faint hover:text-paper">
                    clear
                  </button>
                ) : undefined
              }
            >
              <CompareView engine={engine} weights={weights} ids={compareIds} onRemove={toggleCompare} />
            </Panel>
          ) : (
            <>
              <Panel
                label="Decision"
                tag={
                  <button
                    data-testid="export-brief"
                    onClick={() => downloadBrief(selectedMarket, selectedDecision, selectedRecommendation, selectedRisks)}
                    title="Download this market's decision, conditions, product changes and risks as a Markdown brief"
                    className="flex items-center gap-1.5 rounded-sm border border-line px-2 py-1 font-mono text-[11px] text-paper-dim hover:border-line-strong hover:text-paper print:hidden"
                  >
                    <Download className="h-3 w-3" /> Export brief
                  </button>
                }
              >
                <DecisionCard decision={selectedDecision} market={selectedMarket} />
              </Panel>

              <Panel
                label={`Screening score · ${selectedMarket.name}`}
                tag={
                  <span className="font-mono text-[11px] text-paper-faint">
                    rank #{selectedRecommendation.rawRank} of {ranking.length}
                  </span>
                }
              >
                <ScoreCard rec={selectedRecommendation} userAdded={!!selectedMarket.user_added} screen={selectedMarket.screen_source === "public_data"} />
              </Panel>

              <Panel label="Why the entry order is not the score order">
                <RankingVsSequence items={rankVsSeqItems} />
              </Panel>

              <Panel label="Does the order hold under other weightings?">
                <RobustnessStrip report={robustness} />
              </Panel>

              <Panel label="18-month plan and go-gates">
                <GoGateTimeline sequence={sequence} />
              </Panel>
            </>
          )}
        </main>

        <aside className="order-3 space-y-5 border-t lg:order-none border-line p-5 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l print:h-auto print:overflow-visible">
          <Panel label={`Blockers, mitigations, open items · ${selectedMarket.name}`}>
            <RecommendationSummary rec={selectedRecommendation} screen={selectedMarket.screen_source === "public_data"} />
          </Panel>

          <Panel label={`Risks for ${selectedMarket.name}`}>
            <RiskPanel risks={selectedRisks} market={selectedMarket} />
          </Panel>

          <Panel label="Readiness checklist">
            <ComplianceChecklist market={selectedMarket} goGates={selectedRecommendation.goGates} />
          </Panel>

          <Panel label="What if we weighted the rubric differently?" className="print:hidden">
            <WeightControls presets={presets} weights={weights} provenance={provenance} dimensions={dimensions} onPreset={setPreset} onDrag={setDimensionWeight} onReset={resetWeights} />
          </Panel>
        </aside>
      </div>

      {showAdd && <AddMarketForm engine={engine} dimensions={dimensions} weights={weights} clearThreshold={clearThreshold} initialName={showAdd.name} onAdd={(m) => { addMarket(m); setSelectedId(m.id); setView("market"); }} onClose={() => setShowAdd(false)} />}
      {showIntro && <IntroOverlay onClose={closeIntro} />}
    </div>
  );
}
