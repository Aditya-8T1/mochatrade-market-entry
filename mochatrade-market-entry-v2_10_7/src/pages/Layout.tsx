import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { HelpCircle, Menu, Printer, X } from "lucide-react";
import { Link, useRoute } from "../router";
import { useAppState } from "../state/AppState";

type NavKey = "home" | "plan" | "markets" | "compare" | "method";

const NAV: Array<{ key: NavKey; label: string; to: string }> = [
  { key: "home", label: "Home", to: "#/" },
  { key: "plan", label: "The plan", to: "#/plan" },
  { key: "markets", label: "Markets", to: "#/markets" },
  { key: "compare", label: "Compare", to: "#/compare" },
  { key: "method", label: "How we decided", to: "#/method" },
];

function activeKey(segments: string[]): NavKey | null {
  if (segments.length === 0) return "home";
  if (segments[0] === "plan") return "plan";
  if (segments[0] === "markets" || segments[0] === "market") return "markets";
  if (segments[0] === "compare") return "compare";
  if (segments[0] === "method") return "method";
  return null;
}

/** The bowl with three rising bars, from the Mochatrade logo. Stand-in: swap in the official SVG when you have it. */
export function LogoMark({ className = "" }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <rect x="6.2" y="7" width="2.2" height="4" rx="1.1" />
      <rect x="10.4" y="4.5" width="2.2" height="6.5" rx="1.1" />
      <rect x="14.6" y="2" width="2.2" height="9" rx="1.1" />
      <path d="M2.5 12.5h19a9.5 9.5 0 0 1-19 0z" />
    </svg>
  );
}

/** "Mocha" in the sans, "trade" in italic serif -- the Mochatrade wordmark. */
export function Wordmark({ className = "" }: { className?: string }): ReactElement {
  return (
    <span className={`inline-flex items-center gap-2 leading-none ${className}`}>
      <LogoMark className="h-[22px] w-[22px] -translate-y-[1px]" />
      <span className="text-[25px] tracking-[-0.01em]">
        <span className="font-sans font-medium">Mocha</span>
        <span className="font-display italic" style={{ fontVariationSettings: '"SOFT" 0, "WONK" 0', fontWeight: 400 }}>
          trade
        </span>
      </span>
    </span>
  );
}

const iconBtn = "press flex h-11 w-11 items-center justify-center rounded-btn text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-rule";

export function TopNav(): ReactElement {
  const route = useRoute();
  const { compareIds } = useAppState();
  const active = activeKey(route.segments);
  const [menuOpen, setMenuOpen] = useState(false);
  // Once the page scrolls, the header casts a soft shadow so it reads as floating above the content.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setMenuOpen(false), [route.hash]);


  const links = (mobile: boolean) =>
    NAV.map((n) => {
      const isActive = n.key === active;
      return (
        <Link
          key={n.key}
          to={n.to}
          aria-current={isActive ? "page" : undefined}
          className={
            mobile
              ? `press flex min-h-[52px] items-center border-b border-rule px-1 text-[19px] font-bold active:bg-surface-2 ${isActive ? "text-ink" : "text-ink-2"}`
              : `relative flex h-full items-center px-1 text-[16px] font-bold transition-colors ${isActive ? "text-ink" : "text-muted hover:text-ink"}`
          }
        >
          {n.label}
          {n.key === "compare" && compareIds.length > 0 && <span className="ml-1.5 tabular text-coral-strong">({compareIds.length})</span>}
          {!mobile && <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-[2px] origin-center bg-coral transition-transform duration-300 ${isActive ? "scale-x-100" : "scale-x-0"}`} />}
          {mobile && isActive && <span aria-hidden="true" className="ml-3 h-[2px] w-6 bg-coral" />}
        </Link>
      );
    });

  return (
    <header className={`sticky top-0 z-30 border-b bg-canvas/95 text-ink backdrop-blur-sm transition-[box-shadow,border-color] duration-300 print:static print:border-0 print:shadow-none ${scrolled || menuOpen ? "border-transparent shadow-header" : "border-rule"}`}>
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-6 px-5 md:h-20 md:px-10 xl:px-20">
        <Link to="#/" className="flex items-center" aria-label="Mochatrade, home">
          <Wordmark className="text-ink" />
        </Link>
        <nav aria-label="Main" className="hidden h-full items-stretch gap-6 lg:gap-8 md:flex print:hidden">
          {links(false)}
        </nav>
        <div className="flex items-center gap-1 print:hidden">
          <Link to="#/#how" title="How to find your way around" aria-label="How to find your way around" className={iconBtn}>
            <HelpCircle className="h-5 w-5" />
          </Link>
          <button onClick={() => window.print()} title="Print this page" aria-label="Print this page" className={`${iconBtn} hidden md:flex`}>
            <Printer className="h-5 w-5" />
          </button>
          <button onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-controls="mobile-nav" aria-label={menuOpen ? "Close menu" : "Open menu"} className={`${iconBtn} md:hidden`}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-nav" aria-label="Main" className="pop-in border-t border-rule bg-canvas px-5 pb-4 md:hidden">
          {links(true)}
          <button onClick={() => window.print()} className="flex min-h-[52px] w-full items-center gap-2 text-[17px] font-bold text-ink-2">
            <Printer className="h-5 w-5" aria-hidden="true" /> Print this page
          </button>
        </nav>
      )}
    </header>
  );
}

/** Page frame: 1280px max width, 80px side padding on desktop. */
export function PageFrame({ children, className = "" }: { children: ReactNode; className?: string }): ReactElement {
  return <div className={`mx-auto w-full max-w-page px-5 md:px-10 xl:px-20 ${className}`}>{children}</div>;
}
