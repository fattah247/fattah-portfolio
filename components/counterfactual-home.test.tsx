import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CounterfactualHome } from "./counterfactual-home";
import { SystemShell } from "./system-shell";
import { WorkspaceManagerProvider } from "./workspace-manager";
import { scenarios } from "../lib/scenarios";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push }),
}));

function installBrowserStubs(reducedMotion = false) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 960 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
      media: query,
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
}

function activeSelectedWindow() {
  return document.querySelector<HTMLElement>('.workspace-work-window[data-active-window="true"]')!;
}

describe("CounterfactualHome", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installBrowserStubs();
    push.mockReset();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders a usable workspace immediately without a blocking intro", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    expect(screen.queryByRole("region", { name: "Opening portfolio workspace" })).toBeNull();
    expect(screen.getByRole("region", { name: "Work window" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /View selected work/i })).toBeTruthy();
  });

  it("keeps the immediate workspace contract when reduced motion is requested", () => {
    installBrowserStubs(true);
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    expect(screen.queryByRole("region", { name: "Opening portfolio workspace" })).toBeNull();
    expect(screen.getByRole("region", { name: "Work window" })).toBeTruthy();
  });

  it("keeps the full Work journey discoverable from the identity to a selected entry", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    fireEvent.click(screen.getByRole("link", { name: /View selected work/i }));
    expect(screen.getByRole("heading", { name: "Three failures, three decisions." })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    expect(screen.getAllByText("A payment callback arrived twice").length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: /Open full case/i })).toBeTruthy();
  });

  it("opens and refocuses internal application links without navigating or duplicating UI", () => {
    const { container } = render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    const experienceLink = container.querySelector<HTMLAnchorElement>('.hero-secondary-actions a[href="/brief"]')!;

    fireEvent.click(experienceLink);
    fireEvent.click(experienceLink);

    expect(screen.getAllByRole("region", { name: "Experience window" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Experience window" }).getAttribute("data-active-window")).toBe("true");
    expect(window.location.pathname).toBe("/");
    expect(push).not.toHaveBeenCalled();
  });

  it("gives every selected-work entry its own readable state instrument", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: /View selected work/i }));
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    const workWindow = screen.getByRole("region", { name: "Work window" });
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo);

    expect(screen.getByLabelText("Two callback deliveries result in one payment state change")).toBeTruthy();
    scrollTo.mockClear();
    workWindow.scrollTop = 640;
    fireEvent.click(within(activeSelectedWindow()).getByRole("button", { name: "Next →" }));
    expect(screen.getByRole("region", { name: "Work window" })).toBe(workWindow);
    expect(screen.getByLabelText("Health passes while latency is degraded and an alert is present")).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 0 });
    expect(document.activeElement?.textContent).not.toBe("Next →");
    scrollTo.mockClear();
    workWindow.scrollTop = 640;
    fireEvent.click(within(activeSelectedWindow()).getByRole("button", { name: "Next →" }));
    expect(screen.getByRole("region", { name: "Work window" })).toBe(workWindow);
    expect(screen.getByLabelText("A suspected root signal and valid signature require confirmation for a high sensitivity action")).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 0 });
    expect(document.activeElement?.textContent).not.toBe("Next →");
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);
    expect(activeSelectedWindow().getAttribute("data-view")).toBe("summary");
  });

  it("hosts a directly loaded case inside the one Work application window", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome initialCaseSlug="trustgate" /></WorkspaceManagerProvider>);

    const workWindow = screen.getByRole("region", { name: "Work window" });
    expect(workWindow.getAttribute("data-view")).toBe("full-case");
    expect(within(workWindow).getByRole("heading", { name: scenarios[2].title })).toBeTruthy();
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);
  });

  it.each(scenarios)("maps the $slug index entry to its complete selected-work summary", (scenario) => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: new RegExp(scenario.consequence, "i") }));

    const selectedWindow = screen.getByRole("region", { name: "Work window" });
    expect(selectedWindow.getAttribute("data-view")).toBe("summary");
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);
    expect(selectedWindow.querySelector(`.selected-case-window-content[data-case="${scenario.slug}"]`)).toBeTruthy();
    expect(within(selectedWindow).getByRole("heading", { name: scenario.shortTitle })).toBeTruthy();
    expect(within(selectedWindow).getAllByText(scenario.consequence).length).toBeGreaterThan(0);
    expect(within(selectedWindow).getByText(scenario.decision)).toBeTruthy();
    const evidence = within(selectedWindow).getByAltText(scenario.evidence[0].alt);
    expect(evidence.closest(".selected-case-window-image")?.getAttribute("data-evidence-id")).toBe(`evidence-${scenario.slug}-01`);
    expect(within(selectedWindow).getByRole("link", { name: /Source code/i }).getAttribute("href")).toBe(scenario.repo);
  });

  it("replaces the selected-work summary with the full case and restores it through Back", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: /View selected work/i }));
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open full case/i }));

    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();
    expect(document.querySelector(".embedded-case-workspace")).toBeTruthy();
    expect(document.querySelector(".workspace-detail-layer")).toBeNull();
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "← Back to preview" }));
    act(() => vi.advanceTimersByTime(340));
    expect(document.querySelector('.workspace-work-window[data-view="summary"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open full case/i })).toBeTruthy();
  });

  it("restores the selected-work preview when browser history returns to the root route", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open full case/i }));

    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();
    const state = { portfolioView: "selected-work", slug: "payflow" };
    window.history.replaceState(state, "", "/#selected-work");
    fireEvent(window, new PopStateEvent("popstate", { state }));

    expect(document.querySelector('.workspace-work-window[data-view="summary"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open full case/i })).toBeTruthy();
  });

  it("opens the selected-work list directly from its hash without an overlay", () => {
    window.history.replaceState(null, "", "/#selected-work");
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    act(() => vi.advanceTimersByTime(20));

    expect(screen.queryByRole("region", { name: "Opening portfolio workspace" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Three failures, three decisions." })).toBeTruthy();
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled();
  });

  it("returns from a selected summary to the Work index without closing or duplicating Work", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 812 });
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));

    const workWindow = screen.getByRole("region", { name: "Work window" });
    expect(workWindow.getAttribute("data-view")).toBe("summary");
    fireEvent.click(within(workWindow).getByRole("button", { name: "← All work" }));

    expect(screen.getByRole("region", { name: "Work window" })).toBeTruthy();
    expect(workWindow.getAttribute("data-view")).toBe("index");
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);
  });

  it("normalizes route and detail state when the desktop titlebar closes a full case", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open full case/i }));
    expect(window.location.pathname).toBe("/case/payflow");

    fireEvent.click(screen.getByRole("button", { name: "Close work window" }));
    act(() => vi.advanceTimersByTime(340));

    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("");
    expect(screen.queryByRole("region", { name: "Work window" })).toBeNull();
  });

  it("preserves the compact Home, summary, full-case, evidence, and Back chain", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    render(
      <WorkspaceManagerProvider>
        <SystemShell />
        <CounterfactualHome />
      </WorkspaceManagerProvider>,
    );

    const phoneNavigation = within(screen.getByRole("navigation", { name: "Phone system navigation" }));
    const home = document.querySelector<HTMLElement>(".system-home-screen")!;
    fireEvent.click(phoneNavigation.getByRole("button", { name: "Home" }));
    expect(home.getAttribute("aria-hidden")).toBe("false");
    fireEvent.click(within(home).getByRole("button", { name: "Continue Work" }));
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    fireEvent.click(within(activeSelectedWindow()).getByRole("button", { name: /Open full case/i }));
    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();

    fireEvent.click(screen.getAllByText("Open evidence")[0].closest("button")!);
    const evidenceDialog = screen.getByRole("dialog", { name: /Exhibit 01\.1/i });
    expect(evidenceDialog.getAttribute("data-window-state")).toBe("active");

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Recents" }));
    const recents = document.querySelector<HTMLElement>(".system-recents")!;
    expect(recents.getAttribute("aria-hidden")).toBe("false");
    expect(evidenceDialog.getAttribute("data-window-state")).toBe("background");
    fireEvent.click(within(recents).getByRole("button", { name: "Switch to Work" }));
    expect(evidenceDialog.getAttribute("data-window-state")).toBe("active");

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole("dialog", { name: /Exhibit 01\.1/i })).toBeNull();
    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    act(() => vi.advanceTimersByTime(340));
    expect(document.querySelector('.workspace-work-window[data-view="summary"]')).toBeTruthy();

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    act(() => vi.advanceTimersByTime(340));
    expect(screen.getByRole("region", { name: "Work window" }).getAttribute("data-view")).toBe("index");

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    expect(home.getAttribute("aria-hidden")).toBe("false");
  });
});
