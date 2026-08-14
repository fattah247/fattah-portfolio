"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

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
};

export type WorkspaceAction =
  | { type: "open"; id: WorkspaceWindowId }
  | { type: "close"; id: WorkspaceWindowId }
  | { type: "close-app"; app: PortfolioAppId }
  | { type: "focus"; id: WorkspaceWindowId }
  | { type: "focus-app"; app: PortfolioAppId }
  | { type: "minimize-app"; app: PortfolioAppId }
  | { type: "minimize-window"; id: WorkspaceWindowId }
  | { type: "show-only"; id: WorkspaceWindowId }
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

  if (action.type === "show-only") {
    // Kept for legacy callers, but compact switching must preserve sessions.
    const app = appForWindow(action.id);
    const open = state.open.includes(action.id) ? state.open : [...state.open, action.id];
    return {
      ...state,
      open,
      focus: promote(state.focus.filter((item) => open.includes(item)), action.id),
      minimized: state.minimized.filter((item) => item !== action.id),
      recents: promote(state.recents, app),
      surface: "application",
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
      surface: remainingFocus.length ? "application" : "home",
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
    return new Set(orderedOpen.slice(-2)).has(id) ? "clear" : "background";
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

type WorkspaceManagerValue = {
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
  requestBack: () => void;
  showOnlyWindow: (id: WorkspaceWindowId) => void;
  stateFor: (id: WorkspaceWindowId) => WorkspaceWindowState;
  surface: SystemSurface;
  toggleApp: (app: PortfolioAppId) => void;
  zIndexFor: (id: WorkspaceWindowId) => number;
};

const WorkspaceManagerContext = createContext<WorkspaceManagerValue | null>(null);

export function modeForViewport(width: number, height: number, coarsePointer = false): DeviceMode {
  if (Math.min(width, height) <= 500) return "phone";
  if (coarsePointer || width <= 1100) return "tablet";
  return "computer";
}

export function WorkspaceManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const backHandlers = useRef<Array<{ handler: BackHandler; key: string }>>([]);
  const orderedOpen = useMemo(() => state.focus.filter((item) => state.open.includes(item)), [state.focus, state.open]);
  const activeWindow = orderedOpen.at(-1) ?? null;
  const activeApp = activeWindow ? appForWindow(activeWindow) : null;

  useEffect(() => {
    const coarsePointer = typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)")
      : null;
    const sync = () => dispatch({
      type: "sync-mode",
      mode: modeForViewport(
        window.innerWidth,
        window.innerHeight,
        coarsePointer?.matches ?? false,
      ),
    });
    sync();
    window.addEventListener("resize", sync);
    coarsePointer?.addEventListener("change", sync);
    return () => {
      window.removeEventListener("resize", sync);
      coarsePointer?.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.systemMode = state.mode;
    document.documentElement.dataset.systemSurface = state.surface;
    document.documentElement.dataset.systemApp = activeApp ?? "none";
    return () => {
      delete document.documentElement.dataset.systemMode;
      delete document.documentElement.dataset.systemSurface;
      delete document.documentElement.dataset.systemApp;
    };
  }, [activeApp, state.mode, state.surface]);

  const openWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "open", id }), []);
  const closeWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "close", id }), []);
  const focusWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "focus", id }), []);
  const showOnlyWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "show-only", id }), []);
  const focusApp = useCallback((app: PortfolioAppId) => dispatch({ type: "focus-app", app }), []);
  const closeApp = useCallback((app: PortfolioAppId) => dispatch({ type: "close-app", app }), []);
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
  const stateFor = useCallback((id: WorkspaceWindowId) => workspaceWindowState(state, id), [state]);
  const zIndexFor = useCallback((id: WorkspaceWindowId) => {
    const index = orderedOpen.indexOf(id);
    return index < 0 ? 0 : 24 + index * 8;
  }, [orderedOpen]);
  const toggleApp = useCallback((app: PortfolioAppId) => {
    if (state.surface === "application" && activeApp === app && activeWindow && !state.minimized.includes(activeWindow)) {
      dispatch({ type: "minimize-app", app });
      return;
    }
    dispatch({ type: "focus-app", app });
  }, [activeApp, activeWindow, state.minimized, state.surface]);
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
    requestBack,
    showOnlyWindow,
    stateFor,
    surface: state.surface,
    toggleApp,
    zIndexFor,
  }), [activeApp, activeWindow, closeApp, closeWindow, dismissRecents, focusApp, focusWindow, goHome, isAppOpen, isMinimized, isOpen, minimizeApp, minimizeWindow, openRecents, openWindow, registerBackHandler, requestBack, showOnlyWindow, state.mode, state.open, state.recents, state.surface, stateFor, toggleApp, zIndexFor]);

  return <WorkspaceManagerContext.Provider value={value}>{children}</WorkspaceManagerContext.Provider>;
}

export function useWorkspaceManager() {
  const context = useContext(WorkspaceManagerContext);
  if (!context) throw new Error("useWorkspaceManager must be used inside WorkspaceManagerProvider");
  return context;
}
