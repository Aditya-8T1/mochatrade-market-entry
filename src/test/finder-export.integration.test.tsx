import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../screens/Dashboard";
import { engine } from "../engine";
import { buildBrief, briefFileName } from "../export/brief";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("market finder (front door)", () => {
  it("is the first thing in the main column and shows each match with its verdict", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    const main = screen.getByRole("main");
    expect(main.firstElementChild).toHaveAttribute("data-testid", "market-finder");
    await user.type(screen.getByTestId("finder-input"), "bra");
    const opt = await screen.findByTestId("finder-option-brazil");
    expect(opt).toHaveTextContent("Enter next");
    await user.click(opt);
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "go_next");
    expect((screen.getByTestId("finder-input") as HTMLInputElement).value).toBe("");
  });

  it("resolves aliases (dubai -> Dubai (UAE)) and Enter picks the first match", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(screen.getByTestId("market-brazil"));
    await user.type(screen.getByTestId("finder-input"), "dubai{Enter}");
    expect(screen.getByTestId("decision-card")).toHaveAttribute("data-verdict", "go_now");
  });

  it("offers to score an unknown country and opens the form with the name filled in", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.type(screen.getByTestId("finder-input"), "Mexico");
    expect(screen.queryByTestId(/finder-option-/)).toBeNull();
    await user.click(await screen.findByTestId("finder-score-new"));
    expect((screen.getByTestId("add-market-name") as HTMLInputElement).value).toBe("Mexico");
  });

  it("does not offer 'score new' for a name that already exists exactly", async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.type(screen.getByTestId("finder-input"), "Brazil");
    await screen.findByTestId("finder-option-brazil");
    expect(screen.queryByTestId("finder-score-new")).toBeNull();
  });
});

describe("brief export", () => {
  it("builds a Markdown brief that carries the decision, conditions, changes, risks and open items", () => {
    const w = engine.getDefaultWeights();
    const m = engine.getMarket("brazil")!;
    const text = buildBrief(m, engine.getDecision("brazil", w)!, engine.getMarketRecommendation("brazil", w)!, engine.getRisksForMarket("brazil"), new Date("2026-09-25T00:00:00Z"));
    expect(text).toContain("# Brazil — market entry brief");
    expect(text).toContain("## Decision: Enter next");
    expect(text).toContain("SPSAV route via BCB-authorised partner");
    expect(text).toContain("- [ ] Rebuild perpetuals as dated futures");
    expect(text).toContain("## Risks and mitigations");
    expect(text).toContain("_(route requires confirmation)_");
    expect(text).not.toMatch(/undefined|NaN|\[object/);
    expect(briefFileName(m, new Date("2026-09-25T00:00:00Z"))).toBe("mochatrade-brief-brazil-2026-09-25.md");
  });

  it("no-go brief says why not and has no compliance section", () => {
    const w = engine.getDefaultWeights();
    const text = buildBrief(engine.getMarket("vietnam")!, engine.getDecision("vietnam", w)!, engine.getMarketRecommendation("vietnam", w)!, engine.getRisksForMarket("vietnam"));
    expect(text).toContain("## Decision: Do not enter now");
    expect(text).toContain("## Why not");
    expect(text).not.toContain("## Product and compliance changes");
  });

  it("the Export brief button triggers a download of the selected market's file", async () => {
    const user = userEvent.setup();
    const created: string[] = [];
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      created.push(this.download);
    });
    render(<Dashboard />);
    await user.click(screen.getByTestId("market-indonesia"));
    await user.click(screen.getByTestId("export-brief"));
    await waitFor(() => expect(created[0]).toMatch(/^mochatrade-brief-indonesia-\d{4}-\d{2}-\d{2}\.md$/));
    click.mockRestore();
  });
});
