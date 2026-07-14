"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";

type WindowFrameOptions = {
  defaultHeight: number;
  defaultWidth: number;
  minHeight?: number;
  minWidth?: number;
};

export type ResizeEdge = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type SnapEdge = "left" | "right" | "top" | "bottom" | null;
export type FrameRect = { height: number; width: number; x: number; y: number };

export const windowResizeEdges: ResizeEdge[] = ["top", "right", "bottom", "left", "top-left", "top-right", "bottom-left", "bottom-right"];

export function resizeFrame(rect: FrameRect, edge: ResizeEdge, dx: number, dy: number): FrameRect {
  const next = { ...rect };
  if (edge.includes("right")) next.width = rect.width + dx;
  if (edge.includes("bottom")) next.height = rect.height + dy;
  if (edge.includes("left")) {
    next.width = rect.width - dx;
    next.x = rect.x + dx;
  }
  if (edge.includes("top")) {
    next.height = rect.height - dy;
    next.y = rect.y + dy;
  }
  return next;
}

export function useWindowFrame({
  defaultHeight,
  defaultWidth,
  minHeight = 520,
  minWidth = 720,
}: WindowFrameOptions) {
  const serverSafeRect = { height: defaultHeight, width: defaultWidth, x: 32, y: 86 };

  function defaultRect(): FrameRect {
    if (typeof window === "undefined") {
      return serverSafeRect;
    }

    const bounds = workspaceBounds();
    const horizontalGutter = window.innerWidth > 760 ? 96 : 24;
    const width = Math.min(defaultWidth, window.innerWidth - horizontalGutter);
    const height = Math.min(defaultHeight, bounds.bottom - bounds.top - 24);
    return {
      height,
      width,
      x: Math.max(12, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(bounds.top, Math.round(bounds.top + (bounds.bottom - bounds.top - height) / 2)),
    };
  }

  const initialRect = serverSafeRect;
  const frameRef = useRef<HTMLElement>(null);
  const restoreRectRef = useRef<FrameRect | null>(null);
  const restoreSnapRef = useRef<SnapEdge>(null);
  const committedSnapRef = useRef<SnapEdge>(null);
  const sessionRef = useRef<{
    edge?: ResizeEdge;
    kind: "idle" | "drag" | "resize";
    minimumHeight?: number;
    minimumWidth?: number;
    moved?: boolean;
    pointerId: number;
    rect: FrameRect;
    startX: number;
    startY: number;
  }>({ kind: "idle", pointerId: -1, rect: initialRect, startX: 0, startY: 0 });
  const [rect, setRect] = useState<FrameRect>(initialRect);
  const [dragging, setDragging] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [snap, setSnap] = useState<SnapEdge>(null);
  const [snapCandidate, setSnapCandidate] = useState<SnapEdge>(null);
  const snapRef = useRef<SnapEdge>(null);

  useEffect(() => {
    resetFrame();
  // The first client pass must match the server. The viewport-aware rect is applied only after hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const keepInWorkspace = () => {
      setRect((current) => maximized
        ? clamp(maximizedRect(), { respectMinimums: false })
        : snap
          ? clamp(snapRect(snap), { respectMinimums: false })
          : clamp(current));
    };
    window.addEventListener("resize", keepInWorkspace);
    return () => window.removeEventListener("resize", keepInWorkspace);
  // Recalculate committed snaps and clamp floating windows when the viewport changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maximized, snap]);

  useEffect(() => {
    const finishOutsideHandle = (event: globalThis.PointerEvent) => finish(event.pointerId);
    const moveOutsideHandle = (event: globalThis.PointerEvent) => move(event as unknown as PointerEvent<HTMLElement>);
    window.addEventListener("pointermove", moveOutsideHandle, true);
    window.addEventListener("pointerup", finishOutsideHandle, true);
    window.addEventListener("pointercancel", finishOutsideHandle, true);
    return () => {
      window.removeEventListener("pointermove", moveOutsideHandle, true);
      window.removeEventListener("pointerup", finishOutsideHandle, true);
      window.removeEventListener("pointercancel", finishOutsideHandle, true);
    };
  // Pointer capture should finish on the handle; this global guard prevents a lost release from leaving the frame locked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function workspaceBounds() {
    const headerBottom = document.querySelector<HTMLElement>(".portfolio-header")?.getBoundingClientRect().bottom ?? 60;
    return { top: Math.max(60, Math.round(headerBottom + 8)), bottom: window.innerHeight - 12 };
  }

  function resetFrame() {
    const nextRect = defaultRect();
    setRect(nextRect);
    setDragging(false);
    setMaximized(false);
    setResizing(false);
    setSnap(null);
    setSnapCandidate(null);
    snapRef.current = null;
    restoreRectRef.current = null;
    restoreSnapRef.current = null;
    committedSnapRef.current = null;
    sessionRef.current = { kind: "idle", pointerId: -1, rect: nextRect, startX: 0, startY: 0 };
  }

  function snapTo(edge: Exclude<SnapEdge, null>) {
    setRect(clamp(snapRect(edge), { respectMinimums: false }));
    setDragging(false);
    setMaximized(false);
    setResizing(false);
    setSnap(edge);
    setSnapCandidate(null);
    snapRef.current = edge;
    committedSnapRef.current = edge;
    restoreRectRef.current = null;
    restoreSnapRef.current = null;
  }

  function maximizedRect(): FrameRect {
    const gap = 12;
    const bounds = workspaceBounds();
    return {
      height: bounds.bottom - bounds.top,
      width: window.innerWidth - gap * 2,
      x: gap,
      y: bounds.top,
    };
  }

  function toggleMaximize(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    if (window.matchMedia("(max-width: 760px)").matches) return;
    if (maximized) {
      const restoredSnap = restoreSnapRef.current;
      setRect(restoredSnap
        ? clamp(snapRect(restoredSnap), { respectMinimums: false })
        : clamp(restoreRectRef.current ?? defaultRect()));
      setMaximized(false);
      setSnap(restoredSnap);
      snapRef.current = restoredSnap;
      committedSnapRef.current = restoredSnap;
      restoreRectRef.current = null;
      restoreSnapRef.current = null;
      return;
    }
    const nodeRect = frameRef.current?.getBoundingClientRect();
    const snapToRestore = snap ?? committedSnapRef.current;
    restoreRectRef.current = clamp({
      height: nodeRect?.height ?? rect.height,
      width: nodeRect?.width ?? rect.width,
      x: nodeRect?.left ?? rect.x,
      y: nodeRect?.top ?? rect.y,
    }, { respectMinimums: !snapToRestore });
    restoreSnapRef.current = snapToRestore;
    setRect(clamp(maximizedRect(), { respectMinimums: false }));
    setMaximized(true);
    setSnap(null);
    setSnapCandidate(null);
    snapRef.current = null;
  }

  function clamp(next: FrameRect, options: { minimumHeight?: number; minimumWidth?: number; respectMinimums?: boolean } = {}): FrameRect {
    if (typeof window === "undefined") return next;
    const respectMinimums = options.respectMinimums ?? true;
    const bounds = workspaceBounds();
    const maxWidth = Math.max(280, window.innerWidth - 24);
    const maxHeight = Math.max(260, bounds.bottom - bounds.top);
    const compactMinWidth = Math.min(minWidth, Math.max(280, Math.floor((window.innerWidth - 36) / 2)));
    const compactMinHeight = Math.min(minHeight, Math.max(260, Math.floor((window.innerHeight - 90) / 2)));
    const requestedMinWidth = options.minimumWidth ?? (respectMinimums ? minWidth : compactMinWidth);
    const requestedMinHeight = options.minimumHeight ?? (respectMinimums ? minHeight : compactMinHeight);
    const effectiveMinWidth = Math.min(requestedMinWidth, maxWidth);
    const effectiveMinHeight = Math.min(requestedMinHeight, maxHeight);
    const width = Math.min(Math.max(effectiveMinWidth, next.width), maxWidth);
    const height = Math.min(Math.max(effectiveMinHeight, next.height), maxHeight);
    return {
      height,
      width,
      x: Math.min(Math.max(12, next.x), Math.max(12, window.innerWidth - width - 12)),
      y: Math.min(Math.max(bounds.top, next.y), Math.max(bounds.top, bounds.bottom - height)),
    };
  }

  function snapFor(event: PointerEvent<HTMLElement>): SnapEdge {
    const threshold = 34;
    const portraitTablet = window.innerWidth <= 1100 && window.innerHeight > window.innerWidth;
    if (portraitTablet) {
      if (event.clientY <= 72 + threshold) return "top";
      if (event.clientY >= window.innerHeight - threshold) return "bottom";
      return null;
    }
    if (event.clientX <= threshold) return "left";
    if (event.clientX >= window.innerWidth - threshold) return "right";
    if (event.clientY <= 72 + threshold) return "top";
    if (event.clientY >= window.innerHeight - threshold) return "bottom";
    return null;
  }

  function snapRect(edge: Exclude<SnapEdge, null>): FrameRect {
    const gap = 12;
    const bounds = workspaceBounds();
    const top = bounds.top;
    const availableWidth = window.innerWidth - gap * 3;
    const availableHeight = bounds.bottom - top;
    if (edge === "left") return { x: gap, y: top, width: Math.round(availableWidth / 2), height: availableHeight };
    if (edge === "right") return { x: gap * 2 + Math.round(availableWidth / 2), y: top, width: Math.floor(availableWidth / 2), height: availableHeight };
    if (edge === "top") return { x: gap, y: top, width: window.innerWidth - gap * 2, height: Math.round(availableHeight / 2) };
    return { x: gap, y: top + gap + Math.round(availableHeight / 2), width: window.innerWidth - gap * 2, height: Math.floor(availableHeight / 2) };
  }

  function startDrag(event: PointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a")) return;
    if (window.matchMedia("(max-width: 760px)").matches) return;
    if (maximized) return;
    const nodeRect = frameRef.current?.getBoundingClientRect();
    const base = clamp({
      height: nodeRect?.height ?? rect.height,
      width: nodeRect?.width ?? rect.width,
      x: nodeRect?.left ?? rect.x,
      y: nodeRect?.top ?? rect.y,
    }, { respectMinimums: !snap });
    sessionRef.current = {
      kind: "drag",
      minimumHeight: Math.min(minHeight, base.height),
      minimumWidth: Math.min(minWidth, base.width),
      moved: false,
      pointerId: event.pointerId,
      rect: base,
      startX: event.clientX,
      startY: event.clientY,
    };
    setRect(base);
    setDragging(true);
    setSnap(null);
    setSnapCandidate(null);
    snapRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startResize(edge: ResizeEdge) {
    return (event: PointerEvent<HTMLElement>) => {
      if (window.matchMedia("(max-width: 760px)").matches) return;
      event.preventDefault();
      event.stopPropagation();
      const nodeRect = frameRef.current?.getBoundingClientRect();
      const wasSnapped = Boolean(snap);
      const base = clamp({
        height: nodeRect?.height ?? rect.height,
        width: nodeRect?.width ?? rect.width,
        x: nodeRect?.left ?? rect.x,
        y: nodeRect?.top ?? rect.y,
      }, { respectMinimums: !wasSnapped });
      sessionRef.current = {
        edge,
        kind: "resize",
        minimumHeight: Math.min(minHeight, base.height),
        minimumWidth: Math.min(minWidth, base.width),
        pointerId: event.pointerId,
        rect: base,
        startX: event.clientX,
        startY: event.clientY,
      };
      setRect(base);
      setMaximized(false);
      setResizing(true);
      setSnap(null);
      setSnapCandidate(null);
      snapRef.current = null;
      committedSnapRef.current = null;
      restoreRectRef.current = null;
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  }

  function move(event: PointerEvent<HTMLElement>) {
    const session = sessionRef.current;
    if (event.pointerId !== session.pointerId || session.kind === "idle") return;
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;

    if (session.kind === "drag") {
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        sessionRef.current.moved = true;
        committedSnapRef.current = null;
      }
      setRect(clamp(
        { ...session.rect, x: session.rect.x + dx, y: session.rect.y + dy },
        { minimumHeight: session.minimumHeight, minimumWidth: session.minimumWidth },
      ));
      const nextSnap = snapFor(event);
      snapRef.current = nextSnap;
      setSnapCandidate(nextSnap);
      return;
    }

    const edge = session.edge ?? "bottom-right";
    const next = resizeFrame(session.rect, edge, dx, dy);
    const resizeOptions = {
      minimumHeight: session.minimumHeight,
      minimumWidth: session.minimumWidth,
    };
    let bounded = clamp(next, resizeOptions);
    if (edge.includes("left")) {
      bounded = clamp({ ...bounded, x: session.rect.x + session.rect.width - bounded.width }, resizeOptions);
    }
    if (edge.includes("top")) {
      bounded = clamp({ ...bounded, y: session.rect.y + session.rect.height - bounded.height }, resizeOptions);
    }
    setRect(bounded);
  }

  function finish(pointerId: number, captureTarget?: HTMLElement) {
    if (pointerId !== sessionRef.current.pointerId) return;
    const completedKind = sessionRef.current.kind;
    const completedSnap = snapRef.current;
    const completedMove = sessionRef.current.moved;
    if (completedKind === "drag" && completedSnap) {
      setRect(clamp(snapRect(completedSnap), { respectMinimums: false }));
    }
    sessionRef.current = { kind: "idle", pointerId: -1, rect, startX: 0, startY: 0 };
    setDragging(false);
    setResizing(false);
    setSnap(completedKind === "drag" ? completedSnap : null);
    if (completedKind === "drag") {
      committedSnapRef.current = completedSnap ?? (completedMove ? null : committedSnapRef.current);
    }
    setSnapCandidate(null);
    snapRef.current = null;
    if (captureTarget?.hasPointerCapture(pointerId)) {
      captureTarget.releasePointerCapture(pointerId);
    }
  }

  function end(event: PointerEvent<HTMLElement>) {
    finish(event.pointerId, event.currentTarget);
  }

  return {
    frameRef,
    dragging,
    maximized,
    resetFrame,
    resizing,
    resizeHandleProps: (edge: ResizeEdge) => ({
      "aria-hidden": true,
      className: `window-resize-handle resize-${edge}`,
      onPointerCancel: end,
      onPointerDown: startResize(edge),
      onLostPointerCapture: end,
      onPointerMove: move,
      onPointerUp: end,
    }),
    snap,
    snapCandidate,
    snapTo,
    style: {
      "--window-height": `${rect.height}px`,
      "--window-min-height": `${minHeight}px`,
      "--window-min-width": `${minWidth}px`,
      "--window-width": `${rect.width}px`,
      "--window-x": `${rect.x}px`,
      "--window-y": `${rect.y}px`,
    } as CSSProperties,
    titlebarProps: {
      onDoubleClick: toggleMaximize,
      onLostPointerCapture: end,
      onPointerCancel: end,
      onPointerDown: startDrag,
      onPointerMove: move,
      onPointerUp: end,
    },
  };
}
