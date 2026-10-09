"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { capabilitiesForWindow, capabilitiesForViewport, initialDeviceCapabilities, type DeviceCapabilities } from "../lib/device-capabilities";
import type { FrameRect } from "./use-window-frame";
import { setWorkspaceStackManaged } from "../lib/workspace-navigation";
import { portfolioTitle } from "../lib/portfolio-identity";

export type DeviceMode = "computer" | "tablet" | "phone";
export type PortfolioAppId = "work" | "experience" | "contact" | "products";
export type SystemSurface = "home" | "application" | "recents";
export type ProjectWindowId = "case-payflow" | "case-iyup" | "case-trustgate";
export type EvidenceWindowId =
  | "evidence-payflow-01"
  | "evidence-payflow-02"
  | "evidence-iyup-01"
  | "evidence-iyup-02"
  | "evidence-trustgate-01"
  | "evidence-trustgate-02";
export type WorkspaceWindowId =
  | "work"
  | "experience"
  | "case"
  | ProjectWindowId
  | "detail"
  | "contact"
  | "evidence"
  | EvidenceWindowId
  | "products";
export type WorkspaceWindowState = "active" | "clear" | "blurred" | "background" | "minimized" | "closed";

export type WorkspaceState = {
  focus: WorkspaceWindowId[];
  minimized: WorkspaceWindowId[];
  mode: DeviceMode;
  modeReady: boolean;
  open: WorkspaceWindowId[];
  recents: PortfolioAppId[];
  surface: SystemSurface;
  paired?: boolean;
};

export type WorkspaceAction =
  | { type: "open"; id: WorkspaceWindowId }
  | { type: "close"; id: WorkspaceWindowId }
  | { type: "close-app"; app: PortfolioAppId }
  | { type: "focus"; id: WorkspaceWindowId }
  | { type: "focus-app"; app: PortfolioAppId }
  | { type: "minimize-app"; app: PortfolioAppId }
  | { type: "minimize-window"; id: WorkspaceWindowId }
  | { type: "surface"; surface: SystemSurface }
  | { type: "sync-mode"; mode: DeviceMode };

export const initialWorkspaceState: WorkspaceState = {
  open: [],
  focus: [],
  minimized: [],
  mode: "computer",
  modeReady: false,
  recents: [],
  surface: "home",
};

export function appForWindow(id: WorkspaceWindowId): PortfolioAppId {
  if (id === "experience") return "experience";
  if (id === "contact") return "contact";
  if (id === "products") return "products";
  return "work";
}

function primaryWindowFor(app: PortfolioAppId): WorkspaceWindowId {
  return app;
}

function isChildDocument(id: WorkspaceWindowId) {
  return id === "detail" || id === "evidence" || id.startsWith("evidence-");
}

function promote<T>(items: T[], id: T) {
  return [...items.filter((item) => item !== id), id];
}

function openWindowsForApp(state: WorkspaceState, app: PortfolioAppId) {
  return state.open.filter((id) => appForWindow(id) === app);
}

