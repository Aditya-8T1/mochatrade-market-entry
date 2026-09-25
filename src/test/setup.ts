import "@testing-library/jest-dom/vitest";

/**
 * Node >= 25 defines a global `localStorage` (Web Storage API) that is
 * `undefined` unless Node is started with --localstorage-file. Vitest's jsdom
 * environment only copies window properties that are NOT already on the
 * global object, so on those Node versions `window.localStorage` ends up
 * undefined and every test that touches storage throws. Install a plain
 * in-memory Storage in that case so the suite is independent of the Node
 * version. On Node 20-24 jsdom's own localStorage is left untouched.
 */
function memoryStorage(): Storage {
  let data = new Map<string, string>();
  const s = {
    get length() {
      return data.size;
    },
    clear: () => {
      data = new Map();
    },
    getItem: (k: string) => (data.has(String(k)) ? (data.get(String(k)) as string) : null),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    removeItem: (k: string) => {
      data.delete(String(k));
    },
    setItem: (k: string, v: string) => {
      data.set(String(k), String(v));
    },
  };
  return s as Storage;
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  const w = globalThis as unknown as Record<string, unknown> & { window?: Record<string, unknown> };
  const current = w.window?.[name] as Partial<Storage> | undefined;
  if (typeof current?.getItem !== "function") {
    const store = memoryStorage();
    if (w.window) Object.defineProperty(w.window, name, { value: store, configurable: true, writable: true });
    Object.defineProperty(globalThis, name, { value: store, configurable: true, writable: true });
  }
}

/**
 * No test may depend on the real network. Files that care about a request
 * stub `fetch` themselves (vi.stubGlobal); the two Dashboard suites that
 * don't were silently hitting the live FX / World Bank / REST Countries
 * endpoints, and whether that succeeded, failed fast or timed out decided
 * whether an async state update landed inside a test (an "act(...)"
 * console.error, which those suites treat as a failure). Default to a
 * request that never settles, so an unstubbed fetch produces no state
 * update at all. vi.unstubAllGlobals() restores this default, not the
 * real fetch.
 */
Object.defineProperty(globalThis, "fetch", {
  value: () => new Promise<never>(() => {}),
  configurable: true,
  writable: true,
});

/** jsdom's URL has no object-URL methods; downloadBrief revokes on a 1s timer, after any per-test stub is gone. */
const urlAny = URL as unknown as Record<string, unknown>;
if (typeof urlAny.createObjectURL !== "function") urlAny.createObjectURL = () => "blob:jsdom";
if (typeof urlAny.revokeObjectURL !== "function") urlAny.revokeObjectURL = () => {};
