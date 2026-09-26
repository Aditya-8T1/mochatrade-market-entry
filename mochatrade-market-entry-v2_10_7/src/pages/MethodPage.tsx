import type { ReactElement } from "react";
import { useAppState } from "../state/AppState";
import { Link } from "../router";
import { PageFrame } from "./Layout";
import Panel from "../components/ui/Panel";
import WeightControls from "../components/WeightControls";
import RankingVsSequence from "../components/RankingVsSequence";
import GoGateTimeline from "../components/GoGateTimeline";
import RobustnessStrip from "../components/RobustnessStrip";
import { DIM_COLOR } from "../components/ui/dimensionColors";

const SECTIONS = [
  { id: "rubric", label: "The five questions" },
  { id: "order", label: "Why this order" },
  { id: "robustness", label: "Does it hold up?" },
  { id: "data", label: "Where the data comes from" },
];

/** How we decided: the rubric and weights, the order, its robustness and the data sources. Anchors: #rubric, #order, #robustness, #data. */
export default function MethodPage(): ReactElement {
  const { engine, weights, dimensions, presets, provenance, setPreset, setDimensionWeight, resetWeights, rankVsSeqItems, sequence, robustness, ranking } = useAppState();
  const round2Count = ranking.filter((r) => r.market.research_source === "round2").length;

  return (
    <PageFrame className="pb-24 pt-12 md:pt-16">
      <p className="text-[15px] font-bold text-coral-strong">How we decided</p>
      <h1 className="display-h1 mt-3 max-w-[14em] text-[52px] font-semibold text-ink md:text-[72px]">Same five questions for every country.</h1>
      <nav aria-label="On this page" className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-y border-rule py-4 print:hidden">
        {SECTIONS.map((s) => (
          <Link key={s.id} to={`#/method#${s.id}`} className="link inline-flex min-h-[44px] items-center text-[16px] font-bold">
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="mt-16 space-y-20">
        <Panel id="rubric" label="The five questions" intro="Every market gets a 1–5 score on each question. The weights say how much each one counts; move them and every page updates.">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
            <ol className="space-y-6">
              {engine.getDimensions().map((d, i) => (
                <li key={d.key} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-rule pb-6">
                  <span aria-hidden="true" className="font-display text-[26px] font-semibold text-coral">{i + 1}.</span>
                  <span>
                    <span className="block font-display text-[24px] font-semibold text-ink">{d.label}</span>
                    <span className="mt-1 block text-[17px] leading-relaxed text-ink-2">{d.definition}</span>
                  </span>
                  <span className="text-[20px] font-bold tabular" style={{ color: DIM_COLOR[d.key] }}>
                    {Math.round(weights[d.key] * 100)}%
                  </span>
                </li>
              ))}
            </ol>
            <div className="rounded-card border-1.5 border-rule bg-surface p-6 shadow-lift md:p-8 lg:sticky lg:top-28 lg:self-start print:hidden">
              <h3 className="font-display text-[24px] font-semibold text-ink">Try other weights</h3>
              <div className="mt-5">
                <WeightControls presets={presets} weights={weights} provenance={provenance} dimensions={dimensions} onPreset={setPreset} onDrag={setDimensionWeight} onReset={resetWeights} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel id="order" label="Why the top scorer isn't always first" intro="The entry order is the score minus the cost of getting in: how much the product has to change, and how much we depend on partners. That is why the order can differ from the ranking.">
          <RankingVsSequence items={rankVsSeqItems} />
          <h3 className="mt-16 font-display text-[26px] font-semibold text-ink">The 18-month plan</h3>
          <p className="mt-2 max-w-[68ch] text-[17px] leading-relaxed text-ink-2">Each market's launch window, the go-gates that must pass first, and what we do if it slips.</p>
          <div className="mt-8">
            <GoGateTimeline sequence={sequence} />
          </div>
        </Panel>

        <Panel id="robustness" label="Does the order hold up?" intro="We re-ran the plan under four different weightings. A stable order is a stronger recommendation than any single score.">
          <RobustnessStrip report={robustness} />
        </Panel>

        <Panel id="data" label="Where the data comes from">
          <div className="max-w-[68ch] space-y-5 text-[17px] leading-relaxed text-ink-2">
            <p>
              <span className="font-bold text-ink">The Round 1 deck.</span> Nine markets, scored by the team on the five questions, with deep dives for the three that cleared. The tool reproduces every deck score exactly.
            </p>
            <p>
              <span className="font-bold text-ink">The Round 2 research workbook.</span> {round2Count} more markets, each with sources. Every claim carries an evidence tag: <span className="font-bold text-now">[V]</span> verified, <span className="font-bold text-later">[A]</span> assumption or limited evidence, <span className="font-bold text-next">[D]</span> derived by the researcher. Round 2 markets are ranked but never put into the plan until their entry route is defined.
            </p>
            <p>
              <span className="font-bold text-ink">The public-data screen.</span> A coarse first pass for countries nobody has researched yet, built from the Atlantic Council crypto-regulation tracker and the Chinn-Ito capital-openness index. It can only ever say “shortlist, research first”, never “enter”.
            </p>
            <p>
              <span className="font-bold text-ink">Live lookups.</span> When you score a new market, country facts come from REST Countries and market size from the World Bank. Capital figures are converted to dollars with a live FX feed. Each one falls back to a dated snapshot if the network is down, and says so.
            </p>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}
