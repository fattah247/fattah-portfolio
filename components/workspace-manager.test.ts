import { describe, expect, it } from "vitest";
import {
  appForWindow,
  initialWorkspaceState,
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
  it("boots into the Work application with an explicit desktop session", () => {
    expect(initialWorkspaceState).toMatchObject({
      focus: ["work"],
      minimized: [],
      mode: "computer",
      modeReady: false,
      open: ["work"],
      recents: ["work"],
      surface: "application",
    });
    expect(workspaceWindowState(initialWorkspaceState, "work")).toBe("active");
  });

  it("opens applications without duplicating an already open window", () => {
    const state = reduce(
      initialWorkspaceState,
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
      { type: "open", id: "case" },
      { type: "minimize-app", app: "work" },
    );

    expect(state.open).toEqual(["work", "case"]);
    expect(state.minimized).toEqual(["work"]);
    expect(state.recents).toEqual(["work"]);
    expect(state.surface).toBe("home");
    expect(workspaceWindowState(state, "work")).toBe("minimized");
    expect(workspaceWindowState(state, "case")).toBe("minimized");
  });

  it("restores a minimized application to its last focused window", () => {
    const state = reduce(
      initialWorkspaceState,
      { type: "open", id: "case" },
      { type: "minimize-app", app: "work" },
      { type: "focus-app", app: "work" },
    );

    expect(state.minimized).toEqual([]);
    expect(state.focus.at(-1)).toBe("case");
    expect(state.surface).toBe("application");
    expect(workspaceWindowState(state, "case")).toBe("active");
  });

  it("keeps open application sessions intact while visiting Home and Recents", () => {
    const openState = reduce(
      initialWorkspaceState,
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
    expect(phoneState).toMatchObject({ mode: "phone", modeReady: true, surface: "home" });
    expect(tabletState.mode).toBe("tablet");
    expect(computerState.mode).toBe("computer");
  });

  it("dismisses Recents to the application surface during a mode change without losing sessions", () => {
    const recents = reduce(
      { ...initialWorkspaceState, modeReady: true },
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
      { type: "open", id: "experience" },
      { type: "open", id: "contact" },
    );

    expect(workspaceWindowState(state, "work")).toBe("blurred");
    expect(workspaceWindowState(state, "experience")).toBe("clear");
    expect(workspaceWindowState(state, "contact")).toBe("active");
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
  });
});
