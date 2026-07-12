import { describe, expect, it } from "vitest";
import {
  initialWorkspaceState,
  workspaceReducer,
  workspaceWindowState,
  type WorkspaceState,
} from "./workspace-manager";

describe("workspaceReducer", () => {
  it("starts with Work as the default active window", () => {
    expect(initialWorkspaceState).toEqual({ open: ["work"], focus: ["work"] });
    expect(workspaceWindowState(initialWorkspaceState, "work")).toBe("active");
  });

  it("refocuses an open window without creating a duplicate", () => {
    const withExperience = workspaceReducer(initialWorkspaceState, { type: "open", id: "experience" });
    const refocused = workspaceReducer(withExperience, { type: "open", id: "work" });
    expect(refocused.open).toEqual(["work", "experience"]);
    expect(refocused.focus).toEqual(["experience", "work"]);
  });

  it("keeps only the two most recent windows clear", () => {
    let state: WorkspaceState = initialWorkspaceState;
    state = workspaceReducer(state, { type: "open", id: "experience" });
    state = workspaceReducer(state, { type: "open", id: "case" });
    expect(workspaceWindowState(state, "work")).toBe("blurred");
    expect(workspaceWindowState(state, "experience")).toBe("clear");
    expect(workspaceWindowState(state, "case")).toBe("active");
  });

  it("uses a single window in compact mode", () => {
    const compact = workspaceReducer(
      { open: ["work", "experience"], focus: ["work", "experience"] },
      { type: "show-only", id: "case" },
    );
    expect(compact).toEqual({ open: ["case"], focus: ["case"] });
  });

  it("restores focus order after closing the active window", () => {
    const state = workspaceReducer(
      { open: ["work", "experience"], focus: ["work", "experience"] },
      { type: "close", id: "experience" },
    );
    expect(workspaceWindowState(state, "work")).toBe("active");
    expect(workspaceWindowState(state, "experience")).toBe("closed");
  });
});
