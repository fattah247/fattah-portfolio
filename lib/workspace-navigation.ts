import type { PortfolioAppId } from "@/components/workspace-manager";

export type WorkspaceRoute = {
  app: PortfolioAppId | null;
  documentId: string;
  hash: string;
  pathname: string;
  search: string;
};

export type WorkspaceRouteInput = Pick<WorkspaceRoute, "pathname"> & Partial<Omit<WorkspaceRoute, "pathname">>;

export type WorkspaceNavigationState = {
  app: PortfolioAppId | null;
  documentId: string;
  href: string;
};

export const workspaceHistoryStateKey = "workspace" as const;

function normalizePrefix(value: string | undefined, prefix: "?" | "#") {
  if (!value) return "";
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
}

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Turns a portfolio URL into the app/document identity retained by the workspace. */
export function decodeWorkspaceRoute(input: string | URL): WorkspaceRoute {
  const url = input instanceof URL ? input : new URL(input, "https://workspace.invalid");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const segments = pathname.split("/").filter(Boolean).map(decodeSegment);
  let app: PortfolioAppId | null = null;
  let documentId = "home";

  if (segments[0] === "brief") {
    app = "experience";
    documentId = segments[1] ? `brief:${segments.slice(1).join("/")}` : "brief";
  } else if (segments[0] === "products") {
    app = "products";
    documentId = segments[1] ? `products:${segments.slice(1).join("/")}` : "products";
  } else if (segments[0] === "case" && segments[1]) {
    app = "work";
    documentId = `case:${segments.slice(1).join("/")}`;
  } else if (segments[0] === "projects" && segments[1]) {
    app = "work";
    documentId = `project:${segments.slice(1).join("/")}`;
  } else if (segments[0] === "evidence") {
    app = "work";
    documentId = segments[1] ? `evidence:${segments.slice(1).join("/")}` : "evidence";
  } else if (pathname === "/" && url.hash === "#selected-work") {
    app = "work";
    documentId = "work";
  } else if (pathname === "/" && url.hash === "#contact") {
    app = "contact";
    documentId = "contact";
  }

  return {
    app,
    documentId,
    hash: url.hash,
    pathname,
    search: url.search,
  };
}

