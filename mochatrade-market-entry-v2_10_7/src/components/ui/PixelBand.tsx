import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Link, marketHref } from "../../router";
import { VerdictChip } from "./verdict";
import { formatScore } from "../../engine";
import type { Decision, RankedMarket } from "../../engine/types";

// The brand's pixel band, rebuilt from the data: one column per scored
// market, tallest score first. Height = screening score out of 5. Markets in
// the plan are rust, a shortlist is a pale rust tint, the rest are the page's
// rule colour. Scattered pixels above each column echo the brand image's fade.

const PX = 6; // pixel size
const GAP = 3; // gap between pixels
const PITCH = PX + GAP;
const ROWS = 14; // a 5.0 score fills every row
const HAZE = 3; // rows of scattered pixels above a column

type Tone = "plan" | "short" | "rest";

const FILL: Record<Tone, { main: string; alt: string; top: string }> = {
  plan: { main: "#C0553A", alt: "#E0663A", top: "#7A3624" },
  short: { main: "#EBC7B6", alt: "#E2D2C6", top: "#EBC7B6" },
  rest: { main: "#E4DDD0", alt: "#D9D0C1", top: "#E4DDD0" },
};

/** Small deterministic PRNG so the texture is identical on every render. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h;
}

/**
 * `compact` draws each market one pixel wide (phones); otherwise three wide.
 * Interaction: hover (mouse) or first tap (touch) spotlights a column and
 * floats a card with its name, score and verdict; a click, or a tap on the
 * card, opens the market. Tapping elsewhere dismisses it.
 */
