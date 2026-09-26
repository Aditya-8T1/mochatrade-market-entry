// The app shell: shared state provider, top nav, and a small hash router
// over four pages. Every page reads from useAppState() / the engine --
// nothing here is hardcoded, and nothing imports src/engine/scoring.ts or
// sequencing.ts directly.
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { AppStateProvider } from "./state/AppState";
import { useRoute } from "./router";
import { TopNav } from "./pages/Layout";
import Home from "./pages/Home";
import PlanPage from "./pages/PlanPage";
import MarketsPage from "./pages/MarketsPage";
import MarketPage, { NotFound } from "./pages/MarketPage";
import ComparePage from "./pages/ComparePage";
import MethodPage from "./pages/MethodPage";

function Routes(): ReactElement {
  const route = useRoute();
  const [head, id, tab] = route.segments;
  const mainRef = useRef<HTMLElement>(null);
  const prev = useRef<{ path: string; anchor: string | null } | null>(null);

  // Scroll to top on a new page, to the anchor when there is one, and move
  // focus to <main> so screen-reader users land on the new content. Switching
  // tabs on the same market keeps the scroll position.
  useEffect(() => {
    const before = prev.current;
    prev.current = { path: route.path, anchor: route.anchor };
    if (!before) {
      if (route.anchor) document.getElementById(route.anchor)?.scrollIntoView?.();
      return;
    }
    if (route.anchor) {
      document.getElementById(route.anchor)?.scrollIntoView?.({ block: "start" });
      return;
    }
    const sameMarket = head === "market" && before.path.split("/")[2] === id && before.path.startsWith("/market/");
    if (before.path !== route.path && !sameMarket) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [route.path, route.anchor, head, id]);

  let page: ReactElement;
  if (route.segments.length === 0) page = <Home />;
  else if (head === "plan" && route.segments.length === 1) page = <PlanPage />;
  else if (head === "markets" && route.segments.length === 1) page = <MarketsPage />;
  else if (head === "market" && id) page = <MarketPage id={id} tab={tab} />;
  else if (head === "compare") page = <ComparePage />;
  else if (head === "method") page = <MethodPage />;
  else page = <NotFound what="that page" />;

  // Re-key per page (not per tab) so a new page eases in, while switching tabs on one market stays put.
  const pageKey = head === "market" ? `market/${id}` : head ?? "home";
  return (
    <main ref={mainRef} tabIndex={-1} className="outline-none">
      <div key={pageKey} className="page-enter">
        {page}
      </div>
    </main>
  );
}

export default function App(): ReactElement {
  return (
    <AppStateProvider>
      <div className="min-h-screen bg-canvas text-ink">
        <a href="#main-skip" onClick={(e) => { e.preventDefault(); document.querySelector("main")?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-4 focus:py-3 focus:font-bold">
          Skip to content
        </a>
        <TopNav />
        <Routes />
      </div>
    </AppStateProvider>
  );
}
