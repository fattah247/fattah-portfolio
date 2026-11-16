"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, MouseEvent, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowIcon, ChevronIcon } from "./icons";
import { CaseCover } from "./case-cover";
import { CaseInstrument } from "./case-instrument";
import { useSound } from "./sound-provider";
import { readableOutcome } from "../lib/instruments";
import { fadeOutCopy, leaveSpring, pointerTrail, project, rubberband, sheetSpring, springTo } from "../lib/motion";
import { findScrollOwner } from "./application-frame";
import { useWindowFrame, windowResizeEdges } from "./use-window-frame";
import { WindowChrome } from "./window-chrome";
import { isWorkspaceTraversal, workspaceHistory, workspaceStackOf } from "../lib/workspace-navigation";
import { useWorkspaceManager, type WorkspaceWindowId } from "./workspace-manager";
import {
  hasComparison,
  projectScenario,
  resolveScenarioConditions,
  scenarios,
  type Conditions,
  type Evidence,
  type ProjectionMode,
  type Scenario,
} from "../lib/scenarios";

type CaseSectionId = "context" | "replay" | "decision" | "evidence";

/**
 * The case reads as a complete account before it asks for interaction: the story (failure and
 * decision), its result, then the simulator to try other conditions, then the evidence. The DOM
 * follows this order on every device; no stylesheet reorders it.
 */
export const caseSections: Array<{ id: CaseSectionId; index: string; label: string }> = [
  { id: "context", index: "01", label: "Story" },
  { id: "decision", index: "02", label: "Result" },
  { id: "replay", index: "03", label: "Try it" },
  { id: "evidence", index: "04", label: "Evidence" },
];



/**
 * Whether a sheet let go `dy` px below where it was grabbed, moving at `velocity` px per ms, goes away:
 * if the throw would carry it more than 40% of its height down, or it was let go a quarter of the way
 * down and not on its way back up.
 */
export function sheetGoesAway(dy: number, velocity: number, height: number) {
  return project(dy, velocity) > height * 0.4 || (dy > height / 4 && velocity >= 0);
}

