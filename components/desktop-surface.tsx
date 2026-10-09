"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AppIcon, OwnerMark } from "./app-icons";
import { CaseCover } from "./case-cover";
import { DownloadIcon } from "./icons";
import { Wallpaper } from "./wallpaper";
import { scenarios, type ScenarioSlug } from "../lib/scenarios";
import { portfolioIdentity } from "../lib/portfolio-identity";
import { useWorkspaceManager, type WorkspaceWindowId } from "./workspace-manager";

type WorkspaceWindow = Extract<WorkspaceWindowId, "work" | "experience" | "products">;

const desktopItems = [
  { className: "surface-work", href: "/#selected-work", label: "Projects", app: "work", type: "folder" },
  { className: "surface-experience", href: "/brief", label: "Experience", app: "experience", type: "folder" },
  { className: "surface-contact", href: "#contact", label: "Contact", app: "contact", type: "folder" },
  { className: "surface-products", href: "/products", label: "Product Links", app: "products", type: "folder" },
  ...scenarios.map((scenario) => ({
    className: `surface-shot-${scenario.slug}`,
    href: `/case/${scenario.slug}`,
    label: scenario.category,
    slug: scenario.slug,
    type: "image" as const,
  })),
] as const;

type DesktopOffset = { x: number; y: number; z: number };
type DesktopOffsets = Record<string, DesktopOffset>;

const desktopOffsetsSessionKey = "fattah.desktop.shortcuts.v1";
const desktopGrabHintDelay = 1_200;

function readDesktopOffsets(): DesktopOffsets {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(desktopOffsetsSessionKey) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).flatMap(([key, value]) => {
      if (!value || typeof value !== "object") return [];
      const offset = value as Partial<DesktopOffset>;
      return Number.isFinite(offset.x) && Number.isFinite(offset.y)
        ? [[key, { x: Number(offset.x), y: Number(offset.y), z: Number.isFinite(offset.z) ? Number(offset.z) : 0 }]]
        : [];
    }));
  } catch {
    return {};
  }
}

function storeDesktopOffsets(offsets: DesktopOffsets) {
  try {
    window.sessionStorage.setItem(desktopOffsetsSessionKey, JSON.stringify(offsets));
  } catch {
    // Session storage is an enhancement; shortcut dragging still works without it.
  }
}

