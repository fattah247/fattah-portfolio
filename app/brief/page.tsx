"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { ArrowIcon } from "@/components/icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { PortfolioHeader } from "@/components/portfolio-header";
import { useWindowFrame, windowResizeEdges } from "@/components/use-window-frame";
import { WindowChrome } from "@/components/window-chrome";
import { useWorkspaceManager } from "@/components/workspace-manager";
import { experience, principles, systemScope } from "@/lib/content";
import { scenarios } from "@/lib/scenarios";

type BriefView = "recruiter" | "engineering" | "full";

const cvHref = "/cv/muhammad-abdul-fattah-general-software-engineer-cv.pdf";

const viewCopy: Record<BriefView, { label: string; note: string }> = {
  recruiter: {
    label: "Recruiter",
    note: "Emphasizes current role, scope, contact, and the downloadable one-page CV.",
  },
  engineering: {
    label: "Engineering",
    note: "Emphasizes selected work, system boundaries, public evidence, and technical tradeoffs.",
  },
  full: {
    label: "Full",
    note: "Keeps every section at equal weight for a complete read-through.",
  },
};

export default function BriefPage() {
  const router = useRouter();
  const workspace = useWorkspaceManager();
  const openExperienceWindow = workspace.openWindow;
  const [view, setView] = useState<BriefView>("recruiter");
  const [openExperience, setOpenExperience] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
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
  } = useWindowFrame({ defaultHeight: 820, defaultWidth: 1360, minHeight: 420, minWidth: 680 });

  useEffect(() => {
    openExperienceWindow("experience");
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, [openExperienceWindow]);

  useEffect(() => {
    if (workspace.mode === "computer") return;
    return workspace.registerBackHandler("experience-brief", () => {
      requestClose();
      return true;
    });
  });

  function requestClose() {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      workspace.closeApp("experience");
      router.push("/");
    }, 320);
  }

  function openContactWindow(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.dispatchEvent(new Event("portfolio-contact-open"));
  }

  return (
    <>
      <PortfolioHeader />
      <main
        className="brief-page experience-window"
        data-active-window={workspace.activeWindow === "experience"}
        data-app-id="experience"
        data-closing={isClosing}
        data-dragging={dragging}
        data-resizing={resizing}
        data-snap={snap ?? undefined}
        data-window-state={workspace.stateFor("experience")}
        data-view={view}
        id="main-content"
        onPointerDown={() => workspace.focusWindow("experience")}
        ref={frameRef}
        style={{ ...style, "--window-z": workspace.zIndexFor("experience") } as CSSProperties}
        suppressHydrationWarning
      >
        <WindowChrome
          className="portfolio-window-chrome experience-window-chrome"
          closeLabel="Close experience window"
          closeRef={closeRef}
          label="Experience"
          maximized={maximized}
          onClose={requestClose}
          onMinimize={() => workspace.minimizeApp("experience")}
          onToggleMaximize={toggleMaximize}
          subtitle="Full engineering brief and CV"
          {...titlebarProps}
        />
        {windowResizeEdges.map((edge) => <span key={edge} {...resizeHandleProps(edge)} />)}
        <section className="brief-hero">
          <div>
            <h1>Muhammad<br />A. Fattah</h1>
          </div>
          <div className="brief-summary">
            <p className="brief-role">Software Engineer</p>
            <p>
              Building reliable payment systems and secure mobile clients, with an emphasis on readable state and production evidence.
            </p>
            <div className="brief-view-panel" aria-label="Brief reading mode">
              <div className="brief-view-switch" role="tablist" aria-label="Choose brief reading mode">
                {(Object.keys(viewCopy) as BriefView[]).map((key) => (
                  <button
                    aria-selected={view === key}
                    className="brief-view-option"
                    key={key}
                    onClick={() => setView(key)}
                    role="tab"
                    type="button"
                  >
                    {viewCopy[key].label}
                  </button>
                ))}
              </div>
              <p>{viewCopy[view].note}</p>
            </div>
            <dl className="fact-grid">
              <div><dt>Current</dt><dd>Bank Central Asia</dd></div>
              <div><dt>Focus</dt><dd>Android POS · Payment reliability</dd></div>
              <div><dt>Location</dt><dd>Indonesia · UTC+7</dd></div>
              <div><dt>Contact</dt><dd><a href="#contact" onClick={openContactWindow}>Email</a> · <a href="https://www.linkedin.com/in/muhammad24fattah/" target="_blank" rel="noopener noreferrer">LinkedIn</a></dd></div>
            </dl>
            <div className="brief-actions">
              <a className="brief-action brief-download-action" href={cvHref} download>
                Download CV <ArrowIcon />
              </a>
              <a className="brief-action" href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer">GitHub <span className="sr-only">opens in a new tab</span></a>
              <a className="brief-action" href="#contact" onClick={openContactWindow}>Contact</a>
            </div>
          </div>
        </section>

        <section className="brief-section brief-experience-section" data-brief-section="experience">
          <div className="section-label"><span>01</span><p>Experience</p></div>
          <div className="experience-list">
            {experience.map((item, index) => {
              const isOpen = openExperience === index;
              const panelId = `experience-panel-${index}`;
              return (
              <article className={`experience-entry ${isOpen ? "is-open" : ""}`} key={item.company}>
                <div className="experience-scale">
                  <span>{item.stage}</span>
                </div>
                <div className="experience-main">
                  <p className="experience-period">{item.period}</p>
                  <h2>
                    <button
                      aria-controls={panelId}
                      aria-expanded={isOpen}
                      className="experience-toggle"
                      onClick={() => setOpenExperience(isOpen ? -1 : index)}
                      type="button"
                    >
                      <span>{item.role}</span>
                      <small>{isOpen ? "Collapse details" : "Open details"}</small>
                      <i aria-hidden="true" />
                    </button>
                  </h2>
                  <p className="experience-company">{item.company} · Indonesia</p>
                  <p className="experience-scope">{item.scope}</p>
                  <div className="experience-detail-panel" id={panelId} aria-hidden={!isOpen}>
                    <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </section>

        <section className="brief-section brief-work-section" data-brief-section="work">
          <div className="section-label"><span>02</span><p>Selected work</p></div>
          <div className="brief-case-list">
            {scenarios.map((scenario) => (
              <Link className="brief-case" href={`/case/${scenario.slug}`} key={scenario.slug}>
                <span>{scenario.number}</span>
                <div><h2>{scenario.shortTitle}</h2><p>{scenario.consequence}</p></div>
                <ArrowIcon />
              </Link>
            ))}
          </div>
        </section>

        <section className="brief-section brief-scope-section" data-brief-section="scope">
          <div className="section-label"><span>03</span><p>System scope</p></div>
          <div className="scope-map">
            {systemScope.map((item, index) => (
              <div className="scope-row" key={item.label}>
                <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><p>{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="brief-section principles-section">
          <div className="section-label"><span>04</span><p>Operating principles</p></div>
          <ol className="principles-list">
            {principles.map((principle, index) => <li key={principle}><span>{String(index + 1).padStart(2, "0")}</span>{principle}</li>)}
          </ol>
        </section>

        <section className="brief-contact" id="contact">
          <p className="micro-label">Contact</p>
          <h2>If the happy path is handled, I’m interested in what happens next.</h2>
          <p className="contact-email">fattahmuhammad17@gmail.com</p>
          <CopyEmailButton email="fattahmuhammad17@gmail.com" label="Copy email address" className="contact-copy-action" />
        </section>
      </main>
    </>
  );
}
