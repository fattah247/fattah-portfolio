"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowIcon } from "./icons";
import { CopyEmailButton } from "./copy-email-button";
import { DebuggerWorkspace } from "./debugger-workspace";
import { ExperienceBriefContent } from "./experience-brief-content";
import { ProductLinksAppContent } from "./product-links-app";
import { AppMark } from "./system-shell";
import { WindowChrome } from "./window-chrome";
import { useWorkspaceManager, type WorkspaceWindowId } from "./workspace-manager";
import { experience } from "../lib/content";
import { scenarios, type Conditions, type ScenarioSlug } from "../lib/scenarios";
import { useWindowFrame, windowResizeEdges, type SnapEdge } from "./use-window-frame";

type WorkspaceWindow = Extract<WorkspaceWindowId, "work" | "experience" | "products">;
type WorkView = "index" | "summary" | "full-case";
type ExperienceView = "summary" | "full-brief";
const mainWindowIds: WorkspaceWindow[] = ["work", "experience", "products"];

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

function WorkRow({
  onOpenCase,
  scenario,
}: {
  onOpenCase: (slug: ScenarioSlug) => void;
  scenario: (typeof scenarios)[number];
}) {
  const detail = caseDetails[scenario.slug];
  return (
    <a
      href={`/case/${scenario.slug}`}
      className="editorial-work-row"
      onClick={(event) => {
        event.preventDefault();
        onOpenCase(scenario.slug);
      }}
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
    </a>
  );
}

const desktopItems = [
  {
    className: "surface-work",
    href: "/",
    label: "Work",
    app: "work",
    type: "folder",
  },
  {
    className: "surface-experience",
    href: "/brief",
    label: "Experience",
    app: "experience",
    type: "folder",
  },
  {
    className: "surface-contact",
    href: "#contact",
    label: "Contact",
    app: "contact",
    type: "folder",
  },
  {
    className: "surface-products",
    href: "/products",
    label: "Product Links",
    app: "products",
    type: "folder",
  },
  {
    className: "surface-shot-payflow",
    href: "/case/payflow",
    label: "Payment case",
    type: "image",
    src: "/projects/payflow/audit-trail.png",
  },
  {
    className: "surface-shot-iyup",
    href: "/case/iyup",
    label: "Service case",
    type: "image",
    src: "/projects/iyup/grafana-dashboard.png",
  },
  {
    className: "surface-shot-trustgate",
    href: "/case/trustgate",
    label: "Device case",
    type: "image",
    src: "/projects/trustgate/security-event-log.png",
  },
] as const;

type DesktopOffset = { x: number; y: number; z: number };
type DesktopOffsets = Record<string, DesktopOffset>;

const desktopOffsetsSessionKey = "fattah.desktop.shortcuts.v1";

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