export function DesktopSurface({
  onOpenCase,
  onOpenWindow,
}: {
  onOpenCase: (slug: ScenarioSlug) => void;
  onOpenWindow: (windowName: WorkspaceWindow, target?: "selected-work") => void;
}) {
  const workspace = useWorkspaceManager();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    baseLeft: number;
    baseTop: number;
    height: number;
    key: string;
    latest: DesktopOffset;
    moved: boolean;
    origin: DesktopOffset;
    pointerId: number;
    startX: number;
    startY: number;
    topZ: number;
    width: number;
    boardWidth: number;
    boardHeight: number;
  } | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const grabHintTimerRef = useRef<number | null>(null);
  const [desktopOffsets, setDesktopOffsets] = useState<DesktopOffsets>({});
  const [draggingDesktopItem, setDraggingDesktopItem] = useState<string | null>(null);
  const [grabReadyDesktopItem, setGrabReadyDesktopItem] = useState<string | null>(null);
  // Desktop convention: one click selects a shortcut, a double click (or Enter, or a touch tap)
  // opens it. Selection is visual only; focus follows it for keyboard users.
  const [selectedDesktopItem, setSelectedDesktopItem] = useState<string | null>(null);
  const lastPointerTypeRef = useRef<string>("mouse");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDesktopOffsets(readDesktopOffsets()));
    return () => {
      window.cancelAnimationFrame(frame);
      if (grabHintTimerRef.current) window.clearTimeout(grabHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function clampShortcutsToBoard() {
      const board = boardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();

      setDesktopOffsets((current) => {
        let changed = false;
        const next = { ...current };
        for (const [key, offset] of Object.entries(current)) {
          const shortcut = board.querySelector<HTMLElement>(`.${key}`);
          if (!shortcut) continue;
          const rect = shortcut.getBoundingClientRect();
          const x = offset.x + Math.max(0, boardRect.left - rect.left) - Math.max(0, rect.right - boardRect.right);
          const y = offset.y + Math.max(0, boardRect.top - rect.top) - Math.max(0, rect.bottom - boardRect.bottom);
          if (x !== offset.x || y !== offset.y) {
            next[key] = { ...offset, x, y };
            changed = true;
          }
        }
        if (changed) storeDesktopOffsets(next);
        return changed ? next : current;
      });
    }

    window.addEventListener("resize", clampShortcutsToBoard);
    const frame = window.requestAnimationFrame(clampShortcutsToBoard);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", clampShortcutsToBoard);
    };
  }, []);

  function beginDesktopDrag(event: ReactPointerEvent<HTMLAnchorElement>, key: string) {
    if (event.button !== 0 || document.documentElement.dataset.systemMode !== "computer") return;
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const shortcutRect = event.currentTarget.getBoundingClientRect();
    const origin = desktopOffsets[key] ?? { x: 0, y: 0, z: 0 };
    if (grabHintTimerRef.current) window.clearTimeout(grabHintTimerRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      baseLeft: shortcutRect.left - boardRect.left - origin.x,
      baseTop: shortcutRect.top - boardRect.top - origin.y,
      height: shortcutRect.height,
      key,
      latest: origin,
      moved: false,
      origin,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      topZ: Math.max(0, ...Object.values(desktopOffsets).map((offset) => offset.z)) + 1,
      width: shortcutRect.width,
      boardWidth: boardRect.width,
      boardHeight: boardRect.height,
    };
  }

  function moveDesktopShortcut(event: ReactPointerEvent<HTMLAnchorElement>) {
    const drag = dragRef.current;
    const board = boardRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !board) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;
    event.preventDefault();
    if (!drag.moved) {
      drag.moved = true;
      drag.latest = { ...drag.latest, z: drag.topZ };
    }
    const next = {
      x: Math.min(drag.boardWidth - drag.baseLeft - drag.width, Math.max(-drag.baseLeft, drag.origin.x + deltaX)),
      y: Math.min(drag.boardHeight - drag.baseTop - drag.height, Math.max(-drag.baseTop, drag.origin.y + deltaY)),
      z: drag.latest.z,
    };
    drag.latest = next;
    setDraggingDesktopItem(drag.key);
    setDesktopOffsets((current) => {
      const updated = { ...current, [drag.key]: next };
      return updated;
    });
  }

  function clearDesktopGrabHint() {
    if (grabHintTimerRef.current) window.clearTimeout(grabHintTimerRef.current);
    grabHintTimerRef.current = null;
    setGrabReadyDesktopItem(null);
  }

  function scheduleDesktopGrabHint(key: string) {
    if (document.documentElement.dataset.systemMode !== "computer" || dragRef.current) return;
    if (grabHintTimerRef.current) window.clearTimeout(grabHintTimerRef.current);
    setGrabReadyDesktopItem(null);
    grabHintTimerRef.current = window.setTimeout(() => {
      grabHintTimerRef.current = null;
      if (!dragRef.current) setGrabReadyDesktopItem(key);
    }, desktopGrabHintDelay);
  }

  function moveOrPrimeDesktopShortcut(event: ReactPointerEvent<HTMLAnchorElement>, key: string) {
    if (dragRef.current) {
      moveDesktopShortcut(event);
      return;
    }
    if (event.pointerType !== "touch") scheduleDesktopGrabHint(key);
  }

  function endDesktopDrag(event: ReactPointerEvent<HTMLAnchorElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved) {
      suppressClickRef.current = drag.key;
      setDesktopOffsets((current) => {
        const next = { ...current, [drag.key]: drag.latest };
        storeDesktopOffsets(next);
        return next;
      });
      window.setTimeout(() => {
        if (suppressClickRef.current === drag.key) suppressClickRef.current = null;
      }, 0);
    }
    setDraggingDesktopItem(null);
    clearDesktopGrabHint();
    dragRef.current = null;
  }

  function draggedClick(event: MouseEvent<HTMLAnchorElement>, key: string) {
    if (suppressClickRef.current !== key) return false;
    event.preventDefault();
    suppressClickRef.current = null;
    return true;
  }

  /** A mouse single click only selects; keyboard activation (detail 0), the second click of a
   * double click, and touch taps open. Returns true when the click should open the item. */
  function shouldOpenFromClick(event: MouseEvent<HTMLAnchorElement>, key: string) {
    if (draggedClick(event, key)) return false;
    setSelectedDesktopItem(key);
    if (event.detail === 0 || event.detail >= 2 || lastPointerTypeRef.current === "touch") return true;
    event.preventDefault();
    return false;
  }

  function moveSelection(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(event.key)) return;
    const items = Array.from(boardRef.current?.querySelectorAll<HTMLAnchorElement>(".desktop-object") ?? []);
    const index = items.findIndex((item) => item === document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  }

  return (
    <section className="desktop-surface" aria-labelledby="desktop-surface-title">
      <Wallpaper />
      <h2 className="sr-only" id="desktop-surface-title">Engineering workspace</h2>
      {/* A pinned desk accessory, in the chrome language of the windows: it names whose computer
          this is and carries the two things a visitor most often wants, the CV and an address. */}
      <div className="desktop-identity" role="group" aria-label={`${portfolioIdentity.name}, ${portfolioIdentity.role}`}>
        <p className="desktop-identity-title" aria-hidden="true">About this computer</p>
        <OwnerMark className="desktop-identity-mark" />
        <div className="desktop-identity-copy">
          <h1>{portfolioIdentity.name}</h1>
          <p>{portfolioIdentity.role}, {portfolioIdentity.location}</p>
          <p className="desktop-identity-focus">{portfolioIdentity.focus}</p>
        </div>
        <div className="desktop-identity-actions">
          <a className="desktop-identity-primary" href={portfolioIdentity.cv} download>Download CV <DownloadIcon /></a>
          <a className="desktop-identity-email" href={`mailto:${portfolioIdentity.email}`}>{portfolioIdentity.email}</a>
        </div>
      </div>
      <div
        className="desktop-board"
        onKeyDown={moveSelection}
        onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedDesktopItem(null); }}
        role="group"
        aria-label="Portfolio desktop shortcuts"
        ref={boardRef}
      >
        {desktopItems.map((item) => (
          <Link
            className={`desktop-object ${item.type === "folder" ? "desktop-folder" : "desktop-evidence desktop-case-file"} ${item.className}`}
            data-dragging={draggingDesktopItem === item.className ? "true" : undefined}
            data-selected={selectedDesktopItem === item.className ? "true" : undefined}
            onFocus={() => setSelectedDesktopItem(item.className)}
            data-grab-ready={grabReadyDesktopItem === item.className ? "true" : undefined}
            href={item.href}
            key={item.label}
            onDragStart={(event) => event.preventDefault()}
            onClick={(event) => {
              if (!shouldOpenFromClick(event, item.className)) return;
              event.preventDefault();
              if (item.type === "image") onOpenCase(item.slug);
              else if (item.app === "contact") workspace.launchApp("contact");
              else onOpenWindow(item.app, item.app === "work" ? "selected-work" : undefined);
            }}
            onPointerCancel={(event) => {
              if (dragRef.current) {
                endDesktopDrag(event);
                return;
              }

              clearDesktopGrabHint();
            }}
            onPointerDown={(event) => {
              lastPointerTypeRef.current = event.pointerType || "mouse";
              setSelectedDesktopItem(item.className);
              beginDesktopDrag(event, item.className);
            }}
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") scheduleDesktopGrabHint(item.className);
            }}
            onPointerLeave={() => {
              if (!dragRef.current) clearDesktopGrabHint();
            }}
            onPointerMove={(event) => moveOrPrimeDesktopShortcut(event, item.className)}
            onPointerUp={endDesktopDrag}
            style={{
              "--desktop-offset-x": `${desktopOffsets[item.className]?.x ?? 0}px`,
              "--desktop-offset-y": `${desktopOffsets[item.className]?.y ?? 0}px`,
              zIndex: desktopOffsets[item.className]?.z || undefined,
            } as CSSProperties}
          >
            {item.type === "folder" ? (
              <span className="desktop-app-glyph" aria-hidden="true"><AppIcon app={item.app} /></span>
            ) : (
              <span className="case-file-sheet" aria-hidden="true">
                <CaseCover slug={item.slug} />
              </span>
            )}
            <span className="desktop-object-copy">
              <strong>{item.label}</strong>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
