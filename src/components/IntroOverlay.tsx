import type { ReactElement } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

/** First-run "how to read this" — three sentences, dismissable, never shown again. */
export default function IntroOverlay({ onClose }: { onClose: () => void }): ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="w-full max-w-lg border border-line bg-ink-800 shadow-panel">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="intro-title" className="font-display text-base font-semibold text-paper">
            How to read this tool
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-paper-faint hover:text-paper">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-paper-dim">
          <p>
            <span className="text-paper">MochaTrade</span> is an Indian app for US stocks and crypto perpetuals, funded through UPI. This tool answers one question: <span className="text-paper">which country next, and how?</span>
          </p>
          <p>
            Type a country in the box at the top. If it is one of the nine we screened you get its decision straight away — enter now, next, later, or not — with the entry route and what must be true before launch. If it is not, you can score it and the tool ranks and sequences it the same way. Everything below the decision is the evidence: the score across five rubric dimensions, why the entry order is not the score order, the 18-month plan, risks and the compliance checklist. Export brief downloads the selected market as a one-page Markdown file for the legal or ops team.</p>
          <p>
            Drag the weight sliders to test your own priorities, tick markets to compare them, or add a country that was not screened. Any term you do not recognise (VARA, SPSAV, Pix…) is underlined — hover it for a one-line definition.
          </p>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-3">
          <button data-testid="intro-close" onClick={onClose} className="rounded-sm border border-signal-cyan/60 bg-signal-cyan/10 px-3 py-1.5 font-mono text-[13px] text-signal-cyan">
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
