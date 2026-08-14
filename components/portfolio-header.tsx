"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
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
          onCompactBack={workspace.mode === "phone" ? workspace.requestBack : undefined}
          onMinimize={() => workspace.minimizeWindow("contact")}
          onToggleMaximize={toggleMaximize}
          {...titlebarProps}
        />
        {windowResizeEdges.map((edge) => <span key={edge} {...resizeHandleProps(edge)} />)}
        <div className="contact-window-body">
          <h2>Where to find me.</h2>
          <ul className="contact-directory">
            <li>
              <div className="contact-channel">
                <span>Email</span>
                <a href="mailto:fattahmuhammad17@gmail.com">fattahmuhammad17@gmail.com</a>
              </div>
              <CopyEmailButton email="fattahmuhammad17@gmail.com" label="Copy" copiedLabel="Copied" className="contact-directory-action" />
            </li>
            <li>
              <div className="contact-channel">
                <span>LinkedIn</span>
                <a href="https://www.linkedin.com/in/muhammad24fattah/" target="_blank" rel="noopener noreferrer">linkedin.com/in/muhammad24fattah</a>
              </div>
              <a className="contact-directory-action" href="https://www.linkedin.com/in/muhammad24fattah/" target="_blank" rel="noopener noreferrer" aria-label="Open LinkedIn profile">
                Open <ArrowIcon />
              </a>
            </li>
            <li>
              <div className="contact-channel">
                <span>WhatsApp</span>
                <a href="https://wa.me/6281944242422" target="_blank" rel="noopener noreferrer">0819 4424 2422</a>
              </div>
              <a className="contact-directory-action" href="https://wa.me/6281944242422" target="_blank" rel="noopener noreferrer" aria-label="Open WhatsApp conversation">
                Open <ArrowIcon />
              </a>
            </li>
            <li>
              <div className="contact-channel">
                <span>GitHub</span>
                <a href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer">github.com/fattah247</a>
              </div>
              <a className="contact-directory-action" href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer" aria-label="Open GitHub profile">
                Open <ArrowIcon />
              </a>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export function PortfolioHeader() {
  const pathname = usePathname();
  const workspace = useWorkspaceManager();
  const contactOpen = workspace.isOpen("contact");
  const standalonePage = pathname.startsWith("/products");

  useEffect(() => {
    const openContact = () => workspace.openWindow("contact");
    window.addEventListener("portfolio-contact-open", openContact);
    return () => window.removeEventListener("portfolio-contact-open", openContact);
  }, [workspace]);

  return (
    <>
      <SystemShell />
      <ContactWindow open={contactOpen && !standalonePage} onClose={() => workspace.closeApp("contact")} />
    </>
  );
}
