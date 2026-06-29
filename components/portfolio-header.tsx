"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type NavKey = "work" | "experience" | "contact";

export function PortfolioHeader({ caseNumber }: { caseNumber?: string }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<NavKey, HTMLAnchorElement | null>>({ work: null, experience: null, contact: null });
  const [hash, setHash] = useState("");
  const [preview, setPreview] = useState<NavKey | null>(null);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, ready: false });
  const active: NavKey = pathname.startsWith("/case/") || pathname === "/"
    ? "work"
    : pathname === "/brief" && hash === "#contact"
      ? "contact"
      : "experience";
  const displayed = preview ?? active;

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useLayoutEffect(() => {
    const nav = navRef.current;
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

  return (
    <header className="portfolio-header">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Link className="wordmark" href="/" aria-label="Muhammad A. Fattah home">
        <span>Muhammad A. Fattah</span>
      </Link>

      <nav className="primary-nav" aria-label="Primary navigation" ref={navRef} onMouseLeave={() => setPreview(null)} style={indicatorStyle}>
        <Link data-nav-key="work" ref={(node) => { itemRefs.current.work = node; }} className="nav-item" href="/#selected-work" aria-current={active === "work" ? "page" : undefined} onMouseEnter={() => setPreview("work")} onFocus={() => setPreview("work")} onBlur={() => setPreview(null)}>Work</Link>
        <Link data-nav-key="experience" ref={(node) => { itemRefs.current.experience = node; }} className="nav-item" href="/brief" aria-current={active === "experience" ? "page" : undefined} onMouseEnter={() => setPreview("experience")} onFocus={() => setPreview("experience")} onBlur={() => setPreview(null)}>Experience</Link>
        <Link data-nav-key="contact" ref={(node) => { itemRefs.current.contact = node; }} className="nav-item" href="/brief#contact" aria-current={active === "contact" ? "page" : undefined} onClick={() => setHash("#contact")} onMouseEnter={() => setPreview("contact")} onFocus={() => setPreview("contact")} onBlur={() => setPreview(null)}>Contact</Link>
        <span className={`nav-trace ${indicator.ready ? "is-ready" : ""}`} aria-hidden="true"><i /></span>
      </nav>

      <div className="header-folio" aria-label={caseNumber ? `Case ${caseNumber} of 3` : "Portfolio 2026"}>
        {caseNumber ? `${caseNumber} / 03` : "2026"}
      </div>
    </header>
  );
}
