"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ArrowIcon } from "@/components/icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { experience } from "@/lib/content";
import { scenarios, type ScenarioSlug } from "@/lib/scenarios";
import { useWindowFrame, windowResizeEdges } from "@/components/use-window-frame";

type SplashStage = "showing" | "leaving" | "done";
type WorkspaceWindow = "work" | "experience" | "case";

const caseDetails: Record<ScenarioSlug, { area: string; technology: string; result: ReactNode }> = {
  payflow: {
    area: "Payment reliability",
    technology: "Spring Boot · PostgreSQL",
    result: <><b>2</b> deliveries <span>/</span> <b>1</b> payment change</>,
  },
  iyup: {
    area: "Service observability",
    technology: "Prometheus · Grafana",
    result: <>Latency warned <b>before</b> health failed</>,
  },
  trustgate: {
    area: "Android device trust",
    technology: "Kotlin · Jetpack Compose",
    result: <>Suspicion became <b>confirmation</b>, not an automatic block</>,
  },
};

function Splash({ stage, onSkip }: { stage: SplashStage; onSkip: () => void }) {
  if (stage === "done") return null;
  return (
    <section className="portfolio-splash" data-stage={stage} aria-label="Portfolio introduction">
      <button className="splash-skip" onClick={onSkip} type="button">Skip introduction</button>
      <div className="splash-inner">
        <div className="splash-name-stage">
          <span className="splash-name splash-ghost ghost-one" aria-hidden="true" />
          <span className="splash-name splash-ghost ghost-two" aria-hidden="true" />
          <p className="splash-name splash-master"><span>Muhammad</span><span>A. Fattah</span></p>
          {stage === "showing" ? <i className="splash-locator" aria-hidden="true" /> : null}
        </div>
        <div className="splash-role">
          <i className="splash-role-locator" aria-hidden="true" />
          <small className="splash-context">Portfolio route</small>
          <p>Software Engineer</p>
          <span>Android POS · Merchant Payments</span>
          <div className="splash-sequence" aria-hidden="true">
            <b>Failure</b>
            <b>Decision</b>
            <b>Evidence</b>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkRow({
  index,
  onOpenCase,
  scenario,
}: {
  index: number;
  onOpenCase: (slug: ScenarioSlug) => void;
  scenario: (typeof scenarios)[number];
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.22 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const detail = caseDetails[scenario.slug];
  return (
    <Link
      ref={ref}
      href={`/case/${scenario.slug}`}
      className={`editorial-work-row ${visible ? "is-visible" : ""}`}
      onClick={(event) => {
        event.preventDefault();
        onOpenCase(scenario.slug);
      }}
      style={{ "--row-delay": `${index * 70}ms` } as CSSProperties}
    >
      <span className="work-index" style={{ viewTransitionName: `case-number-${scenario.slug}` } as CSSProperties}>
        <i aria-hidden="true" />
        <span className="work-number">{scenario.number}</span>
      </span>
      <span className="work-main">
        <span className="work-area">{detail.area}</span>
        <strong style={{ viewTransitionName: `case-title-${scenario.slug}` } as CSSProperties}>{scenario.shortTitle}</strong>
        <span className="work-summary">{scenario.consequence}</span>
      </span>
      <span className="work-side">
        <span>{detail.technology}</span>
        <span className="work-result">{detail.result}</span>
        <span className={`work-preview preview-${scenario.slug}`} aria-hidden="true">
          {scenario.slug === "payflow" ? <><i /><i /><b /></> : null}
          {scenario.slug === "iyup" ? <><i /><i /><b /></> : null}
          {scenario.slug === "trustgate" ? <><i /><b>ALLOW</b><b>CONFIRM</b></> : null}
        </span>
      </span>
      <span className="work-arrow" aria-hidden="true"><ArrowIcon /></span>
    </Link>
  );
}

const desktopItems = [
  {
    className: "surface-work",
    href: "/",
    label: "Work",
    detail: "Front page",
    type: "folder",
  },
  {
    className: "surface-selected",
    href: "/#selected-work",
    label: "Selected work",
    detail: "Failure → decision",
    type: "folder",
  },
  {
    className: "surface-experience",
    href: "/brief",
    label: "Experience",
    detail: "Brief + CV",
    type: "folder",
  },
  {
    className: "surface-contact",
    href: "#contact",
    label: "Contact",
    detail: "Email / profile",
    type: "folder",
  },
  {
    className: "surface-shot-payflow",
    href: "/case/payflow",
    label: "Callback evidence",
    detail: "Audit trail",
    type: "image",
    src: "/projects/payflow/audit-trail.png",
  },
  {
    className: "surface-shot-iyup",
    href: "/case/iyup",
    label: "Latency evidence",
    detail: "Dashboard",
    type: "image",
    src: "/projects/iyup/grafana-dashboard.png",
  },
  {
    className: "surface-shot-trustgate",
    href: "/case/trustgate",
    label: "Device evidence",
    detail: "Security log",
    type: "image",
    src: "/projects/trustgate/security-event-log.png",
  },
] as const;

function DesktopSurface({
  onOpenCase,
  onOpenWindow,
}: {
  onOpenCase: (slug: ScenarioSlug) => void;
  onOpenWindow: (windowName: WorkspaceWindow, target?: "selected-work") => void;
}) {
  function openContact(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.dispatchEvent(new Event("portfolio-contact-open"));
  }

  function openDesktopWindow(windowName: WorkspaceWindow, target?: "selected-work") {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      onOpenWindow(windowName, target);
    };
  }

  return (
    <section className="desktop-surface" aria-labelledby="desktop-surface-title">
      <div className="desktop-surface-head">
        <h2 id="desktop-surface-title">Open the part you need.</h2>
        <p>Folders hold the main routes. Evidence cards preview what each selected work proves.</p>
      </div>
      <div className="desktop-board" aria-label="Portfolio desktop shortcuts">
        {desktopItems.map((item) => (
          <Link
            className={`desktop-object ${item.type === "folder" ? "desktop-folder" : "desktop-evidence"} ${item.className}`}
            href={item.href}
            key={item.label}
            onClick={
              item.label === "Contact"
                ? openContact
                : item.label === "Work"
                  ? openDesktopWindow("work")
                  : item.label === "Selected work"
                    ? openDesktopWindow("work", "selected-work")
                    : item.label === "Experience"
                      ? openDesktopWindow("experience")
                      : item.type === "image"
                        ? (event) => {
                          event.preventDefault();
                          onOpenCase(item.href.replace("/case/", "") as ScenarioSlug);
                        }
                      : undefined
            }
          >
            {item.type === "folder" ? (
              <span className="folder-glyph" aria-hidden="true">
                <i />
                <b />
              </span>
            ) : (
              <span className="evidence-polaroid" aria-hidden="true">
                <Image src={item.src} alt="" fill sizes="(max-width: 760px) 88vw, 260px" />
              </span>
            )}
            <span className="desktop-object-copy">
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SelectedCaseWindowContent({ scenario }: { scenario: (typeof scenarios)[number] }) {
  const detail = caseDetails[scenario.slug];
  return (
    <div className="selected-case-window-content">
      <section className="selected-case-window-hero">
        <p className="micro-label">Selected work / {scenario.number}</p>
        <h2>{scenario.shortTitle}</h2>
        <p>{scenario.consequence}</p>
      </section>
      <section className="selected-case-window-proof">
        <div>
          <span>{detail.area}</span>
          <strong>{detail.technology}</strong>
          <p>{scenario.decision}</p>
        </div>
        <div className="selected-case-window-image">
          <Image src={scenario.evidence[0].src} alt="" fill sizes="(max-width: 760px) 80vw, 520px" unoptimized />
        </div>
      </section>
      <div className="selected-case-window-actions">
        <Link className="primary-action" href={`/case/${scenario.slug}`}>Open full case <ArrowIcon /></Link>
        <a className="inline-link" href={scenario.repo} target="_blank" rel="noopener noreferrer">Source code <ArrowIcon /></a>
      </div>
    </div>
  );
}

const cvHref = "/cv/muhammad-abdul-fattah-general-software-engineer-cv.pdf";

function ExperienceWindowContent({ onOpenContact }: { onOpenContact: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <div className="experience-window-content">
      <section className="experience-window-hero">
        <p className="micro-label">Experience</p>
        <h2>Software engineering brief.</h2>
        <p>
          Payment systems, Android POS clients, and operational surfaces where retries,
          state, security signals, and evidence need to stay readable.
        </p>
        <div className="experience-window-actions">
          <a className="brief-action brief-download-action" href={cvHref} download>Download CV <ArrowIcon /></a>
          <a className="brief-action" href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a className="brief-action" href="#contact" onClick={onOpenContact}>Contact</a>
        </div>
      </section>
      <section className="experience-window-list" aria-label="Experience summary">
        {experience.map((item) => (
          <article key={item.company}>
            <p>{item.period}</p>
            <h3>{item.role}</h3>
            <span>{item.company}</span>
            <p>{item.scope}</p>
          </article>
        ))}
      </section>
      <Link className="inline-link experience-window-full" href="/brief">
        Open full brief <ArrowIcon />
      </Link>
    </div>
  );
}

export function CounterfactualHome({ initialDesktop = false }: { initialDesktop?: boolean }) {
  const [splashStage, setSplashStage] = useState<SplashStage>(initialDesktop ? "done" : "showing");
  const [openWindows, setOpenWindows] = useState<WorkspaceWindow[]>(initialDesktop ? [] : ["work"]);
  const [focusOrder, setFocusOrder] = useState<WorkspaceWindow[]>(initialDesktop ? [] : ["work"]);
  const [selectedCaseSlug, setSelectedCaseSlug] = useState<ScenarioSlug>("payflow");
  const splashTimers = useRef<number[]>([]);
  const heroRef = useRef<HTMLElement>(null);
  const workContentRef = useRef<HTMLDivElement>(null);
  const pendingWorkScroll = useRef<"selected-work" | null>(null);
  const mountedRef = useRef(false);
  const workFrame = useWindowFrame({ defaultHeight: 820, defaultWidth: 1360, minHeight: 420, minWidth: 680 });
  const experienceFrame = useWindowFrame({ defaultHeight: 820, defaultWidth: 1360, minHeight: 420, minWidth: 680 });
  const caseFrame = useWindowFrame({ defaultHeight: 820, defaultWidth: 1360, minHeight: 460, minWidth: 700 });
  const isWorkOpen = openWindows.includes("work");
  const isExperienceOpen = openWindows.includes("experience");
  const isCaseOpen = openWindows.includes("case");
  const selectedCase = scenarios.find((scenario) => scenario.slug === selectedCaseSlug) ?? scenarios[0];
  const hasOpenWindows = openWindows.length > 0;
  const activeWindow = focusOrder.filter((item) => openWindows.includes(item)).at(-1);
  const clearWindows = new Set(focusOrder.filter((item) => openWindows.includes(item)).slice(-2));

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    splashTimers.current.forEach(window.clearTimeout);
    setOpenWindows(initialDesktop ? [] : ["work"]);
    setFocusOrder(initialDesktop ? [] : ["work"]);
    setSplashStage("done");
  }, [initialDesktop]);

  useEffect(() => {
    if (!isWorkOpen) {
      setSplashStage("done");
      return;
    }
    const timers = splashTimers.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compact = window.matchMedia("(max-width: 760px)").matches;
    if (reduced) {
      timers.push(window.setTimeout(() => setSplashStage("done"), 0));
      return () => timers.forEach(window.clearTimeout);
    }
    timers.push(
      window.setTimeout(() => setSplashStage("leaving"), compact ? 1450 : 1650),
      window.setTimeout(() => {
        setSplashStage("done");
      }, compact ? 1900 : 2150),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [isWorkOpen]);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".portfolio-header");
    if (header) header.dataset.introStage = splashStage;
    return () => {
      if (header) delete header.dataset.introStage;
    };
  }, [splashStage]);

  useEffect(() => {
    if (splashStage === "done") return;
    const previous = document.body.style.overflow;
    const isolated = Array.from(document.querySelectorAll<HTMLElement>(".portfolio-header, .editorial-home"));
    document.body.style.overflow = "hidden";
    isolated.forEach((element) => element.setAttribute("inert", ""));
    const skipWithKey = (event: KeyboardEvent) => {
      if (!["Escape", "Enter", " "].includes(event.key)) return;
      splashTimers.current.forEach(window.clearTimeout);
      setSplashStage("leaving");
      splashTimers.current.push(window.setTimeout(() => setSplashStage("done"), 360));
    };
    window.addEventListener("keydown", skipWithKey);
    return () => {
      document.body.style.overflow = previous;
      isolated.forEach((element) => element.removeAttribute("inert"));
      window.removeEventListener("keydown", skipWithKey);
    };
  }, [splashStage]);

  useEffect(() => {
    if (!isWorkOpen) return;
    const hero = heroRef.current;
    const header = document.querySelector<HTMLElement>(".portfolio-header");
    if (!hero || !header || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      header.dataset.heroPast = String(!entry.isIntersecting);
    }, { threshold: 0.08 });
    observer.observe(hero);
    return () => {
      observer.disconnect();
      delete header.dataset.heroPast;
    };
  }, [isWorkOpen]);

  useEffect(() => {
    if (!isWorkOpen || pendingWorkScroll.current !== "selected-work") return;
    pendingWorkScroll.current = null;
    window.requestAnimationFrame(() => {
      const target = workContentRef.current?.querySelector<HTMLElement>("#selected-work");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isWorkOpen, openWindows]);

  function focusWindow(windowName: WorkspaceWindow) {
    setFocusOrder((current) => [...current.filter((item) => item !== windowName), windowName]);
  }

  function openWindow(windowName: WorkspaceWindow, target?: "selected-work") {
    splashTimers.current.forEach(window.clearTimeout);
    setSplashStage("done");
    if (windowName === "work" && target) pendingWorkScroll.current = target;
    if (!openWindows.includes(windowName)) {
      if (windowName === "work") workFrame.resetFrame();
      if (windowName === "experience") experienceFrame.resetFrame();
      if (windowName === "case") caseFrame.resetFrame();
    }
    if (windowName === "experience" && openWindows.includes("work")) {
      workFrame.snapTo("left");
      experienceFrame.snapTo("right");
    }
    if (windowName === "case" && openWindows.includes("work")) {
      workFrame.snapTo("left");
      caseFrame.snapTo("right");
    }
    if (windowName === "work" && openWindows.includes("experience")) {
      workFrame.snapTo("left");
      experienceFrame.snapTo("right");
    }
    setOpenWindows((current) => (current.includes(windowName) ? current : [...current, windowName]));
    focusWindow(windowName);
    if (window.location.pathname === "/" && window.location.search) {
      window.history.pushState(null, "", "/");
    }
    window.dispatchEvent(new Event("portfolio-window-state"));
  }

  function closeWindow(windowName: WorkspaceWindow) {
    setOpenWindows((current) => {
      const next = current.filter((item) => item !== windowName);
      if (next.length === 0) {
        window.history.pushState(null, "", "/?desktop=1");
      }
      return next;
    });
    setFocusOrder((current) => current.filter((item) => item !== windowName));
    window.dispatchEvent(new Event("portfolio-window-state"));
  }

  function openCaseWindow(slug: ScenarioSlug) {
    setSelectedCaseSlug(slug);
    openWindow("case");
  }

  useEffect(() => {
    const openWorkFromHeader = () => openWindow("work");
    const openExperienceFromHeader = () => openWindow("experience");
    window.addEventListener("portfolio-open-work", openWorkFromHeader);
    window.addEventListener("portfolio-open-experience", openExperienceFromHeader);
    return () => {
      window.removeEventListener("portfolio-open-work", openWorkFromHeader);
      window.removeEventListener("portfolio-open-experience", openExperienceFromHeader);
    };
  });

  function skipSplash() {
    splashTimers.current.forEach(window.clearTimeout);
    setSplashStage("leaving");
    splashTimers.current.push(window.setTimeout(() => setSplashStage("done"), 360));
  }

  function openContactWindow(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.dispatchEvent(new Event("portfolio-contact-open"));
  }

  function windowState(windowName: WorkspaceWindow) {
    if (activeWindow === windowName) return "active";
    if (clearWindows.has(windowName)) return "clear";
    return "blurred";
  }

  function frameStyle(frameStyle: CSSProperties, windowName: WorkspaceWindow) {
    const state = windowState(windowName);
    return {
      ...frameStyle,
      "--window-z": activeWindow === windowName ? 42 : state === "clear" ? 34 : 24,
    } as CSSProperties;
  }

  return (
    <>
      <Splash stage={splashStage} onSkip={skipSplash} />
      <main className={`home-page editorial-home ${hasOpenWindows ? "has-work-window" : "is-desktop"}`} data-intro={splashStage} id="main-content">
        {!hasOpenWindows ? (
          <DesktopSurface onOpenCase={openCaseWindow} onOpenWindow={openWindow} />
        ) : (
          <>
          {isWorkOpen ? <section
            className="portfolio-window home-window"
            aria-label="Work window"
            data-active-window={activeWindow === "work"}
            data-dragging={workFrame.dragging}
            data-resizing={workFrame.resizing}
            data-snap={workFrame.snap ?? undefined}
            data-window-state={windowState("work")}
            onPointerDown={() => focusWindow("work")}
            ref={workFrame.frameRef}
            style={frameStyle(workFrame.style, "work")}
          >
            <div className="portfolio-window-chrome" {...workFrame.titlebarProps}>
              <button className="window-close-action work-window-close" onClick={() => closeWindow("work")} type="button" aria-label="Close work window">
                <span aria-hidden="true">×</span>
              </button>
              <div className="window-location">
                <p className="micro-label">Work</p>
              </div>
            </div>
            {windowResizeEdges.map((edge) => <span key={edge} {...workFrame.resizeHandleProps(edge)} />)}
            <div className="portfolio-window-content" ref={workContentRef}>
              <section className="editorial-hero" ref={heroRef} aria-labelledby="home-title">
                <div className="hero-identity">
                  <p className="hero-kicker">Software Engineer · Indonesia</p>
                  <h1 id="home-title"><span>Muhammad</span><span>A. Fattah</span></h1>
                </div>
                <div className="hero-summary">
                  <p className="hero-role">I work on Android POS and merchant payment systems.</p>
                  <p className="hero-description">
                    I build for the conditions outside the happy path: repeated requests,
                    slowing services, and device signals that disagree.
                  </p>
                  <p className="hero-purpose">
                    This portfolio explains three engineering decisions, the results they produced,
                    and the public evidence behind them.
                  </p>
                  <div className="hero-actions">
                    <a className="primary-action" href="#selected-work" onClick={(event) => {
                      event.preventDefault();
                      openWindow("work", "selected-work");
                    }}>View selected work <ArrowIcon /></a>
                    <div className="hero-secondary-actions">
                      <a href="/brief" onClick={(event) => {
                        event.preventDefault();
                        openWindow("experience");
                      }}>Experience</a>
                      <a href="https://github.com/fattah247" target="_blank" rel="noopener noreferrer">GitHub</a>
                      <CopyEmailButton email="fattahmuhammad17@gmail.com" label="Copy email" className="hero-email-action" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="editorial-work" id="selected-work" aria-labelledby="work-title">
                <div className="work-intro">
                  <p>Selected work</p>
                  <h2 id="work-title">Three failures.<br />Three decisions.</h2>
                  <p>Start with the consequence. Open a case for the reasoning, behavior, code, and limitation.</p>
                </div>
                <div className="editorial-work-list">
                  {scenarios.map((scenario, index) => <WorkRow scenario={scenario} index={index} key={scenario.slug} onOpenCase={openCaseWindow} />)}
                </div>
              </section>

              <section className="editorial-footer">
                <p>Currently building Android POS and merchant payment systems at Bank Central Asia.</p>
                <a href="/brief" onClick={(event) => {
                  event.preventDefault();
                  openWindow("experience");
                }}>Read experience and contact <ArrowIcon /></a>
              </section>
            </div>
          </section> : null}
          {isExperienceOpen ? <section
            className="portfolio-window home-window workspace-experience-window"
            aria-label="Experience window"
            data-active-window={activeWindow === "experience"}
            data-dragging={experienceFrame.dragging}
            data-resizing={experienceFrame.resizing}
            data-snap={experienceFrame.snap ?? undefined}
            data-window-state={windowState("experience")}
            onPointerDown={() => focusWindow("experience")}
            ref={experienceFrame.frameRef}
            style={frameStyle(experienceFrame.style, "experience")}
          >
            <div className="portfolio-window-chrome" {...experienceFrame.titlebarProps}>
              <button className="window-close-action work-window-close" onClick={() => closeWindow("experience")} type="button" aria-label="Close experience window">
                <span aria-hidden="true">×</span>
              </button>
              <div className="window-location">
                <p className="micro-label">Experience</p>
              </div>
            </div>
            {windowResizeEdges.map((edge) => <span key={edge} {...experienceFrame.resizeHandleProps(edge)} />)}
            <ExperienceWindowContent onOpenContact={openContactWindow} />
          </section> : null}
          {isCaseOpen ? <section
            className="portfolio-window home-window workspace-case-window"
            aria-label="Selected work window"
            data-active-window={activeWindow === "case"}
            data-dragging={caseFrame.dragging}
            data-resizing={caseFrame.resizing}
            data-snap={caseFrame.snap ?? undefined}
            data-window-state={windowState("case")}
            onPointerDown={() => focusWindow("case")}
            ref={caseFrame.frameRef}
            style={frameStyle(caseFrame.style, "case")}
          >
            <div className="portfolio-window-chrome" {...caseFrame.titlebarProps}>
              <button className="window-close-action work-window-close" onClick={() => closeWindow("case")} type="button" aria-label="Close selected work window">
                <span aria-hidden="true">×</span>
              </button>
              <div className="window-location">
                <p className="micro-label">Selected work</p>
              </div>
            </div>
            {windowResizeEdges.map((edge) => <span key={edge} {...caseFrame.resizeHandleProps(edge)} />)}
            <SelectedCaseWindowContent scenario={selectedCase} />
          </section> : null}
          </>
        )}
      </main>
    </>
  );
}
