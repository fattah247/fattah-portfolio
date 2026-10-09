import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decodeWorkspaceRoute,
  encodeWorkspaceRoute,
  isWorkspaceTraversal,
  mergeWorkspaceHistoryState,
  overlayNode,
  setWorkspaceStackManaged,
  syncWorkspaceStack,
  workspaceHistory,
  workspaceHistoryStateKey,
  workspaceStackOf,
  type StackNode,
} from "./workspace-navigation";

describe("workspace-navigation route codec", () => {
  it.each([
    ["/", null, "home"],
    ["/#selected-work", "work", "work"],
    ["/#contact", "contact", "contact"],
    ["/brief", "experience", "brief"],
    ["/products", "products", "products"],
    ["/case/payflow", "work", "case:payflow"],
    ["/projects/trustgate-android", "work", "project:trustgate-android"],
    ["/evidence", "work", "evidence"],
  ] as const)("decodes %s to the owning app/document", (href, app, documentId) => {
    expect(decodeWorkspaceRoute(href)).toMatchObject({ app, documentId });
  });

  it("normalizes trailing slashes and decodes repository segments", () => {
    expect(decodeWorkspaceRoute("/projects/Stock%20Triage/")).toMatchObject({
      app: "work",
      documentId: "project:Stock Triage",
      pathname: "/projects/Stock%20Triage",
    });
  });

  it("encodes workspace routes while preserving search and hash", () => {
    expect(encodeWorkspaceRoute({ pathname: "projects/Xpire", search: "tab=readme", hash: "selected-work" })).toBe("/projects/Xpire?tab=readme#selected-work");
  });

  it("merges workspace history metadata without discarding existing router state", () => {
    const state = mergeWorkspaceHistoryState(
      { __NA: true, tree: ["existing"] },
      { href: "/case/trustgate" },
    );

    expect(state).toMatchObject({ __NA: true, tree: ["existing"] });
    expect(state[workspaceHistoryStateKey]).toEqual({
      app: "work",
      documentId: "case:trustgate",
      href: "/case/trustgate",
    });
  });
});

describe("phone history stack", () => {
  const index: StackNode = { key: "work:work", href: "/#selected-work", title: "Projects" };
  const payflow: StackNode = { key: "work:case:payflow", href: "/case/payflow", title: "Payment reliability" };
  const iyup: StackNode = { key: "work:case:iyup", href: "/case/iyup", title: "Service observability" };
  const brief: StackNode = { key: "experience:brief", href: "/brief", title: "Experience" };
  const evidence = overlayNode(payflow, "evidence-payflow-01");
  const here = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const stack = () => workspaceStackOf(window.history.state)?.map((node) => node.key);
  const popped = () => new Promise<PopStateEvent>((resolve) => window.addEventListener("popstate", (event) => resolve(event), { once: true }));
  // The stack writes the rest of a walk on the task after the browser arrives.
  const settled = async () => { await popped(); await new Promise((resolve) => setTimeout(resolve, 5)); };

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    setWorkspaceStackManaged(true, "Home");
  });

  afterEach(() => setWorkspaceStackManaged(false));

  it("writes Home and the parents of a deep link, so Back leads up instead of out", () => {
    window.history.replaceState(null, "", "/case/payflow");
    const length = window.history.length;
    syncWorkspaceStack([index, payflow]);
    expect(here()).toBe("/case/payflow");
    expect(stack()).toEqual(["work:work", "work:case:payflow"]);
    expect(window.history.length).toBe(length + 2);
  });

  it("pushes each level it opens and walks back to Home in one traversal", async () => {
    syncWorkspaceStack([]);
    const length = window.history.length;
    syncWorkspaceStack([index]);
    syncWorkspaceStack([index, payflow]);
    syncWorkspaceStack([index, payflow, evidence]);
    expect(window.history.length).toBe(length + 3);
    expect(stack()).toEqual(["work:work", "work:case:payflow", "work:case:payflow>evidence-payflow-01"]);
    const arrival = settled();
    syncWorkspaceStack([]);
    await arrival;
    expect(here()).toBe("/");
    expect(stack()).toEqual([]);
  });

  it("replaces a sibling document and marks its own traversals", async () => {
    syncWorkspaceStack([]);
    syncWorkspaceStack([index, payflow]);
    const length = window.history.length;
    syncWorkspaceStack([index, iyup]);
    expect(window.history.length).toBe(length);
    expect(here()).toBe("/case/iyup");
    const event = popped();
    syncWorkspaceStack([index]);
    expect(isWorkspaceTraversal(await event)).toBe(true);
  });

  it("switches apps at the app level: back to Home, then the new app", async () => {
    syncWorkspaceStack([]);
    syncWorkspaceStack([index, payflow]);
    const arrival = settled();
    syncWorkspaceStack([brief]);
    await arrival;
    expect(here()).toBe("/brief");
    expect(stack()).toEqual(["experience:brief"]);
    const back = popped();
    window.history.back();
    const event = await back;
    expect(isWorkspaceTraversal(event)).toBe(false);
    expect(here()).toBe("/");
  });

  it("writes only refinements of the visible document from components", () => {
    syncWorkspaceStack([index, payflow]);
    const length = window.history.length;
    workspaceHistory.replaceState(null, "", "/case/payflow?delivery=once#replay");
    expect(here()).toBe("/case/payflow?delivery=once#replay");
    expect(workspaceStackOf(window.history.state)?.at(-1)?.href).toBe("/case/payflow?delivery=once#replay");
    workspaceHistory.pushState(null, "", "/case/iyup");
    workspaceHistory.replaceState(null, "", "/brief");
    expect(here()).toBe("/case/payflow?delivery=once#replay");
    expect(window.history.length).toBe(length);
  });

  it("leaves other device modes on document-level history without a stack", () => {
    syncWorkspaceStack([index]);
    setWorkspaceStackManaged(false);
    workspaceHistory.replaceState(null, "", "/brief");
    expect(here()).toBe("/brief");
    expect(workspaceStackOf(window.history.state)).toBeNull();
  });
});