/** Encodes a route without discarding its query string or in-document location. */
export function encodeWorkspaceRoute(route: WorkspaceRouteInput): string {
  const pathname = route.pathname.startsWith("/") ? route.pathname : `/${route.pathname}`;
  return `${pathname}${normalizePrefix(route.search, "?")}${normalizePrefix(route.hash, "#")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Merges workspace metadata into the browser's existing history entry. Next.js
 * stores its own routing fields there, so callers must preserve rather than replace it.
 */
export function mergeWorkspaceHistoryState<T>(
  currentState: T,
  update: Partial<WorkspaceNavigationState>,
): T & { [workspaceHistoryStateKey]: WorkspaceNavigationState } {
  const current: Record<string, unknown> = isRecord(currentState) ? currentState : {};
  const existing = isRecord(current[workspaceHistoryStateKey])
    ? current[workspaceHistoryStateKey]
    : {};
  const href = typeof update.href === "string"
    ? update.href
    : typeof existing.href === "string"
      ? existing.href
      : "/";
  const decoded = decodeWorkspaceRoute(href);
  const workspace: WorkspaceNavigationState = {
    app: update.app !== undefined
      ? update.app
      : (existing.app as PortfolioAppId | null | undefined) ?? decoded.app,
    documentId: update.documentId
      ?? (typeof existing.documentId === "string" ? existing.documentId : decoded.documentId),
    href,
  };

  return {
    ...current,
    [workspaceHistoryStateKey]: workspace,
  } as T & { [workspaceHistoryStateKey]: WorkspaceNavigationState };
}

/** Convenience wrapper for callers updating the current entry in place. */
export function replaceWorkspaceHistory(
  href: string,
  update: Partial<Omit<WorkspaceNavigationState, "href">> = {},
) {
  const decoded = decodeWorkspaceRoute(href);
  const state = mergeWorkspaceHistoryState(window.history.state, {
    app: update.app === undefined ? decoded.app : update.app,
    documentId: update.documentId ?? decoded.documentId,
    href,
  });
  window.history.replaceState(state, "", href);
}

/**
 * One level of the phone's navigation stack: an app root, a document inside it, or a child
 * surface over that document (attached evidence). `key` names the document, `href` its address.
 */
export type StackNode = { key: string; href: string; title: string };

const stackStateKey = "workspaceStack";

/** The document identity of a route: what a stack level compares, ignoring query and chapter. */
export function documentKey(href: string | URL) {
  const route = decodeWorkspaceRoute(typeof href === "string" ? new URL(href, "https://workspace.invalid") : href);
  return `${route.app ?? "home"}:${route.documentId}`;
}

/** A child surface shares its document's address but is its own level. */
export function overlayNode(parent: StackNode, overlay: string): StackNode {
  return { ...parent, key: `${parent.key}>${overlay}` };
}

function baseKey(key: string) {
  return key.split(">")[0];
}

function readStack(state: unknown = window.history.state): StackNode[] | null {
  const stack = isRecord(state) ? state[stackStateKey] : null;
  return isRecord(stack) && Array.isArray(stack.nodes) ? stack.nodes as StackNode[] : null;
}

/** The phone stack recorded on a history entry, if the phone wrote that entry. */
export function workspaceStackOf(state: unknown) {
  return readStack(state);
}

let stackManaged = false;
let stackHomeTitle = "";
let desiredStack: StackNode[] | null = null;
let pendingTraversals = 0;
let traversalTimer: number | null = null;
const workspaceTraversals = new WeakSet<Event>();

/**
 * Shared adapter preserving Next's history fields and explicit document ownership.
 * The History API ignores its title argument, so a non-empty title is applied to the
 * document instead; the route metadata would otherwise stay stale after in-app navigation.
 *
 * While the phone owns the stack, components still describe their documents through this
 * adapter, but only refinements of the visible document (its conditions query or chapter)
 * are written; opening, leaving, and switching documents is the stack's job.
 */
function updateHistory(method: "pushState" | "replaceState", documentState: Record<string, unknown> | null, title: string, href: string | URL | null | undefined, internal = false) {
  let target = href == null ? window.location.href : String(href);
  let entryState = documentState;
  if (stackManaged && !internal) {
    const stack = readStack();
    const top = stack?.at(-1);
    const resolved = new URL(target, window.location.href);
    if (method === "pushState" || !stack || !top || documentKey(resolved) !== baseKey(top.key)) return;
    target = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    entryState = { ...documentState, [stackStateKey]: { nodes: [...stack.slice(0, -1), { ...top, href: target }] } };
    title = title || top.title;
  }
  const decoded = decodeWorkspaceRoute(new URL(target, window.location.href));
  const current = { ...(window.history.state ?? {}) };
  delete current.portfolioView;
  delete current.slug;
  delete current.repository;
  // An entry written outside the phone stack must not claim a place in it.
  if (!stackManaged) delete current[stackStateKey];
  // Next's patched pushState/replaceState re-attaches __NA and its tree to entries it does not
  // already own and updates the router's canonical URL (usePathname) in the same call.
  // Passing those fields ourselves would make Next treat the entry as its own and skip that sync.
  delete current.__NA;
  delete current.__PRIVATE_NEXTJS_INTERNALS_TREE;
  const state = mergeWorkspaceHistoryState({ ...current, ...entryState }, { app: decoded.app, documentId: decoded.documentId, href: target });
  window.history[method](state, "", target);
  if (title) document.title = title;
}

export const workspaceHistory = {
  pushState: (state: Record<string, unknown> | null, title: string, href?: string | URL | null) => updateHistory("pushState", state, title, href),
  replaceState: (state: Record<string, unknown> | null, title: string, href?: string | URL | null) => updateHistory("replaceState", state, title, href),
};

function writeStack(method: "pushState" | "replaceState", nodes: StackNode[]) {
  const top = nodes.at(-1);
  updateHistory(method, { [stackStateKey]: { nodes } }, top?.title ?? stackHomeTitle, top?.href ?? "/", true);
}

function settleTraversal() {
  if (traversalTimer !== null) window.clearTimeout(traversalTimer);
  traversalTimer = null;
  pendingTraversals = Math.max(0, pendingTraversals - 1);
  reconcileStack();
}

function onStackPopState(event: PopStateEvent) {
  if (!stackManaged) return;
  if (pendingTraversals > 0) {
    // The stack walked back on its own; the visible state already moved, so handlers ignore it.
    workspaceTraversals.add(event);
    // Next's router reads this entry during the same event; later writes wait for it.
    window.setTimeout(settleTraversal, 0);
    return;
  }
  // The browser moved (its Back or Forward, or the system back gesture): the entry is now the truth.
  desiredStack = readStack(event.state);
}

/** True for a popstate the phone stack caused itself; the visible state already matches it. */
export function isWorkspaceTraversal(event: Event) {
  return workspaceTraversals.has(event);
}

/**
 * Brings browser history in line with the visible phone hierarchy: Home → app → document →
 * child surface. Every level above Home is a real entry, so the page's Back, the browser's
 * Back, and the system back gesture all return to the same parent, and Forward re-enters it.
 *
 * - Opening a level pushes; a sibling at the same level (the next case, another app chosen
 *   in Recents) replaces; leaving levels walks back to the shared parent.
 * - An entry the stack has not written (a direct link, a refresh, a switch from another
 *   device mode) becomes Home and the target's parents are written above it, so a deep
 *   link's Back leads to its real parent rather than out of the portfolio.
 */
function reconcileStack() {
  if (!stackManaged || pendingTraversals > 0 || !desiredStack) return;
  const target = desiredStack;
  const current = readStack();
  if (!current) {
    writeStack("replaceState", []);
    target.forEach((_, index) => writeStack("pushState", target.slice(0, index + 1)));
    return;
  }
  let shared = 0;
  while (shared < current.length && shared < target.length && current[shared].key === target[shared].key) shared += 1;
  const leaving = current.length - shared;
  if (leaving === 0) {
    for (let index = shared; index < target.length; index += 1) writeStack("pushState", target.slice(0, index + 1));
    if (shared === target.length && target.length) {
      // Same document: keep its address current without disturbing a chapter hash.
      const now = new URL(current[shared - 1].href, "https://workspace.invalid");
      const next = new URL(target[shared - 1].href, "https://workspace.invalid");
      if (now.pathname !== next.pathname || now.search !== next.search) writeStack("replaceState", target);
      else document.title = target[shared - 1].title;
    }
    if (!target.length) document.title = stackHomeTitle;
    return;
  }
  if (leaving === 1 && target.length > shared) {
    writeStack("replaceState", target.slice(0, shared + 1));
    for (let index = shared + 1; index < target.length; index += 1) writeStack("pushState", target.slice(0, index + 1));
    return;
  }
  // Walk back to the shared parent (or to the level a sibling will replace); the rest is
  // written once the browser arrives there.
  pendingTraversals += 1;
  traversalTimer = window.setTimeout(() => {
    // A traversal that never reports back must not freeze the stack.
    traversalTimer = null;
    pendingTraversals = 0;
    writeStack("replaceState", target);
  }, 1000);
  window.history.go(-(target.length > shared ? leaving - 1 : leaving));
}

/**
 * Hands browser history to the phone stack, or returns it to the document-level model the
 * other device modes use (switching and focus rewrite the current entry; new documents push).
 */
export function setWorkspaceStackManaged(managed: boolean, homeTitle = "") {
  if (homeTitle) stackHomeTitle = homeTitle;
  if (managed === stackManaged) return;
  stackManaged = managed;
  if (managed) {
    window.addEventListener("popstate", onStackPopState, { capture: true });
    return;
  }
  window.removeEventListener("popstate", onStackPopState, { capture: true });
  desiredStack = null;
  pendingTraversals = 0;
  if (traversalTimer !== null) window.clearTimeout(traversalTimer);
  traversalTimer = null;
}

/** Declares the hierarchy the phone currently shows; history follows it. */
export function syncWorkspaceStack(target: StackNode[]) {
  if (!stackManaged) return;
  desiredStack = target;
  reconcileStack();
}
