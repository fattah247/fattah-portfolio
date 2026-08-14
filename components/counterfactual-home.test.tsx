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
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: vi.fn(() => false) });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
}

function activeSelectedWindow() {
  return document.querySelector<HTMLElement>('.workspace-work-window[data-active-window="true"]')!;
}

function openWorkFromDesktop() {
  fireEvent.click(screen.getByRole("link", { name: "Work" }));
}

describe("CounterfactualHome", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installBrowserStubs();
    push.mockReset();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.systemMode;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders a usable workspace immediately without a blocking intro", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    expect(screen.queryByRole("region", { name: "Opening portfolio workspace" })).toBeNull();
    expect(screen.getByRole("region", { name: "Engineering workspace" })).toBeTruthy();
    expect(document.querySelector(".desktop-wallpaper")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByText("Second Attempt")).toBeNull();
    expect(screen.queryByRole("link", { name: "Selected work" })).toBeNull();
    expect(document.querySelector(".desktop-object-copy small")).toBeNull();
    expect(screen.queryByRole("region", { name: "Work window" })).toBeNull();
    openWorkFromDesktop();
    expect(screen.getByRole("region", { name: "Work window" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /View selected work/i })).toBeTruthy();
  });

  it("restores desktop shortcut positions for the current browser session", () => {
    window.sessionStorage.setItem("fattah.desktop.shortcuts.v1", JSON.stringify({
      "surface-work": { x: 36, y: 20 },
    }));

    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    act(() => vi.runOnlyPendingTimers());

    const workShortcut = screen.getByRole("link", { name: "Work" });
    expect(workShortcut.style.getPropertyValue("--desktop-offset-x")).toBe("36px");
    expect(workShortcut.style.getPropertyValue("--desktop-offset-y")).toBe("20px");
  });

  it("moves a desktop shortcut without opening it and persists its position and stack order", () => {
    document.documentElement.dataset.systemMode = "computer";
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    const board = screen.getByLabelText("Portfolio desktop shortcuts");
    const workShortcut = screen.getByRole("link", { name: "Work" });
    vi.spyOn(board, "getBoundingClientRect").mockReturnValue({
      bottom: 700, height: 700, left: 0, right: 1000, top: 0, width: 1000, x: 0, y: 0, toJSON: () => ({}),
    });
    vi.spyOn(workShortcut, "getBoundingClientRect").mockReturnValue({
      bottom: 168, height: 136, left: 32, right: 180, top: 32, width: 148, x: 32, y: 32, toJSON: () => ({}),
    });

    fireEvent.pointerDown(workShortcut, { button: 0, clientX: 100, clientY: 100, pointerId: 7 });
    fireEvent.pointerMove(workShortcut, { clientX: 180, clientY: 160, pointerId: 7 });
    fireEvent.pointerUp(workShortcut, { clientX: 180, clientY: 160, pointerId: 7 });
    fireEvent.click(workShortcut);

    expect(screen.queryByRole("region", { name: "Work window" })).toBeNull();
    const savedOffsets = JSON.parse(window.sessionStorage.getItem("fattah.desktop.shortcuts.v1") ?? "{}");
    expect(savedOffsets["surface-work"]).toEqual({ x: 80, y: 60, z: 1 });
    expect(workShortcut.style.zIndex).toBe("1");
  });

  it("keeps the immediate workspace contract when reduced motion is requested", () => {
    installBrowserStubs(true);
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    expect(screen.queryByRole("region", { name: "Opening portfolio workspace" })).toBeNull();
    openWorkFromDesktop();
    expect(screen.getByRole("region", { name: "Work window" })).toBeTruthy();
  });

  it("keeps the full Work journey discoverable from the identity to a selected entry", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();

    fireEvent.click(screen.getByRole("link", { name: /View selected work/i }));
    expect(screen.getByRole("heading", { name: "Three failures, three decisions." })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    expect(screen.getAllByText("A payment callback arrived twice").length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: /Open full case/i })).toBeTruthy();
  });

  it("opens and refocuses internal application links without navigating or duplicating UI", () => {
    const { container } = render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    const experienceLink = container.querySelector<HTMLAnchorElement>('.hero-secondary-actions a[href="/brief"]')!;

    fireEvent.click(experienceLink);
    fireEvent.click(experienceLink);

    expect(screen.getAllByRole("region", { name: "Experience window" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Experience window" }).getAttribute("data-active-window")).toBe("true");
    expect(window.location.pathname).toBe("/");
    expect(push).not.toHaveBeenCalled();
  });

  it("does not duplicate Back and Close controls in tablet window title bars", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 768 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1024 });
    render(
      <WorkspaceManagerProvider>
        <SystemShell />
        <CounterfactualHome />
      </WorkspaceManagerProvider>,
    );
    act(() => vi.advanceTimersByTime(20));

    const shelf = within(screen.getByRole("navigation", { name: "Tablet application shelf" }));
    fireEvent.click(shelf.getByRole("button", { name: "Open Experience. Not running" }));
    const experienceWindow = screen.getByRole("region", { name: "Experience window" });

    expect(within(experienceWindow).getByRole("button", { name: "Close experience window" })).toBeTruthy();
    expect(within(experienceWindow).queryByRole("button", { name: "Return from Experience" })).toBeNull();
    expect(shelf.getByRole("button", { name: "Back" })).toBeTruthy();
  });

  it("opens the full brief inside the existing active Experience application", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: "Experience" }));

    const experienceWindow = screen.getByRole("region", { name: "Experience window" });
    fireEvent.click(within(experienceWindow).getByRole("link", { name: /Open full brief/i }));

    expect(screen.getByRole("region", { name: "Experience window" })).toBe(experienceWindow);
    expect(experienceWindow.getAttribute("data-view")).toBe("full-brief");
    expect(experienceWindow.getAttribute("data-active-window")).toBe("true");
    expect(within(experienceWindow).getByText("Full engineering brief")).toBeTruthy();
    expect(within(experienceWindow).getByRole("heading", { name: /MuhammadA\. Fattah/i })).toBeTruthy();
    expect(document.querySelectorAll('[data-app-id="experience"]')).toHaveLength(1);
    expect(window.location.pathname).toBe("/brief");

    fireEvent.click(within(experienceWindow).getByRole("button", { name: "← Overview" }));

    expect(screen.getByRole("region", { name: "Experience window" })).toBe(experienceWindow);
    expect(experienceWindow.getAttribute("data-view")).toBe("summary");
    expect(experienceWindow.getAttribute("data-active-window")).toBe("true");
    expect(within(experienceWindow).getByRole("link", { name: /Open full brief/i })).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });

  it("loads /brief as the focused full view of the one Experience application", () => {
    window.history.replaceState(null, "", "/brief");
    render(<WorkspaceManagerProvider><CounterfactualHome initialExperienceView="full-brief" /></WorkspaceManagerProvider>);

    const experienceWindow = screen.getByRole("region", { name: "Experience window" });
    expect(experienceWindow.getAttribute("data-view")).toBe("full-brief");
    expect(experienceWindow.getAttribute("data-active-window")).toBe("true");
    expect(within(experienceWindow).getByText("Full engineering brief")).toBeTruthy();
    expect(document.querySelectorAll('[data-app-id="experience"]')).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Work window" })).toBeNull();
  });

  it("gives every selected-work entry its own readable state instrument", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
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
    openWorkFromDesktop();
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
    openWorkFromDesktop();
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
    openWorkFromDesktop();
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open full case/i }));

    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();
    const state = { portfolioView: "selected-work", slug: "payflow" };
    window.history.replaceState(state, "", "/#selected-work");
    fireEvent(window, new PopStateEvent("popstate", { state }));

    expect(document.querySelector('.workspace-work-window[data-view="summary"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open full case/i })).toBeTruthy();
  });

  it.each([
    ["computer", 1440, 960],
    ["tablet", 768, 1024],
    ["phone", 390, 844],
  ] as const)("treats a stale selected-work hash as a clean %s launch with no application open", (mode, width, height) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
    window.history.replaceState(null, "", "/#selected-work");
    render(
      <WorkspaceManagerProvider>
        <SystemShell />
        <CounterfactualHome />
      </WorkspaceManagerProvider>,
    );
    act(() => vi.advanceTimersByTime(20));

    expect(screen.queryByRole("region", { name: "Opening portfolio workspace" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Work window" })).toBeNull();
    expect(document.querySelector(".system-home-screen")?.getAttribute("aria-hidden")).toBe("false");
    expect(document.querySelector(".system-home-screen")?.getAttribute("data-mode")).toBe(mode);
    expect(document.querySelectorAll('.taskbar-app[data-running="true"]')).toHaveLength(0);
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("");
  });

  it("returns from a selected summary to the Work index without closing or duplicating Work", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 812 });
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
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
    openWorkFromDesktop();
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
    fireEvent.click(home.querySelector<HTMLButtonElement>(".system-resume-app")!);
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
    expect(screen.getByRole("region", { name: "Work window" }).getAttribute("data-view")).toBe("index");
    const workWindow = screen.getByRole("region", { name: "Work window" });
    const selectedWork = workWindow.querySelector<HTMLElement>("#selected-work")!;
    const chrome = workWindow.querySelector<HTMLElement>(".portfolio-window-chrome")!;
    vi.spyOn(workWindow, "getBoundingClientRect").mockReturnValue({
      bottom: 812, height: 812, left: 0, right: 390, top: 0, width: 390, x: 0, y: 0, toJSON: () => ({}),
    });
    vi.spyOn(selectedWork, "getBoundingClientRect").mockReturnValue({
      bottom: 1200, height: 600, left: 0, right: 390, top: 600, width: 390, x: 0, y: 600, toJSON: () => ({}),
    });
    vi.spyOn(chrome, "getBoundingClientRect").mockReturnValue({
      bottom: 62, height: 62, left: 0, right: 390, top: 0, width: 390, x: 0, y: 0, toJSON: () => ({}),
    });
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo);
    scrollTo.mockClear();
    act(() => vi.advanceTimersByTime(340));
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 518 });

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    expect(home.getAttribute("aria-hidden")).toBe("false");
  });

  it("keeps the merged Experience mobile Back chain inside its parent app", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    render(
      <WorkspaceManagerProvider>
        <SystemShell />
        <CounterfactualHome />
      </WorkspaceManagerProvider>,
    );

    const home = screen.getByRole("region", { name: "Portfolio home screen" });
    fireEvent.click(within(home).getByRole("button", { name: "Open Experience" }));
    const experienceWindow = screen.getByRole("region", { name: "Experience window" });
    fireEvent.click(within(experienceWindow).getByRole("link", { name: /Open full brief/i }));
    expect(experienceWindow.getAttribute("data-view")).toBe("full-brief");

    const phoneNavigation = within(screen.getByRole("navigation", { name: "Phone system navigation" }));
    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    expect(experienceWindow.getAttribute("data-view")).toBe("summary");
    expect(screen.getByRole("region", { name: "Experience window" })).toBe(experienceWindow);

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    expect(home.getAttribute("aria-hidden")).toBe("false");
    expect(document.querySelectorAll('[data-app-id="experience"]')).toHaveLength(1);
  });
});