function DesktopSurface({
  onOpenCase,
  onOpenWindow,
}: {
  onOpenCase: (slug: ScenarioSlug) => void;
  onOpenWindow: (windowName: WorkspaceWindow, target?: "selected-work") => void;
}) {
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
  } | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const [desktopOffsets, setDesktopOffsets] = useState<DesktopOffsets>({});
  const [draggingDesktopItem, setDraggingDesktopItem] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDesktopOffsets(readDesktopOffsets()));
    return () => window.cancelAnimationFrame(frame);
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
    const boardRect = board.getBoundingClientRect();
    const next = {
      x: Math.min(boardRect.width - drag.baseLeft - drag.width, Math.max(-drag.baseLeft, drag.origin.x + deltaX)),
      y: Math.min(boardRect.height - drag.baseTop - drag.height, Math.max(-drag.baseTop, drag.origin.y + deltaY)),
      z: drag.latest.z,
    };
    drag.latest = next;
    setDraggingDesktopItem(drag.key);
    setDesktopOffsets((current) => {
      const updated = { ...current, [drag.key]: next };
      storeDesktopOffsets(updated);
      return updated;
    });
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
    dragRef.current = null;
  }

  function draggedClick(event: MouseEvent<HTMLAnchorElement>, key: string) {
    if (suppressClickRef.current !== key) return false;
    event.preventDefault();
    suppressClickRef.current = null;
    return true;
  }

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
      <div className="desktop-wallpaper" aria-hidden="true">
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <pattern id="desktop-weave" width="48" height="48" patternUnits="userSpaceOnUse">
              <path className="desktop-wallpaper-thread" d="M0 12h12V0M36 48V36h12" />
            </pattern>
          </defs>
          <path className="desktop-wallpaper-field-warm" d="M1060 0h540v900H880V780h120V660h120V540h120V420h120V300h120V180h100V0Z" />
          <path className="desktop-wallpaper-field-cool" d="M1290 0h310v900h-166V768h-96V636h-96V504h-96V372h-96V240h240V0Z" />
          <rect className="desktop-wallpaper-weave" x="720" y="0" width="880" height="900" fill="url(#desktop-weave)" />
          <g className="desktop-wallpaper-ribbons">
            <path d="M760 842h120V722h120V602h120V482h120V362h120V242h120V122h140" />
            <path d="M920 900V804h120v-96h120v-96h120v-96h120v-96h120V324h100" />
          </g>
          <g className="desktop-wallpaper-pixels">
            <path d="M1116 92h20v20h-20zM1164 92h20v20h-20zM1212 92h20v20h-20zM1260 92h20v20h-20z" />
            <path d="M1140 116h20v20h-20zM1188 116h20v20h-20zM1236 116h20v20h-20z" />
            <path d="M1476 596h28v28h-28zM1516 596h28v28h-28zM1556 596h28v28h-28z" />
          </g>
          <g className="desktop-wallpaper-perforations">
            <path d="M756 520h12v12h-12zM788 520h12v12h-12zM820 520h12v12h-12zM852 520h12v12h-12z" />
            <path d="M924 836h12v12h-12zM956 836h12v12h-12zM988 836h12v12h-12zM1020 836h12v12h-12z" />
          </g>
        </svg>
      </div>
      <h2 className="sr-only" id="desktop-surface-title">Engineering workspace</h2>
      <div className="desktop-board" aria-label="Portfolio desktop shortcuts" ref={boardRef}>
        {desktopItems.map((item) => (
          <Link
            className={`desktop-object ${item.type === "folder" ? "desktop-folder" : "desktop-evidence"} ${item.className}`}
            data-dragging={draggingDesktopItem === item.className ? "true" : undefined}
            href={item.href}
            key={item.label}
            onDragStart={(event) => event.preventDefault()}
            onClick={
              item.label === "Contact"
                ? (event) => { if (!draggedClick(event, item.className)) openContact(event); }
                : item.label === "Work"
                  ? (event) => { if (!draggedClick(event, item.className)) openDesktopWindow("work")(event); }
                  : item.label === "Experience"
                      ? (event) => { if (!draggedClick(event, item.className)) openDesktopWindow("experience")(event); }
                      : item.label === "Product Links"
                        ? (event) => { if (!draggedClick(event, item.className)) openDesktopWindow("products")(event); }
                      : item.type === "image"
                        ? (event) => {
                          if (draggedClick(event, item.className)) return;
                          event.preventDefault();
                          onOpenCase(item.href.replace("/case/", "") as ScenarioSlug);
                        }
                      : undefined
            }
            onPointerCancel={endDesktopDrag}
            onPointerDown={(event) => beginDesktopDrag(event, item.className)}
            onPointerMove={moveDesktopShortcut}
            onPointerUp={endDesktopDrag}
            style={{
              "--desktop-offset-x": `${desktopOffsets[item.className]?.x ?? 0}px`,
              "--desktop-offset-y": `${desktopOffsets[item.className]?.y ?? 0}px`,
              zIndex: desktopOffsets[item.className]?.z || undefined,
            } as CSSProperties}
          >
            {item.type === "folder" ? (
              <span className="desktop-app-glyph" aria-hidden="true"><AppMark app={item.app} /></span>
            ) : (
              <span className="evidence-polaroid" aria-hidden="true">
                <Image src={item.src} alt="" fill sizes="(max-width: 760px) 88vw, 260px" />
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
    <div className="selected-case-window-content" data-case={scenario.slug}>
      <section className="selected-case-window-hero" aria-live="polite">
        <h2>{scenario.shortTitle}</h2>
        <p>{scenario.consequence}</p>
      </section>
      <section className="selected-case-window-proof">
        <div>
          <span>{detail.area}</span>
          <strong>{detail.technology}</strong>
          <p>{scenario.decision}</p>
        </div>
        <CaseEntryInstrument scenario={scenario} />
        <div
          className="selected-case-window-image"
          data-evidence-id={`evidence-${scenario.slug}-01`}
          id={`evidence-${scenario.slug}-01`}
        >
          <Image src={scenario.evidence[0].src} alt={scenario.evidence[0].alt} fill loading="eager" sizes="(max-width: 760px) 80vw, 520px" />
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

function CaseEntryInstrument({ scenario }: { scenario: (typeof scenarios)[number] }) {
  if (scenario.slug === "payflow") {
    return <div className="case-entry-instrument payment-ledger" aria-label="Two callback deliveries result in one payment state change">
      <span>Callback journal</span>
      <div><b>01</b><i>APPLIED</i></div>
      <div><b>02</b><i>RECORDED</i></div>
      <p><strong>2</strong> deliveries <em>→</em> <strong>1</strong> state change</p>
    </div>;
  }

  if (scenario.slug === "iyup") {
    return <div className="case-entry-instrument service-monitor" aria-label="Health passes while latency is degraded and an alert is present">
      <span>Operating signals</span>
      <div><b>HEALTH</b><i>PASS</i></div>
      <div className="monitor-trace" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div><b>LATENCY</b><i>DEGRADED</i></div>
      <div><b>ALERT</b><i>PRESENT</i></div>
    </div>;
  }

  return <div className="case-entry-instrument device-policy" aria-label="A suspected root signal and valid signature require confirmation for a high sensitivity action">
    <span>Policy record</span>
    <dl>
      <div><dt>Root</dt><dd>SUSPECTED</dd></div>
      <div><dt>Signature</dt><dd>VALID</dd></div>
      <div><dt>Action</dt><dd>HIGH</dd></div>
    </dl>
    <p>REQUIRE <strong>CONFIRMATION</strong></p>
  </div>;
}

const cvHref = "/cv/muhammad-abdul-fattah-general-software-engineer-cv.pdf";

function ExperienceWindowContent({
  onOpenContact,
  onOpenFullBrief,
}: {
  onOpenContact: (event: MouseEvent<HTMLAnchorElement>) => void;
  onOpenFullBrief: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
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
      <Link className="inline-link experience-window-full" href="/brief" onClick={onOpenFullBrief}>
        Open full brief <ArrowIcon />
      </Link>
    </div>
  );
}

export function CounterfactualHome({
  initialCaseConditions,
  initialCaseSlug,
  initialExperienceView,
}: {
  initialCaseConditions?: Conditions;
  initialCaseSlug?: ScenarioSlug;
  initialExperienceView?: ExperienceView;
} = {}) {
  const workspace = useWorkspaceManager();
  const [selectedCaseSlug, setSelectedCaseSlug] = useState<ScenarioSlug>(initialCaseSlug ?? "payflow");
  const [workView, setWorkView] = useState<WorkView>(initialCaseSlug ? "full-case" : "index");
  const [experienceView, setExperienceView] = useState<ExperienceView>(initialExperienceView ?? "summary");
  const [closingWindows, setClosingWindows] = useState<WorkspaceWindow[]>([]);
  const closeTimers = useRef<number[]>([]);
  const caseSummaryScrollRef = useRef<Record<ScenarioSlug, number>>({ payflow: 0, iyup: 0, trustgate: 0 });
  const workIndexScrollRef = useRef(0);
  const experienceCloseRef = useRef<HTMLButtonElement>(null);
  const experienceSummaryScrollRef = useRef(0);
  const heroRef = useRef<HTMLElement>(null);
  const workContentRef = useRef<HTMLDivElement>(null);
  const workCloseRef = useRef<HTMLButtonElement>(null);
  const productsCloseRef = useRef<HTMLButtonElement>(null);
  const pendingWorkScroll = useRef<"selected-work" | null>(null);
  const pendingSummaryReset = useRef(false);
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
    dragging: productsDragging,
    frameRef: productsFrameRef,
    maximized: productsMaximized,
    resetFrame: resetProductsFrame,
    resizeHandleProps: productsResizeHandleProps,
    resizing: productsResizing,
    snap: productsSnap,
    snapCandidate: productsSnapCandidate,
    snapTo: snapProductsFrame,
    style: productsWindowStyle,
    titlebarProps: productsTitlebarProps,
    toggleMaximize: toggleProductsMaximize,
  } = useWindowFrame({ defaultHeight: 820, defaultWidth: 1220, minHeight: 420, minWidth: 620 });
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
  const openWindows = workspace.openWindows.filter((item): item is WorkspaceWindow => mainWindowIds.includes(item as WorkspaceWindow));
  const isWorkOpen = workspace.isOpen("work");
  const isExperienceOpen = workspace.isOpen("experience");
  const isProductsOpen = workspace.isOpen("products");
  const hasOpenWindows = openWindows.length > 0;
  const activeWindow = workspace.activeWindow;
  const activeSnapCandidate = activeWindow === "work"
    ? workSnapCandidate
    : activeWindow === "experience"
      ? experienceSnapCandidate
      : activeWindow === "products"
        ? productsSnapCandidate
        : null;

  useEffect(() => {
    if (initialCaseSlug) {
      setSelectedCaseSlug(initialCaseSlug);
      setWorkView("full-case");
      workspace.openWindow("work");
      workspace.focusWindow("work");
    }
  // This restores the Work document once for the route that mounted it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCaseSlug]);

  useEffect(() => {
    if (initialExperienceView !== "full-brief") return;
    setExperienceView("full-brief");
    workspace.openWindow("experience");
    workspace.focusWindow("experience");
    window.requestAnimationFrame(() => experienceFrameRef.current?.scrollTo({ behavior: "auto", top: 0 }));
  // This restores the Experience document once for a direct /brief load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExperienceView]);

  useEffect(() => {
    if (initialCaseSlug || window.location.pathname !== "/" || !window.location.hash) return;
    window.history.replaceState(null, "", "/");
  }, [initialCaseSlug]);

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

  useLayoutEffect(() => {
    if (workView !== "summary" || !pendingSummaryReset.current) return;
    pendingSummaryReset.current = false;

    const frame = workFrameRef.current;
    const resetScroll = () => frame?.scrollTo({ behavior: "auto", top: 0 });
    resetScroll();

    let settleFrame = 0;
    const paintFrame = window.requestAnimationFrame(() => {
      resetScroll();
      settleFrame = window.requestAnimationFrame(resetScroll);
    });
    return () => {
      window.cancelAnimationFrame(paintFrame);
      window.cancelAnimationFrame(settleFrame);
    };
  }, [selectedCaseSlug, workView, workFrameRef]);

  function focusWindow(windowName: WorkspaceWindow) {
    workspace.focusWindow(windowName);
  }

  function frameFor(windowName: WorkspaceWindow) {
    if (windowName === "work") return workFrameRef.current;
    if (windowName === "experience") return experienceFrameRef.current;
    if (windowName === "products") return productsFrameRef.current;
    return null;
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
    if (windowName === "products") resetProductsFrame();
  }

  function snapFrameFor(windowName: WorkspaceWindow, edge: "left" | "right" | "top" | "bottom") {
    if (windowName === "work") snapWorkFrame(edge);
    if (windowName === "experience") snapExperienceFrame(edge);
    if (windowName === "products") snapProductsFrame(edge);
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
    const alreadyOpen = openWindows.includes(windowName);

    if (windowName === "work" && target) {
      setWorkView("index");
      pendingWorkScroll.current = target;
      if (window.location.pathname !== "/" || window.location.hash !== "#selected-work") {
        window.history.replaceState(null, "", "/#selected-work");
      }
    }

    if (workspace.mode !== "computer") {
      workspace.openWindow(windowName);
      if (windowName === "work" && target && openWindows.includes("work")) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior())));
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
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollWorkToSelected(preferredScrollBehavior())));
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
      if (windowName === "products") resetProductsFrame();
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
      workspace.closeWindow(windowName);
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

  function closeApplication(app: "work" | "experience" | "products", visualWindow: WorkspaceWindow) {
    if (closingWindows.includes(visualWindow)) return;
    const removedWindows: WorkspaceWindow[] = app === "work"
      ? openWindows.filter((item) => item === "work")
      : app === "experience"
        ? openWindows.filter((item) => item === "experience")
        : openWindows.filter((item) => item === "products");
    const remainingWindows = openWindows.filter((item) => !removedWindows.includes(item));
    setClosingWindows((current) => [...current, visualWindow]);
    closeTimers.current.push(window.setTimeout(() => {
      workspace.closeApp(app);
      if (app === "work") {
        setWorkView("index");
        if (window.location.pathname.startsWith("/case/")) window.history.replaceState(null, "", "/");
      }
      if (app === "experience") {
        setExperienceView("summary");
        if (window.location.pathname === "/brief") window.history.replaceState(null, "", "/");
      }
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
    workIndexScrollRef.current = workFrameRef.current?.scrollTop ?? workIndexScrollRef.current;
    pendingSummaryReset.current = true;
    setSelectedCaseSlug(slug);
    setWorkView("summary");
    workspace.openWindow("work");
    workspace.focusWindow("work");
    window.history.pushState({ portfolioView: "selected-work", slug }, "", "/#selected-work");
  }

  function openExperienceBrief(event?: MouseEvent<HTMLAnchorElement>) {
    event?.preventDefault();
    experienceSummaryScrollRef.current = experienceFrameRef.current?.scrollTop ?? experienceSummaryScrollRef.current;
    setExperienceView("full-brief");
    workspace.openWindow("experience");
    workspace.focusWindow("experience");
    if (window.location.pathname !== "/brief") {
      window.history.pushState({ portfolioView: "experience-brief" }, "", "/brief");
    }
    window.requestAnimationFrame(() => experienceFrameRef.current?.scrollTo({ behavior: "auto", top: 0 }));
  }

  function closeExperienceBrief() {
    setExperienceView("summary");
    workspace.openWindow("experience");
    workspace.focusWindow("experience");
    if (window.location.pathname === "/brief") {
      window.history.replaceState(null, "", "/");
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      experienceFrameRef.current?.scrollTo({ behavior: "auto", top: experienceSummaryScrollRef.current });
      experienceFrameRef.current?.focus({ preventScroll: true });
    }));
  }

  function selectCaseSummary(slug: ScenarioSlug) {
    pendingSummaryReset.current = true;
    setSelectedCaseSlug(slug);
    setWorkView("summary");
    workspace.focusWindow("work");
    window.history.replaceState({ portfolioView: "selected-work", slug }, "", "/#selected-work");
  }

  function openDetailedCaseWindow(slug: ScenarioSlug) {
    caseSummaryScrollRef.current[slug] = workFrameRef.current?.scrollTop ?? 0;
    setSelectedCaseSlug(slug);
    setWorkView("full-case");
    workspace.openWindow("work");
    workspace.focusWindow("work");
    window.history.pushState({ portfolioView: "full-case", slug }, "", `/case/${slug}`);
    window.requestAnimationFrame(() => workFrameRef.current?.scrollTo({ behavior: "auto", top: 0 }));
  }

  function closeDetailedCaseWindow(slug: ScenarioSlug) {
    setSelectedCaseSlug(slug);
    setWorkView("summary");
    workspace.focusWindow("work");
    window.history.replaceState({ portfolioView: "selected-work", slug }, "", "/#selected-work");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      workFrameRef.current?.scrollTo({ behavior: "auto", top: caseSummaryScrollRef.current[slug] });
      workFrameRef.current?.focus({ preventScroll: true });
    }));
  }

  function closeCaseSummary() {
    setWorkView("index");
    window.history.replaceState(null, "", "/#selected-work");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (workspace.mode === "computer") {
        workFrameRef.current?.scrollTo({ behavior: "auto", top: workIndexScrollRef.current });
      } else {
        scrollWorkToSelected("auto");
      }
      workFrameRef.current?.focus({ preventScroll: true });
    }));
  }

  function switchDetailedCase(slug: ScenarioSlug) {
    setSelectedCaseSlug(slug);
    setWorkView("full-case");
    workspace.focusWindow("work");
    window.history.pushState({ portfolioView: "full-case", slug }, "", `/case/${slug}`);
    window.requestAnimationFrame(() => workFrameRef.current?.scrollTo({ behavior: "auto", top: 0 }));
  }

  useEffect(() => {
    const syncWorkHistory = (event: PopStateEvent) => {
      const routeMatch = window.location.pathname.match(/^\/case\/(payflow|iyup|trustgate)$/);
      if (routeMatch) {
        const slug = routeMatch[1] as ScenarioSlug;
        setSelectedCaseSlug(slug);
        setWorkView("full-case");
        workspace.openWindow("work");
        workspace.focusWindow("work");
        return;
      }
      if (window.location.pathname !== "/") return;
      if (window.location.hash === "#selected-work" && event.state?.portfolioView === "selected-work") {
        const slug = scenarios.some((scenario) => scenario.slug === event.state.slug)
          ? event.state.slug as ScenarioSlug
          : selectedCaseSlug;
        setSelectedCaseSlug(slug);
        setWorkView("summary");
        workspace.openWindow("work");
        workspace.focusWindow("work");
        return;
      }
      setWorkView("index");
      workspace.openWindow("work");
      workspace.focusWindow("work");
      if (window.location.hash === "#selected-work") {
        pendingWorkScroll.current = "selected-work";
        window.requestAnimationFrame(() => scrollWorkToSelected("auto"));
      }
    };
    window.addEventListener("popstate", syncWorkHistory);
    return () => window.removeEventListener("popstate", syncWorkHistory);
  // The history handler reads the current Work frame when the browser dispatches popstate.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseSlug, workspace]);

  useEffect(() => {
    const syncExperienceHistory = () => {
      if (window.location.pathname === "/brief") {
        setExperienceView("full-brief");
        workspace.openWindow("experience");
        workspace.focusWindow("experience");
        window.requestAnimationFrame(() => experienceFrameRef.current?.scrollTo({ behavior: "auto", top: 0 }));
        return;
      }
      if (experienceView !== "full-brief") return;
      setExperienceView("summary");
      workspace.openWindow("experience");
      workspace.focusWindow("experience");
      window.requestAnimationFrame(() => experienceFrameRef.current?.scrollTo({ behavior: "auto", top: experienceSummaryScrollRef.current }));
    };
    window.addEventListener("popstate", syncExperienceHistory);
    return () => window.removeEventListener("popstate", syncExperienceHistory);
  // The frame ref is stable; keeping the dependency shape fixed also keeps Fast Refresh safe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceView, workspace]);

  useEffect(() => {
    if (workspace.activeApp !== "work") return;
    return workspace.registerBackHandler("work-navigation", () => {
      if (workspace.activeWindow !== "work") return false;
      if (workView === "full-case") return false;
      if (workView === "summary") {
        closeCaseSummary();
        return true;
      }
      if (workspace.mode !== "computer" && isWorkOpen) {
        workspace.goHome();
        return true;
      }
      return false;
    });
  // The handler deliberately follows the currently visible Work depth.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkOpen, workView, workspace.activeApp, workspace.activeWindow, workspace.mode]);

  useEffect(() => {
    if (workspace.activeApp !== "experience" || experienceView !== "full-brief") return;
    return workspace.registerBackHandler("experience-navigation", () => {
      if (workspace.activeWindow !== "experience") return false;
      closeExperienceBrief();
      return true;
    });
  // The handler follows the internal Experience document depth.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceView, workspace.activeApp, workspace.activeWindow]);

  useEffect(() => () => closeTimers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (workspace.isAppOpen("work") || initialCaseSlug) return;
    setWorkView("index");
    if (window.location.pathname.startsWith("/case/")) {
      window.history.replaceState(null, "", "/");
    }
  }, [initialCaseSlug, workspace.openWindows, workspace]);

  useEffect(() => {
    if (!activeWindow || !mainWindowIds.includes(activeWindow as WorkspaceWindow) || (activeWindow === "work" && workView === "full-case")) return;
    const closeActiveWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeWindow(activeWindow as WorkspaceWindow);
    };
    window.addEventListener("keydown", closeActiveWithEscape);
    return () => window.removeEventListener("keydown", closeActiveWithEscape);
  // Close behavior intentionally follows the currently focused OS window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWindow, closingWindows, workView]);

  useEffect(() => {
    const openWorkFromHeader = () => openWindow("work", "selected-work");
    const openExperienceFromHeader = () => openWindow("experience");
    const openProductsFromHeader = () => openWindow("products");
    window.addEventListener("portfolio-open-work", openWorkFromHeader);
    window.addEventListener("portfolio-open-experience", openExperienceFromHeader);
    window.addEventListener("portfolio-open-products", openProductsFromHeader);
    return () => {
      window.removeEventListener("portfolio-open-work", openWorkFromHeader);
      window.removeEventListener("portfolio-open-experience", openExperienceFromHeader);
      window.removeEventListener("portfolio-open-products", openProductsFromHeader);
    };
  // The handlers should read the latest open/focus state without forcing stable callbacks through the window model.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWindows, workspace]);

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

  const selectedScenario = scenarios.find((scenario) => scenario.slug === selectedCaseSlug)!;
  const selectedCaseTitle = `${selectedScenario.number} / ${String(scenarios.length).padStart(2, "0")} · ${caseDetails[selectedCaseSlug].area}`;

  return (
    <>
      <main
        className={`home-page editorial-home ${hasOpenWindows ? "has-work-window" : "is-desktop"}`}
        data-system-mode={workspace.mode}
        id="main-content"
        tabIndex={-1}
      >
        <DesktopSurface onOpenCase={openCaseWindow} onOpenWindow={openWindow} />
        <WindowSnapPreview edge={activeSnapCandidate} />
        {hasOpenWindows ? (
          <>
          {isWorkOpen ? <section
            className={`portfolio-window home-window workspace-work-window ${workView !== "index" ? "workspace-case-window" : ""}`.trim()}
            aria-label="Work window"
            data-active-window={activeWindow === "work"}
            data-app-id="work"
            data-closing={closingWindows.includes("work")}
            data-dragging={workDragging}
            data-resizing={workResizing}
            data-snap={workSnap ?? undefined}
            data-snap-candidate={workSnapCandidate ?? undefined}
            data-view={workView}
            data-window-state={windowState("work")}
            onFocusCapture={(event) => {
              if ((event.target as Element).closest(".evidence-dialog")) return;
              focusWindow("work");
            }}
            onPointerDown={(event) => {
              if ((event.target as Element).closest(".evidence-dialog")) return;
              focusWindow("work");
            }}
            ref={workFrameRef}
            style={frameStyle(workWindowStyle, "work")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome
              actions={workView === "summary" ? <div className="case-workspace-actions case-preview-titlebar-actions">
                <button className="case-back-action" onClick={closeCaseSummary} type="button">← All work</button>
              </div> : workView === "full-case" ? <div className="case-workspace-actions case-preview-titlebar-actions">
                <button className="case-back-action" onClick={() => closeDetailedCaseWindow(selectedCaseSlug)} type="button">← Back to preview</button>
              </div> : null}
              className="portfolio-window-chrome"
              closeLabel="Close work window"
              closeRef={workCloseRef}
              compactBackLabel={workView === "index" ? "Return to Home" : workView === "summary" ? "Return to selected work list" : "Return to selected work preview"}
              label="Work"
              maximized={workMaximized}
              onClose={() => closeApplication("work", "work")}
              onCompactBack={workspace.mode === "phone" ? workspace.requestBack : undefined}
              onMinimize={() => workspace.minimizeWindow("work")}
              onToggleMaximize={toggleWorkMaximize}
              subtitle={workView === "index" ? undefined : selectedScenario.shortTitle}
              title={workView === "index" ? undefined : `Selected work · ${selectedCaseTitle}`}
              {...workTitlebarProps}
            />
            {windowResizeEdges.map((edge) => <span key={edge} {...workResizeHandleProps(edge)} />)}
            {workView === "index" ? <div className="portfolio-window-content" ref={workContentRef}>
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
                  <h2 id="work-title">Three failures, three decisions.</h2>
                  <p>Start with the consequence. Open a case for the reasoning, behavior, code, and limitation.</p>
                </div>
                <div className="editorial-work-list">
                  {scenarios.map((scenario) => <WorkRow scenario={scenario} key={scenario.slug} onOpenCase={openCaseWindow} />)}
                </div>
              </section>

              <section className="editorial-footer">
                <p>Currently building Android POS and merchant payment systems at Bank Central Asia.</p>
                <a href="/brief" onClick={(event) => {
                  event.preventDefault();
                  openWindow("experience");
                }}>Read experience and contact <ArrowIcon /></a>
              </section>
            </div> : workView === "summary" ? (
              <SelectedCaseWindowContent key={selectedCaseSlug} onOpenFullCase={openDetailedCaseWindow} onSelectCase={selectCaseSummary} scenario={selectedScenario} />
            ) : (
              <DebuggerWorkspace
                embedded
                initialConditions={initialCaseSlug === selectedCaseSlug && initialCaseConditions ? initialCaseConditions : { ...selectedScenario.defaults }}
                onClose={() => closeDetailedCaseWindow(selectedCaseSlug)}
                onSelectScenario={switchDetailedCase}
                scenario={selectedScenario}
                scrollContainerRef={workFrameRef}
                workspaceWindowId="work"
              />
            )}
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
            data-view={experienceView}
            data-window-state={windowState("experience")}
            onFocusCapture={() => focusWindow("experience")}
            onPointerDown={() => focusWindow("experience")}
            ref={experienceFrameRef}
            style={frameStyle(experienceWindowStyle, "experience")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome
              actions={experienceView === "full-brief" ? <div className="case-workspace-actions experience-brief-titlebar-actions">
                <button className="case-back-action" onClick={closeExperienceBrief} type="button">← Overview</button>
              </div> : null}
              className="portfolio-window-chrome"
              closeLabel="Close experience window"
              closeRef={experienceCloseRef}
              compactBackLabel={experienceView === "full-brief" ? "Return to Experience overview" : "Return from Experience"}
              label="Experience"
              maximized={experienceMaximized}
              onClose={() => closeApplication("experience", "experience")}
              onCompactBack={workspace.mode === "phone" ? (experienceView === "full-brief" ? closeExperienceBrief : workspace.requestBack) : undefined}
              onMinimize={() => workspace.minimizeWindow("experience")}
              onToggleMaximize={toggleExperienceMaximize}
              subtitle={experienceView === "full-brief" ? "CV, selected work, and operating scope" : undefined}
              title={experienceView === "full-brief" ? "Full engineering brief" : undefined}
              {...experienceTitlebarProps}
            />
            {windowResizeEdges.map((edge) => <span key={edge} {...experienceResizeHandleProps(edge)} />)}
            {experienceView === "summary" ? (
              <ExperienceWindowContent onOpenContact={openContactWindow} onOpenFullBrief={openExperienceBrief} />
            ) : (
              <ExperienceBriefContent onOpenCase={openDetailedCaseWindow} onOpenContact={openContactWindow} />
            )}
          </section> : null}
          {isProductsOpen ? <section
            className="portfolio-window home-window product-links-window"
            aria-label="Product Links window"
            data-active-window={activeWindow === "products"}
            data-app-id="products"
            data-closing={closingWindows.includes("products")}
            data-dragging={productsDragging}
            data-resizing={productsResizing}
            data-snap={productsSnap ?? undefined}
            data-snap-candidate={productsSnapCandidate ?? undefined}
            data-window-state={windowState("products")}
            onFocusCapture={() => focusWindow("products")}
            onPointerDown={() => focusWindow("products")}
            ref={productsFrameRef}
            style={frameStyle(productsWindowStyle, "products")}
            suppressHydrationWarning
            tabIndex={-1}
          >
            <WindowChrome
              className="portfolio-window-chrome product-links-window-chrome"
              closeLabel="Close product links"
              closeRef={productsCloseRef}
              label="Product Links"
              maximized={productsMaximized}
              onClose={() => closeApplication("products", "products")}
              onCompactBack={workspace.mode === "phone" ? workspace.requestBack : undefined}
              onMinimize={() => workspace.minimizeWindow("products")}
              onToggleMaximize={toggleProductsMaximize}
              subtitle="Searchable tools and products directory"
              {...productsTitlebarProps}
            />
            {windowResizeEdges.map((edge) => <span key={edge} {...productsResizeHandleProps(edge)} />)}
            <ProductLinksAppContent />
          </section> : null}
          </>
        ) : null}
      </main>
    </>
  );
}
