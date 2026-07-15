"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowIcon } from "@/components/icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { SystemShell } from "@/components/system-shell";
import { useWindowFrame, windowResizeEdges } from "@/components/use-window-frame";
import { WindowChrome } from "@/components/window-chrome";
import { useWorkspaceManager } from "@/components/workspace-manager";

function ContactWindow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspace = useWorkspaceManager();
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
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
  } = useWindowFrame({ defaultHeight: 500, defaultWidth: 520, minHeight: 320, minWidth: 360 });

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    frameRef.current?.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
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
      <section
        className="contact-window"
        data-active-window={workspace.activeWindow === "contact"}
        data-app-id="contact"
        data-dragging={dragging}
        data-maximized={maximized}
        data-resizing={resizing}
        data-snap={snap ?? undefined}
        data-window-state={workspace.stateFor("contact")}
        onPointerDown={() => workspace.focusWindow("contact")}
        ref={frameRef}
        role="dialog"
        aria-modal="false"
        aria-label="Contact"
        style={{ ...style, "--window-z": workspace.zIndexFor("contact") } as CSSProperties}
        suppressHydrationWarning
        tabIndex={-1}
      >
        <WindowChrome
          className="window-titlebar contact-titlebar"
          closeRef={closeRef}
          closeLabel="Close contact window"
          label="Contact"
          maximized={maximized}
          onClose={requestClose}
          onMinimize={() => workspace.minimizeApp("contact")}
          onToggleMaximize={toggleMaximize}
          {...titlebarProps}
        />
        {windowResizeEdges.map((edge) => <span key={edge} {...resizeHandleProps(edge)} />)}
        <div className="contact-window-body">
          <p className="micro-label">Available channel</p>
          <h2>Email or public profile.</h2>
          <div className="contact-window-row">
            <span>Email</span>
            <strong>fattahmuhammad17@gmail.com</strong>
            <CopyEmailButton email="fattahmuhammad17@gmail.com" label="Copy email" copiedLabel="Copied" className="contact-window-copy" />
          </div>
          <a className="contact-window-link" href="https://www.linkedin.com/in/muhammad24fattah/" target="_blank" rel="noopener noreferrer">
            LinkedIn <span className="sr-only">opens in a new tab</span> <ArrowIcon />
          </a>
        </div>
      </section>
    </div>
  );
}

export function PortfolioHeader() {
  const workspace = useWorkspaceManager();
  const contactOpen = workspace.isOpen("contact");

  useEffect(() => {
    const openContact = () => workspace.openWindow("contact");
    window.addEventListener("portfolio-contact-open", openContact);
    return () => window.removeEventListener("portfolio-contact-open", openContact);
  }, [workspace]);

  return (
    <>
      <SystemShell />
      <ContactWindow open={contactOpen} onClose={() => workspace.closeApp("contact")} />
    </>
  );
}
