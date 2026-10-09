"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ChevronIcon } from "./icons";
import { CaseCover } from "./case-cover";
import { DebuggerWorkspace } from "./debugger-workspace";
import { ExperienceBriefContent } from "./experience-brief-content";
import { GithubProjectPreview, GithubProjectsIndex } from "./github-projects";
import { ProductLinksAppContent } from "./product-links-app";
import { DesktopSurface } from "./desktop-surface";
import { WindowChrome } from "./window-chrome";
import { ApplicationFrame, findScrollOwner } from "./application-frame";
import { decodeWorkspaceRoute, documentKey, encodeWorkspaceRoute, isWorkspaceTraversal, overlayNode, syncWorkspaceStack, workspaceHistory, type StackNode } from "../lib/workspace-navigation";
import { portfolioApp } from "./app-registry";
import { loadGithubProjects } from "../lib/github-project-loader";
import { portfolioTitle } from "../lib/portfolio-identity";
import { useWorkspaceManager, type PortfolioAppId, type WorkspaceWindowId } from "./workspace-manager";
import { scenarios, type Conditions, type ScenarioSlug } from "../lib/scenarios";
import type { GithubProject, GithubProjectsPayload } from "../lib/github-projects";
import { useWindowFrame, type SnapEdge } from "./use-window-frame";

type WorkspaceWindow = Extract<WorkspaceWindowId, "work" | "experience" | "products">;
type WorkView = "index" | "full-case" | "github-project";
const mainWindowIds: WorkspaceWindow[] = ["work", "experience", "products"];

function WindowSnapPreview({ edge }: { edge: SnapEdge }) {
  if (!edge) return null;
  return <div className="window-snap-preview" data-edge={edge} aria-hidden="true" />;
}

const caseDetails = Object.fromEntries(scenarios.map((scenario) => [scenario.slug, {
  area: scenario.category, technology: scenario.indexTechnology, result: scenario.indexResult,
}])) as Record<ScenarioSlug, { area: string; technology: string; result: ReactNode }>;

function WorkRow({
  onOpenCase,
  scenario,
}: {
  onOpenCase: (slug: ScenarioSlug) => void;
  scenario: (typeof scenarios)[number];
}) {
  const detail = caseDetails[scenario.slug];
  return (
    <a
      href={`/case/${scenario.slug}`}
      className="case-entry"
      data-case={scenario.slug}
      onClick={(event) => {
        event.preventDefault();
        onOpenCase(scenario.slug);
      }}
    >
      <span className="case-entry-cover" aria-hidden="true">
        <CaseCover slug={scenario.slug} />
      </span>
      <span className="case-entry-body">
        <span className="case-entry-meta">
          <span className="case-entry-number" style={{ viewTransitionName: `case-number-${scenario.slug}` } as CSSProperties}>{scenario.number}</span>
          <span>{detail.area}</span>
        </span>
        <strong style={{ viewTransitionName: `case-title-${scenario.slug}` } as CSSProperties}>{scenario.shortTitle}</strong>
        <span className="case-entry-summary">{scenario.consequence}</span>
        <span className="case-entry-facts">
          <span>{detail.technology}</span>
          <span className="case-entry-result">{detail.result}</span>
        </span>
        <span className="case-entry-open" aria-hidden="true">Open case <ChevronIcon direction="right" /></span>
      </span>
    </a>
  );
}


