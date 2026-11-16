"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from "react";
import { fadeOutCopy } from "../lib/motion";
import { AppIcon } from "./app-icons";
import { ChevronIcon, CloseIcon, MaximizeIcon, MinimizeIcon, MoreIcon } from "./icons";
import { useOptionalWorkspaceManager, type PortfolioAppId } from "./workspace-manager";
import type { useWindowFrame } from "./use-window-frame";

type WindowChromeProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  /** The owning application: its small icon is the window menu, as on a desktop title bar. */
  app?: PortfolioAppId;
  compactBackLabel?: string;
  /** Visible parent name beside the compact Back chevron where the title bar has room (tablet). */
  compactBackText?: string;
  onCompactBack?: () => void;
  closeHref?: string;
  closeLabel: string;
  closeClassName?: string;
  closeRef?: Ref<HTMLButtonElement>;
  label: string;
  locationClassName?: string;
  maximized?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  subtitle?: string;
  title?: string;
  titleId?: string;
  windowManagement?: ReturnType<typeof useWindowFrame>["titlebarProps"]["windowManagement"];
};

/**
 * Shared titlebar contract for every portfolio window.
 * Reading order follows the bar: the window menu (the app's own icon), the title, document
 * actions, then minimize, maximize, and close grouped at the trailing edge. The frame hook owns
 * drag behaviour; this component owns hierarchy and the close affordance.
 */
