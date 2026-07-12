"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { ArrowIcon } from "@/components/icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { useWindowFrame, windowResizeEdges } from "@/components/use-window-frame";
import { WindowChrome } from "@/components/window-chrome";
import { useWorkspaceManager } from "@/components/workspace-manager";

type NavKey = "work" | "experience" | "contact";

function ContactWindow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspace = useWorkspaceManager();
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const {
    dragging,
    frameRef,
    resizeHandleProps,
    resizing,
    snap,
    style,
    titlebarProps,
  } = useWindowFrame({ defaultHeight: 500, defaultWidth: 520, minHeight: 320, minWidth: 360 });

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
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

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  function requestClose() {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 320);
  }

  if (!open) return null;

  return (
    <div className="contact-window-layer" data-closing={isClosing} role="presentation">
      <div className="contact-window-scrim" aria-hidden="true" />
      <section
        className="contact-window"
        data-active-window={workspace.activeWindow === "contact"}
        data-dragging={dragging}
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
      >
        <WindowChrome
          className="window-titlebar contact-titlebar"
          closeRef={closeRef}
          closeLabel="Close contact window"
          label="Contact"
          onClose={requestClose}
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

export function PortfolioHeader({ caseNumber }: { caseNumber?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspaceManager();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<NavKey, HTMLAnchorElement | null>>({ work: null, experience: null, contact: null });
  const [preview, setPreview] = useState<NavKey | null>(null);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, ready: false });
  const contactOpen = workspace.isOpen("contact");
  const active: NavKey | null = contactOpen && workspace.activeWindow === "contact"
    ? "contact"
    : pathname.startsWith("/case/") || (pathname === "/" && workspace.activeWindow !== "experience")
      ? "work"
      : "experience";
  const displayed = preview ?? active;

  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash === "#contact") {
        workspace.openWindow("contact");
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    };
    const openContactFromEvent = () => workspace.openWindow("contact");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("portfolio-contact-open", openContactFromEvent);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("portfolio-contact-open", openContactFromEvent);
    };
  }, [pathname, workspace]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!displayed) return;
    const item = itemRefs.current[displayed];
    if (!nav || !item) return;
    const position = () => {
      const navRect = nav.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const next = { x: itemRect.left - navRect.left, width: itemRect.width, ready: true };
      setIndicator(next);
      if (displayed === "work") {
        document.documentElement.style.setProperty("--locator-dock-x", `${itemRect.right + 5}px`);
        document.documentElement.style.setProperty("--locator-dock-y", `${itemRect.bottom + 7}px`);
      }
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [displayed, pathname]);

  const indicatorStyle = {
    "--nav-indicator-x": `${indicator.x}px`,
    "--nav-indicator-width": `${indicator.width}px`,
  } as CSSProperties;
  const indicatorReady = displayed ? indicator.ready : false;

  function closeContact() {
    workspace.closeWindow("contact");
    if (window.location.hash === "#contact") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  function openContact(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    workspace.openWindow("contact");
  }

  function openWork(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    workspace.openWindow("work");
    window.dispatchEvent(new Event("portfolio-open-work"));
    if (pathname !== "/") router.push("/");
  }

  function openExperience(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    workspace.openWindow("experience");
    window.dispatchEvent(new Event("portfolio-open-experience"));
    if (pathname !== "/") router.push("/");
  }

  return (
    <>
      <header className="portfolio-header">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <Link className="wordmark" href="/" aria-label="Muhammad A. Fattah home">
          <span>Muhammad A. Fattah</span>
        </Link>

        <nav className="primary-nav" aria-label="Primary navigation" ref={navRef} onMouseLeave={() => setPreview(null)} style={indicatorStyle}>
          <Link data-nav-key="work" ref={(node) => { itemRefs.current.work = node; }} className="nav-item" href="/" aria-current={active === "work" ? "page" : undefined} onClick={openWork} onMouseEnter={() => setPreview("work")} onFocus={() => setPreview("work")} onBlur={() => setPreview(null)}>Work</Link>
          <Link data-nav-key="experience" ref={(node) => { itemRefs.current.experience = node; }} className="nav-item" href="/brief" aria-current={active === "experience" ? "page" : undefined} onClick={openExperience} onMouseEnter={() => setPreview("experience")} onFocus={() => setPreview("experience")} onBlur={() => setPreview(null)}>Experience</Link>
          <Link data-nav-key="contact" ref={(node) => { itemRefs.current.contact = node; }} className="nav-item" href="#contact" aria-current={active === "contact" ? "page" : undefined} onClick={openContact} onMouseEnter={() => setPreview("contact")} onFocus={() => setPreview("contact")} onBlur={() => setPreview(null)}>Contact</Link>
          <span className={`nav-trace ${indicatorReady ? "is-ready" : ""}`} aria-hidden="true"><i /></span>
        </nav>

        <div className="header-folio" aria-label={caseNumber ? `Case ${caseNumber} of 3` : "Portfolio 2026"}>
          {caseNumber ? `${caseNumber} / 03` : "2026"}
        </div>
      </header>
      <ContactWindow open={contactOpen} onClose={closeContact} />
    </>
  );
}
