import { useEffect, useMemo } from "react";
import type { ReactElement } from "react";
import { ArrowRight } from "lucide-react";
import { useAppState } from "../state/AppState";
import { Link, marketHref, navigate } from "../router";
import { PageFrame } from "./Layout";
import { useDecisions } from "./shared";
import PixelBand, { BandSwatch } from "../components/ui/PixelBand";

const GUIDE: Array<{ to: string; title: string; text: string; testId: string }> = [
  { to: "#/plan", title: "The plan", text: "The markets we would enter, in order, and when.", testId: "guide-plan" },
  { to: "#/markets", title: "Any market", text: "Its decision, what must be true before launch, its risks, and a one-page brief to download.", testId: "guide-markets" },
  { to: "#/method", title: "How we decided", text: "The five questions, their weights, and why the top scorer is not always first.", testId: "guide-method" },
];

/**
 * Welcome (#/): the title page, built to open a presentation. The
 * question, one way in, and the brand's pixel band made from the real data
 * (one column per scored country). No tables or verdicts -- those live on
 * #/plan and #/markets. The → key goes to the plan, for presenting.
 */
export default function Home(): ReactElement {
  const { ranking, sequence } = useAppState();
  const decisions = useDecisions();
  const planIds = useMemo(() => new Set(sequence.map((s) => s.market.id)), [sequence]);

  useEffect(() => {
    // Presenting: → , Enter, Space or PageDown (the keys a clicker sends) all
    // go to the plan. Keys reach the page only once it has focus, so take
    // focus on load -- after typing the URL, focus can still be in the
    // address bar, which is why "press → to start" looked broken.
    const START_KEYS = new Set(["ArrowRight", "Enter", " ", "Spacebar", "PageDown"]);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!START_KEYS.has(e.key) || e.altKey || e.metaKey || e.ctrlKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Enter / Space on a focused link or button must keep their normal meaning.
      if ((e.key === "Enter" || e.key === " " || e.key === "Spacebar") && t && /^(A|BUTTON)$/.test(t.tagName)) return;
      e.preventDefault();
      navigate("#/plan");
    };
    window.addEventListener("keydown", onKey);
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div>
      <section data-testid="welcome" className="flex min-h-[calc(100svh-64px)] flex-col md:min-h-[calc(100svh-80px)]">
        <PageFrame className="flex flex-1 flex-col justify-center py-10 md:py-12">
          <div data-testid="welcome-copy">
            <p className="rise text-[15px] font-bold text-coral-strong md:text-[16px]">Market entry readiness</p>
            <h1 className="mt-5 max-w-[13em] font-display text-[52px] font-normal leading-[1.02] tracking-[-0.025em] sm:text-[72px] xl:text-[88px]" style={{ fontVariationSettings: '"SOFT" 0, "WONK" 0, "opsz" 36' }}>
              <span className="rise block text-ink" style={{ animationDelay: "60ms" }}>Where should MochaTrade</span>{" "}
              <span className="rise block text-coral-strong" style={{ animationDelay: "140ms" }}>go next?</span>
            </h1>
            <p style={{ animationDelay: "220ms" }} className="rise mt-7 max-w-[34em] text-[19px] leading-relaxed text-ink-2 md:text-[21px]">
              MochaTrade lets Indians trade US stocks and crypto, funded by UPI. We scored {ranking.length} countries on the same five questions to decide where it launches next, and in what order.
            </p>
            <div style={{ animationDelay: "300ms" }} className="rise mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 print:hidden">
              <Link to="#/plan" data-testid="see-plan" className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-btn bg-coral-strong px-8 text-[19px] font-bold text-white transition-colors hover:bg-ink">
                See the plan <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link to="#/markets" data-testid="check-country" className="link inline-flex min-h-[44px] items-center text-[18px] font-bold">
                or check a country
              </Link>
              <span className="hidden text-[15px] text-muted lg:inline">
                Presenting? Press <kbd className="rounded-[6px] border-1.5 border-rule bg-surface px-1.5 py-0.5 font-sans text-[14px] text-ink-2">→</kbd> or <kbd className="rounded-[6px] border-1.5 border-rule bg-surface px-1.5 py-0.5 font-sans text-[14px] text-ink-2">Enter</kbd> to start.
              </span>
            </div>
          </div>
        </PageFrame>

        <div className="mt-auto print:hidden">
          <div className="mx-auto max-w-[1440px] px-2 md:px-6">
            <PixelBand ranking={ranking} planIds={planIds} decisions={decisions} onOpen={(id) => navigate(marketHref(id))} className="hidden md:block" />
            <PixelBand ranking={ranking} planIds={planIds} decisions={decisions} onOpen={(id) => navigate(marketHref(id))} compact className="px-3 md:hidden" />
          </div>
          <PageFrame className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-rule py-5 text-[15px] text-muted">
            <span>
              Each column is one of the {ranking.length} countries we scored, tallest score first. The rust ones are the plan. Hover or tap a column to see which country it is.
            </span>
            <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="inline-flex items-center gap-2"><BandSwatch tone="plan" /> In the plan</span>
              <span className="inline-flex items-center gap-2"><BandSwatch tone="short" /> Shortlist</span>
              <span className="inline-flex items-center gap-2"><BandSwatch tone="rest" /> Not now</span>
            </span>
          </PageFrame>
        </div>
      </section>

      <section id="how" aria-labelledby="how-title" className="scroll-mt-24 border-t border-rule pb-24 pt-16">
        <PageFrame>
          <h2 id="how-title" className="font-display text-[30px] font-normal leading-tight text-ink md:text-[36px]" style={{ fontVariationSettings: '"SOFT" 0, "WONK" 0, "opsz" 36' }}>
            Finding your way around
          </h2>
          <ul className="mt-8 border-t border-rule">
            {GUIDE.map((g) => (
              <li key={g.to} className="border-b border-rule">
                <Link to={g.to} data-testid={g.testId} className="row-card group -mx-4 grid gap-1 px-4 py-6 md:grid-cols-[260px_minmax(0,1fr)_auto] md:items-baseline md:gap-8">
                  <span className="font-display text-[26px] text-ink group-hover:text-coral-strong" style={{ fontVariationSettings: '"SOFT" 0, "WONK" 0, "opsz" 36' }}>
                    {g.title}
                  </span>
                  <span className="max-w-[42em] text-[17px] leading-relaxed text-ink-2">{g.text}</span>
                  <ArrowRight className="row-arrow hidden h-5 w-5 text-muted group-hover:text-coral-strong md:block" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-[44em] text-[16px] leading-relaxed text-muted">
            Terms like VARA, SPSAV or Pix are underlined wherever they appear; hover or focus one for a plain-English definition.
          </p>
        </PageFrame>
      </section>
    </div>
  );
}
