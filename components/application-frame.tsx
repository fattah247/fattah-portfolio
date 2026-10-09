"use client";

import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import { appForWindow, useOptionalWorkspaceManager, type WorkspaceWindowId, type WorkspaceWindowState } from "./workspace-manager";
import { windowResizeEdges, type useWindowFrame } from "./use-window-frame";

type ApplicationFrameProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "main";
  windowId: WorkspaceWindowId;
  frameRef?: RefObject<HTMLElement | null>;
  initialVisible?: boolean;
  documentId?: string;
  chrome?: ReactNode;
  resizeHandleProps?: ReturnType<typeof useWindowFrame>["resizeHandleProps"];
  "data-window-state"?: WorkspaceWindowState;
};

const scrollOwnerSelector = ".portfolio-window-content, .embedded-case-workspace, .github-project-preview, .experience-brief-content, .product-links-app-content, .evidence-route-content";

/**
 * The element that actually scrolls a document. Desktop frames scroll an inner surface
 * beneath the chrome; compact modes scroll the frame itself. Hosts and documents share
 * this lookup so chapter offsets, restoration, and recording all target one scroller.
 */
export function findScrollOwner(frame: HTMLElement | null) {
  if (!frame) return null;
  const candidates = Array.from(frame.querySelectorAll<HTMLElement>(scrollOwnerSelector));
  return candidates.find((node) => /auto|scroll|overlay/.test(window.getComputedStyle(node).overflowY)) ?? frame;
}

/**
 * One lifecycle/accessibility boundary; documents never choose their device shell.
 *
 * Scroll policy: the frame is the only scroll owner. It records the owner's position
 * into the provider's document record and restores `saved ?? 0` whenever the document,
 * the device mode, or the frame itself changes. Hosts express intent by writing the
 * record (0 for a fresh open, the current position when leaving) instead of scrolling
 * the surface imperatively, and in-document alignment (chapter hashes) runs afterwards.
 */
export function ApplicationFrame({ as: Element = "section", children, chrome, documentId = "root", frameRef, initialVisible = false, resizeHandleProps, windowId, ...props }: ApplicationFrameProps) {
  const workspace = useOptionalWorkspaceManager();
  const nodeRef = useRef<HTMLElement | null>(null);
  const ownedRef = frameRef ?? nodeRef;
  const readDocumentState = workspace?.readDocumentState;
  const writeDocumentState = workspace?.writeDocumentState;
  const mode = workspace?.mode;
  const modeReady = workspace?.modeReady;
  useEffect(() => {
    const frame = ownedRef.current;
    if (!frame || !readDocumentState || !writeDocumentState) return;
    const app = appForWindow(windowId);
    const owner = findScrollOwner(frame) ?? frame;
    const saved = readDocumentState(app, documentId)?.scroll;
    // Restore synchronously so later in-document alignment (chapter hashes, pending
    // section scrolls) scheduled by children on the next frame still wins.
    owner.scrollTo({ top: saved ?? 0, behavior: "auto" });
    const remember = () => writeDocumentState(app, documentId, { scroll: owner.scrollTop });
    owner.addEventListener("scroll", remember, { passive: true });
    return () => owner.removeEventListener("scroll", remember);
  // modeReady re-runs the lookup once the provider has published the device mode to the document.
  }, [documentId, mode, modeReady, ownedRef, readDocumentState, windowId, writeDocumentState]);
  const state = props["data-window-state"] ?? (initialVisible && !workspace?.modeReady ? "active" : workspace?.stateFor(windowId) ?? "active");
  const hidden = state === "background" || state === "minimized" || state === "closed" || state === "blurred";
  // A desktop window minimizes into its own dock icon and restores out of it. The vector is
  // measured from the untransformed layout box, so a transition already in flight is irrelevant.
  useLayoutEffect(() => {
    const frame = ownedRef.current;
    if (!frame || mode !== "computer" || state !== "minimized") return;
    const icon = document.querySelector<HTMLElement>(`.desktop-taskbar .taskbar-app[data-app="${appForWindow(windowId)}"]`);
    if (!icon) return;
    const target = icon.getBoundingClientRect();
    const dx = target.left + target.width / 2 - (frame.offsetLeft + frame.offsetWidth / 2);
    const dy = target.top + target.height / 2 - (frame.offsetTop + frame.offsetHeight / 2);
    frame.style.setProperty("--minimize-dx", `${Math.round(dx)}px`);
    frame.style.setProperty("--minimize-dy", `${Math.round(dy)}px`);
  }, [mode, ownedRef, state, windowId]);
  return <Element {...props} ref={ownedRef} data-window-state={state} aria-hidden={hidden || undefined} inert={hidden} tabIndex={props.tabIndex ?? -1}>
    {chrome}
    {resizeHandleProps && (!workspace || workspace.mode === "computer") ? windowResizeEdges.map((edge) => <span key={edge} {...resizeHandleProps(edge)} />) : null}
    {children}
  </Element>;
}