function EvidenceDialog({
  evidence,
  evidenceWindowId,
  exhibitLabel,
  onClose,
  parentWindowId,
  returnFocus,
}: {
  evidence: Evidence;
  evidenceWindowId: WorkspaceWindowId;
  exhibitLabel: string;
  onClose: () => void;
  parentWindowId: WorkspaceWindowId;
  returnFocus: HTMLElement | null;
}) {
  const workspace = useWorkspaceManager();
  const {
    activeWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    openWindow,
    registerBackHandler,
    surface,
  } = workspace;
  const closeRef = useRef<HTMLButtonElement>(null);
  // Screenshots are often wider than a phone; "Actual size" shows real pixels and pans.
  const [zoomed, setZoomed] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const {
    dragging,
    frameRef,
    maximized,
    resizeHandleProps,
    resizing,
    snap,
    style,
    titlebarProps,
    toggleMaximize,
  } = useWindowFrame({ defaultHeight: 780, defaultWidth: 1180, minHeight: 480, minWidth: 720 });

  // Closing is immediate: the sheet is gone the moment it's asked, and a copy of it fades out where it
  // stood (150 ms, never in the way), so the close is seen to happen.
  const requestClose = useCallback(() => { fadeOutCopy(frameRef.current); onClose(); }, [frameRef, onClose]);

  // On a phone or tablet the sheet is a sheet: grab its title bar (or the grabber) and it follows the
  // finger 1:1, even while it's still opening, the page behind brightening as it comes down; pulled up
  // it gives like a rubber band. Let go and it goes where the throw would carry it: off the bottom at
  // the speed it was thrown, or back up on a spring at that speed.
  const pull = useRef<{ id: number; startY: number; trail: ReturnType<typeof pointerTrail> } | null>(null);
  const offsetFor = (dy: number, height: number) => (dy > 0 ? dy : rubberband(dy, height));
  const scrimOf = (sheet: HTMLElement) => sheet.parentElement?.querySelector<HTMLElement>(".evidence-scrim") ?? null;
  const grabSheet = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (workspace.mode === "computer" || !target.closest(".evidence-sheet-head, .evidence-grabber") || target.closest("button, a, summary")) return;
    const sheet = frameRef.current;
    if (!sheet) return;
    // A slide it was already making stops under the finger; its opening (a scale) carries on.
    for (const running of sheet.getAnimations?.() ?? []) if (!("animationName" in running)) running.cancel();
    for (const running of scrimOf(sheet)?.getAnimations?.() ?? []) running.cancel();
    const trail = pointerTrail();
    trail.add(event.clientX, event.clientY, event.timeStamp);
    pull.current = { id: event.pointerId, startY: event.clientY, trail };
    sheet.dataset.pulling = "true";
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragSheet = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = pull.current;
    const sheet = frameRef.current;
    if (!state || state.id !== event.pointerId || !sheet) return;
    state.trail.add(event.clientX, event.clientY, event.timeStamp);
    const offset = offsetFor(event.clientY - state.startY, sheet.offsetHeight);
    sheet.style.translate = `0px ${offset}px`;
    const scrim = scrimOf(sheet);
    if (scrim) scrim.style.opacity = String(1 - Math.max(0, Math.min(1, offset / sheet.offsetHeight)));
  };
  const releaseSheet = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = pull.current;
    const sheet = frameRef.current;
    if (!state || state.id !== event.pointerId || !sheet) return;
    pull.current = null;
    delete sheet.dataset.pulling;
    const height = sheet.offsetHeight;
    const dy = event.clientY - state.startY;
    const velocity = event.type === "pointercancel" ? 0 : state.trail.velocity(event.timeStamp).y;
    const scrim = scrimOf(sheet);
    const shade = scrim ? Number(getComputedStyle(scrim).opacity) : 1;
    scrim?.style.removeProperty("opacity");
    if (event.type !== "pointercancel" && sheetGoesAway(dy, velocity, height)) {
      const away = springTo(sheet, { translate: `0px ${height}px` }, leaveSpring, { fill: "forwards", velocity: velocity * 1000 });
      sheet.style.removeProperty("translate");
      scrim?.animate([{ opacity: shade }, { opacity: 0 }], { duration: 200, easing: "cubic-bezier(.32, .72, 0, 1)", fill: "forwards" });
      if (away) away.addEventListener("finish", () => onClose());
      else onClose();
      return;
    }
    springTo(sheet, { translate: "0px 0px" }, sheetSpring, { velocity: velocity * 1000 });
    sheet.style.removeProperty("translate");
    scrim?.animate([{ opacity: shade }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
  };

  // The sheet grows out of the evidence card that opened it, so it's seen to come from there.
  useLayoutEffect(() => {
    const sheet = frameRef.current;
    if (!sheet || !returnFocus) return;
    const card = returnFocus.getBoundingClientRect();
    const box = sheet.getBoundingClientRect();
    // A card out of sight (opened from the keyboard, say) grows the sheet from its nearest edge.
    const x = Math.min(Math.max(card.left + card.width / 2 - box.left, 0), box.width);
    const y = Math.min(Math.max(card.top + card.height / 2 - box.top, 0), box.height);
    sheet.style.setProperty("--from-origin", `${Math.round(x)}px ${Math.round(y)}px`);
  // Measured once, as the sheet opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (surface !== "application" || activeWindow !== evidenceWindowId) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (workspace.mode === "computer") {
      document.body.style.overflow = "hidden";
    }
    frameRef.current?.focus({ preventScroll: true });
    const modal = workspace.mode !== "computer";
    const sheet = frameRef.current;
    const inertSiblings: Array<{ node: HTMLElement; inert: boolean }> = [];
    if (modal && sheet) {
      for (const child of Array.from(document.body.children)) {
        // Shell visibility is React-owned; restoring its previous inert value would
        // disable Home/Recents after the user navigates away from this viewer.
        if (!(child instanceof HTMLElement) || child.contains(sheet) || child.matches(".phone-system-navigation, .tablet-shelf, .system-home-screen, .system-recents")) continue;
        inertSiblings.push({ node: child, inert: child.inert });
        child.inert = true;
      }
    }
    const containFocus = (event: FocusEvent) => {
      if (modal && sheet && event.target instanceof Node && !sheet.contains(event.target)) sheet.focus({ preventScroll: true });
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); requestClose(); }
      if (!modal || !sheet || event.key !== "Tab") return;
      const targets = Array.from(sheet.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select, textarea, summary, [tabindex="0"]')).filter((node) => window.getComputedStyle(node).display !== "none" && !node.closest("[inert]"));
      const first = targets[0];
      const last = targets.at(-1);
      if (!first) { event.preventDefault(); sheet.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === sheet)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey, true);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      document.removeEventListener("focusin", containFocus);
      for (const { node, inert } of inertSiblings) node.inert = inert;
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => {
        const focusTarget = returnFocus?.isConnected ? returnFocus : previousFocus;
        focusTarget?.focus({ preventScroll: true });
      }, 0);
    };
  }, [activeWindow, evidenceWindowId, frameRef, requestClose, returnFocus, surface, workspace.mode]);

  useEffect(() => registerBackHandler(`work-${evidenceWindowId}`, () => {
    if (activeWindow !== evidenceWindowId || surface !== "application") return false;
    requestClose();
    return true;
  }), [activeWindow, evidenceWindowId, registerBackHandler, requestClose, surface]);

  useEffect(() => {
    openWindow(evidenceWindowId);
    return () => {
      closeWindow(evidenceWindowId);
      focusWindow(parentWindowId);
    };
  }, [closeWindow, evidenceWindowId, focusWindow, openWindow, parentWindowId]);

  const titleId = `${evidenceWindowId}-title`;

  return createPortal(
    <div
      aria-labelledby={titleId}
      aria-modal={workspace.mode !== "computer"}
      aria-hidden={workspace.stateFor(evidenceWindowId) === "background" || workspace.stateFor(evidenceWindowId) === "minimized" || undefined}
      inert={workspace.stateFor(evidenceWindowId) === "background" || workspace.stateFor(evidenceWindowId) === "minimized"}
      className="evidence-dialog"
      data-app-id="work"
      data-window-id={evidenceWindowId}
      data-window-state={workspace.stateFor(evidenceWindowId)}
      role="dialog"
      style={{ "--window-layer-z": workspace.zIndexFor(evidenceWindowId) } as CSSProperties}
    >
      <button
        aria-hidden="true"
        className="evidence-scrim"
        onClick={requestClose}
        tabIndex={-1}
        type="button"
      />
      <div
        className="evidence-sheet"
        data-dragging={dragging}
        data-resizing={resizing}
        data-snap={snap ?? undefined}
        data-window-state={workspace.stateFor(evidenceWindowId)}
        onPointerCancel={releaseSheet}
        onPointerDown={grabSheet}
        onFocusCapture={() => {
          if (activeWindow !== evidenceWindowId) focusWindow(evidenceWindowId);
        }}
        onPointerDownCapture={() => {
          if (activeWindow !== evidenceWindowId) focusWindow(evidenceWindowId);
        }}
        onPointerMove={dragSheet}
        onPointerUp={releaseSheet}
        ref={(node) => {
          frameRef.current = node;
        }}
        style={{ ...style, "--window-z": workspace.zIndexFor(evidenceWindowId) } as CSSProperties}
        suppressHydrationWarning
        tabIndex={-1}
      >
        {workspace.mode !== "computer" ? <span aria-hidden="true" className="evidence-grabber" /> : null}
        <WindowChrome
          app="work"
          className="evidence-sheet-head"
          closeClassName="evidence-close-action"
          closeLabel="Close attached evidence"
          closeRef={closeRef}
          label="Attached evidence"
          maximized={maximized}
          onClose={requestClose}
          onCompactBack={workspace.mode === "phone" ? requestClose : undefined}
          onMinimize={() => minimizeWindow(evidenceWindowId)}
          onToggleMaximize={toggleMaximize}
          title={exhibitLabel}
          titleId={titleId}
          {...titlebarProps}
        />
        <div className="evidence-sheet-content">
          <aside className="evidence-inspector">
            <div className="evidence-inspector-copy">
              <p className="evidence-focus-label">What to verify</p>
              <h2>{evidence.focus}</h2>
              <p>{evidence.caption}</p>
            </div>
            <dl className="evidence-meta">
              <div>
                <dt>Source</dt>
                <dd>Public project screenshot</dd>
              </div>
            </dl>
            <a className="evidence-original" href={evidence.src} target="_blank" rel="noopener noreferrer">
              Open original image <span className="sr-only">in a new tab</span> <ArrowIcon />
            </a>
          </aside>
          <div className="evidence-stage" data-zoomed={zoomed || undefined}>
            <div className="evidence-stage-tools">
              <button aria-pressed={zoomed} className="evidence-zoom" disabled={!natural} onClick={() => setZoomed((value) => !value)} type="button">
                {zoomed ? "Fit to screen" : "Actual size"}
              </button>
            </div>
            <div
              className="evidence-image-wrap"
              onDoubleClick={() => { if (natural) setZoomed((value) => !value); }}
              // The phone sizes the frame to the screenshot's own proportions instead of a fixed box.
              style={zoomed && natural ? { aspectRatio: `${natural.width} / ${natural.height}`, inlineSize: `${natural.width}px` } as CSSProperties : natural ? { "--evidence-ratio": `${natural.width} / ${natural.height}` } as CSSProperties : undefined}
            >
              <Image
                src={evidence.src}
                alt={evidence.alt}
                className="evidence-image"
                fill
                loading="eager"
                onLoad={(event) => setNatural({ height: event.currentTarget.naturalHeight, width: event.currentTarget.naturalWidth })}
                sizes="(max-width: 760px) 100vw, 70vw"
                unoptimized
              />
            </div>
          </div>
        </div>
        {windowResizeEdges.map((edge) => <span key={edge} {...resizeHandleProps(edge)} />)}
      </div>
    </div>,
    document.body,
  );
}

