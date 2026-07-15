"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ArrowIcon } from "@/components/icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { DebuggerWorkspace } from "@/components/debugger-workspace";
import { WindowChrome } from "@/components/window-chrome";
import { useWorkspaceManager, type WorkspaceWindowId } from "@/components/workspace-manager";
import { experience } from "@/lib/content";
import { scenarios, type ScenarioSlug } from "@/lib/scenarios";
import { useWindowFrame, windowResizeEdges, type SnapEdge } from "@/components/use-window-frame";

type SplashStage = "showing" | "leaving" | "done";
type WorkspaceWindow = Extract<WorkspaceWindowId, "work" | "experience" | "case">;
const mainWindowIds: WorkspaceWindow[] = ["work", "experience", "case"];
const workRouteSession: {
  detailedCase: ScenarioSlug | null;
  scrollTop: number;
  selectedCase: ScenarioSlug;
} = { detailedCase: null, scrollTop: 0, selectedCase: "payflow" };

function WindowSnapPreview({ edge }: { edge: SnapEdge }) {
  if (!edge) return null;
  return <div className="window-snap-preview" data-edge={edge} aria-hidden="true" />;
}

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
          <small className="splash-context">Portfolio workspace</small>
          <p>Software Engineer</p>
          <span>Android POS · Merchant Payments</span>
          <div className="splash-sequence" aria-hidden="true">
            <b>Failure</b>
            <b>Decision</b>
            <b>Evidence</b>
          </div>
        </div>
        <div className="splash-window-seed" aria-hidden="true">
          <i>×</i>
          <span>Work</span>
          <b />
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
    label: "Payment case",
    detail: "Callback replay",
    type: "image",
    src: "/projects/payflow/audit-trail.png",
  },
  {
    className: "surface-shot-iyup",
    href: "/case/iyup",
    label: "Service case",
    detail: "Latency replay",
    type: "image",
    src: "/projects/iyup/grafana-dashboard.png",
  },
  {
    className: "surface-shot-trustgate",
    href: "/case/trustgate",
    label: "Device case",
    detail: "Signal policy",
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
      <h2 className="sr-only" id="desktop-surface-title">Applications and engineering case files</h2>
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

function SelectedCaseWindowContent({
  onOpenFullCase,
  onSelectCase,
  scenario,
}: {
  onOpenFullCase: (slug: ScenarioSlug) => void;
  onSelectCase: (slug: ScenarioSlug) => void;
  scenario: (typeof scenarios)[number];
}) {
  const detail = caseDetails[scenario.slug];
  const scenarioIndex = scenarios.findIndex((item) => item.slug === scenario.slug);
  const previousScenario = scenarios[(scenarioIndex - 1 + scenarios.length) % scenarios.length];
  const nextScenario = scenarios[(scenarioIndex + 1) % scenarios.length];
  return (
    <div className="selected-case-window-content">
      <section className="selected-case-window-hero">
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
          <Image src={scenario.evidence[0].src} alt={scenario.evidence[0].alt} fill sizes="(max-width: 760px) 80vw, 520px" />
        </div>
      </section>
      <div className="selected-case-window-actions">
        <button className="primary-action" onClick={() => onOpenFullCase(scenario.slug)} type="button">
          Open full case <ArrowIcon />
        </button>
        <a className="inline-link" href={scenario.repo} target="_blank" rel="noopener noreferrer">Source code <ArrowIcon /></a>
      </div>
      <nav className="selected-case-switcher" aria-label="Move between selected work previews">
        <button onClick={() => onSelectCase(previousScenario.slug)} type="button">← Previous</button>
        <span>{scenario.number} / {String(scenarios.length).padStart(2, "0")}</span>
        <button onClick={() => onSelectCase(nextScenario.slug)} type="button">Next →</button>
      </nav>
    </div>
  );
}

const cvHref = "/cv/muhammad-abdul-fattah-general-software-engineer-cv.pdf";

function ExperienceWindowContent({ onOpenContact }: { onOpenContact: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <div className="experience-window-content">
      <section className="experience-window-hero">
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

export function CounterfactualHome() {
  const workspace = useWorkspaceManager();
  const [splashStage, setSplashStage] = useState<SplashStage>("showing");
  const [detailedCaseSlug, setDetailedCaseSlug] = useState<ScenarioSlug | null>(null);
  const [selectedCaseSlug, setSelectedCaseSlug] = useState<ScenarioSlug>("payflow");
  const [closingWindows, setClosingWindows] = useState<WorkspaceWindow[]>([]);
  const closeTimers = useRef<number[]>([]);
  const caseCloseRef = useRef<HTMLButtonElement>(null);
  const experienceCloseRef = useRef<HTMLButtonElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const workContentRef = useRef<HTMLDivElement>(null);
  const workCloseRef = useRef<HTMLButtonElement>(null);
  const pendingWorkScroll = useRef<"selected-work" | null>(null);
  const selectedCaseSessionRef = useRef(selectedCaseSlug);
  const detailedCaseSessionRef = useRef(detailedCaseSlug);
  const {
    dragging: workDragging,
    frameRef: workFrameRef,
    maximized: workMaximized,
    resetFrame: resetWorkFrame,
    resizeHandleProps: workResizeHandleProps,
    resizing: workResizing,
    snap: workSnap,
    snapCandidate: workSnapCandidate,
    snapTo: snapWorkFrame,
    style: workWindowStyle,
    titlebarProps: workTitlebarProps,
    toggleMaximize: toggleWorkMaximize,
  } = useWindowFrame({ defaultHeight: 820, defaultWidth: 1360, minHeight: 420, minWidth: 680 });
  const {
    dragging: experienceDragging,
    frameRef: experienceFrameRef,
    maximized: experienceMaximized,
    resetFrame: resetExperienceFrame,
    resizeHandleProps: experienceResizeHandleProps,
    resizing: experienceResizing,
    snap: experienceSnap,
    snapCandidate: experienceSnapCandidate,
    snapTo: snapExperienceFrame,
    style: experienceWindowStyle,
    titlebarProps: experienceTitlebarProps,
    toggleMaximize: toggleExperienceMaximize,
  } = useWindowFrame({ defaultHeight: 820, defaultWidth: 1360, minHeight: 420, minWidth: 680 });
  const {
    dragging: caseDragging,
    frameRef: caseFrameRef,
    maximized: caseMaximized,
    resetFrame: resetCaseFrame,
    resizeHandleProps: caseResizeHandleProps,
    resizing: caseResizing,
    snap: caseSnap,
    snapCandidate: caseSnapCandidate,
    snapTo: snapCaseFrame,
    style: caseWindowStyle,
    titlebarProps: caseTitlebarProps,
    toggleMaximize: toggleCaseMaximize,
  } = useWindowFrame({ defaultHeight: 820, defaultWidth: 1360, minHeight: 460, minWidth: 700 });
  const openWindows = workspace.openWindows.filter((item): item is WorkspaceWindow => mainWindowIds.includes(item as WorkspaceWindow));
  const isWorkOpen = workspace.isOpen("work");
  const isExperienceOpen = workspace.isOpen("experience");
  const isCaseOpen = workspace.isOpen("case");
  const detailedCase = scenarios.find((scenario) => scenario.slug === detailedCaseSlug) ?? null;
  const selectedCase = scenarios.find((scenario) => scenario.slug === selectedCaseSlug) ?? scenarios[0];
  const hasOpenWindows = openWindows.length > 0;
  const activeWindow = workspace.activeWindow;
  const activeSnapCandidate = activeWindow === "work" ? workSnapCandidate : activeWindow === "experience" ? experienceSnapCandidate : activeWindow === "case" ? caseSnapCandidate : null;

  selectedCaseSessionRef.current = selectedCaseSlug;
  detailedCaseSessionRef.current = detailedCaseSlug;

  useEffect(() => {
    const workFrame = workFrameRef.current;
    setSelectedCaseSlug(workRouteSession.selectedCase);
    setDetailedCaseSlug(workRouteSession.detailedCase);
    const restoreFrame = window.requestAnimationFrame(() => {
      if (workRouteSession.scrollTop > 0) workFrame?.scrollTo({ behavior: "auto", top: workRouteSession.scrollTop });
    });
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      workRouteSession.selectedCase = selectedCaseSessionRef.current;
      workRouteSession.detailedCase = detailedCaseSessionRef.current;
      workRouteSession.scrollTop = workFrame?.scrollTop ?? 0;
    };
  }, [workFrameRef]);

  useEffect(() => {
    if (workspace.mode !== "computer") setSplashStage("done");
  }, [workspace.mode]);

  useEffect(() => {
    if (window.location.hash !== "#selected-work") return;
    pendingWorkScroll.current = "selected-work";
    workspace.openWindow("work");
    setSplashStage("done");
    window.requestAnimationFrame(() => scrollWorkToSelected("auto"));
  // Consume the deep-link once when the Work window mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isWorkOpen) {
      setSplashStage("done");
      return;
    }
    if (splashStage === "done") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const compact = window.matchMedia("(max-width: 760px)").matches;
    if (reduced) {
      setSplashStage("done");
      return;
    }
    const timer = window.setTimeout(
      () => setSplashStage((current) => current === "showing" ? "leaving" : "done"),
      splashStage === "showing" ? (compact ? 1450 : 1650) : (compact ? 360 : 500),
    );
    return () => window.clearTimeout(timer);
  }, [isWorkOpen, splashStage]);

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
      setSplashStage("leaving");
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
    window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior()));
  // Reads the current frame refs and pending scroll flag; rerunning for every render is unnecessary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkOpen, openWindows]);

  useEffect(() => {
    if (!isCaseOpen) return;
    window.requestAnimationFrame(() => {
      caseFrameRef.current?.scrollTo({ behavior: preferredScrollBehavior(), top: 0 });
    });
  }, [isCaseOpen, selectedCaseSlug, caseFrameRef]);

  function focusWindow(windowName: WorkspaceWindow) {
    workspace.focusWindow(windowName);
  }

  function frameFor(windowName: WorkspaceWindow) {
    if (windowName === "work") return workFrameRef.current;
    if (windowName === "experience") return experienceFrameRef.current;
    return caseFrameRef.current;
  }

  function focusWindowControl(windowName: WorkspaceWindow) {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => frameFor(windowName)?.focus({ preventScroll: true })));
  }

  function preferredScrollBehavior(): ScrollBehavior {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function resetFrameFor(windowName: WorkspaceWindow) {
    if (windowName === "work") resetWorkFrame();
    if (windowName === "experience") resetExperienceFrame();
    if (windowName === "case") resetCaseFrame();
  }

  function snapFrameFor(windowName: WorkspaceWindow, edge: "left" | "right" | "top" | "bottom") {
    if (windowName === "work") snapWorkFrame(edge);
    if (windowName === "experience") snapExperienceFrame(edge);
    if (windowName === "case") snapCaseFrame(edge);
  }

  function scrollWorkToSelected(behavior: ScrollBehavior = "smooth") {
    const container = workFrameRef.current;
    const target = workContentRef.current?.querySelector<HTMLElement>("#selected-work");
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const chromeHeight = container.querySelector<HTMLElement>(".portfolio-window-chrome")?.getBoundingClientRect().height ?? 0;
    const top = container.scrollTop + targetRect.top - containerRect.top - chromeHeight - 20;
    container.scrollTo({ behavior, top: Math.max(0, top) });
  }

  function openWindow(windowName: WorkspaceWindow, target?: "selected-work") {
    setSplashStage("done");
    const alreadyOpen = openWindows.includes(windowName);

    if (workspace.mode !== "computer") {
      if (windowName === "work" && target) {
        pendingWorkScroll.current = target;
      }
      workspace.openWindow(windowName);
      if (windowName === "work" && target && openWindows.includes("work")) {
        window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior()));
      }
      if (windowName === "case") {
        window.requestAnimationFrame(() => window.scrollTo({ behavior: preferredScrollBehavior(), top: 0 }));
      }
      if (window.location.pathname === "/" && window.location.search) {
        window.history.pushState(null, "", "/");
      }
      window.dispatchEvent(new Event("portfolio-window-state"));
      window.dispatchEvent(new Event("portfolio-window-open"));
      focusWindowControl(windowName);
      return;
    }

    if (windowName === "work" && target) {
      if (openWindows.includes("work")) {
        window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior()));
      } else {
        pendingWorkScroll.current = target;
      }
    }
    if (alreadyOpen) {
      focusWindow(windowName);
      if (window.location.pathname === "/" && window.location.search) {
        window.history.pushState(null, "", "/");
      }
      window.dispatchEvent(new Event("portfolio-window-state"));
      window.dispatchEvent(new Event("portfolio-window-open"));
      focusWindowControl(windowName);
      return;
    }

    if (!alreadyOpen) {
      if (windowName === "work") resetWorkFrame();
      if (windowName === "experience") resetExperienceFrame();
      if (windowName === "case") resetCaseFrame();
    }
    const partner = mainWindowIds.includes(activeWindow as WorkspaceWindow)
      ? activeWindow as WorkspaceWindow
      : openWindows.at(-1);
    if (partner && partner !== windowName) {
      const portrait = window.innerWidth <= 1100 && window.innerHeight > window.innerWidth;
      snapFrameFor(partner, portrait ? "top" : "left");
      snapFrameFor(windowName, portrait ? "bottom" : "right");
    }
    workspace.openWindow(windowName);
    if (window.location.pathname === "/" && window.location.search) {
      window.history.pushState(null, "", "/");
    }
    window.dispatchEvent(new Event("portfolio-window-state"));
    window.dispatchEvent(new Event("portfolio-window-open"));
    focusWindowControl(windowName);
  }

  function closeWindow(windowName: WorkspaceWindow) {
    if (closingWindows.includes(windowName)) return;
    const remainingWindows = openWindows.filter((item) => item !== windowName);
    setClosingWindows((current) => [...current, windowName]);
    closeTimers.current.push(window.setTimeout(() => {
      if (windowName === "case" && workspace.mode !== "computer") {
        pendingWorkScroll.current = "selected-work";
        workspace.openWindow("work");
        window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior()));
      } else {
        workspace.closeWindow(windowName);
      }
      if (workspace.mode === "computer" && remainingWindows.length === 1) {
        const remaining = remainingWindows[0];
        window.requestAnimationFrame(() => {
          resetFrameFor(remaining);
          focusWindow(remaining);
          focusWindowControl(remaining);
        });
      } else if (workspace.mode === "computer" && remainingWindows.length > 1) {
        const promoted = activeWindow !== windowName && remainingWindows.includes(activeWindow as WorkspaceWindow)
          ? activeWindow as WorkspaceWindow
          : remainingWindows.find((item) => windowState(item) === "clear") ?? remainingWindows.at(-1)!;
        const companion = remainingWindows.find((item) => item !== promoted)!;
        const portrait = window.innerWidth <= 1100 && window.innerHeight > window.innerWidth;
        snapFrameFor(companion, portrait ? "top" : "left");
        snapFrameFor(promoted, portrait ? "bottom" : "right");
        window.requestAnimationFrame(() => {
          focusWindow(promoted);
          focusWindowControl(promoted);
        });
      }
      setClosingWindows((current) => current.filter((item) => item !== windowName));
      window.dispatchEvent(new Event("portfolio-window-state"));
    }, 320));
  }

  function closeApplication(app: "work" | "experience", visualWindow: WorkspaceWindow) {
    if (closingWindows.includes(visualWindow)) return;
    const removedWindows: WorkspaceWindow[] = app === "work"
      ? openWindows.filter((item) => item === "work" || item === "case")
      : openWindows.filter((item) => item === "experience");
    const remainingWindows = openWindows.filter((item) => !removedWindows.includes(item));
    setClosingWindows((current) => [...current, visualWindow]);
    closeTimers.current.push(window.setTimeout(() => {
      workspace.closeApp(app);
      if (app === "work") setDetailedCaseSlug(null);
      if (workspace.mode === "computer" && remainingWindows.length === 1) {
        const remaining = remainingWindows[0];
        window.requestAnimationFrame(() => {
          resetFrameFor(remaining);
          focusWindow(remaining);
          focusWindowControl(remaining);
        });
      }
      setClosingWindows((current) => current.filter((item) => item !== visualWindow));
      window.dispatchEvent(new Event("portfolio-window-state"));
    }, 320));
  }

  function openCaseWindow(slug: ScenarioSlug) {
    setSelectedCaseSlug(slug);
    openWindow("case");
  }

  function openDetailedCaseWindow(slug: ScenarioSlug) {
    setDetailedCaseSlug(slug);
    setSplashStage("done");
    if (workspace.mode !== "computer") {
      workspace.openWindow("case");
      window.scrollTo({ behavior: preferredScrollBehavior(), top: 0 });
    }
    workspace.openWindow("detail");
  }

  function closeDetailedCaseWindow() {
    setDetailedCaseSlug(null);
    workspace.closeWindow("detail");
    workspace.focusWindow("case");
  }

  useEffect(() => {
    if (workspace.mode === "computer" || workspace.activeApp !== "work") return;
    return workspace.registerBackHandler("work-navigation", () => {
      if (detailedCase) return false;
      if (isCaseOpen) {
        closeWindow("case");
        return true;
      }
      if (isWorkOpen) {
        workspace.goHome();
        return true;
      }
      return false;
    });
  // The handler deliberately follows the currently visible Work depth.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailedCase, isCaseOpen, isWorkOpen, workspace.activeApp, workspace.mode]);

  useEffect(() => () => closeTimers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (workspace.isAppOpen("work")) return;
    setDetailedCaseSlug(null);
  }, [workspace.openWindows, workspace]);

  useEffect(() => {
    if (!activeWindow || !mainWindowIds.includes(activeWindow as WorkspaceWindow) || detailedCase) return;
    const closeActiveWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeWindow(activeWindow as WorkspaceWindow);
    };
    window.addEventListener("keydown", closeActiveWithEscape);
    return () => window.removeEventListener("keydown", closeActiveWithEscape);
  // Close behavior intentionally follows the currently focused OS window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWindow, detailedCase, closingWindows]);

  useEffect(() => {
    const openWorkFromHeader = () => openWindow("work", "selected-work");
    const openExperienceFromHeader = () => openWindow("experience");
    window.addEventListener("portfolio-open-work", openWorkFromHeader);
    window.addEventListener("portfolio-open-experience", openExperienceFromHeader);
    return () => {
      window.removeEventListener("portfolio-open-work", openWorkFromHeader);
      window.removeEventListener("portfolio-open-experience", openExperienceFromHeader);
    };
  // The handlers should read the latest open/focus state without forcing stable callbacks through the window model.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWindows, workspace]);

  function skipSplash() {
    setSplashStage("leaving");
  }

  function openContactWindow(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.dispatchEvent(new Event("portfolio-contact-open"));
  }

  function windowState(windowName: WorkspaceWindow) {
    return workspace.stateFor(windowName);
  }

  function frameStyle(frameStyle: CSSProperties, windowName: WorkspaceWindow) {
    return {
      ...frameStyle,
      "--window-z": String(workspace.zIndexFor(windowName)),
    } as CSSProperties;
  }

  const detailIsForeground = Boolean(
    detailedCase && (workspace.activeWindow === "detail" || workspace.activeWindow === "evidence"),
  );

  return (
    <>
      <Splash stage={splashStage} onSkip={skipSplash} />
      <main
        aria-hidden={detailIsForeground ? true : undefined}
        className={`home-page editorial-home ${hasOpenWindows ? "has-work-window" : "is-desktop"}`}
        data-intro={splashStage}
        data-system-mode={workspace.mode}
        id="main-content"
        inert={detailIsForeground ? true : undefined}
        tabIndex={-1}
      >
        <DesktopSurface onOpenCase={openCaseWindow} onOpenWindow={openWindow} />
        <WindowSnapPreview edge={activeSnapCandidate} />
        {hasOpenWindows ? (
          <>
          {isWorkOpen ? <section
            className="portfolio-window home-window"
            aria-label="Work window"
            data-active-window={activeWindow === "work"}
            data-app-id="work"
            data-closing={closingWindows.includes("work")}
            data-dragging={workDragging}
            data-resizing={workResizing}
            data-snap={workSnap ?? undefined}
            data-snap-candidate={workSnapCandidate ?? undefined}
            data-window-state={windowState("work")}
            onFocusCapture={() => focusWindow("work")}
            onPointerDown={() => focusWindow("work")}
            ref={workFrameRef}
            style={frameStyle(workWindowStyle, "work")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome className="portfolio-window-chrome" closeLabel="Close work window" closeRef={workCloseRef} label="Work" maximized={workMaximized} onClose={() => closeApplication("work", "work")} onMinimize={() => workspace.minimizeApp("work")} onToggleMaximize={toggleWorkMaximize} {...workTitlebarProps} />
            {windowResizeEdges.map((edge) => <span key={edge} {...workResizeHandleProps(edge)} />)}
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
            data-app-id="experience"
            data-closing={closingWindows.includes("experience")}
            data-dragging={experienceDragging}
            data-resizing={experienceResizing}
            data-snap={experienceSnap ?? undefined}
            data-snap-candidate={experienceSnapCandidate ?? undefined}
            data-window-state={windowState("experience")}
            onFocusCapture={() => focusWindow("experience")}
            onPointerDown={() => focusWindow("experience")}
            ref={experienceFrameRef}
            style={frameStyle(experienceWindowStyle, "experience")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome className="portfolio-window-chrome" closeLabel="Close experience window" closeRef={experienceCloseRef} label="Experience" maximized={experienceMaximized} onClose={() => closeApplication("experience", "experience")} onMinimize={() => workspace.minimizeApp("experience")} onToggleMaximize={toggleExperienceMaximize} {...experienceTitlebarProps} />
            {windowResizeEdges.map((edge) => <span key={edge} {...experienceResizeHandleProps(edge)} />)}
            <ExperienceWindowContent onOpenContact={openContactWindow} />
          </section> : null}
          {isCaseOpen ? <section
            className="portfolio-window home-window workspace-case-window"
            aria-label="Selected work window"
            data-active-window={activeWindow === "case"}
            data-app-id="work"
            data-closing={closingWindows.includes("case")}
            data-dragging={caseDragging}
            data-resizing={caseResizing}
            data-snap={caseSnap ?? undefined}
            data-snap-candidate={caseSnapCandidate ?? undefined}
            data-window-state={windowState("case")}
            onFocusCapture={() => focusWindow("case")}
            onPointerDown={() => focusWindow("case")}
            ref={caseFrameRef}
            style={frameStyle(caseWindowStyle, "case")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome
              actions={<div className="case-workspace-actions case-preview-titlebar-actions">
                <button onClick={() => setSelectedCaseSlug(scenarios[(scenarios.findIndex((item) => item.slug === selectedCase.slug) - 1 + scenarios.length) % scenarios.length].slug)} type="button">Previous</button>
                <button onClick={() => setSelectedCaseSlug(scenarios[(scenarios.findIndex((item) => item.slug === selectedCase.slug) + 1) % scenarios.length].slug)} type="button">Next</button>
              </div>}
              className="portfolio-window-chrome"
              closeLabel="Close selected work window"
              closeRef={caseCloseRef}
              label="Selected work"
              maximized={caseMaximized}
              onClose={() => closeWindow("case")}
              onMinimize={() => workspace.minimizeApp("work")}
              onToggleMaximize={toggleCaseMaximize}
              subtitle={selectedCase.consequence}
              title={`${selectedCase.number} / ${String(scenarios.length).padStart(2, "0")} · ${caseDetails[selectedCase.slug].area}`}
              {...caseTitlebarProps}
            />
            {windowResizeEdges.map((edge) => <span key={edge} {...caseResizeHandleProps(edge)} />)}
            <SelectedCaseWindowContent onOpenFullCase={openDetailedCaseWindow} onSelectCase={setSelectedCaseSlug} scenario={selectedCase} />
          </section> : null}
          </>
        ) : null}
      </main>
      {detailedCase ? (
        <div
          className="workspace-detail-layer"
          data-window-state={workspace.activeWindow === "evidence" ? "active" : workspace.stateFor("detail")}
          role="presentation"
          style={{
            "--window-layer-z": workspace.activeWindow === "evidence"
              ? workspace.zIndexFor("evidence")
              : workspace.zIndexFor("detail"),
          } as CSSProperties}
        >
          <DebuggerWorkspace
            initialConditions={{ ...detailedCase.defaults }}
            key={detailedCase.slug}
            onClose={closeDetailedCaseWindow}
            onSelectScenario={(slug) => {
              setDetailedCaseSlug(slug);
              setSelectedCaseSlug(slug);
            }}
            scenario={detailedCase}
          />
        </div>
      ) : null}
    </>
  );
}
