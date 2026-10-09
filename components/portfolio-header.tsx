"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowIcon } from "@/components/icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { SystemShell } from "@/components/system-shell";
import { useWindowFrame } from "@/components/use-window-frame";
import { ApplicationFrame } from "./application-frame";
import { displayHandle, portfolioIdentity } from "../lib/portfolio-identity";
import { WindowChrome } from "@/components/window-chrome";
import { useWorkspaceManager } from "@/components/workspace-manager";
import { OwnerMark } from "@/components/app-icons";

function ContactWindow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspace = useWorkspaceManager();
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const foregroundRef = useRef(false);
  foregroundRef.current = workspace.activeWindow === "contact" && workspace.surface === "application";
  const [isClosing, setIsClosing] = useState(false);
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
  } = useWindowFrame({ appId: "contact", enabled: open, defaultHeight: 500, defaultWidth: 520, minHeight: 320, minWidth: 360 });

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    frameRef.current?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      // A background Contact window leaves Escape to the foreground application.
      if (event.key === "Escape" && !event.defaultPrevented && foregroundRef.current) requestClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  // The close request is intentionally read from the current render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || workspace.mode === "computer") return;
    return workspace.registerBackHandler("contact-root", () => {
      // Only the foreground Contact window answers Back; registration order must not decide.
      if (workspace.activeWindow !== "contact" || workspace.surface !== "application") return false;
      workspace.goHome();
      return true;
    });
  }, [open, workspace]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closingRef.current = false;
      setIsClosing(false);
      onClose();
    }, 320);
  }

  if (!open) return null;

  return (
    <div
      className="contact-window-layer"
      data-closing={isClosing}
      data-window-state={workspace.stateFor("contact")}
      role="presentation"
      style={{ "--window-layer-z": workspace.zIndexFor("contact") } as CSSProperties}
    >
      <div className="contact-window-scrim" aria-hidden="true" />
      <ApplicationFrame windowId="contact" resizeHandleProps={resizeHandleProps}
        className="contact-window"
        data-active-window={workspace.activeWindow === "contact"}
        data-app-id="contact"
        data-dragging={dragging}
        data-maximized={maximized}
        data-resizing={resizing}
        data-snap={snap ?? undefined}
        data-window-state={workspace.stateFor("contact")}
        onPointerDown={() => workspace.focusWindow("contact")}
        frameRef={frameRef}
        role="dialog"
        aria-modal="false"
        aria-label="Contact"
        style={{ ...style, "--window-z": workspace.zIndexFor("contact") } as CSSProperties}
        suppressHydrationWarning
        tabIndex={-1}
      >
        <WindowChrome
          app="contact"
          className="window-titlebar contact-titlebar"
          closeRef={closeRef}
          closeLabel="Close contact window"
          label="Contact"
          maximized={maximized}
          onClose={requestClose}
          onMinimize={() => workspace.minimizeWindow("contact")}
          onToggleMaximize={toggleMaximize}
          {...titlebarProps}
        />
        <div className="contact-window-body">
          <header className="contact-card-head">
            <OwnerMark className="contact-card-mark" />
            <div>
              <h2>{portfolioIdentity.name}</h2>
              <p>{portfolioIdentity.location} · UTC+7</p>
            </div>
          </header>
          <ul className="contact-directory">
            <li className="contact-primary" data-channel="email">
              <div className="contact-channel">
                <span>Email</span>
                <a href={`mailto:${portfolioIdentity.email}`}>{portfolioIdentity.email}</a>
              </div>
              <div className="contact-primary-actions">
                <a className="contact-directory-action is-primary" href={`mailto:${portfolioIdentity.email}`}>Write email</a>
                <CopyEmailButton email={portfolioIdentity.email} label="Copy email" copiedLabel="Email copied" className="contact-directory-action" />
              </div>
            </li>
            <li data-channel="linkedin">
              <div className="contact-channel">
                <span>LinkedIn</span>
                <span>{displayHandle(portfolioIdentity.linkedin)}</span>
              </div>
              <a className="contact-directory-action" href={portfolioIdentity.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Open LinkedIn profile">
                <span className="contact-action-label">Open</span> <ArrowIcon />
              </a>
            </li>
            <li data-channel="whatsapp">
              <div className="contact-channel">
                <span>WhatsApp</span>
                <span>{portfolioIdentity.whatsappDisplay}</span>
              </div>
              <a className="contact-directory-action" href={portfolioIdentity.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Open WhatsApp conversation">
                <span className="contact-action-label">Open</span> <ArrowIcon />
              </a>
            </li>
            <li data-channel="github">
              <div className="contact-channel">
                <span>GitHub</span>
                <span>{displayHandle(portfolioIdentity.github)}</span>
              </div>
              <a className="contact-directory-action" href={portfolioIdentity.github} target="_blank" rel="noopener noreferrer" aria-label="Open GitHub profile">
                <span className="contact-action-label">Open</span> <ArrowIcon />
              </a>
            </li>
          </ul>
        </div>
      </ApplicationFrame>
    </div>
  );
}

export function PortfolioHeader() {
  const workspace = useWorkspaceManager();
  const contactOpen = workspace.isOpen("contact");

  useEffect(() => workspace.registerAppLauncher("contact", () => workspace.openWindow("contact")), [workspace]);

  return (
    <>
      <SystemShell />
      <ContactWindow open={contactOpen} onClose={() => workspace.closeApp("contact")} />
    </>
  );
}
