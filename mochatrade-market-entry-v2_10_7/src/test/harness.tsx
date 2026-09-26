// Shared helpers for tests that drive the multi-page app (v2.9.0). The old
// suites rendered <Dashboard /> and found everything on one screen; these
// render the real <App /> (provider + router) and move between pages by hash,
// exactly as a user clicking links would.
import { act, render, screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import App from "../App";
import { navigate } from "../router";

type User = ReturnType<typeof userEvent.setup>;

/**
 * Mount the app at a route. Resets the hash first so tests never inherit one.
 * Defaults to #/markets: the search, the market table, compare ticks and
 * "Score a new market" all live there. Home (#/) is a welcome page with no data.
 */
export function renderApp(hash = "#/markets") {
  window.history.replaceState(null, "", hash);
  return render(<App />);
}

/** Navigate to a route (same as following a link). */
export function go(hash: string): void {
  act(() => navigate(hash));
}

/** The Markets page's table order, as market ids (goes to #/markets if needed). */
export function queueOrder(): string[] {
  if (!screen.queryByTestId("market-selector")) go("#/markets");
  return within(screen.getByTestId("market-selector"))
    .getAllByTestId(/^market-/)
    .map((el) => el.dataset.testid!.replace("market-", ""));
}

/** The plan on #/plan, in engine order, as market ids (goes to #/plan if needed). */
export function planOrder(): string[] {
  if (!screen.queryByTestId("home-plan")) go("#/plan");
  return screen.getAllByTestId(/^plan-row-/).map((el) => el.dataset.testid!.replace("plan-row-", ""));
}

/** Open a market the way a user does: from the Markets table, then optionally a tab. */
export async function openMarket(user: User, id: string, tab?: string): Promise<void> {
  if (!screen.queryByTestId("market-selector")) go("#/markets");
  await user.click(screen.getByTestId(`market-${id}`));
  if (tab) await user.click(screen.getByTestId(`tab-${tab}`));
}

/** Switch tab on the current market page. */
export async function openTab(user: User, tab: string): Promise<void> {
  await user.click(screen.getByTestId(`tab-${tab}`));
}
