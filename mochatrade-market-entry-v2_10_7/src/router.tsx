// A small hash router -- no library. URLs look like /#/market/uae/risks and
// /#/method#order (a route, then an optional in-page anchor). Hash routing
// works on Vercel's static output without rewrites, so vercel.json is
// unchanged.
//
// navigate() updates location.hash AND notifies subscribers synchronously,
// so a click re-renders in the same tick (tests don't have to wait for the
// browser's async hashchange). The real hashchange event still drives
// back/forward, typed URLs and plain <a href> navigation.
import { forwardRef, useSyncExternalStore } from "react";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

export interface Route {
  /** The full hash, e.g. "#/market/uae/risks". */
  hash: string;
  /** Path segments: "#/market/uae/risks" -> ["market", "uae", "risks"]. Home is []. */
  segments: string[];
  /** The route part without the anchor: "/market/uae/risks". */
  path: string;
  /** In-page anchor after a second "#": "#/method#order" -> "order". */
  anchor: string | null;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const cut = raw.indexOf("#");
  const pathPart = cut === -1 ? raw : raw.slice(0, cut);
  const anchor = cut === -1 ? null : raw.slice(cut + 1) || null;
  const segments = pathPart
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  return { hash, segments, path: "/" + segments.join("/"), anchor };
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("hashchange", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("hashchange", cb);
  };
}

const getSnapshot = () => window.location.hash;
const getServerSnapshot = () => "";

// useSyncExternalStore needs a stable object per snapshot to avoid loops.
let lastHash: string | null = null;
let lastRoute: Route = parseHash("");

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (hash !== lastHash) {
    lastHash = hash;
    lastRoute = parseHash(hash);
  }
  return lastRoute;
}

/** Go to a hash route, e.g. navigate("#/market/uae"). Adds a history entry. */
export function navigate(to: string): void {
  const target = to.startsWith("#") ? to : `#${to}`;
  if (window.location.hash !== target) window.location.hash = target;
  listeners.forEach((l) => l());
}

export function marketHref(id: string, tab?: string): string {
  return `#/market/${encodeURIComponent(id)}${tab ? `/${tab}` : ""}`;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string };

/** A real <a href> that navigates without waiting for hashchange. Modified clicks (new tab etc.) are left to the browser. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, onClick, children, ...rest }, ref) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== "_self") return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a ref={ref} href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
});