function mostRecentWindowForApp(state: WorkspaceState, app: PortfolioAppId) {
  return [...state.focus].reverse().find((id) => state.open.includes(id) && appForWindow(id) === app)
    ?? openWindowsForApp(state, app).at(-1)
    ?? primaryWindowFor(app);
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  if (action.type === "sync-mode") {
    if (state.mode === action.mode && state.modeReady) return state;
    return {
      ...state,
      mode: action.mode,
      modeReady: true,
      surface: state.surface === "recents" ? "application" : state.surface,
    };
  }

  if (action.type === "surface") {
    return { ...state, surface: action.surface };
  }

  if (action.type === "open") {
    const app = appForWindow(action.id);
    return {
      ...state,
      open: state.open.includes(action.id) ? state.open : [...state.open, action.id],
      focus: promote(state.focus.filter((item) => state.open.includes(item) || item === action.id), action.id),
      minimized: state.minimized.filter((item) => item !== action.id),
      recents: promote(state.recents, app),
      surface: "application",
    };
  }

  if (action.type === "focus") {
    if (!state.open.includes(action.id)) return state;
    const app = appForWindow(action.id);
    return {
      ...state,
      focus: promote(state.focus, action.id),
      minimized: state.minimized.filter((item) => item !== action.id),
      recents: promote(state.recents, app),
      surface: "application",
    };
  }

  if (action.type === "focus-app") {
    const id = mostRecentWindowForApp(state, action.app);
    const open = state.open.includes(id) ? state.open : [...state.open, id];
    return {
      ...state,
      open,
      focus: promote(state.focus.filter((item) => open.includes(item) || item === id), id),
      minimized: state.minimized.filter((item) => item !== id),
      recents: promote(state.recents, action.app),
      surface: "application",
    };
  }

  if (action.type === "minimize-app") {
    const appWindows = openWindowsForApp(state, action.app);
    if (!appWindows.length) return state;
    return {
      ...state,
      focus: state.focus.filter((id) => appForWindow(id) !== action.app),
      minimized: [...state.minimized.filter((id) => !appWindows.includes(id)), ...appWindows],
      recents: promote(state.recents, action.app),
      surface: state.focus.some((id) => state.open.includes(id) && appForWindow(id) !== action.app)
        ? "application"
        : "home",
    };
  }

  if (action.type === "minimize-window") {
    if (!state.open.includes(action.id)) return state;
    const focus = state.focus.filter((id) => id !== action.id);
    return {
      ...state,
      focus,
      minimized: promote(state.minimized, action.id),
      recents: promote(state.recents, appForWindow(action.id)),
      surface: focus.some((id) => state.open.includes(id) && !state.minimized.includes(id)) ? "application" : "home",
    };
  }

  if (action.type === "close-app") {
    const remainingOpen = state.open.filter((id) => appForWindow(id) !== action.app);
    const remainingFocus = state.focus.filter((id) => remainingOpen.includes(id));
    return {
      ...state,
      open: remainingOpen,
      focus: remainingFocus,
      minimized: state.minimized.filter((id) => appForWindow(id) !== action.app),
      recents: state.recents.filter((item) => item !== action.app),
      // Closing a card in the phone's Recents leaves Recents open on the remaining cards.
      surface: state.mode === "phone" && state.surface === "recents"
        ? "recents"
        : remainingFocus.length ? "application" : "home",
    };
  }

  const app = appForWindow(action.id);
  const open = state.open.filter((item) => item !== action.id);
  const focus = state.focus.filter((item) => item !== action.id);
  const appStillOpen = open.some((id) => appForWindow(id) === app);
  return {
    ...state,
    open,
    focus,
    minimized: state.minimized.filter((item) => item !== action.id),
    recents: appStillOpen ? state.recents : state.recents.filter((item) => item !== app),
    surface: focus.length ? state.surface : "home",
  };
}

export function workspaceWindowState(state: WorkspaceState, id: WorkspaceWindowId): WorkspaceWindowState {
  if (!state.open.includes(id)) return "closed";
  const app = appForWindow(id);
  if (state.minimized.includes(id)) return "minimized";
  const orderedOpen = state.focus.filter((item) => state.open.includes(item));
  const active = orderedOpen.at(-1);
  if (state.surface !== "application") return "background";
  if (active === id) return "active";
  const activeApp = active ? appForWindow(active) : null;
  if (state.mode === "phone") return "background";
  if (state.mode === "tablet") {
    // Pairing is the explicit Projects + Experience stage; any other combination stays single-pane.
    const stage = new Set(orderedOpen.slice(-2));
    return state.paired && stage.has("work") && stage.has("experience") && stage.has(id) ? "clear" : "background";
  }
  if (activeApp && app !== activeApp) {
    const recentApps = [...orderedOpen]
      .reverse()
      .map(appForWindow)
      .filter((item, index, items) => items.indexOf(item) === index)
      .slice(0, 2);
    if (!recentApps.includes(app)) return "blurred";
    const representative = [...orderedOpen].reverse().find((windowId) => (
      !isChildDocument(windowId) && appForWindow(windowId) === app
    ));
    return representative === id ? "clear" : "blurred";
  }
  return new Set(orderedOpen.slice(-2)).has(id) ? "clear" : "blurred";
}

type BackHandler = () => boolean;
export type AppDocumentState = { documentId: string; scroll?: number; geometry?: FrameRect; data?: Record<string, unknown> };

