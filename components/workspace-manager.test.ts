import { describe, expect, it } from "vitest";
import {
  appForWindow,
  initialWorkspaceState,
  modeForViewport,
  workspaceReducer,
  workspaceWindowState,
  type WorkspaceState,
} from "./workspace-manager";
import { capabilitiesForViewport, tabletPairingStage } from "../lib/device-capabilities";

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

  it("keeps the phone's Recents open while its cards are closed, down to the empty state", () => {
    const phone = reduce(
      initialWorkspaceState,
      { type: "sync-mode", mode: "phone" },
      { type: "open", id: "work" },
      { type: "open", id: "contact" },
      { type: "surface", surface: "recents" },
    );
    const afterForeground = reduce(phone, { type: "close-app", app: "contact" });
    expect(afterForeground.surface).toBe("recents");
    expect(afterForeground.open).toEqual(["work"]);
    const empty = reduce(afterForeground, { type: "close-app", app: "work" });
    expect(empty.surface).toBe("recents");
    expect(empty.open).toEqual([]);
    // A desktop overview keeps its existing behavior: closing returns to the remaining window.
    const desktop = reduce({ ...phone, mode: "computer" }, { type: "close-app", app: "contact" });
    expect(desktop.surface).toBe("application");
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

  it("classifies device mode at the phone, tablet, desktop, and touch-first boundaries", () => {
    expect(modeForViewport(390, 844)).toBe("phone");
    expect(modeForViewport(600, 960)).toBe("phone");
    expect(modeForViewport(601, 960)).toBe("tablet");
    expect(modeForViewport(960, 600)).toBe("tablet");
    expect(modeForViewport(960, 500, true, false)).toBe("phone");
    expect(modeForViewport(960, 500, true, true)).toBe("tablet");
    expect(modeForViewport(1024, 768)).toBe("tablet");
    expect(modeForViewport(1100, 900)).toBe("tablet");
    expect(modeForViewport(1101, 900)).toBe("computer");
    expect(modeForViewport(1194, 834, true, false)).toBe("tablet");
    expect(modeForViewport(1366, 768, true, false)).toBe("tablet");
    expect(modeForViewport(1366, 768, true, true)).toBe("computer");
    expect(modeForViewport(1440, 900)).toBe("computer");
  });

  it("reports tablet pairing eligibility only when the tablet stage can hold two panes", () => {
    expect(tabletPairingStage).toMatchObject({ height: 600, paneMinWidth: 480, width: 1040 });
    expect(capabilitiesForViewport({ width: 768, height: 1024 })).toMatchObject({
      mode: "tablet",
      pairingEligible: false,
    });
    expect(capabilitiesForViewport({ width: 1194, height: 834, coarsePointer: true, hover: false })).toMatchObject({
      mode: "tablet",
      pairingEligible: true,
    });
    expect(capabilitiesForViewport({ width: 1366, height: 768, coarsePointer: true, hover: false })).toMatchObject({
      mode: "tablet",
      pairingEligible: true,
    });
    expect(capabilitiesForViewport({ width: 1440, height: 900, coarsePointer: false, hover: true })).toMatchObject({
      mode: "computer",
      pairingEligible: false,
    });
  });

  it("keeps tablet applications single-pane until Projects and Experience are explicitly paired", () => {
    const tablet = reduce(
      { ...initialWorkspaceState, mode: "tablet", modeReady: true },
      { type: "open", id: "products" },
      { type: "open", id: "work" },
      { type: "open", id: "experience" },
    );

    expect(workspaceWindowState(tablet, "experience")).toBe("active");
    expect(workspaceWindowState(tablet, "work")).toBe("background");
    expect(workspaceWindowState({ ...tablet, paired: true }, "work")).toBe("clear");
    expect(workspaceWindowState({ ...tablet, paired: true }, "products")).toBe("background");

    // Only the Projects + Experience stage pairs; another foreground app returns to one pane.
    const withProducts = workspaceReducer({ ...tablet, paired: true }, { type: "focus-app", app: "products" });
    expect(workspaceWindowState(withProducts, "products")).toBe("active");
    expect(workspaceWindowState(withProducts, "experience")).toBe("background");

    const phone = workspaceReducer(tablet, { type: "sync-mode", mode: "phone" });
    expect(workspaceWindowState({ ...phone, paired: true }, "work")).toBe("background");
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