export default function PixelBand({ ranking, planIds, decisions, compact = false, className = "", onOpen }: { ranking: RankedMarket[]; planIds: Set<string>; decisions: Map<string, Decision>; compact?: boolean; className?: string; onOpen?: (id: string) => void }): ReactElement {
  const [active, setActive] = useState<string | null>(null);
  const lastPointer = useRef<string>("mouse");
  const wrapRef = useRef<HTMLDivElement>(null);

  // A tap outside the band dismisses the floating card.
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  const WIDE = compact ? 1 : 3; // pixels per market column
  const SPACE = 1; // empty pixel slots between markets
  const slots = ranking.length * (WIDE + SPACE) - SPACE;
  const width = slots * PITCH - GAP;
  const height = (ROWS + HAZE) * PITCH - GAP;
  const plan = ranking.filter((r) => planIds.has(r.market.id)).map((r) => r.market.name);
  const colW = WIDE * PITCH - GAP;

  const activeIdx = active ? ranking.findIndex((r) => r.market.id === active) : -1;
  const activeMarket = activeIdx >= 0 ? ranking[activeIdx] : null;
  let tip: ReactElement | null = null;
  if (activeMarket) {
    const lit = Math.max(1, Math.round((activeMarket.screening.weightedScore / 5) * ROWS));
    const cx = ((activeIdx * (WIDE + SPACE) * PITCH + colW / 2) / width) * 100;
    const top = ((height - lit * PITCH) / height) * 100;
    // Near an edge, anchor the card to that edge of its column so it never leaves the screen.
    const shift = cx < 18 ? "0%" : cx > 82 ? "-100%" : "-50%";
    const left = cx < 18 ? `max(calc(${cx}% - 10px), 4px)` : cx > 82 ? `min(calc(${cx}% + 10px), calc(100% - 4px))` : `${cx}%`;
    const d = decisions.get(activeMarket.market.id);
    // Outer element positions (its own transform); the inner link animates, so the two transforms never fight.
    tip = (
      <div className="absolute z-10" style={{ left, top: `${top}%`, transform: `translate(${shift}, calc(-100% - 12px))` }}>
      <Link
        to={marketHref(activeMarket.market.id)}
        data-testid="band-tip"
        className="pop-in press block w-max max-w-[240px] rounded-chip border-1.5 border-rule bg-surface px-3.5 py-2.5 text-left shadow-float"
        style={{ transformOrigin: "bottom center" }}
      >
        <span className="block font-display text-[19px] font-semibold leading-tight text-ink">{activeMarket.market.name}</span>
        <span className="mt-1 flex items-center gap-2 text-[14px] text-ink-2">
          <span className="tabular">{formatScore(activeMarket.screening.weightedScore)} / 5</span>
          {d && <VerdictChip verdict={d.verdict} label={d.verdictLabel} className="!px-2 !py-0.5 !text-[13px]" />}
        </span>
        <span className="mt-1 block text-[13px] font-bold text-coral-strong">{lastPointer.current === "touch" ? "Tap to open" : "Click to open"}</span>
      </Link>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`} onPointerLeave={(e) => e.pointerType !== "touch" && setActive(null)}>
    <svg
      data-testid={compact ? "pixel-band-compact" : "pixel-band"}
      viewBox={`0 0 ${width} ${height}`}
      className="block h-auto w-full"
      data-band-active={active ? "" : undefined}
      role="img"
      aria-label={`${ranking.length} scored countries as columns, tallest score first. In the plan: ${plan.join(", ")}.`}
    >
      {ranking.map((r, i) => {
        const tone: Tone = planIds.has(r.market.id) ? "plan" : r.market.cleared ? "short" : "rest";
        const f = FILL[tone];
        const score = r.screening.weightedScore;
        const lit = Math.max(1, Math.round((score / 5) * ROWS));
        const rand = rng(hash(r.market.id));
        const x0 = i * (WIDE + SPACE) * PITCH;
        const d = decisions.get(r.market.id);
        const cells: ReactElement[] = [];
        for (let c = 0; c < WIDE; c++) {
          for (let row = 0; row < lit + HAZE; row++) {
            const fromBottom = row; // 0 = bottom row
            const y = height - PX - fromBottom * PITCH;
            const x = x0 + c * PITCH;
            if (row < lit) {
              const isTop = row === lit - 1;
              const alt = rand() < (tone === "plan" ? 0.14 : 0.1);
              const fill = isTop && tone === "plan" && c === Math.floor(WIDE / 2) ? f.top : alt ? f.alt : f.main;
              cells.push(<rect key={`${c}-${row}`} x={x} y={y} width={PX} height={PX} fill={fill} />);
            } else {
              // haze: fewer and dimmer the higher it gets
              const k = row - lit + 1;
              if (rand() < 0.5 / k) cells.push(<rect key={`${c}-${row}`} x={x} y={y} width={PX} height={PX} fill={tone === "plan" ? "#E0663A" : "#E4DDD0"} opacity={1 - k * 0.18} />);
            }
          }
        }
        return (
          <g
            key={r.market.id}
            data-band-market={r.market.id}
            data-tone={tone}
            data-active={active === r.market.id ? "" : undefined}
            className="pixel-col cursor-pointer"
            style={{ animationDelay: `${320 + i * 22}ms` }}
            onPointerDown={(e) => (lastPointer.current = e.pointerType)}
            onPointerEnter={(e) => e.pointerType !== "touch" && setActive(r.market.id)}
            onClick={() => {
              // Touch: first tap previews, second tap (or a tap on the card) opens. Mouse: click opens.
              if (lastPointer.current === "touch" && active !== r.market.id) setActive(r.market.id);
              else onOpen?.(r.market.id);
            }}
          >
            <title>{`${r.market.name}: ${formatScore(score)} / 5${d ? `, ${d.verdictLabel}` : ""}`}</title>
            {/* invisible full-height hit area, so the gaps between pixels are still tappable */}
            <rect x={x0 - GAP / 2} y={0} width={colW + GAP} height={height} fill="transparent" />
            {cells}
          </g>
        );
      })}
    </svg>
    {tip}
    </div>
  );
}

/** Legend swatch in the band's colours. */
export function BandSwatch({ tone }: { tone: Tone }): ReactElement {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0" style={{ backgroundColor: FILL[tone].main, outline: undefined }} />;
}