export function DebuggerWorkspace({
  embedded = false,
  onClose,
  onSelectScenario,
  scenario,
  initialConditions,
  initialTechnical = false,
  scrollContainerRef,
  workspaceWindowId,
}: {
  embedded?: boolean;
  onClose?: () => void;
  onSelectScenario?: (slug: Scenario["slug"]) => void;
  scenario: Scenario;
  initialConditions: Conditions;
  /** Whether Technical starts on (`?technical=1`), passed from the server so hydration matches. */
  initialTechnical?: boolean;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  workspaceWindowId?: WorkspaceWindowId;
}) {
  const workspace = useWorkspaceManager();
  const {
    activeWindow,
    closeWindow,
    focusApp,
    focusWindow,
    minimizeWindow,
    openWindow,
    registerBackHandler,
    requestBack,
    surface,
  } = workspace;
  const { play } = useSound();
  // A case is a document: it lands like paper when it opens (or the next one does), and lifts away
  // more softly when the visitor leaves it.
  useEffect(() => {
    play("sys.file-open");
  }, [play, scenario.slug]);
  useEffect(() => () => play("sys.file-close"), [play]);
  const [conditions, setConditions] = useState<Conditions>(() => resolveScenarioConditions(scenario, (workspace.readDocumentState("work", `case:${scenario.slug}`)?.data?.conditions as Conditions) ?? initialConditions));
  const [selectedConditions, setSelectedConditions] = useState<Conditions>(() => resolveScenarioConditions(scenario, (workspace.readDocumentState("work", `case:${scenario.slug}`)?.data?.conditions as Conditions) ?? initialConditions));
  const [statusMessage, setStatusMessage] = useState("Replay ready.");
  // The simulators run only the repo's rules; the comparison is drawn beside them, never switched to.
  const [approach, setApproach] = useState<ProjectionMode>("designed");
  const [technical, setTechnical] = useState<boolean>(() => {
    const saved = workspace.readDocumentState("work", `case:${scenario.slug}`)?.data?.technical;
    return typeof saved === "boolean" ? saved : initialTechnical;
  });
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [activeSection, setActiveSection] = useState<CaseSectionId>("context");
  const [pageVisible, setPageVisible] = useState(true);
  const resolvedConditions = useMemo(() => resolveScenarioConditions(scenario, conditions), [conditions, scenario]);
  const resolvedSelectedConditions = useMemo(() => resolveScenarioConditions(scenario, selectedConditions), [scenario, selectedConditions]);
  const timers = useRef<number[]>([]);
  const caseScrollFrame = useRef<number | null>(null);
  const embeddedFrameRef = useRef<HTMLDivElement>(null);
  const evidenceTriggerRef = useRef<HTMLElement | null>(null);
  const previousScenarioSlugRef = useRef(scenario.slug);
  const targetConditions = useRef<Conditions>(resolveScenarioConditions(scenario, (workspace.readDocumentState("work", `case:${scenario.slug}`)?.data?.conditions as Conditions) ?? initialConditions));
  const workspaceTitleRef = useRef<HTMLHeadingElement>(null);
  const {
    dragging,
    frameRef,
    maximized,
    resizeHandleProps,
    resizing,
    snap,
    style,
    titlebarProps,
    toggleMaximize,
  } = useWindowFrame({ enabled: !embedded, defaultHeight: 820, defaultWidth: 1360, minHeight: 460, minWidth: 420 });
  const hostWindowId: WorkspaceWindowId = workspaceWindowId ?? (embedded ? "case" : "detail");

  const openEvidence = useCallback((item: Evidence, trigger: HTMLElement) => {
    evidenceTriggerRef.current = trigger;
    setEvidence(item);
  }, []);

  const closeEvidence = useCallback(() => {
    const trigger = evidenceTriggerRef.current;
    setEvidence(null);
    window.setTimeout(() => trigger?.focus({ preventScroll: true }), 80);
  }, []);

  // On a phone, attached evidence is its own history level: the browser's Back (or the system
  // back gesture) closes it onto its case, and Forward opens it again.
  useEffect(() => {
    if (workspace.mode !== "phone") return;
    const syncEvidence = (event: PopStateEvent) => {
      if (isWorkspaceTraversal(event)) return;
      const overlay = workspaceStackOf(event.state)?.at(-1)?.key.split(">")[1];
      const index = overlay?.startsWith(`evidence-${scenario.slug}-`) ? Number(overlay.slice(-2)) - 1 : -1;
      const item = scenario.evidence[index];
      if (item && item.src !== evidence?.src) {
        evidenceTriggerRef.current = null;
        setEvidence(item);
      } else if (!item && evidence) setEvidence(null);
    };
    window.addEventListener("popstate", syncEvidence);
    return () => window.removeEventListener("popstate", syncEvidence);
  }, [evidence, scenario, workspace.mode]);

  const scrollFrame = useCallback(() => {
    // Embedded documents share the host frame's scroll owner lookup.
    if (embedded) return findScrollOwner(scrollContainerRef?.current ?? embeddedFrameRef.current);

    const frame = frameRef.current;
    if (!frame) return null;

    const overflowY = window.getComputedStyle(frame).overflowY;
    const ownsScrolling = /auto|scroll|overlay/.test(overflowY) && frame.scrollHeight > frame.clientHeight;
    return ownsScrolling ? frame : (document.scrollingElement as HTMLElement | null) ?? frame;
  }, [embedded, frameRef, scrollContainerRef]);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  const hostState = workspace.stateFor(hostWindowId);
  const onScreen = pageVisible && (hostState === "active" || hostState === "clear");

  const { readDocumentState, writeDocumentState } = workspace;
  useEffect(() => {
    if (previousScenarioSlugRef.current !== scenario.slug) return;
    writeDocumentState("work", `case:${scenario.slug}`, { data: { approach, conditions: resolvedSelectedConditions, technical } });
    // A restored non-default selection must be addressable: keep the query in step so a refresh reconstructs it.
    if (window.location.pathname === `/case/${scenario.slug}`) {
      const params = new URLSearchParams();
      for (const control of scenario.controls) {
        if (resolvedSelectedConditions[control.key] !== scenario.defaults[control.key]) params.set(control.key, resolvedSelectedConditions[control.key]);
      }
      if (technical) params.set("technical", "1");
      const query = params.toString();
      const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) workspaceHistory.replaceState(null, "", next);
    }
  }, [approach, resolvedSelectedConditions, scenario, technical, writeDocumentState]);

  useEffect(() => {
    // The host ApplicationFrame owns scroll records for embedded cases; only the
    // self-hosted workspace keeps its own.
    if (embedded) return;
    const container = scrollFrame();
    const saved = readDocumentState("work", `case:${scenario.slug}`)?.scroll;
    if (container && saved && !window.location.hash) container.scrollTo({ top: saved, behavior: "auto" });
    const remember = () => writeDocumentState("work", `case:${scenario.slug}`, { scroll: container?.scrollTop ?? 0 });
    container?.addEventListener("scroll", remember, { passive: true });
    return () => container?.removeEventListener("scroll", remember);
  }, [embedded, scenario.slug, scrollFrame, workspace.mode, readDocumentState, writeDocumentState]);

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    if (caseScrollFrame.current) window.cancelAnimationFrame(caseScrollFrame.current);
  }, []);

  useEffect(() => {
    if (previousScenarioSlugRef.current === scenario.slug) return;
    const savedData = workspace.readDocumentState("work", `case:${scenario.slug}`)?.data;
    const nextConditions = resolveScenarioConditions(scenario, (savedData?.conditions as Conditions) ?? initialConditions);
    const resetTimer = window.setTimeout(() => {
      previousScenarioSlugRef.current = scenario.slug;
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
      targetConditions.current = nextConditions;
      setConditions(nextConditions);
      setSelectedConditions(nextConditions);
      // Technical belongs to each case: one never opened starts in everyday words.
      setTechnical(savedData?.technical === true);
      setEvidence(null);
      setActiveSection("context");
      setStatusMessage("Replay ready.");
    }, 0);
    return () => window.clearTimeout(resetTimer);
  // `initialConditions` is an initial snapshot; project identity owns the reset boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.slug]);

  const requestWorkspaceClose = useCallback(() => { onClose?.(); }, [onClose]);

  const returnToWorkIndex = useCallback(() => {
    if (onClose) {
      requestWorkspaceClose();
      return;
    }
    // The standalone case page leaves for the workspace's own route, which reads its hash on load.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/#selected-work");
  }, [onClose, requestWorkspaceClose]);

  useEffect(() => {
    if (!embedded) openWindow("detail");
    document.body.dataset.workspace = "case";
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => workspaceTitleRef.current?.focus({ preventScroll: true }), 80);
    return () => {
      window.clearTimeout(focusTimer);
      delete document.body.dataset.workspace;
      if (!embedded) closeWindow("detail");
      previousFocus?.focus();
    };
  }, [closeWindow, embedded, openWindow]);

  useEffect(() => registerBackHandler(`work-detail-${scenario.slug}`, () => {
    if (activeWindow !== hostWindowId || surface !== "application") return false;
    returnToWorkIndex();
    return true;
  }), [activeWindow, hostWindowId, registerBackHandler, returnToWorkIndex, scenario.slug, surface]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      // Only the foreground Projects case answers; other applications own their own Escape.
      if (event.key !== "Escape" || event.defaultPrevented || surface !== "application") return;
      if (activeWindow !== hostWindowId && !activeWindow?.startsWith("evidence-")) return;
      // The focused evidence sheet handles Escape itself; a de-focused sheet still closes before the case.
      if (evidence) { closeEvidence(); return; }
      requestBack();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeWindow, closeEvidence, evidence, hostWindowId, requestBack, surface]);

  useEffect(() => {
    let ticking = false;
    const readActiveSection = () => {
      ticking = false;
      const container = scrollFrame();
      const chromeHeight = container?.querySelector<HTMLElement>(embedded ? ".portfolio-window-chrome" : ".case-workspace-chrome")?.getBoundingClientRect().height ?? 0;
      const progressHeight = container?.querySelector<HTMLElement>(".case-progress")?.getBoundingClientRect().height ?? 0;
      // A chapter is current once its top passes a line 30% down the readable area, so a section
      // that fills most of the view is the one named; at the end of the document the last
      // chapter whose top is on screen wins, even when it is too short to reach the line.
      const readable = (container?.clientHeight ?? 0) - chromeHeight - progressHeight;
      const readLine = chromeHeight + progressHeight + Math.max(36, readable * .3);
      const atEnd = container ? container.scrollHeight > container.clientHeight && container.scrollTop + container.clientHeight >= container.scrollHeight - 2 : false;
      let nextActive = caseSections[0].id;

      for (const section of caseSections) {
        const node = container?.querySelector<HTMLElement>(`#${section.id}`);
        if (!node) continue;
        const top = node.getBoundingClientRect().top - (container?.getBoundingClientRect().top ?? 0);
        if (top <= readLine || (atEnd && top < (container?.clientHeight ?? 0))) {
          nextActive = section.id;
        }
      }
      setActiveSection(nextActive);
    };

    const requestRead = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(readActiveSection);
    };

    const containerNode = scrollFrame();
    requestRead();
    containerNode?.addEventListener("scroll", requestRead, { passive: true });
    window.addEventListener("resize", requestRead);
    return () => {
      containerNode?.removeEventListener("scroll", requestRead);
      window.removeEventListener("resize", requestRead);
    };
  }, [embedded, scrollFrame, workspace.mode]);

  useEffect(() => {
    const requestedSection = window.location.hash.slice(1) as CaseSectionId;
    if (!caseSections.some((section) => section.id === requestedSection)) return;
    const routeBase = `${window.location.pathname}${window.location.search}`;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const cancelSettling = () => {
      cancelled = true;
      observer?.disconnect();
    };
    const activeFrame = scrollFrame();
    const alignRequestedSection = () => {
      if (cancelled) return;
      scrollContainerToSection(requestedSection, "auto");
      setActiveSection(requestedSection);
      workspaceHistory.replaceState(null, "", `${routeBase}#${requestedSection}`);
    };
    const firstFrame = window.requestAnimationFrame(() => {
      alignRequestedSection();
      if (typeof ResizeObserver !== "undefined" && activeFrame) {
        observer = new ResizeObserver(alignRequestedSection);
        observer.observe(activeFrame);
      }
      void document.fonts?.ready.then(alignRequestedSection);
    });
    activeFrame?.addEventListener("pointerdown", cancelSettling, { once: true });
    activeFrame?.addEventListener("touchstart", cancelSettling, { once: true, passive: true });
    activeFrame?.addEventListener("wheel", cancelSettling, { once: true, passive: true });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      observer?.disconnect();
      activeFrame?.removeEventListener("pointerdown", cancelSettling);
      activeFrame?.removeEventListener("touchstart", cancelSettling);
      activeFrame?.removeEventListener("wheel", cancelSettling);
    };
  // Re-align when the responsive workspace mode settles so the measured chrome is final.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.slug, workspace.mode]);

  // The Result chapter reports the story's own conditions; the simulator below it reports
  // whatever the visitor sets, so the two never contradict each other.
  // A comparing case reports the old and the designed handling; a single-system case (case 03)
  // reports the risk it found and the decision it reached.
  const storyRows = useMemo(() => {
    const project = (mode: ProjectionMode) => projectScenario(scenario.slug, scenario.defaults, mode);
    const read = (mode: ProjectionMode) => readableOutcome(scenario.slug, project(mode).find((item) => item.id === scenario.outcomeNodeId)?.value ?? "Unknown");
    if (hasComparison(scenario)) {
      return [
        { path: "baseline", label: scenario.baselineLabel!, value: read("baseline") },
        { path: "designed", label: scenario.designedLabel!, value: read("designed") },
      ];
    }
    const nodes = project("designed");
    const level = nodes.find((item) => item.id === "level");
    const score = nodes.find((item) => item.id === "score");
    const decision = nodes.find((item) => item.id === scenario.outcomeNodeId);
    return [
      { path: "baseline", label: level?.label ?? "Risk", value: `${level?.value.toLowerCase()} · ${score?.value.toLowerCase()}`, tone: level?.tone },
      { path: "designed", label: decision?.label ?? "Decision", value: read("designed"), tone: decision?.tone },
    ];
  }, [scenario]);
  const isDefault = scenario.controls.every((control) => resolvedSelectedConditions[control.key] === scenario.defaults[control.key]);
  const caseCategory = scenario.category;
  const scenarioIndex = Math.max(0, scenarios.findIndex((item) => item.slug === scenario.slug));
  const previousScenario = scenarios[(scenarioIndex - 1 + scenarios.length) % scenarios.length];
  const nextScenario = scenarios[(scenarioIndex + 1) % scenarios.length];

  function updateUrl(next: Conditions) {
    const params = new URLSearchParams();
    for (const control of scenario.controls) {
      if (next[control.key] !== scenario.defaults[control.key]) {
        params.set(control.key, next[control.key]);
      }
    }
    if (technical) params.set("technical", "1");
    const query = params.toString();
    const hash = window.location.hash;
    workspaceHistory.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${hash}`);
  }

  function resultFor(next: Conditions, mode: ProjectionMode) {
    const value = projectScenario(scenario.slug, next, mode).find((item) => item.id === scenario.outcomeNodeId)?.value ?? "Unknown";
    return readableOutcome(scenario.slug, value);
  }

  /** Applies new conditions at once: a key the visitor pressed answers immediately. */
  function settle(next: Conditions, message: string) {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setConditions(next);
    updateUrl(next);
    setStatusMessage(message);
  }

  function changeCondition(key: string, value: string) {
    if (targetConditions.current[key] === value) return;
    const next = { ...targetConditions.current, [key]: value };
    targetConditions.current = next;
    setSelectedConditions(next);
    const label = scenario.controls.find((control) => control.key === key)?.label ?? "Condition";
    settle(next, `${label} changed. Result: ${resultFor(next, approach)}.`);
  }

  function changeApproach(mode: ProjectionMode) {
    if (mode === approach) return;
    setApproach(mode);
    setStatusMessage(`${(mode === "designed" ? scenario.designedLabel : scenario.baselineLabel) ?? "Approach changed"}. Result: ${resultFor(targetConditions.current, mode)}.`);
  }

  function reset() {
    if (scenario.controls.every((control) => targetConditions.current[control.key] === scenario.defaults[control.key])) return;
    targetConditions.current = scenario.defaults;
    setSelectedConditions(scenario.defaults);
    settle(scenario.defaults, `Conditions reset. Result: ${resultFor(scenario.defaults, approach)}.`);
  }

  function scrollContainerToSection(sectionId: CaseSectionId, behavior: ScrollBehavior) {
    const container = scrollFrame();
    const target = container?.querySelector<HTMLElement>(`#${sectionId}`) ?? document.getElementById(sectionId);
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const chromeHeight = container.querySelector<HTMLElement>(embedded ? ".portfolio-window-chrome" : ".case-workspace-chrome")?.getBoundingClientRect().height ?? 0;
    const progressHeight = container.querySelector<HTMLElement>(".case-progress")?.getBoundingClientRect().height ?? 0;
    const top = container.scrollTop + targetRect.top - containerRect.top - chromeHeight - progressHeight - 24;
    const destination = Math.max(0, top);
    if (caseScrollFrame.current) window.cancelAnimationFrame(caseScrollFrame.current);
    if (behavior === "auto" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      container.scrollTop = destination;
    } else {
      const start = container.scrollTop;
      const distance = destination - start;
      const startedAt = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / 360);
        const eased = 1 - Math.pow(1 - progress, 4);
        container.scrollTop = start + distance * eased;
        if (progress < 1) caseScrollFrame.current = window.requestAnimationFrame(step);
        else caseScrollFrame.current = null;
      };
      caseScrollFrame.current = window.requestAnimationFrame(step);
    }
  }

  function scrollToCaseSection(event: MouseEvent<HTMLAnchorElement>, sectionId: CaseSectionId) {
    event.preventDefault();
    setActiveSection(sectionId);
    scrollContainerToSection(sectionId, "smooth");
    workspaceHistory.replaceState(null, "", `#${sectionId}`);
  }

  const WorkspaceElement = embedded ? "div" : "main";

  return (
    <>
      <WorkspaceElement
        className={`case-page case-${scenario.slug} selected-work-window ${embedded ? "embedded-case-workspace" : ""}`.trim()}
        data-dragging={dragging}
        data-app-id="work"
        data-resizing={resizing}
        data-snap={snap ?? undefined}
        data-window-state={workspace.stateFor(hostWindowId)}
        data-window-mode={embedded ? "embedded" : onClose ? "overlay" : "route"}
        id={embedded ? "embedded-case-workspace" : onClose ? "case-workspace" : "main-content"}
        onPointerDownCapture={(event) => {
          if ((event.target as Element).closest(".evidence-dialog")) return;
          if (activeWindow !== hostWindowId) focusWindow(hostWindowId);
        }}
        ref={(node) => {
          if (embedded) embeddedFrameRef.current = node as HTMLDivElement | null;
          else frameRef.current = node;
        }}
        style={embedded ? undefined : { ...style, "--window-z": workspace.zIndexFor("detail") } as CSSProperties}
        suppressHydrationWarning
        tabIndex={-1}
      >
        {!embedded ? <WindowChrome
          actions={<div aria-label="Move between cases" className="case-workspace-actions" role="group">
            {onSelectScenario ? <button onClick={() => onSelectScenario(previousScenario.slug)} type="button">Previous</button> : <Link href={`/case/${previousScenario.slug}`}>Previous</Link>}
            {onSelectScenario ? <button onClick={() => onSelectScenario(nextScenario.slug)} type="button">Next</button> : <Link href={`/case/${nextScenario.slug}`}>Next</Link>}
          </div>}
          app="work"
          aria-label="Case workspace"
          className="case-workspace-chrome"
          closeClassName="case-close-action"
          closeHref={onClose ? undefined : "/#selected-work"}
          closeLabel={onClose ? "Close case" : "Close case and return to the project list"}
          label="Projects"
          locationClassName="case-location"
          maximized={maximized}
          onClose={onClose ? requestWorkspaceClose : undefined}
          onMinimize={() => minimizeWindow(hostWindowId)}
          onToggleMaximize={toggleMaximize}
          title={caseCategory}
          {...titlebarProps}
        /> : null}
        {!embedded ? windowResizeEdges.map((edge) => <span key={edge} {...resizeHandleProps(edge)} />) : null}
        <nav className="case-progress" aria-label="Case chapters">
          {caseSections.map((section) => (
            <a
              aria-current={activeSection === section.id ? "step" : undefined}
              href={`#${section.id}`}
              key={section.id}
              onClick={(event) => scrollToCaseSection(event, section.id)}
            >
              <b>{section.label}</b>
            </a>
          ))}
        </nav>
        <section className="case-intro" data-case={scenario.slug} id="context">
          <header className="case-thesis">
            <p className="case-position">Case {scenarios.findIndex((item) => item.slug === scenario.slug) + 1} of {scenarios.length}</p>
            <h1 ref={workspaceTitleRef} tabIndex={-1} style={{ viewTransitionName: `case-title-${scenario.slug}` } as CSSProperties}>{scenario.title}</h1>
            <p className="case-consequence">{scenario.consequence}</p>
          </header>
          <div className="case-narrative">
            <p className="case-situation">{scenario.premise}</p>
            <p className="case-decision-line"><span>Decision</span>{scenario.decision}</p>
          </div>
          <figure className="case-figure">
            <CaseCover slug={scenario.slug} />
            <figcaption>Schematic, not measured data.</figcaption>
          </figure>
        </section>

        <div className="mobile-outcome-strip case-result" id="decision" role="group" aria-label="Outcome comparison">
          <p className="case-result-note">{scenario.outcome}</p>
          {storyRows.map((row) => (
            <div data-path={row.path} data-tone={"tone" in row ? row.tone : undefined} key={row.path}><span>{row.label}</span><strong>{row.value}</strong></div>
          ))}
          <p className="case-limits"><span>Limits</span>{scenario.limitation}</p>
        </div>

        <CaseInstrument
          approach={approach}
          conditions={resolvedConditions}
          foreground={onScreen}
          isDefault={isDefault}
          onApproachChange={changeApproach}
          onChange={changeCondition}
          onReset={reset}
          onTechnicalChange={setTechnical}
          scenario={scenario}
          selectedConditions={resolvedSelectedConditions}
          technical={technical}
        />

        <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>

        <section className="case-evidence" id="evidence">
          <div className="evidence-intro">
            <h2>Source and evidence</h2>
            <p>{scenario.technology}</p>
            <a className="inline-link" href={scenario.repo} target="_blank" rel="noopener noreferrer">
              Open repository <span className="sr-only">in a new tab</span> <ArrowIcon />
            </a>
          </div>
          <div className="evidence-grid">
            {scenario.evidence.map((item, index) => (
              <button className="evidence-card" key={item.src} onClick={(event) => openEvidence(item, event.currentTarget)} type="button">
                <span className="evidence-number">Exhibit {scenario.number}.{index + 1}</span>
                <span className="evidence-focus">{item.focus}</span>
                <span className="evidence-thumb">
                  <Image src={item.src} alt="" className="evidence-thumb-image" fill loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 800px) 90vw, 30vw" unoptimized />
                </span>
                <span className="evidence-caption">{item.caption}</span>
                <span className="evidence-view">Open evidence <ChevronIcon direction="right" /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="case-handoff">
          {onSelectScenario ? (
            scenario.slug === "trustgate" ? (
              <button className="solid-link" onClick={() => { if (!workspace.launchApp("experience")) focusApp("experience"); }} type="button">
                Open Experience <ChevronIcon direction="right" />
              </button>
            ) : (
              <button className="solid-link" onClick={() => onSelectScenario(nextScenario.slug)} type="button">
                {scenario.slug === "payflow" ? "Next: Service observability" : "Next: Android device trust"} <ChevronIcon direction="right" />
              </button>
            )
          ) : (
            <Link className="solid-link" href={scenario.slug === "payflow" ? "/case/iyup" : scenario.slug === "iyup" ? "/case/trustgate" : "/brief"}>
              {scenario.slug === "payflow" ? "Next: Service observability" : scenario.slug === "iyup" ? "Next: Android device trust" : "Open Experience"} <ChevronIcon direction="right" />
            </Link>
          )}
        </section>
      </WorkspaceElement>

      {evidence ? (
        <EvidenceDialog
          evidence={evidence}
          evidenceWindowId={`evidence-${scenario.slug}-0${Math.max(0, scenario.evidence.findIndex((item) => item.src === evidence.src)) + 1}` as WorkspaceWindowId}
          exhibitLabel={`Exhibit ${scenario.number}.${Math.max(0, scenario.evidence.findIndex((item) => item.src === evidence.src)) + 1}`}
          onClose={closeEvidence}
          parentWindowId={hostWindowId}
          returnFocus={evidenceTriggerRef.current}
        />
      ) : null}
    </>
  );
}
