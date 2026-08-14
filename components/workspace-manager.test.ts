import { describe, expect, it } from "vitest";
import {
  appForWindow,
  initialWorkspaceState,
  modeForViewport,
  workspaceReducer,
  workspaceWindowState,
  type WorkspaceState,
} from "./workspace-manager";

function reduce(
  state: WorkspaceState,
  ...actions: Parameters<typeof workspaceReducer>[1][]
) {
  return actions.reduce(workspaceReducer, state);
}

describe("workspaceReducer", () => {
  it("boots into an empty desktop session", () => {
    expect(initialWorkspaceState).toMatchObject({
      focus: [],
      minimized: [],
      mode: "computer",
      modeReady: false,
      open: [],
      recents: [],
      surface: "home",
    });
    expect(workspaceWindowState(initialWorkspaceState, "work")).toBe("closed");
  });

  it("opens applications without duplicating an already open window", () => {
    const state = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "experience" },
      { type: "open", id: "work" },
    );

    expect(state.open).toEqual(["work", "experience"]);
    expect(state.focus).toEqual(["experience", "work"]);
    expect(state.recents).toEqual(["experience", "work"]);
    expect(state.surface).toBe("application");
  });

  it("focuses the most recent window belonging to an application", () => {
    const state = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "case" },
      { type: "open", id: "detail" },
      { type: "open", id: "experience" },
      { type: "focus-app", app: "work" },
    );

    expect(state.open).toEqual(["work", "case", "detail", "experience"]);
    expect(state.focus.at(-1)).toBe("detail");
    expect(state.recents.at(-1)).toBe("work");
    expect(workspaceWindowState(state, "detail")).toBe("active");
  });

  it("minimizes an application without destroying its windows or recent entry", () => {
    const state = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "case" },
      { type: "minimize-app", app: "work" },
    );

    expect(state.open).toEqual(["work", "case"]);
    expect(state.minimized).toEqual(["work", "case"]);
    expect(state.recents).toEqual(["work"]);
    expect(state.surface).toBe("home");
    expect(workspaceWindowState(state, "work")).toBe("minimized");
    expect(workspaceWindowState(state, "case")).toBe("minimized");
  });

  it("restores a minimized application to its last focused window", () => {
    const state = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "case" },
      { type: "minimize-app", app: "work" },
      { type: "focus-app", app: "work" },
    );

    expect(state.minimized).toEqual(["work"]);
    expect(state.focus.at(-1)).toBe("case");
    expect(state.surface).toBe("application");
    expect(workspaceWindowState(state, "case")).toBe("active");
  });

  it("minimizes one project window without hiding its Work siblings", () => {
    const state = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "case-payflow" },
      { type: "open", id: "case-trustgate" },
      { type: "minimize-window", id: "case-trustgate" },
    );

    expect(state.open).toEqual(["work", "case-payflow", "case-trustgate"]);
    expect(state.minimized).toEqual(["case-trustgate"]);
    expect(workspaceWindowState(state, "case-trustgate")).toBe("minimized");
    expect(workspaceWindowState(state, "case-payflow")).toBe("active");
  });

  it("keeps open application sessions intact while visiting Home and Recents", () => {
    const openState = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "experience" },
      { type: "open", id: "contact" },
    );
    const homeState = workspaceReducer(openState, { type: "surface", surface: "home" });
    const recentsState = workspaceReducer(homeState, { type: "surface", surface: "recents" });

    expect(homeState.open).toEqual(openState.open);
    expect(homeState.focus).toEqual(openState.focus);
    expect(homeState.recents).toEqual(openState.recents);
    expect(workspaceWindowState(homeState, "contact")).toBe("background");
    expect(recentsState.open).toEqual(openState.open);
    expect(recentsState.focus).toEqual(openState.focus);
    expect(recentsState.recents).toEqual(["work", "experience", "contact"]);
    expect(recentsState.surface).toBe("recents");
  });

  it("preserves open, focused, minimized, and recent application state across device modes", () => {
    const session = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "experience" },
      { type: "minimize-app", app: "experience" },
    );
    const phoneState = workspaceReducer(session, { type: "sync-mode", mode: "phone" });
    const tabletState = workspaceReducer(phoneState, { type: "sync-mode", mode: "tablet" });
    const computerState = workspaceReducer(tabletState, { type: "sync-mode", mode: "computer" });

    for (const state of [phoneState, tabletState, computerState]) {
      expect(state.open).toEqual(session.open);
      expect(state.focus).toEqual(session.focus);
      expect(state.minimized).toEqual(session.minimized);
      expect(state.recents).toEqual(session.recents);
    }
    expect(phoneState).toMatchObject({ mode: "phone", modeReady: true, surface: "application" });
    expect(tabletState.mode).toBe("tablet");
    expect(computerState.mode).toBe("computer");
  });

  it("dismisses Recents to the application surface during a mode change without losing sessions", () => {
    const recents = reduce(
      { ...initialWorkspaceState, modeReady: true },
      { type: "open", id: "work" },
      { type: "open", id: "experience" },
      { type: "surface", surface: "recents" },
    );
    const tablet = workspaceReducer(recents, { type: "sync-mode", mode: "tablet" });

    expect(tablet.surface).toBe("application");
    expect(tablet.open).toEqual(["work", "experience"]);
    expect(tablet.focus).toEqual(["work", "experience"]);
    expect(tablet.recents).toEqual(["work", "experience"]);
  });

  it("keeps show-only as a non-destructive compatibility action", () => {
    const existingSession = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "experience" },
      { type: "open", id: "contact" },
    );
    const switched = workspaceReducer(existingSession, { type: "show-only", id: "case" });

    expect(switched.open).toEqual(["work", "experience", "contact", "case"]);
    expect(switched.focus.at(-1)).toBe("case");
    expect(switched.recents).toEqual(["experience", "contact", "work"]);
    expect(workspaceWindowState(switched, "case")).toBe("active");
  });

  it("closes an application as one session while preserving unrelated applications", () => {
    const state = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "open", id: "case" },
      { type: "open", id: "evidence" },
      { type: "open", id: "experience" },
      { type: "close-app", app: "work" },
    );

    expect(state.open).toEqual(["experience"]);
    expect(state.focus).toEqual(["experience"]);
    expect(state.recents).toEqual(["experience"]);
    expect(state.surface).toBe("application");
  });

  it("keeps only the two most recently focused desktop windows clear", () => {
    const state = reduce(
      { ...initialWorkspaceState, modeReady: true },
      { type: "open", id: "work" },
      { type: "open", id: "experience" },
      { type: "open", id: "contact" },
    );

    expect(workspaceWindowState(state, "work")).toBe("blurred");
    expect(workspaceWindowState(state, "experience")).toBe("clear");
    expect(workspaceWindowState(state, "contact")).toBe("active");
  });

  it("classifies phone landscape and coarse-pointer tablet landscape by device shape", () => {
    expect(modeForViewport(390, 844)).toBe("phone");
    expect(modeForViewport(844, 390)).toBe("phone");
    expect(modeForViewport(1024, 768)).toBe("tablet");
    expect(modeForViewport(1194, 834, true)).toBe("tablet");
    expect(modeForViewport(1440, 900)).toBe("computer");
  });

  it("keeps one companion application available on tablet without exposing sibling Work documents", () => {
    const tablet = reduce(
      { ...initialWorkspaceState, mode: "tablet", modeReady: true },
      { type: "open", id: "work" },
      { type: "open", id: "case" },
      { type: "open", id: "experience" },
    );

    expect(workspaceWindowState(tablet, "experience")).toBe("active");
    expect(workspaceWindowState(tablet, "case")).toBe("clear");
    expect(workspaceWindowState(tablet, "work")).toBe("background");

    const phone = workspaceReducer(tablet, { type: "sync-mode", mode: "phone" });
    expect(workspaceWindowState(phone, "case")).toBe("background");
  });

  it("treats Product Links as one first-class application session", () => {
    const withWork = workspaceReducer(initialWorkspaceState, { type: "open", id: "work" });
    const opened = workspaceReducer(withWork, { type: "focus-app", app: "products" });
    const minimized = workspaceReducer(opened, { type: "minimize-app", app: "products" });
    const restored = workspaceReducer(minimized, { type: "focus-app", app: "products" });

    expect(opened.open).toEqual(["work", "products"]);
    expect(opened.recents.at(-1)).toBe("products");
    expect(workspaceWindowState(opened, "products")).toBe("active");
    expect(workspaceWindowState(minimized, "products")).toBe("minimized");
    expect(restored.minimized).not.toContain("products");
    expect(restored.focus.at(-1)).toBe("products");
  });

  it("reconciles rapid app transitions without duplicate or ghost sessions", () => {
    const state = reduce(
      initialWorkspaceState,
      { type: "open", id: "work" },
      { type: "focus-app", app: "products" },
      { type: "minimize-app", app: "products" },
      { type: "focus-app", app: "products" },
      { type: "focus-app", app: "experience" },
      { type: "close-app", app: "products" },
    );

    expect(state.open).toEqual(["work", "experience"]);
    expect(state.recents).toEqual(["work", "experience"]);
    expect(state.focus.at(-1)).toBe("experience");
    expect(state.minimized).toEqual([]);
  });
});

describe("appForWindow", () => {
  it("groups every project and evidence window into the Work application", () => {
    expect(appForWindow("work")).toBe("work");
    expect(appForWindow("case")).toBe("work");
    expect(appForWindow("detail")).toBe("work");
    expect(appForWindow("evidence")).toBe("work");
    expect(appForWindow("experience")).toBe("experience");
    expect(appForWindow("contact")).toBe("contact");
    expect(appForWindow("products")).toBe("products");
  });
});
