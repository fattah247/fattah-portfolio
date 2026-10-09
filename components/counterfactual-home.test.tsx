import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CounterfactualHome } from "./counterfactual-home";
import { PortfolioHeader } from "./portfolio-header";
import { SystemShell } from "./system-shell";
import { useWorkspaceManager, WorkspaceManagerProvider } from "./workspace-manager";
import { scenarios } from "../lib/scenarios";
import type { GithubProject } from "../lib/github-projects";

const push = vi.fn();

const githubProjects: GithubProject[] = [
  {
    description: "Android security lab for device-risk checks and request signing.",
    displayName: "TrustGate Android",
    homepageUrl: null,
    id: "trustgate-android",
    language: "Kotlin",
    previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/trustgate-android",
    readmeExcerpt: "Device-risk checks, request signing, and audit-style events stay inspectable in one Android lab.",
    repositoryUrl: "https://github.com/fattah247/trustgate-android",
    topics: ["android"],
    updatedAt: "2026-05-31T01:06:25Z",
    updatedLabel: "May 2026",
  },
  {
    description: "Track item expiration dates.",
    displayName: "Xpire",
    homepageUrl: "https://xpire.example.com/",
    id: "Xpire",
    language: "JavaScript",
    previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/Xpire",
    readmeExcerpt: "A small inventory tool for items that expire.",
    repositoryUrl: "https://github.com/fattah247/Xpire",
    topics: ["reminders"],
    updatedAt: "2026-02-16T21:41:30Z",
    updatedLabel: "Feb 2026",
  },
];

const rollingGithubProjects: GithubProject[] = [
  ...githubProjects,
  {
    description: "IDX filing analysis automation system.",
    displayName: "Stock Triage",
    homepageUrl: null,
    id: "Stock-Triage",
    language: "Python",
    previewImageUrl: "https://opengraph.githubassets.com/portfolio/fattah247/Stock-Triage",
    readmeExcerpt: "A local workflow for collecting and reviewing public IDX filings.",
    repositoryUrl: "https://github.com/fattah247/Stock-Triage",
    topics: ["finance"],
    updatedAt: "2026-04-20T07:12:21Z",
    updatedLabel: "Apr 2026",
  },
];

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ push }),
}));