type WorkspaceManagerValue = {
  capabilities: DeviceCapabilities;
  modeReady: boolean;
  paired: boolean;
  setPaired: (paired: boolean) => void;
  readDocumentState: (app: PortfolioAppId, documentId: string) => AppDocumentState | undefined;
  writeDocumentState: (app: PortfolioAppId, documentId: string, update: Partial<AppDocumentState>) => void;
  activeApp: PortfolioAppId | null;
  activeWindow: WorkspaceWindowId | null;
  closeApp: (app: PortfolioAppId) => void;
  closeWindow: (id: WorkspaceWindowId) => void;
  dismissRecents: () => void;
  focusApp: (app: PortfolioAppId) => void;
  focusWindow: (id: WorkspaceWindowId) => void;
  goHome: () => void;
  isAppOpen: (app: PortfolioAppId) => boolean;
  isMinimized: (app: PortfolioAppId) => boolean;
  isOpen: (id: WorkspaceWindowId) => boolean;
  minimizeApp: (app: PortfolioAppId) => void;
  minimizeWindow: (id: WorkspaceWindowId) => void;
  mode: DeviceMode;
  openRecents: () => void;
  openWindow: (id: WorkspaceWindowId) => void;
  openWindows: WorkspaceWindowId[];
  recentApps: PortfolioAppId[];
  registerBackHandler: (key: string, handler: BackHandler) => () => void;
  /** A launcher opens or focuses its app; `documentId` (e.g. "case:payflow") opens that document inside it. */
  registerAppLauncher: (app: PortfolioAppId, launch: (documentId?: string) => void) => () => void;
  launchApp: (app: PortfolioAppId, documentId?: string) => boolean;
  requestBack: () => void;
  stateFor: (id: WorkspaceWindowId) => WorkspaceWindowState;
  surface: SystemSurface;
  zIndexFor: (id: WorkspaceWindowId) => number;
};

const WorkspaceManagerContext = createContext<WorkspaceManagerValue | null>(null);

export function modeForViewport(width: number, height: number, coarsePointer = false, hover = !coarsePointer): DeviceMode {
  return capabilitiesForViewport({ width, height, coarsePointer, hover }).mode;
}