export function WindowChrome({
  actions,
  app,
  children,
  className = "",
  compactBackLabel,
  compactBackText,
  closeClassName = "window-close-action",
  closeRef,
  closeHref,
  closeLabel,
  label,
  locationClassName = "",
  maximized = false,
  onClose,
  onCompactBack,
  onMinimize,
  onToggleMaximize,
  subtitle,
  title,
  titleId,
  windowManagement,
  ...titlebarProps
}: WindowChromeProps) {
  const workspace = useOptionalWorkspaceManager();
  const [operation, setOperation] = useState<"move" | "resize" | null>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // A menu closes when the pointer goes elsewhere, like any desktop menu.
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  });

  function closeMenu(returnFocus = false) {
    if (operation) windowManagement?.cancel();
    setOperation(null);
    // A menu fades out as it goes, as a Mac's does; it's already gone for the pointer.
    if (menuRef.current?.open) fadeOutCopy(menuRef.current.querySelector<HTMLElement>(".window-management-options"));
    if (menuRef.current) menuRef.current.open = false;
    setMenuOpen(false);
    if (returnFocus) menuRef.current?.querySelector("summary")?.focus();
  }

  /** The chosen item blinks once (120 ms), then the menu closes and the action runs, as a desktop menu confirms a choice. */
  function runFromMenu(action?: () => void, chosen?: HTMLElement) {
    const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!chosen || still) { closeMenu(); action?.(); return; }
    chosen.dataset.chosen = "true";
    window.setTimeout(() => {
      delete chosen.dataset.chosen;
      closeMenu();
      action?.();
    }, 120);
  }

  // A desktop menu opens on the press, not the click, and the press can be carried to an item and let
  // go there to choose it, as on a Mac; pressed and let go on its own button, it stays open.
  const pressOpened = useRef(false);
  function pressMenu(event: ReactPointerEvent<HTMLElement>) {
    const menu = menuRef.current;
    if (!menu || event.pointerType !== "mouse" || event.button !== 0) return;
    pressOpened.current = true;
    if (menu.open) { closeMenu(); return; }
    menu.open = true;
    setMenuOpen(true);
    const id = event.pointerId;
    const letGo = (lifted: PointerEvent) => {
      if (lifted.pointerId !== id) return;
      window.removeEventListener("pointerup", letGo);
      // The click that follows a release on the button mustn't toggle the menu again.
      window.setTimeout(() => { pressOpened.current = false; }, 0);
      const under = document.elementFromPoint(lifted.clientX, lifted.clientY);
      const item = under?.closest<HTMLButtonElement>(".window-management-options button");
      if (item && menu.contains(item)) item.click();
      else if (!under || !menu.contains(under)) closeMenu();
    };
    window.addEventListener("pointerup", letGo);
  }

  // Up and down move through the menu's items, opening it from its button, as a desktop menu does.
  function stepThroughMenu(event: ReactKeyboardEvent<HTMLElement>) {
    const menu = menuRef.current;
    const items = [...(menu?.querySelectorAll<HTMLButtonElement>(".window-management-options button") ?? [])];
    if (!menu || !items.length) return;
    event.preventDefault();
    if (!menu.open) { menu.open = true; setMenuOpen(true); }
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[event.key === "ArrowDown" ? (at + 1) % items.length : at <= 0 ? items.length - 1 : at - 1].focus();
  }

  const closeControl = onClose ? (
    <button ref={closeRef} className={closeClassName} onClick={onClose} type="button" aria-label={closeLabel}>
      <span aria-hidden="true"><CloseIcon /></span>
    </button>
  ) : closeHref ? (
    <Link className={closeClassName} href={closeHref} aria-label={closeLabel}>
      <span aria-hidden="true"><CloseIcon /></span>
    </Link>
  ) : null;

  return (
    <div className={`window-chrome ${className}`.trim()} {...titlebarProps}>
      {onCompactBack ? (
        <button className="window-compact-back-action" onClick={onCompactBack} type="button" aria-label={compactBackLabel ?? `Back from ${label}`}>
          <ChevronIcon className="system-glyph" direction="left" />
          {compactBackText ? <span className="window-compact-back-text" aria-hidden="true">{compactBackText}</span> : null}
        </button>
      ) : null}
      {windowManagement && (!workspace || workspace.mode === "computer") ? <details className="window-management-menu" data-app={app} ref={menuRef} onToggle={(event) => setMenuOpen(event.currentTarget.open)} onKeyDown={(event) => {
        if (!operation) {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(true); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") stepThroughMenu(event);
          return;
        }
        const step = event.shiftKey ? 1 : 10;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (delta) { event.preventDefault(); event.stopPropagation(); windowManagement[operation](delta[0], delta[1]); }
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault(); event.stopPropagation();
          if (event.key === "Escape") windowManagement.cancel(); else windowManagement.commit();
          setOperation(null);
        }
      }}>
        <summary aria-label={`${label} window menu`} onClick={(event) => { if (pressOpened.current) { event.preventDefault(); pressOpened.current = false; } }} onPointerDown={pressMenu}>{app ? <AppIcon app={app} variant="small" /> : <MoreIcon className="system-control-icon" />}</summary>
        <div className="window-management-options" role="group" aria-label={`${label} window`}>
          {onToggleMaximize && maximized ? <button type="button" onClick={(event) => runFromMenu(onToggleMaximize, event.currentTarget)}>Restore</button> : null}
          <button type="button" onClick={() => { windowManagement.begin(); setOperation("move"); }}>Move with arrow keys</button>
          <button type="button" onClick={() => { windowManagement.begin(); setOperation("resize"); }}>Resize with arrow keys</button>
          <button type="button" onClick={(event) => runFromMenu(() => windowManagement.snap("left"), event.currentTarget)}>Snap left</button>
          <button type="button" onClick={(event) => runFromMenu(() => windowManagement.snap("right"), event.currentTarget)}>Snap right</button>
          <button type="button" onClick={(event) => runFromMenu(windowManagement.reset, event.currentTarget)}>Reset position</button>
          {onMinimize || (onToggleMaximize && !maximized) || onClose ? <hr /> : null}
          {onMinimize ? <button type="button" onClick={(event) => runFromMenu(onMinimize, event.currentTarget)}>Minimize</button> : null}
          {onToggleMaximize && !maximized ? <button type="button" onClick={(event) => runFromMenu(onToggleMaximize, event.currentTarget)}>Maximize</button> : null}
          {onClose ? <button type="button" onClick={(event) => runFromMenu(onClose, event.currentTarget)}>Close</button> : null}
          {operation ? <p role="status">Arrow keys {operation}. Shift: 1px. Enter: done. Escape: cancel.</p> : null}
        </div>
      </details> : null}
      <div aria-atomic="true" aria-live={title ? "polite" : undefined} className={`window-location ${locationClassName}`.trim()}>
        <p className="micro-label">{label}</p>
        {title ? <strong id={titleId}>{title}</strong> : null}
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {actions}
      <div className="window-control-cluster">
        {onMinimize ? <button className="window-system-control minimize" onClick={onMinimize} type="button" aria-label={`Minimize ${label}`}><span aria-hidden="true"><MinimizeIcon /></span></button> : null}
        {onToggleMaximize ? <button className="window-system-control maximize" onClick={onToggleMaximize} type="button" aria-label={`${maximized ? "Restore" : "Maximize"} ${label}`}><span aria-hidden="true"><MaximizeIcon restored={maximized} /></span></button> : null}
        {closeControl}
      </div>
      {children ?? <span className="window-chrome-grip" aria-hidden="true" />}
    </div>
  );
}