vi.mock("../lib/github-project-loader", () => ({
  loadGithubProjects: vi.fn(async () => ({ projects: [], source: "fallback" })),
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
  fireEvent.click(screen.getByRole("link", { name: "Projects" }));
}

function ContactLauncherHarness() {
  const workspace = useWorkspaceManager();
  useEffect(() => workspace.registerAppLauncher("contact", () => workspace.openWindow("contact")), [workspace]);
  if (!workspace.isOpen("contact")) return null;
  return (
    <section aria-label="Contact" data-active-window={workspace.activeWindow === "contact"} role="dialog">
      Contact application
    </section>
  );
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
    expect(document.querySelector(".environment-wallpaper")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByText("Second Attempt")).toBeNull();
    expect(screen.queryByRole("link", { name: "Selected work" })).toBeNull();
    expect(document.querySelector(".desktop-object-copy small")).toBeNull();
    expect(screen.queryByRole("region", { name: "Projects window" })).toBeNull();
    openWorkFromDesktop();
    expect(screen.getByRole("region", { name: "Projects window" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Engineering cases" })).toBeTruthy();
  });

  it("restores desktop shortcut positions for the current browser session", () => {
    window.sessionStorage.setItem("fattah.desktop.shortcuts.v1", JSON.stringify({
      "surface-work": { x: 36, y: 20 },
    }));

    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    act(() => vi.runOnlyPendingTimers());

    const workShortcut = screen.getByRole("link", { name: "Projects" });
    expect(workShortcut.style.getPropertyValue("--desktop-offset-x")).toBe("36px");
    expect(workShortcut.style.getPropertyValue("--desktop-offset-y")).toBe("20px");
  });

  it("reveals the native grab affordance only after a desktop shortcut stays hovered and still", () => {
    document.documentElement.dataset.systemMode = "computer";
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    const workShortcut = screen.getByRole("link", { name: "Projects" });
    expect(workShortcut.getAttribute("data-grab-ready")).toBeNull();

    fireEvent.pointerEnter(workShortcut, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(1_199));
    expect(workShortcut.getAttribute("data-grab-ready")).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(workShortcut.getAttribute("data-grab-ready")).toBe("true");

    fireEvent.pointerMove(workShortcut, { clientX: 80, clientY: 80, pointerType: "mouse" });
    expect(workShortcut.getAttribute("data-grab-ready")).toBeNull();
    act(() => vi.advanceTimersByTime(1_200));
    expect(workShortcut.getAttribute("data-grab-ready")).toBe("true");

    fireEvent.pointerLeave(workShortcut, { pointerType: "mouse" });
    expect(workShortcut.getAttribute("data-grab-ready")).toBeNull();
  });

  it("moves a desktop shortcut without opening it and persists its position and stack order", () => {
    document.documentElement.dataset.systemMode = "computer";
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    const board = screen.getByLabelText("Portfolio desktop shortcuts");
    const workShortcut = screen.getByRole("link", { name: "Projects" });
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

    expect(screen.queryByRole("region", { name: "Projects window" })).toBeNull();
    const savedOffsets = JSON.parse(window.sessionStorage.getItem("fattah.desktop.shortcuts.v1") ?? "{}");
    expect(savedOffsets["surface-work"]).toEqual({ x: 80, y: 60, z: 1 });
    expect(workShortcut.style.zIndex).toBe("1");
  });

  it("keeps the immediate workspace contract when reduced motion is requested", () => {
    installBrowserStubs(true);
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);

    expect(screen.queryByRole("region", { name: "Opening portfolio workspace" })).toBeNull();
    openWorkFromDesktop();
    expect(screen.getByRole("region", { name: "Projects window" })).toBeTruthy();
  });

  it("keeps the full Work journey discoverable from the identity to a selected entry", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();

    expect(screen.getByRole("heading", { name: "Engineering cases" })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();
    expect(screen.getByRole("heading", { name: scenarios[0].title })).toBeTruthy();
  });

  it("keeps the Projects narrative ordered and exposes stable section and container hooks", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome githubProjects={rollingGithubProjects} /></WorkspaceManagerProvider>);
    openWorkFromDesktop();

    const projectsWindow = screen.getByRole("region", { name: "Projects window" });
    const workIndex = projectsWindow.querySelector<HTMLElement>(".projects-index")!;
    const caseList = workIndex.querySelector<HTMLElement>(".editorial-work-list")!;
    const sideProjects = projectsWindow.querySelector<HTMLElement>(".github-projects-index")!;
    const projectRail = sideProjects.querySelector<HTMLOListElement>(".github-project-ledger")!;

    expect(workIndex).toBeTruthy();
    expect(within(workIndex).getByRole("heading", { name: "Engineering cases" })).toBeTruthy();
    expect(within(workIndex).getByText(/Three small public projects, each built around one failure/)).toBeTruthy();
    expect(Array.from(caseList.querySelectorAll(".case-entry-open"), (line) => line.textContent?.trim())).toEqual(["Open case", "Open case", "Open case"]);
    expect(Array.from(caseList.querySelectorAll<HTMLAnchorElement>("a")).map((link) => link.getAttribute("href"))).toEqual(
      scenarios.map((scenario) => `/case/${scenario.slug}`),
    );

    expect(sideProjects).toBeTruthy();
    expect(sideProjects.classList.contains("github-projects-index")).toBe(true);
    expect(projectRail).toBeTruthy();
    expect(projectRail.getAttribute("aria-label")).toMatch(/project/i);
    expect(projectRail.classList.contains("github-project-ledger")).toBe(true);
  });

  it("labels Side projects with its live count and renders each repository item once", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome githubProjects={rollingGithubProjects} /></WorkspaceManagerProvider>);
    openWorkFromDesktop();

    const projectsWindow = screen.getByRole("region", { name: "Projects window" });
    const sideProjects = projectsWindow.querySelector<HTMLElement>(".github-projects-index")!;
    expect(within(sideProjects).getByRole("heading", { name: /Side projects/i })).toBeTruthy();
    expect(within(sideProjects).getByText(new RegExp(`\\b${rollingGithubProjects.length}\\s+(?:public\\s+)?(?:projects|repos)\\b`, "i"))).toBeTruthy();

    const projectLinks = within(sideProjects).getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/projects/"));
    expect(projectLinks).toHaveLength(rollingGithubProjects.length);
    expect(new Set(projectLinks.map((link) => link.getAttribute("href"))).size).toBe(rollingGithubProjects.length);
    for (const project of rollingGithubProjects) {
      expect(projectLinks.filter((link) => link.getAttribute("href") === `/projects/${encodeURIComponent(project.id)}`)).toHaveLength(1);
    }
    expect(sideProjects.textContent).toContain(rollingGithubProjects[0].description);
    expect(sideProjects.textContent).toContain(`Updated ${rollingGithubProjects[0].updatedLabel}`);
    expect(sideProjects.querySelector(".github-project-image")).toBeNull();
  });

  it("opens live GitHub repositories as previews inside the existing Projects app", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome githubProjects={githubProjects} githubProjectsSource="github" /></WorkspaceManagerProvider>);
    openWorkFromDesktop();

    const projectsWindow = screen.getByRole("region", { name: "Projects window" });
    expect(within(projectsWindow).getByRole("heading", { name: "Side projects" })).toBeTruthy();
    expect(within(projectsWindow).getByRole("link", { name: /public repositories on GitHub/ })).toBeTruthy();

    fireEvent.click(within(projectsWindow).getByRole("link", { name: /TrustGate Android/i }));

    expect(projectsWindow.getAttribute("data-view")).toBe("github-project");
    expect(within(projectsWindow).getByRole("heading", { name: "TrustGate Android" })).toBeTruthy();
    expect(within(projectsWindow).getByRole("link", { name: /View source/i }).getAttribute("href")).toBe("https://github.com/fattah247/trustgate-android");
    expect(document.querySelectorAll('[data-app-id="work"]')).toHaveLength(1);

    fireEvent.click(within(projectsWindow).getByRole("button", { name: "Next" }));
    expect(within(projectsWindow).getByRole("heading", { name: "Xpire" })).toBeTruthy();
    expect(window.location.pathname).toBe("/projects/Xpire");
    expect(document.querySelectorAll('[data-app-id="work"]')).toHaveLength(1);

    fireEvent.click(within(projectsWindow).getByRole("button", { name: "All projects" }));
    expect(projectsWindow.getAttribute("data-view")).toBe("index");
    expect(within(projectsWindow).getByRole("heading", { name: "Side projects" })).toBeTruthy();
  });

  it("returns from a repository preview to the Projects index and restores document scroll", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome githubProjects={githubProjects} githubProjectsSource="github" /></WorkspaceManagerProvider>);
    openWorkFromDesktop();

    const projectsWindow = screen.getByRole("region", { name: "Projects window" });
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo);
    projectsWindow.scrollTop = 512;
    scrollTo.mockClear();

    fireEvent.click(within(projectsWindow).getByRole("link", { name: /TrustGate Android/i }));
    expect(projectsWindow.getAttribute("data-view")).toBe("github-project");
    expect(window.location.pathname).toBe("/projects/trustgate-android");
    act(() => vi.advanceTimersByTime(20));
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 0 });

    scrollTo.mockClear();
    fireEvent.click(within(projectsWindow).getByRole("button", { name: "All projects" }));
    act(() => vi.advanceTimersByTime(40));

    expect(screen.getByRole("region", { name: "Projects window" })).toBe(projectsWindow);
    expect(projectsWindow.getAttribute("data-view")).toBe("index");
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("#selected-work");
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 512 });
    expect(document.querySelectorAll('[data-app-id="work"]')).toHaveLength(1);
  });

  it("selects a desktop shortcut on one click and opens it on a double click, Enter, or a touch tap", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    const projects = screen.getByRole("link", { name: "Projects" });
    const experience = screen.getByRole("link", { name: "Experience" });

    fireEvent.pointerDown(projects, { button: 0, pointerType: "mouse" });
    fireEvent.click(projects, { detail: 1 });
    expect(projects.getAttribute("data-selected")).toBe("true");
    expect(screen.queryByRole("region", { name: "Projects window" })).toBeNull();

    fireEvent.click(projects, { detail: 2 });
    expect(screen.getByRole("region", { name: "Projects window" })).toBeTruthy();

    // Keyboard and assistive-technology activation dispatch a click with detail 0.
    fireEvent.click(experience, { detail: 0 });
    expect(screen.getByRole("region", { name: "Experience window" })).toBeTruthy();
    expect(experience.getAttribute("data-selected")).toBe("true");
    expect(projects.getAttribute("data-selected")).toBeNull();

    fireEvent.pointerDown(screen.getByRole("group", { name: "Portfolio desktop shortcuts" }));
    expect(experience.getAttribute("data-selected")).toBeNull();
  });

  it("opens a desktop shortcut on a single touch tap", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    const projects = screen.getByRole("link", { name: "Projects" });
    fireEvent.pointerDown(projects, { button: 0, pointerType: "touch" });
    fireEvent.click(projects, { detail: 1 });
    expect(screen.getByRole("region", { name: "Projects window" })).toBeTruthy();
  });

  it("lists side projects as one quiet column with no paging or autoplay controls", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome githubProjects={rollingGithubProjects} githubProjectsSource="github" /></WorkspaceManagerProvider>);
    openWorkFromDesktop();

    const sideProjects = screen.getByRole("heading", { name: /Side projects/i }).closest("section")!;
    const list = within(sideProjects).getByRole("list", { name: "Side projects" });
    expect(list.children).toHaveLength(rollingGithubProjects.length);
    expect(within(sideProjects).queryAllByRole("button")).toHaveLength(0);
    expect(within(sideProjects).getByRole("link", { name: `All ${rollingGithubProjects.length} public repositories on GitHub` }).getAttribute("target")).toBe("_blank");

    act(() => vi.advanceTimersByTime(12_000));
    expect(Array.from(list.querySelectorAll("a")).map((link) => link.getAttribute("href"))).toEqual(
      rollingGithubProjects.map((project) => `/projects/${encodeURIComponent(project.id)}`),
    );
  });

  it("restores a directly loaded GitHub project in the Projects-owned route host", () => {
    window.history.replaceState(null, "", "/projects/trustgate-android");
    render(
      <WorkspaceManagerProvider>
        <CounterfactualHome githubProjects={githubProjects} initialGithubProjectId="trustgate-android" />
      </WorkspaceManagerProvider>,
    );

    const projectsWindow = screen.getByRole("region", { name: "Projects window" });
    expect(projectsWindow.getAttribute("data-view")).toBe("github-project");
    expect(within(projectsWindow).getByRole("heading", { name: "TrustGate Android" })).toBeTruthy();
  });

  it("opens and refocuses internal application links without navigating or duplicating UI", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    const experienceLink = within(screen.getByRole("region", { name: "Projects window" })).getByRole("link", { name: "Experience" });

    fireEvent.click(experienceLink);
    fireEvent.click(experienceLink);

    expect(screen.getAllByRole("region", { name: "Experience window" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Experience window" }).getAttribute("data-active-window")).toBe("true");
    // Focus rewrites the address in place to the owning document without router navigation.
    expect(window.location.pathname).toBe("/brief");
    expect(push).not.toHaveBeenCalled();
  });

  it("gives tablet apps one up control: a labelled title-bar Back below the root, the shelf Back above it", () => {
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
    fireEvent.click(shelf.getByRole("button", { name: "Open Projects. Not running" }));
    const workWindow = screen.getByRole("region", { name: "Projects window" });
    expect(within(workWindow).queryByRole("button", { name: "Return to project list" })).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    expect(workWindow.getAttribute("data-view")).toBe("full-case");
    const back = within(workWindow).getByRole("button", { name: "Return to project list" });
    expect(back.textContent).toBe("Projects");
    fireEvent.click(back);
    act(() => vi.advanceTimersByTime(400));
    expect(workWindow.getAttribute("data-view")).toBe("index");

    fireEvent.click(shelf.getByRole("button", { name: "Open Experience. Not running" }));
    const experienceWindow = screen.getByRole("region", { name: "Experience window" });
    expect(within(experienceWindow).queryByRole("button", { name: "Return from Experience" })).toBeNull();
    expect(shelf.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(false);
  });

  it("opens Experience directly as the complete engineering brief", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: "Experience" }));

    const experienceWindow = screen.getByRole("region", { name: "Experience window" });
    expect(experienceWindow.getAttribute("data-view")).toBe("brief");
    expect(experienceWindow.getAttribute("data-active-window")).toBe("true");
    expect(within(experienceWindow).getByRole("heading", { level: 1, name: "Muhammad A. Fattah" })).toBeTruthy();
    expect(within(experienceWindow).queryByText("Roles, scope, and responsibility.")).toBeNull();
    expect(within(experienceWindow).getByRole("link", { name: /Download CV/i })).toBeTruthy();
    expect(within(experienceWindow).getByRole("link", { name: /GitHub/i })).toBeTruthy();
    expect(within(experienceWindow).getByRole("link", { name: "Contact" })).toBeTruthy();
    expect(within(experienceWindow).getByRole("link", { name: "Projects" })).toBeTruthy();
    expect(within(experienceWindow).queryByRole("heading", { name: "Engineering cases" })).toBeNull();
    expect(within(experienceWindow).queryByText("fattahmuhammad17@gmail.com")).toBeNull();
    expect(within(experienceWindow).queryByRole("link", { name: /Open full brief/i })).toBeNull();
    expect(document.querySelectorAll('[data-app-id="experience"]')).toHaveLength(1);
    expect(window.location.pathname).toBe("/brief");
    expect(document.title).toBe("Experience and CV — Muhammad A. Fattah");
  });

  it("hands off from Experience to the existing Work application instead of repeating cases", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: "Experience" }));

    const experienceWindow = screen.getByRole("region", { name: "Experience window" });
    fireEvent.click(within(experienceWindow).getByRole("link", { name: "Projects" }));

    const workWindow = screen.getByRole("region", { name: "Projects window" });
    expect(workWindow.getAttribute("data-active-window")).toBe("true");
    expect(within(workWindow).getByRole("heading", { name: "Engineering cases" })).toBeTruthy();
    expect(document.querySelectorAll('[data-app-id="work"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-app-id="experience"]')).toHaveLength(1);
  });

  it("routes every internal contact prompt to the shared Contact application", () => {
    render(<WorkspaceManagerProvider><ContactLauncherHarness /><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();

    const workWindow = screen.getByRole("region", { name: "Projects window" });
    fireEvent.click(within(workWindow).getByRole("link", { name: "Experience" }));

    const experienceWindow = screen.getByRole("region", { name: "Experience window" });
    fireEvent.click(within(experienceWindow).getByRole("link", { name: "Contact" }));

    const contactWindow = screen.getByRole("dialog", { name: "Contact" });
    expect(contactWindow.getAttribute("data-active-window")).toBe("true");
    expect(within(experienceWindow).queryByText("fattahmuhammad17@gmail.com")).toBeNull();
  });

  it("loads /brief as the focused view of the one Experience application", () => {
    window.history.replaceState(null, "", "/brief");
    render(<WorkspaceManagerProvider><CounterfactualHome initialExperienceOpen /></WorkspaceManagerProvider>);

    const experienceWindow = screen.getByRole("region", { name: "Experience window" });
    expect(experienceWindow.getAttribute("data-view")).toBe("brief");
    expect(experienceWindow.getAttribute("data-active-window")).toBe("true");
    expect(within(experienceWindow).getByRole("heading", { level: 1, name: "Muhammad A. Fattah" })).toBeTruthy();
    expect(document.querySelectorAll('[data-app-id="experience"]')).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Projects window" })).toBeNull();
  });

  it("opens every selected-work entry as a complete case and keeps it inside Projects", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    const workWindow = screen.getByRole("region", { name: "Projects window" });
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo);

    expect(activeSelectedWindow().getAttribute("data-view")).toBe("full-case");
    expect(screen.getByRole("heading", { name: scenarios[0].title })).toBeTruthy();
    scrollTo.mockClear();
    workWindow.scrollTop = 640;
    fireEvent.click(within(activeSelectedWindow()).getByRole("button", { name: "Next: Detect degradation" }));
    expect(screen.getByRole("region", { name: "Projects window" })).toBe(workWindow);
    expect(screen.getByRole("heading", { name: scenarios[1].title })).toBeTruthy();
    act(() => vi.advanceTimersByTime(20));
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 0 });
    expect(document.activeElement?.textContent).not.toBe("Next: Detect degradation");
    scrollTo.mockClear();
    workWindow.scrollTop = 640;
    fireEvent.click(within(activeSelectedWindow()).getByRole("button", { name: "Next: Evaluate device trust" }));
    expect(screen.getByRole("region", { name: "Projects window" })).toBe(workWindow);
    expect(screen.getByRole("heading", { name: scenarios[2].title })).toBeTruthy();
    act(() => vi.advanceTimersByTime(20));
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 0 });
    expect(document.activeElement?.textContent).not.toBe("Next: Evaluate device trust");
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);
    expect(activeSelectedWindow().getAttribute("data-view")).toBe("full-case");
  });

  it("hosts a directly loaded case inside the one Work application window", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome initialCaseSlug="trustgate" /></WorkspaceManagerProvider>);

    const workWindow = screen.getByRole("region", { name: "Projects window" });
    expect(workWindow.getAttribute("data-view")).toBe("full-case");
    expect(within(workWindow).getByRole("heading", { name: scenarios[2].title })).toBeTruthy();
    expect(workWindow.querySelector(".portfolio-window-chrome")?.textContent).not.toContain(scenarios[2].shortTitle);
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);
  });

  it.each(scenarios)("maps the $slug index entry to its complete case document", (scenario) => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    fireEvent.click(screen.getByRole("link", { name: new RegExp(scenario.consequence, "i") }));

    const selectedWindow = screen.getByRole("region", { name: "Projects window" });
    expect(selectedWindow.getAttribute("data-view")).toBe("full-case");
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);
    expect(selectedWindow.querySelector(`.case-page.case-${scenario.slug}`)).toBeTruthy();
    expect(within(selectedWindow).getByRole("heading", { name: scenario.title })).toBeTruthy();
    expect(within(selectedWindow).getAllByText(scenario.consequence).length).toBeGreaterThan(0);
    expect(within(selectedWindow).getByText(scenario.decision)).toBeTruthy();
    expect(within(selectedWindow).getByRole("link", { name: /Open repository/i }).getAttribute("href")).toBe(scenario.repo);
  });

  it("returns from a complete case to the Projects index and restores index scroll", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    const workWindow = screen.getByRole("region", { name: "Projects window" });
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo);
    workWindow.scrollTop = 384;
    scrollTo.mockClear();
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));

    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();
    expect(document.querySelector(".embedded-case-workspace")).toBeTruthy();
    expect(document.querySelector(".workspace-detail-layer")).toBeNull();
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);

    scrollTo.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "All projects" }));
    act(() => vi.advanceTimersByTime(340));
    expect(document.querySelector('.workspace-work-window[data-view="index"]')).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Engineering cases" })).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 384 });
  });

  it("keeps the merged Projects frame resizable while a full case owns the inner scroll", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));

    const workWindow = screen.getByRole("region", { name: "Projects window" });
    const caseDocument = workWindow.querySelector<HTMLElement>(":scope > .embedded-case-workspace")!;
    const resizeHandle = workWindow.querySelector<HTMLElement>(":scope > .resize-bottom-right")!;
    Object.defineProperty(workWindow, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 822, height: 756, left: 48, right: 1392, top: 66, width: 1344, x: 48, y: 66, toJSON: () => ({}) }),
    });

    expect(caseDocument).toBeTruthy();
    expect(resizeHandle).toBeTruthy();
    fireEvent.pointerDown(resizeHandle, { clientX: 1390, clientY: 820, pointerId: 19 });
    expect(workWindow.getAttribute("data-resizing")).toBe("true");
    fireEvent.pointerMove(resizeHandle, { clientX: 1290, clientY: 760, pointerId: 19 });
    act(() => vi.advanceTimersByTime(20));
    fireEvent.pointerUp(resizeHandle, { clientX: 1290, clientY: 760, pointerId: 19 });

    expect(workWindow.style.getPropertyValue("--window-width")).toBe("1244px");
    expect(workWindow.style.getPropertyValue("--window-height")).toBe("696px");
    expect(workWindow.getAttribute("data-resizing")).toBe("false");
  });

  it("maps selected-work browser history entries back to the Projects index", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));

    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();
    const state = { portfolioView: "selected-work" };
    window.history.replaceState(state, "", "/#selected-work");
    fireEvent(window, new PopStateEvent("popstate", { state }));

    expect(document.querySelector('.workspace-work-window[data-view="index"]')).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Engineering cases" })).toBeTruthy();
  });

  it.each([
    ["/brief", "region", "Experience window", "experience"],
    ["/products", "region", "Product Links window", "products"],
    ["/#contact", "dialog", "Contact", "contact"],
  ] as const)("focuses the %s route owner during browser popstate", (href, role, name, app) => {
    render(
      <WorkspaceManagerProvider>
        <ContactLauncherHarness />
        <SystemShell />
        <CounterfactualHome />
      </WorkspaceManagerProvider>,
    );
    openWorkFromDesktop();

    window.history.replaceState(null, "", href);
    fireEvent(window, new PopStateEvent("popstate", { state: null }));

    const surface = role === "dialog"
      ? screen.getByRole("dialog", { name })
      : screen.getByRole("region", { name });
    expect(surface.getAttribute("data-active-window")).toBe("true");
    expect(document.documentElement.dataset.systemApp).toBe(app);
  });

  it.each([
    ["computer", 1440, 960],
    ["tablet", 768, 1024],
    ["phone", 390, 844],
  ] as const)("loads an explicit selected-work hash as the Projects index on %s", (mode, width, height) => {
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

    expect(document.querySelector(".system-home-screen")?.getAttribute("data-mode")).toBe(mode);
    const projectsWindow = screen.getByRole("region", { name: "Projects window" });
    expect(projectsWindow.getAttribute("data-view")).toBe("index");
    expect(projectsWindow.getAttribute("data-active-window")).toBe("true");
    expect(document.querySelector(".system-home-screen")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelectorAll('.taskbar-app[data-running="true"]')).toHaveLength(mode === "computer" ? 1 : 0);
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("#selected-work");
  });

  it("returns from a complete case to the Projects index without closing or duplicating Work", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 812 });
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));

    const workWindow = screen.getByRole("region", { name: "Projects window" });
    expect(workWindow.getAttribute("data-view")).toBe("full-case");
    fireEvent.click(within(workWindow).getByRole("button", { name: "All projects" }));

    expect(screen.getByRole("region", { name: "Projects window" })).toBeTruthy();
    expect(workWindow.getAttribute("data-view")).toBe("index");
    expect(document.querySelectorAll('.portfolio-window[data-app-id="work"]')).toHaveLength(1);
  });

  it("normalizes route and detail state when the desktop titlebar closes a full case", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    expect(window.location.pathname).toBe("/case/payflow");

    fireEvent.click(screen.getByRole("button", { name: "Close Projects window" }));
    act(() => vi.advanceTimersByTime(340));

    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("");
    expect(screen.queryByRole("region", { name: "Projects window" })).toBeNull();
  });

  it("returns keyboard focus to the app's taskbar button when its window closes", () => {
    render(
      <WorkspaceManagerProvider>
        <SystemShell />
        <CounterfactualHome />
      </WorkspaceManagerProvider>,
    );
    act(() => vi.advanceTimersByTime(20));
    const taskbar = within(screen.getByRole("navigation", { name: "System taskbar" }));
    fireEvent.click(taskbar.getByRole("button", { name: /Open Projects\. Not running/i }));
    const close = screen.getByRole("button", { name: "Close Projects window" });
    close.focus();
    fireEvent.click(close);
    act(() => vi.advanceTimersByTime(400));
    // Focus moves on the frame after the window has gone.
    act(() => vi.advanceTimersByTime(50));

    expect(screen.queryByRole("region", { name: "Projects window" })).toBeNull();
    expect(document.activeElement).toBe(taskbar.getByRole("button", { name: /Open Projects\. Not running/i }));
  });

  it("preserves the compact Home, full-case, evidence, and Back chain", () => {
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
    fireEvent.click(home.querySelector<HTMLButtonElement>('.system-launcher-app[data-app="work"]')!);
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();

    fireEvent.click(screen.getAllByText("Open evidence")[0].closest("button")!);
    const evidenceDialog = screen.getByRole("dialog", { name: /Exhibit 01\.1/i });
    expect(evidenceDialog.getAttribute("data-window-state")).toBe("active");

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole("dialog", { name: /Exhibit 01\.1/i })).toBeNull();
    expect(document.querySelector('.workspace-work-window[data-view="full-case"]')).toBeTruthy();

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    act(() => vi.advanceTimersByTime(340));
    expect(screen.getByRole("region", { name: "Projects window" }).getAttribute("data-view")).toBe("index");
    const workWindow = screen.getByRole("region", { name: "Projects window" });
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

  it("keeps Home and Recents interactive when evidence is open on phone", () => {
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
    const recents = document.querySelector<HTMLElement>(".system-recents")!;
    fireEvent.click(home.querySelector<HTMLButtonElement>('.system-launcher-app[data-app="work"]')!);
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    fireEvent.click(screen.getAllByText("Open evidence")[0].closest("button")!);
    const evidenceDialog = screen.getByRole("dialog", { name: /Exhibit 01\.1/i });
    expect(evidenceDialog.getAttribute("data-window-state")).toBe("active");

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Home" }));
    expect(home.getAttribute("aria-hidden")).toBe("false");
    expect(home.hasAttribute("inert")).toBe(false);

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Recents" }));
    expect(recents.getAttribute("aria-hidden")).toBe("false");
    expect(recents.hasAttribute("inert")).toBe(false);
    expect(evidenceDialog.getAttribute("data-window-state")).toBe("background");
  });

  it("keeps the recorded index position when browser Back returns from a case", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    const workWindow = screen.getByRole("region", { name: "Projects window" });
    const scrollTo = vi.mocked(HTMLElement.prototype.scrollTo);
    workWindow.scrollTop = 384;
    fireEvent.scroll(workWindow);
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    expect(window.location.pathname).toBe("/case/payflow");

    scrollTo.mockClear();
    window.history.replaceState(null, "", "/#selected-work");
    fireEvent(window, new PopStateEvent("popstate", { state: null }));
    act(() => vi.advanceTimersByTime(40));

    expect(workWindow.getAttribute("data-view")).toBe("index");
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 384 });
    expect(scrollTo).not.toHaveBeenCalledWith({ behavior: "auto", top: 0 });
  });

  it("rewrites a direct case address when Projects is closed from the application overview", () => {
    window.history.replaceState(null, "", "/case/payflow");
    render(
      <WorkspaceManagerProvider>
        <SystemShell />
        <CounterfactualHome initialCaseSlug="payflow" />
      </WorkspaceManagerProvider>,
    );
    expect(screen.getByRole("region", { name: "Projects window" }).getAttribute("data-view")).toBe("full-case");

    fireEvent.click(screen.getByRole("button", { name: "Application overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Projects" }));

    expect(screen.queryByRole("region", { name: "Projects window" })).toBeNull();
    expect(window.location.pathname).toBe("/");
    expect(push).not.toHaveBeenCalled();
  });

  it("opens Contact for a direct legacy #contact load", () => {
    window.history.replaceState(null, "", "/#contact");
    render(<WorkspaceManagerProvider><ContactLauncherHarness /><CounterfactualHome /></WorkspaceManagerProvider>);

    expect(screen.getByRole("dialog", { name: "Contact" }).getAttribute("data-active-window")).toBe("true");
    expect(screen.queryByRole("region", { name: "Projects window" })).toBeNull();
  });

  it("returns from a repository preview to the Projects index on phone Back while Contact runs in the background", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    render(
      <WorkspaceManagerProvider>
        <PortfolioHeader />
        <CounterfactualHome githubProjects={githubProjects} githubProjectsSource="github" />
      </WorkspaceManagerProvider>,
    );
    const home = document.querySelector<HTMLElement>(".system-home-screen")!;
    const phoneNavigation = within(screen.getByRole("navigation", { name: "Phone system navigation" }));
    const launcher = (label: string) => Array.from(home.querySelectorAll<HTMLButtonElement>(".system-launcher-app")).find((button) => new RegExp(label).test(button.getAttribute("aria-label") ?? ""))!;

    fireEvent.click(launcher("Contact"));
    expect(document.querySelector(".contact-window")).toBeTruthy();
    fireEvent.click(phoneNavigation.getByRole("button", { name: "Home" }));

    fireEvent.click(launcher("Projects"));
    fireEvent.click(screen.getByRole("link", { name: /Open TrustGate Android project preview/i }));
    const workWindow = screen.getByRole("region", { name: "Projects window" });
    expect(workWindow.getAttribute("data-view")).toBe("github-project");
    fireEvent.pointerDown(within(workWindow).getByRole("heading", { level: 2, name: "TrustGate Android" }));

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    act(() => vi.advanceTimersByTime(340));

    expect(workWindow.getAttribute("data-view")).toBe("index");
    expect(home.getAttribute("aria-hidden")).toBe("true");
  });

  it("clears the product search on Escape without closing Product Links", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    fireEvent.click(screen.getByRole("link", { name: "Product Links" }));
    const search = screen.getByRole("searchbox", { name: "Find a product" });
    fireEvent.change(search, { target: { value: "charger" } });

    fireEvent.keyDown(search, { key: "Escape" });
    act(() => vi.advanceTimersByTime(400));

    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("region", { name: "Product Links window" })).toBeTruthy();
  });

  it("returns a repository preview to the Projects index on Escape instead of closing Projects", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome githubProjects={githubProjects} githubProjectsSource="github" /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    const projectsWindow = screen.getByRole("region", { name: "Projects window" });
    fireEvent.click(within(projectsWindow).getByRole("link", { name: /TrustGate Android/i }));
    expect(projectsWindow.getAttribute("data-view")).toBe("github-project");

    fireEvent.keyDown(window, { key: "Escape" });
    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByRole("region", { name: "Projects window" }).getAttribute("data-view")).toBe("index");
    expect(window.location.hash).toBe("#selected-work");
  });

  it("leaves an open case alone when Escape belongs to the foreground Experience window", () => {
    render(<WorkspaceManagerProvider><CounterfactualHome /></WorkspaceManagerProvider>);
    openWorkFromDesktop();
    fireEvent.click(screen.getByRole("link", { name: /A payment callback arrived twice/i }));
    fireEvent.click(screen.getByRole("link", { name: "Experience" }));
    expect(screen.getByRole("region", { name: "Experience window" }).getAttribute("data-active-window")).toBe("true");

    fireEvent.keyDown(window, { key: "Escape" });
    act(() => vi.advanceTimersByTime(400));

    expect(screen.queryByRole("region", { name: "Experience window" })).toBeNull();
    expect(screen.getByRole("region", { name: "Projects window" }).getAttribute("data-view")).toBe("full-case");
    expect(document.documentElement.dataset.systemSurface).toBe("application");
  });

  it("uses the SVG icon language and public-lab framing in the rendered workspace", () => {
    render(
      <WorkspaceManagerProvider>
        <SystemShell />
        <CounterfactualHome githubProjects={rollingGithubProjects} githubProjectsSource="github" />
      </WorkspaceManagerProvider>,
    );
    openWorkFromDesktop();
    const controls = Array.from(document.querySelectorAll("button, a, summary")).map((node) => node.textContent ?? "").join(" ");

    expect(controls).not.toMatch(/[▶Ⅱ⇆×↗⋯←→]/);
    expect(document.body.textContent).not.toMatch(/production problems/i);
    expect(screen.queryByText("Android POS · payments · reliability")).toBeNull();
  });

  it("returns from the direct Experience brief to mobile Home in one Back action", () => {
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
    expect(experienceWindow.getAttribute("data-view")).toBe("brief");
    expect(within(experienceWindow).getByRole("link", { name: /Download CV/i })).toBeTruthy();

    const phoneNavigation = within(screen.getByRole("navigation", { name: "Phone system navigation" }));
    fireEvent.click(phoneNavigation.getByRole("button", { name: "Back" }));
    expect(home.getAttribute("aria-hidden")).toBe("false");
    expect(document.querySelectorAll('[data-app-id="experience"]')).toHaveLength(1);
  });
});
