"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";

export type WorkspaceWindowId = "work" | "experience" | "case" | "detail" | "contact" | "evidence";
export type WorkspaceWindowState = "active" | "clear" | "blurred" | "closed";

export type WorkspaceState = {
  focus: WorkspaceWindowId[];
  open: WorkspaceWindowId[];
};

type WorkspaceAction =
  | { type: "open"; id: WorkspaceWindowId }
  | { type: "close"; id: WorkspaceWindowId }
  | { type: "focus"; id: WorkspaceWindowId }
  | { type: "show-only"; id: WorkspaceWindowId };

export const initialWorkspaceState: WorkspaceState = { open: ["work"], focus: ["work"] };

function promote(items: WorkspaceWindowId[], id: WorkspaceWindowId) {
  return [...items.filter((item) => item !== id), id];
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  if (action.type === "open") {
    return {
      open: state.open.includes(action.id) ? state.open : [...state.open, action.id],
      focus: promote(state.focus.filter((item) => state.open.includes(item) || item === action.id), action.id),
    };
  }

  if (action.type === "focus") {
    if (!state.open.includes(action.id)) return state;
    return { ...state, focus: promote(state.focus, action.id) };
  }

  if (action.type === "show-only") {
    return { open: [action.id], focus: [action.id] };
  }

  return {
    open: state.open.filter((item) => item !== action.id),
    focus: state.focus.filter((item) => item !== action.id),
  };
}

export function workspaceWindowState(state: WorkspaceState, id: WorkspaceWindowId): WorkspaceWindowState {
  if (!state.open.includes(id)) return "closed";
  const orderedOpen = state.focus.filter((item) => state.open.includes(item));
  if (orderedOpen.at(-1) === id) return "active";
  return new Set(orderedOpen.slice(-2)).has(id) ? "clear" : "blurred";
}

type WorkspaceManagerValue = {
  activeWindow: WorkspaceWindowId | null;
  closeWindow: (id: WorkspaceWindowId) => void;
  focusWindow: (id: WorkspaceWindowId) => void;
  isOpen: (id: WorkspaceWindowId) => boolean;
  openWindow: (id: WorkspaceWindowId) => void;
  openWindows: WorkspaceWindowId[];
  showOnlyWindow: (id: WorkspaceWindowId) => void;
  stateFor: (id: WorkspaceWindowId) => WorkspaceWindowState;
  zIndexFor: (id: WorkspaceWindowId) => number;
};

const WorkspaceManagerContext = createContext<WorkspaceManagerValue | null>(null);

export function WorkspaceManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const orderedOpen = useMemo(() => state.focus.filter((item) => state.open.includes(item)), [state.focus, state.open]);
  const activeWindow = orderedOpen.at(-1) ?? null;

  const openWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "open", id }), []);
  const closeWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "close", id }), []);
  const focusWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "focus", id }), []);
  const showOnlyWindow = useCallback((id: WorkspaceWindowId) => dispatch({ type: "show-only", id }), []);
  const isOpen = useCallback((id: WorkspaceWindowId) => state.open.includes(id), [state.open]);
  const stateFor = useCallback((id: WorkspaceWindowId): WorkspaceWindowState => {
    return workspaceWindowState(state, id);
  }, [state]);
  const zIndexFor = useCallback((id: WorkspaceWindowId) => {
    const index = orderedOpen.indexOf(id);
    return index < 0 ? 0 : 24 + index * 8;
  }, [orderedOpen]);

  const value = useMemo<WorkspaceManagerValue>(() => ({
    activeWindow,
    closeWindow,
    focusWindow,
    isOpen,
    openWindow,
    openWindows: state.open,
    showOnlyWindow,
    stateFor,
    zIndexFor,
  }), [activeWindow, closeWindow, focusWindow, isOpen, openWindow, showOnlyWindow, state.open, stateFor, zIndexFor]);

  return <WorkspaceManagerContext.Provider value={value}>{children}</WorkspaceManagerContext.Provider>;
}

export function useWorkspaceManager() {
  const context = useContext(WorkspaceManagerContext);
  if (!context) throw new Error("useWorkspaceManager must be used inside WorkspaceManagerProvider");
  return context;
}