export function CounterfactualHome({
  githubProjects: initialGithubProjects = [],
  githubProjectsSource: initialGithubProjectsSource = "fallback",
  initialCaseConditions,
  initialCaseSlug,
  initialExperienceOpen,
  initialProductsOpen,
  initialGithubProjectId,
}: {
  githubProjects?: GithubProject[];
  githubProjectsSource?: GithubProjectsPayload["source"];
  initialCaseConditions?: Conditions;
  initialCaseSlug?: ScenarioSlug;
  initialExperienceOpen?: boolean;
  initialProductsOpen?: boolean;
  initialGithubProjectId?: string;
} = {}) {
  const workspace = useWorkspaceManager();
  const [githubProjects, setGithubProjects] = useState(initialGithubProjects);
  const [githubProjectsSource, setGithubProjectsSource] = useState(initialGithubProjectsSource);
  const [githubLoading, setGithubLoading] = useState(false);
  const githubRequested = useRef(initialGithubProjects.length > 0);
  const [selectedCaseSlug, setSelectedCaseSlug] = useState<ScenarioSlug>(() => initialCaseSlug ?? (workspace.readDocumentState("work", "session")?.data?.slug as ScenarioSlug) ?? "payflow");
  const [selectedGithubProjectId, setSelectedGithubProjectId] = useState(() => initialGithubProjectId ?? (workspace.readDocumentState("work", "session")?.data?.repository as string) ?? githubProjects[0]?.id ?? "");
  const [workView, setWorkView] = useState<WorkView>(() => initialGithubProjectId ? "github-project" : initialCaseSlug ? "full-case" : (workspace.readDocumentState("work", "session")?.data?.view as WorkView) ?? "index");
  const [closingWindows, setClosingWindows] = useState<WorkspaceWindow[]>([]);
  const closeTimers = useRef<number[]>([]);
  const experienceCloseRef = useRef<HTMLButtonElement>(null);
  const workContentRef = useRef<HTMLDivElement>(null);
  const initialConditionsConsumed = useRef(false);
  const openedApps = useRef(new Set<PortfolioAppId>());
  const workCloseRef = useRef<HTMLButtonElement>(null);
  const productsCloseRef = useRef<HTMLButtonElement>(null);
  const pendingWorkScroll = useRef<"selected-work" | null>(null);
  const {
    dragging: workDragging,
    frameRef: workFrameRef,
    maximized: workMaximized,
    resetFrame: resetWorkFrame,
    resizeHandleProps: workResizeHandleProps,
    resizing: workResizing,
    snap: workSnap,
    snapCandidate: workSnapCandidate,
    snapTo: snapWorkFrame,
    style: workWindowStyle,
    titlebarProps: workTitlebarProps,
    toggleMaximize: toggleWorkMaximize,
  } = useWindowFrame({ appId: "work", enabled: workspace.isAppOpen("work"), defaultHeight: 780, defaultWidth: 1180, minHeight: 420, minWidth: 420 });
  const {
    dragging: productsDragging,
    frameRef: productsFrameRef,
    maximized: productsMaximized,
    resetFrame: resetProductsFrame,
    resizeHandleProps: productsResizeHandleProps,
    resizing: productsResizing,
    snap: productsSnap,
    snapCandidate: productsSnapCandidate,
    snapTo: snapProductsFrame,
    style: productsWindowStyle,
    titlebarProps: productsTitlebarProps,
    toggleMaximize: toggleProductsMaximize,
  } = useWindowFrame({ appId: "products", enabled: workspace.isAppOpen("products"), defaultHeight: 660, defaultWidth: 820, minHeight: 420, minWidth: 420 });
  const {
    dragging: experienceDragging,
    frameRef: experienceFrameRef,
    maximized: experienceMaximized,
    resetFrame: resetExperienceFrame,
    resizeHandleProps: experienceResizeHandleProps,
    resizing: experienceResizing,
    snap: experienceSnap,
    snapCandidate: experienceSnapCandidate,
    snapTo: snapExperienceFrame,
    style: experienceWindowStyle,
    titlebarProps: experienceTitlebarProps,
    toggleMaximize: toggleExperienceMaximize,
  } = useWindowFrame({ appId: "experience", enabled: workspace.isAppOpen("experience"), defaultHeight: 760, defaultWidth: 980, minHeight: 420, minWidth: 460 });
  const openWindows = workspace.openWindows.filter((item): item is WorkspaceWindow => mainWindowIds.includes(item as WorkspaceWindow));
  const isWorkOpen = workspace.isOpen("work") || (!workspace.modeReady && Boolean(initialCaseSlug || initialGithubProjectId));
  const isExperienceOpen = workspace.isOpen("experience") || (!workspace.modeReady && Boolean(initialExperienceOpen));
  const isProductsOpen = workspace.isOpen("products") || (!workspace.modeReady && Boolean(initialProductsOpen));
  useEffect(() => {
    if (!isWorkOpen || githubRequested.current) return;
    githubRequested.current = true;
    setGithubLoading(true);
    void loadGithubProjects().then((payload) => {
      setGithubProjects(payload.projects);
      setGithubProjectsSource(payload.source);
    }).catch(() => { /* The compact empty state retains the public GitHub link. */ })
      .finally(() => setGithubLoading(false));
  }, [isWorkOpen]);
  const hasOpenWindows = openWindows.length > 0 || isWorkOpen || isExperienceOpen || isProductsOpen;
  const activeWindow = workspace.activeWindow;
  useEffect(() => {
    if (workspace.isAppOpen("work")) workspace.writeDocumentState("work", "session", { data: { view: workView, slug: selectedCaseSlug, repository: selectedGithubProjectId } });
  }, [selectedCaseSlug, selectedGithubProjectId, workView, workspace]);
  const activeSnapCandidate = activeWindow === "work"
    ? workSnapCandidate
    : activeWindow === "experience"
      ? experienceSnapCandidate
      : activeWindow === "products"
        ? productsSnapCandidate
        : null;

  useEffect(() => {
    if (initialCaseSlug) {
      setSelectedCaseSlug(initialCaseSlug);
      setWorkView("full-case");
      workspace.openWindow("work");
      workspace.focusWindow("work");
    }
  // This restores the Work document once for the route that mounted it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCaseSlug]);

  useEffect(() => {
    if (!initialGithubProjectId || !githubProjects.some((project) => project.id === initialGithubProjectId)) return;
    setSelectedGithubProjectId(initialGithubProjectId);
    setWorkView("github-project");
    workspace.openWindow("work");
    workspace.focusWindow("work");
    window.requestAnimationFrame(() => workScrollFrame()?.scrollTo({ behavior: "auto", top: 0 }));
  // This restores the GitHub project document once for its direct route.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGithubProjectId]);

  useEffect(() => {
    if (!initialExperienceOpen) return;
    workspace.openWindow("experience");
    workspace.focusWindow("experience");
    window.requestAnimationFrame(() => experienceFrameRef.current?.scrollTo({ behavior: "auto", top: 0 }));
  // This opens the one Experience document for a direct /brief load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExperienceOpen]);

  useEffect(() => {
    if (!initialProductsOpen) return;
    workspace.openWindow("products");
    workspace.focusWindow("products");
  // Restore the addressed app once; subsequent navigation belongs to the workspace.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductsOpen]);

  useEffect(() => {
    if (initialCaseSlug || initialGithubProjectId || window.location.pathname !== "/") return;
    if (window.location.hash === "#selected-work") {
      workspace.openWindow("work");
      workspace.focusWindow("work");
    }
    if (window.location.hash === "#contact") workspace.openWindow("contact");
  // Restore only an explicit legacy deep link, never open an app on plain /.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCaseSlug, initialGithubProjectId]);

  // The phone's history mirrors what is visible: Home, the foreground app's root, its document,
  // and attached evidence. Recents sits over the foreground app without becoming a level.
  // Declared after the route-restoring effects above so they read the address before the stack
  // rewrites it (a client-side navigation can mount this host with the device mode known).
  useEffect(() => {
    if (workspace.mode !== "phone" || !workspace.modeReady) return;
    syncWorkspaceStack(phoneStack());
  // phoneStack reads the visible Work document and the saved conditions behind its address.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWindow, githubProjects, selectedCaseSlug, selectedGithubProjectId, workView, workspace.mode, workspace.modeReady, workspace.surface]);

  useEffect(() => {
    if (!isWorkOpen || pendingWorkScroll.current !== "selected-work") return;
    pendingWorkScroll.current = null;
    window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior()));
  // Reads the current frame refs and pending scroll flag; rerunning for every render is unnecessary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkOpen, openWindows]);

  function focusWindow(windowName: WorkspaceWindow) {
    workspace.focusWindow(windowName);
    syncRouteToWindow(windowName);
  }

  /** The visible Work document's own address, including any restored non-default conditions. */
  function workDocumentRoute() {
    if (workView === "full-case") {
      const saved = workspace.readDocumentState("work", `case:${selectedCaseSlug}`)?.data?.conditions as Conditions | undefined;
      const params = new URLSearchParams();
      for (const control of selectedScenarioFor(selectedCaseSlug).controls) {
        const value = saved?.[control.key];
        if (value && value !== selectedScenarioFor(selectedCaseSlug).defaults[control.key]) params.set(control.key, value);
      }
      return { pathname: `/case/${selectedCaseSlug}`, search: params.toString(), title: portfolioTitle.for(caseDetails[selectedCaseSlug].area) };
    }
    if (workView === "github-project" && selectedGithubProjectId) {
      return { pathname: `/projects/${encodeURIComponent(selectedGithubProjectId)}`, title: portfolioTitle.for(githubProjects.find((project) => project.id === selectedGithubProjectId)?.displayName) };
    }
    return { pathname: "/", hash: "#selected-work", title: portfolioTitle.default };
  }

  function stackNode(href: string, title: string): StackNode {
    return { key: documentKey(href), href, title };
  }

  /** The visible phone hierarchy, from the foreground app's root down to its child surface. */
  function phoneStack(): StackNode[] {
    if (workspace.surface === "home" || !activeWindow) return [];
    const app = workspace.activeApp;
    if (app === "contact") return [stackNode("/#contact", portfolioTitle.for(portfolioApp("contact").label))];
    if (app !== "work") return app ? [stackNode(portfolioApp(app).href, portfolioTitle.for(portfolioApp(app).documentTitle))] : [];
    const nodes = [stackNode("/#selected-work", portfolioTitle.default)];
    if (workView === "index") return nodes;
    const route = workDocumentRoute();
    const documentNode = stackNode(encodeWorkspaceRoute(route), route.title);
    if (documentNode.key === nodes[0].key) return nodes;
    nodes.push(documentNode);
    if (workView === "full-case" && activeWindow.startsWith(`evidence-${selectedCaseSlug}-`)) nodes.push(overlayNode(documentNode, activeWindow));
    return nodes;
  }

  /**
   * Focus and switching never add history entries, but the address must name the
   * visible application document, so the current entry is rewritten in place.
   */
  function syncRouteToWindow(windowName: WorkspaceWindow) {
    const route = windowName === "work"
      ? workDocumentRoute()
      : { pathname: portfolioApp(windowName).href, title: portfolioTitle.for(portfolioApp(windowName).documentTitle) };
    const href = encodeWorkspaceRoute(route);
    // The document's own chapter (a hash the route does not name) survives focus.
    const current = `${window.location.pathname}${window.location.search}${"hash" in route && route.hash ? window.location.hash : ""}`;
    if (href !== current) workspaceHistory.replaceState(null, route.title, href);
  }

  function frameFor(windowName: WorkspaceWindow) {
    if (windowName === "work") return workFrameRef.current;
    if (windowName === "experience") return experienceFrameRef.current;
    if (windowName === "products") return productsFrameRef.current;
    return null;
  }

  function workScrollFrame() {
    return findScrollOwner(workFrameRef.current);
  }

  /** Hand the index position to the frame record before another document replaces it. */
  function rememberIndexScroll() {
    if (workView === "index") workspace.writeDocumentState("work", "index", { scroll: workScrollFrame()?.scrollTop ?? 0 });
  }

  /** A freshly opened document starts at the top; the frame restores this record on mount. */
  function openDocumentAtTop(documentId: string) {
    workspace.writeDocumentState("work", documentId, { scroll: 0 });
  }

  function focusWindowControl(windowName: WorkspaceWindow) {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => frameFor(windowName)?.focus({ preventScroll: true })));
  }

  function preferredScrollBehavior(): ScrollBehavior {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function resetFrameFor(windowName: WorkspaceWindow) {
    if (windowName === "work") resetWorkFrame();
    if (windowName === "experience") resetExperienceFrame();
    if (windowName === "products") resetProductsFrame();
  }

  function snapFrameFor(windowName: WorkspaceWindow, edge: "left" | "right" | "top" | "bottom") {
    if (windowName === "work") snapWorkFrame(edge);
    if (windowName === "experience") snapExperienceFrame(edge);
    if (windowName === "products") snapProductsFrame(edge);
  }

  function scrollWorkToSelected(behavior: ScrollBehavior = "smooth") {
    const container = workScrollFrame();
    const target = workContentRef.current?.querySelector<HTMLElement>("#selected-work");
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const chromeHeight = container.querySelector<HTMLElement>(".portfolio-window-chrome")?.getBoundingClientRect().height ?? 0;
    const top = container.scrollTop + targetRect.top - containerRect.top - chromeHeight - 20;
    container.scrollTo({ behavior, top: Math.max(0, top) });
  }

  function openWindow(windowName: WorkspaceWindow, target?: "selected-work") {
    const alreadyOpen = openWindows.includes(windowName);

    if (windowName === "work" && target) {
      setWorkView("index");
      pendingWorkScroll.current = target;
      if (window.location.pathname !== "/" || window.location.hash !== "#selected-work") {
        workspaceHistory.replaceState(null, "", "/#selected-work");
      }
    }

    if (workspace.mode !== "computer") {
      if (alreadyOpen && !(windowName === "work" && target)) workspace.focusApp(windowName);
      else workspace.openWindow(windowName);
      if (windowName === "work" && target && openWindows.includes("work")) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior())));
      }
      if (window.location.pathname === "/" && window.location.search) {
        workspaceHistory.pushState(null, "", "/");
      }
      // The index target already rewrote the address above; other windows name their own document.
      if (!(windowName === "work" && target)) syncRouteToWindow(windowName);
      focusWindowControl(windowName);
      return;
    }

    if (windowName === "work" && target) {
      if (openWindows.includes("work")) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior())));
      } else {
        pendingWorkScroll.current = target;
      }
    }
    if (alreadyOpen) {
      // Re-launching a running app restores its most recent window (an evidence child included).
      if (windowName === "work" && target) workspace.focusWindow("work");
      else { workspace.focusApp(windowName); syncRouteToWindow(windowName); }
      if (window.location.pathname === "/" && window.location.search) {
        workspaceHistory.pushState(null, "", "/");
      }
      focusWindowControl(windowName);
      return;
    }

    if (!alreadyOpen) {
      if (windowName === "work") resetWorkFrame();
      if (windowName === "experience") resetExperienceFrame();
      if (windowName === "products") resetProductsFrame();
    }
    const partner = mainWindowIds.includes(activeWindow as WorkspaceWindow)
      ? activeWindow as WorkspaceWindow
      : openWindows.at(-1);
    if (partner && partner !== windowName) {
      const portrait = window.innerWidth <= 1100 && window.innerHeight > window.innerWidth;
      snapFrameFor(partner, portrait ? "top" : "left");
      snapFrameFor(windowName, portrait ? "bottom" : "right");
    }
    workspace.openWindow(windowName);
    if (window.location.pathname === "/" && window.location.search) {
      workspaceHistory.pushState(null, "", "/");
    }
    if (!(windowName === "work" && target)) syncRouteToWindow(windowName);
    focusWindowControl(windowName);
  }

  function closeWindow(windowName: WorkspaceWindow) {
    if (closingWindows.includes(windowName)) return;
    const remainingWindows = openWindows.filter((item) => item !== windowName);
    setClosingWindows((current) => [...current, windowName]);
    closeTimers.current.push(window.setTimeout(() => {
      workspace.closeWindow(windowName);
      if (workspace.mode === "computer" && remainingWindows.length === 1) {
        const remaining = remainingWindows[0];
        window.requestAnimationFrame(() => {
          resetFrameFor(remaining);
          focusWindow(remaining);
          focusWindowControl(remaining);
        });
      } else if (workspace.mode === "computer" && remainingWindows.length > 1) {
        const promoted = activeWindow !== windowName && remainingWindows.includes(activeWindow as WorkspaceWindow)
          ? activeWindow as WorkspaceWindow
          : remainingWindows.find((item) => windowState(item) === "clear") ?? remainingWindows.at(-1)!;
        const companion = remainingWindows.find((item) => item !== promoted)!;
        const portrait = window.innerWidth <= 1100 && window.innerHeight > window.innerWidth;
        snapFrameFor(companion, portrait ? "top" : "left");
        snapFrameFor(promoted, portrait ? "bottom" : "right");
        window.requestAnimationFrame(() => {
          focusWindow(promoted);
          focusWindowControl(promoted);
        });
      }
      setClosingWindows((current) => current.filter((item) => item !== windowName));
    }, 320));
  }

  function closeApplication(app: "work" | "experience" | "products", visualWindow: WorkspaceWindow) {
    if (closingWindows.includes(visualWindow)) return;
    const removedWindows: WorkspaceWindow[] = app === "work"
      ? openWindows.filter((item) => item === "work")
      : app === "experience"
        ? openWindows.filter((item) => item === "experience")
        : openWindows.filter((item) => item === "products");
    const remainingWindows = openWindows.filter((item) => !removedWindows.includes(item));
    setClosingWindows((current) => [...current, visualWindow]);
    closeTimers.current.push(window.setTimeout(() => {
      workspace.closeApp(app);
      if (workspace.mode === "computer" && remainingWindows.length === 1) {
        const remaining = remainingWindows[0];
        window.requestAnimationFrame(() => {
          resetFrameFor(remaining);
          focusWindow(remaining);
          focusWindowControl(remaining);
        });
      }
      setClosingWindows((current) => current.filter((item) => item !== visualWindow));
    }, 320));
  }

  function openCaseWindow(slug: ScenarioSlug) {
    rememberIndexScroll();
    openDocumentAtTop(`case:${slug}`);
    setSelectedCaseSlug(slug);
    setWorkView("full-case");
    workspace.openWindow("work");
    workspace.focusWindow("work");
    workspaceHistory.pushState(null, portfolioTitle.for(caseDetails[slug].area), `/case/${slug}`);
  }

  function closeDetailedCaseWindow(slug: ScenarioSlug) {
    setSelectedCaseSlug(slug);
    returnToProjectIndex();
  }

  /** Index → case → index: the frame restores the recorded index position on desktop. */
  function returnToProjectIndex() {
    setWorkView("index");
    workspaceHistory.replaceState(null, portfolioTitle.default, "/#selected-work");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (workspace.mode !== "computer") scrollWorkToSelected("auto");
      workFrameRef.current?.focus({ preventScroll: true });
    }));
  }

  function openGithubProject(projectId: string) {
    if (!githubProjects.some((project) => project.id === projectId)) return;
    rememberIndexScroll();
    openDocumentAtTop(`project:${projectId}`);
    setSelectedGithubProjectId(projectId);
    setWorkView("github-project");
    workspace.openWindow("work");
    workspace.focusWindow("work");
    workspaceHistory.pushState(null, portfolioTitle.for(githubProjects.find((project) => project.id === projectId)?.displayName), `/projects/${encodeURIComponent(projectId)}`);
  }

  function selectGithubProject(projectId: string) {
    if (!githubProjects.some((project) => project.id === projectId)) return;
    openDocumentAtTop(`project:${projectId}`);
    setSelectedGithubProjectId(projectId);
    setWorkView("github-project");
    workspace.focusWindow("work");
    workspaceHistory.replaceState(null, portfolioTitle.for(githubProjects.find((project) => project.id === projectId)?.displayName), `/projects/${encodeURIComponent(projectId)}`);
  }

  function switchDetailedCase(slug: ScenarioSlug) {
    openDocumentAtTop(`case:${slug}`);
    setSelectedCaseSlug(slug);
    setWorkView("full-case");
    workspace.focusWindow("work");
    workspaceHistory.pushState(null, portfolioTitle.for(caseDetails[slug].area), `/case/${slug}`);
  }

  useEffect(() => {
    const syncWorkHistory = (event: PopStateEvent) => {
      // The phone stack walking back to a parent it already shows needs no restoration.
      if (isWorkspaceTraversal(event)) return;
      const route = decodeWorkspaceRoute(window.location.href);
      // Traversal restores the entry's document; the tab title follows the same route ownership.
      if (route.app === "experience" || route.app === "products" || route.app === "contact") {
        document.title = portfolioTitle.for(portfolioApp(route.app).documentTitle);
        workspace.openWindow(route.app);
        workspace.focusWindow(route.app);
        return;
      }
      const routeSlug = route.documentId.startsWith("case:") ? route.documentId.slice(5) : null;
      if (routeSlug && scenarios.some((scenario) => scenario.slug === routeSlug)) {
        const slug = routeSlug as ScenarioSlug;
        document.title = portfolioTitle.for(caseDetails[slug].area);
        setSelectedCaseSlug(slug);
        setWorkView("full-case");
        workspace.openWindow("work");
        workspace.focusWindow("work");
        return;
      }
      if (route.documentId.startsWith("project:")) {
        const repository = route.documentId.slice("project:".length);
        const project = githubProjects.find((item) => item.id.toLocaleLowerCase() === repository.toLocaleLowerCase());
        if (project) {
          document.title = portfolioTitle.for(project.displayName);
          setSelectedGithubProjectId(project.id);
          setWorkView("github-project");
          workspace.openWindow("work");
          workspace.focusWindow("work");
        }
        return;
      }
      if (window.location.pathname !== "/") return;
      document.title = portfolioTitle.default;
      if (!window.location.hash) { workspace.goHome(); return; }
      const wasOpen = workspace.isAppOpen("work");
      setWorkView("index");
      workspace.openWindow("work");
      workspace.focusWindow("work");
      // Traversal back to a running index keeps its recorded position; a fresh open reveals the list.
      if (window.location.hash === "#selected-work" && !wasOpen) {
        pendingWorkScroll.current = "selected-work";
        window.requestAnimationFrame(() => scrollWorkToSelected("auto"));
      }
    };
    window.addEventListener("popstate", syncWorkHistory);
    return () => window.removeEventListener("popstate", syncWorkHistory);
  // The history handler reads the current Work frame when the browser dispatches popstate.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubProjects, workspace]);

  useEffect(() => {
    if (workspace.activeApp !== "work") return;
    return workspace.registerBackHandler("work-navigation", () => {
      if (workspace.activeWindow !== "work") return false;
      if (workView === "full-case") return false;
      if (workView === "github-project") {
        returnToProjectIndex();
        return true;
      }
      if (workspace.mode !== "computer" && isWorkOpen) {
        workspace.goHome();
        return true;
      }
      return false;
    });
  // The handler deliberately follows the currently visible Work depth.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkOpen, workView, workspace.activeApp, workspace.activeWindow, workspace.mode]);

  useEffect(() => () => closeTimers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    for (const app of mainWindowIds) {
      if (workspace.isAppOpen(app)) { openedApps.current.add(app); continue; }
      if (!openedApps.current.has(app)) continue;
      openedApps.current.delete(app);
      if (app === "work") setWorkView("index");
      // A closed application must not keep addressing its document, or a refresh would reopen it.
      if (decodeWorkspaceRoute(window.location.href).app === app) workspaceHistory.replaceState(null, portfolioTitle.default, "/");
    }
  }, [workspace]);

  useEffect(() => {
    // The route's query conditions seed the first case only; later opens start from defaults.
    if (workView === "full-case" && workspace.isAppOpen("work")) initialConditionsConsumed.current = true;
  }, [workView, workspace]);

  useEffect(() => {
    if (!activeWindow || !mainWindowIds.includes(activeWindow as WorkspaceWindow) || (activeWindow === "work" && workView === "full-case")) return;
    const closeActiveWithEscape = (event: KeyboardEvent) => {
      // A child (search field, evidence, repository preview) answers Escape before its application.
      if (event.key !== "Escape" || event.defaultPrevented || workspace.surface !== "application") return;
      if (activeWindow === "work" && workView === "github-project") { returnToProjectIndex(); return; }
      closeWindow(activeWindow as WorkspaceWindow);
    };
    window.addEventListener("keydown", closeActiveWithEscape);
    return () => window.removeEventListener("keydown", closeActiveWithEscape);
  // Close behavior intentionally follows the currently focused OS window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWindow, closingWindows, workView]);

  useEffect(() => {
    const unregister = [
      workspace.registerAppLauncher("work", (documentId) => {
        const slug = documentId?.startsWith("case:") ? documentId.slice(5) : null;
        if (slug && scenarios.some((scenario) => scenario.slug === slug)) { openCaseWindow(slug as ScenarioSlug); return; }
        const repository = documentId?.startsWith("project:") ? documentId.slice(8) : null;
        if (repository) { openGithubProject(repository); return; }
        openWindow("work", workspace.isAppOpen("work") ? undefined : "selected-work");
      }),
      workspace.registerAppLauncher("experience", () => openWindow("experience")),
      workspace.registerAppLauncher("products", () => openWindow("products")),
    ];
    return () => unregister.forEach((remove) => remove());
  // The handlers should read the latest open/focus state without forcing stable callbacks through the window model.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWindows, workspace]);

  function openContactWindow(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    workspace.launchApp("contact");
  }

  function openWorkFromExperience(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    openWindow("work", "selected-work");
  }

  function windowState(windowName: WorkspaceWindow) {
    if (!workspace.modeReady && ((windowName === "work" && (initialCaseSlug || initialGithubProjectId)) || (windowName === "experience" && initialExperienceOpen) || (windowName === "products" && initialProductsOpen))) return "active";
    return workspace.stateFor(windowName);
  }

  function frameStyle(frameStyle: CSSProperties, windowName: WorkspaceWindow) {
    return {
      ...frameStyle,
      "--window-z": String(workspace.zIndexFor(windowName)),
    } as CSSProperties;
  }

  function selectedScenarioFor(slug: ScenarioSlug) {
    return scenarios.find((scenario) => scenario.slug === slug)!;
  }

  const selectedScenario = selectedScenarioFor(selectedCaseSlug);
  const selectedGithubProject = githubProjects.find((project) => project.id === selectedGithubProjectId) ?? githubProjects[0];

  return (
    <>
      <main
        className={`home-page editorial-home ${hasOpenWindows ? "has-work-window" : "is-desktop"}`}
        data-system-mode={workspace.mode}
        data-workspace-paired={workspace.paired && (workspace.activeApp === "work" || workspace.activeApp === "experience") && isWorkOpen && isExperienceOpen && workspace.surface === "application"}
        id="main-content"
        tabIndex={-1}
      >
        <DesktopSurface onOpenCase={openCaseWindow} onOpenWindow={openWindow} />
        <WindowSnapPreview edge={activeSnapCandidate} />
        {hasOpenWindows ? (
          <>
          {isWorkOpen ? <ApplicationFrame windowId="work" documentId={workView === "full-case" ? `case:${selectedCaseSlug}` : workView === "github-project" ? `project:${selectedGithubProjectId}` : workView} resizeHandleProps={workResizeHandleProps}
            className={`portfolio-window home-window workspace-work-window ${workView === "full-case" ? "workspace-case-window" : ""} ${workView === "github-project" ? "workspace-github-project-window" : ""}`.trim()}
            aria-label="Projects window"
            data-active-window={activeWindow === "work"}
            data-app-id="work"
            data-closing={closingWindows.includes("work")}
            data-dragging={workDragging}
            data-resizing={workResizing}
            data-snap={workSnap ?? undefined}
            data-snap-candidate={workSnapCandidate ?? undefined}
            data-view={workView}
            data-window-state={windowState("work")}
            onFocusCapture={(event) => {
              if ((event.target as Element).closest(".evidence-dialog")) return;
              focusWindow("work");
            }}
            onPointerDown={(event) => {
              if ((event.target as Element).closest(".evidence-dialog")) return;
              focusWindow("work");
            }}
            frameRef={workFrameRef}
            style={frameStyle(workWindowStyle, "work")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome
              actions={workView === "github-project" ? <div className="case-workspace-actions case-preview-titlebar-actions">
                <button className="case-back-action" onClick={returnToProjectIndex} type="button"><ChevronIcon /><span className="case-back-label">All projects</span></button>
              </div> : workView === "full-case" ? <div className="case-workspace-actions case-preview-titlebar-actions">
                <button className="case-back-action" onClick={() => closeDetailedCaseWindow(selectedCaseSlug)} type="button"><ChevronIcon /><span className="case-back-label">All projects</span></button>
              </div> : null}
              app="work"
              className="portfolio-window-chrome"
              closeLabel="Close Projects window"
              closeRef={workCloseRef}
              compactBackLabel="Return to project list"
              compactBackText="Projects"
              label="Projects"
              maximized={workMaximized}
              onClose={() => closeApplication("work", "work")}
              onCompactBack={workspace.mode !== "computer" && workView !== "index" ? workspace.requestBack : undefined}
              onMinimize={() => workspace.minimizeWindow("work")}
              onToggleMaximize={toggleWorkMaximize}
              title={workView === "index" ? undefined : workView === "github-project" ? selectedGithubProject?.displayName : caseDetails[selectedCaseSlug].area}
              {...workTitlebarProps}
            />
            {workView === "index" ? <div className="portfolio-window-content" ref={workContentRef}>
              <section className="editorial-work projects-index" id="selected-work" aria-labelledby="work-title">
                <div className="work-intro">
                  <div className="projects-index-heading">
                    <h1 id="work-title">Engineering cases</h1>
                  </div>
                  <p>Three small public projects, each built around one failure in payments, monitoring, or Android security.<span className="work-intro-how"> Open one to read what went wrong and the decision that handles it, then run it yourself.</span></p>
                </div>
                <div className="editorial-work-list">
                  {scenarios.map((scenario) => <WorkRow scenario={scenario} key={scenario.slug} onOpenCase={openCaseWindow} />)}
                </div>
              </section>

              {githubLoading ? <section className="github-project-index" aria-label="Side projects" aria-busy="true"><p>Loading side projects…</p></section> : <GithubProjectsIndex onOpenProject={openGithubProject} projects={githubProjects} source={githubProjectsSource} />}

              <p className="editorial-footer">
                Role history, scope, and the CV are in{" "}
                <a href="/brief" onClick={(event) => {
                  event.preventDefault();
                  openWindow("experience");
                }}>Experience <ChevronIcon direction="right" /></a>
              </p>
            </div> : workView === "github-project" && selectedGithubProject ? (
              <GithubProjectPreview key={selectedGithubProject.id} onSelectProject={selectGithubProject} project={selectedGithubProject} projects={githubProjects} />
            ) : (
              <DebuggerWorkspace
                embedded
                initialConditions={!initialConditionsConsumed.current && initialCaseSlug === selectedCaseSlug && initialCaseConditions ? initialCaseConditions : { ...selectedScenario.defaults }}
                onClose={() => closeDetailedCaseWindow(selectedCaseSlug)}
                onSelectScenario={switchDetailedCase}
                scenario={selectedScenario}
                scrollContainerRef={workFrameRef}
                workspaceWindowId="work"
              />
            )}
          </ApplicationFrame> : null}
          {isExperienceOpen ? <ApplicationFrame windowId="experience" resizeHandleProps={experienceResizeHandleProps}
            className="portfolio-window home-window workspace-experience-window"
            aria-label="Experience window"
            data-active-window={activeWindow === "experience"}
            data-app-id="experience"
            data-closing={closingWindows.includes("experience")}
            data-dragging={experienceDragging}
            data-resizing={experienceResizing}
            data-snap={experienceSnap ?? undefined}
            data-snap-candidate={experienceSnapCandidate ?? undefined}
            data-view="brief"
            data-window-state={windowState("experience")}
            onFocusCapture={() => focusWindow("experience")}
            onPointerDown={() => focusWindow("experience")}
            frameRef={experienceFrameRef}
            style={frameStyle(experienceWindowStyle, "experience")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome
              app="experience"
              className="portfolio-window-chrome"
              closeLabel="Close experience window"
              closeRef={experienceCloseRef}
              label="Experience"
              maximized={experienceMaximized}
              onClose={() => closeApplication("experience", "experience")}
              onMinimize={() => workspace.minimizeWindow("experience")}
              onToggleMaximize={toggleExperienceMaximize}
              {...experienceTitlebarProps}
            />
            <ExperienceBriefContent onOpenContact={openContactWindow} onOpenWork={openWorkFromExperience} />
          </ApplicationFrame> : null}
          {isProductsOpen ? <ApplicationFrame windowId="products" resizeHandleProps={productsResizeHandleProps}
            className="portfolio-window home-window product-links-window"
            aria-label="Product Links window"
            data-active-window={activeWindow === "products"}
            data-app-id="products"
            data-closing={closingWindows.includes("products")}
            data-dragging={productsDragging}
            data-resizing={productsResizing}
            data-snap={productsSnap ?? undefined}
            data-snap-candidate={productsSnapCandidate ?? undefined}
            data-window-state={windowState("products")}
            onFocusCapture={() => focusWindow("products")}
            onPointerDown={() => focusWindow("products")}
            frameRef={productsFrameRef}
            style={frameStyle(productsWindowStyle, "products")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome
              app="products"
              className="portfolio-window-chrome product-links-window-chrome"
              closeLabel="Close product links"
              closeRef={productsCloseRef}
              label="Product Links"
              maximized={productsMaximized}
              onClose={() => closeApplication("products", "products")}
              onMinimize={() => workspace.minimizeWindow("products")}
              onToggleMaximize={toggleProductsMaximize}
              {...productsTitlebarProps}
            />
            <ProductLinksAppContent />
          </ApplicationFrame> : null}
          </>
        ) : null}
      </main>
    </>
  );
}