export function WorkspaceManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const [capabilities, setCapabilities] = useState(initialDeviceCapabilities);
  const [pairRequested, setPaired] = useState(false);
  const documents = useRef(new Map<string, AppDocumentState>());
  const paired = pairRequested && capabilities.pairingEligible;
  const readDocumentState = useCallback((app: PortfolioAppId, documentId: string) => documents.current.get(`${app}/${documentId}`), []);
  const writeDocumentState = useCallback((app: PortfolioAppId, documentId: string, update: Partial<AppDocumentState>) => {
    const key = `${app}/${documentId}`;
    documents.current.set(key, { ...documents.current.get(key), ...update, documentId });
  }, []);
  const backHandlers = useRef<Array<{ handler: BackHandler; key: string }>>([]);
  const appLaunchers = useRef(new Map<PortfolioAppId, (documentId?: string) => void>());
  const registerAppLauncher = useCallback((app: PortfolioAppId, launch: (documentId?: string) => void) => {
    appLaunchers.current.set(app, launch);
    return () => { if (appLaunchers.current.get(app) === launch) appLaunchers.current.delete(app); };
  }, []);
  const launchApp = useCallback((app: PortfolioAppId, documentId?: string) => {
    const launch = appLaunchers.current.get(app);
    if (!launch) return false;
    launch(documentId);
    return true;
  }, []);
  const orderedOpen = useMemo(() => state.focus.filter((item) => state.open.includes(item)), [state.focus, state.open]);
  const activeWindow = orderedOpen.at(-1) ?? null;
  const activeApp = activeWindow ? appForWindow(activeWindow) : null;

  useEffect(() => {
    const coarsePointer = typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)")
      : null;
    const hover = typeof window.matchMedia === "function" ? window.matchMedia("(hover: hover)") : null;
    const sync = () => {
      const next = capabilitiesForWindow();
      // Resize streams must not re-render every consumer when nothing material changed.
      setCapabilities((current) => (
        current.mode === next.mode && current.width === next.width && current.height === next.height
          && current.coarsePointer === next.coarsePointer && current.hover === next.hover
          && current.pairingEligible === next.pairingEligible
          ? current
          : next
      ));
      dispatch({ type: "sync-mode", mode: next.mode });
    };
    sync();
    window.addEventListener("resize", sync);
    coarsePointer?.addEventListener("change", sync);
    hover?.addEventListener("change", sync);
    return () => {
      window.removeEventListener("resize", sync);
      coarsePointer?.removeEventListener("change", sync);
      hover?.removeEventListener("change", sync);
    };
  }, []);

  // Layout timing publishes the mode before child passive effects measure mode-dependent CSS.
  // Values are overwritten in place: removing them between commits would let child layout
  // effects (window geometry, minimize vectors) measure against unstyled system chrome.
  useLayoutEffect(() => {
    document.documentElement.dataset.systemMode = state.mode;
    document.documentElement.dataset.systemSurface = state.surface;
    document.documentElement.dataset.systemApp = activeApp ?? "none";
    document.documentElement.dataset.workspacePaired = String(paired);
  }, [activeApp, paired, state.mode, state.surface]);
  // A phone keeps one history entry per visible level, so the page's Back and the system back
  // gesture agree. Layout timing hands history over before any document syncs its stack.
  useLayoutEffect(() => {
    setWorkspaceStackManaged(state.modeReady && state.mode === "phone", portfolioTitle.default);
  }, [state.mode, state.modeReady]);
  useLayoutEffect(() => () => {
    delete document.documentElement.dataset.systemMode;
    delete document.documentElement.dataset.systemSurface;
    delete document.documentElement.dataset.systemApp;
    delete document.documentElement.dataset.workspacePaired;
  }, []);

  const openWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "open", id }), []);
  const closeWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "close", id }), []);
  const focusWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "focus", id }), []);
  const focusApp = useCallback((app: PortfolioAppId) => dispatch({ type: "focus-app", app }), []);
  const closeApp = useCallback((app: PortfolioAppId) => {
    for (const key of documents.current.keys()) if (key.startsWith(`${app}/`)) documents.current.delete(key);
    dispatch({ type: "close-app", app });
  }, []);
  const minimizeApp = useCallback((app: PortfolioAppId) => dispatch({ type: "minimize-app", app }), []);
  const minimizeWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "minimize-window", id }), []);
  const goHome = useCallback(() => dispatch({ type: "surface", surface: "home" }), []);
  const openRecents = useCallback(() => dispatch({ type: "surface", surface: "recents" }), []);
  const dismissRecents = useCallback(() => dispatch({ type: "surface", surface: activeWindow ? "application" : "home" }), [activeWindow]);
  const isOpen = useCallback((id: WorkspaceWindowId) => state.open.includes(id), [state.open]);
  const isAppOpen = useCallback((app: PortfolioAppId) => state.open.some((id) => appForWindow(id) === app), [state.open]);
  const isMinimized = useCallback((app: PortfolioAppId) => {
    const windows = state.open.filter((id) => appForWindow(id) === app);
    return windows.length > 0 && windows.every((id) => state.minimized.includes(id));
  }, [state.minimized, state.open]);
  const stateFor = useCallback((id: WorkspaceWindowId) => workspaceWindowState({ ...state, paired }, id), [paired, state]);
  const zIndexFor = useCallback((id: WorkspaceWindowId) => {
    const index = orderedOpen.indexOf(id);
    return index < 0 ? 0 : 24 + index * 8;
  }, [orderedOpen]);
  const registerBackHandler = useCallback((key: string, handler: BackHandler) => {
    backHandlers.current = [...backHandlers.current.filter((item) => item.key !== key), { key, handler }];
    return () => {
      backHandlers.current = backHandlers.current.filter((item) => item.key !== key);
    };
  }, []);
  const requestBack = useCallback(() => {
    if (state.surface === "recents") {
      dispatch({ type: "surface", surface: activeWindow ? "application" : "home" });
      return;
    }
    if (state.surface === "home") return;
    const handlers = [...backHandlers.current].reverse();
    if (handlers.some(({ handler }) => handler())) return;
    dispatch({ type: "surface", surface: "home" });
  }, [activeWindow, state.surface]);

  const value = useMemo<WorkspaceManagerValue>(() => ({
    capabilities,
    modeReady: state.modeReady,
    paired,
    setPaired,
    readDocumentState,
    writeDocumentState,
    activeApp,
    activeWindow,
    closeApp,
    closeWindow,
    dismissRecents,
    focusApp,
    focusWindow,
    goHome,
    isAppOpen,
    isMinimized,
    isOpen,
    minimizeApp,
    minimizeWindow,
    mode: state.mode,
    openRecents,
    openWindow,
    openWindows: state.open,
    recentApps: state.recents,
    registerBackHandler,
    registerAppLauncher,
    launchApp,
    requestBack,
    stateFor,
    surface: state.surface,
    zIndexFor,
  }), [launchApp, registerAppLauncher, capabilities, paired, readDocumentState, writeDocumentState, activeApp, activeWindow, closeApp, closeWindow, dismissRecents, focusApp, focusWindow, goHome, isAppOpen, isMinimized, isOpen, minimizeApp, minimizeWindow, openRecents, openWindow, registerBackHandler, requestBack, state.mode, state.modeReady, state.open, state.recents, state.surface, stateFor, zIndexFor]);

  return <WorkspaceManagerContext.Provider value={value}>{children}</WorkspaceManagerContext.Provider>;
}

export function useWorkspaceManager() {
  const context = useContext(WorkspaceManagerContext);
  if (!context) throw new Error("useWorkspaceManager must be used inside WorkspaceManagerProvider");
  return context;
}

export function useOptionalWorkspaceManager() {
  return useContext(WorkspaceManagerContext);
}
