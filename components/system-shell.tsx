"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useWorkspaceManager,
  type PortfolioAppId,
} from "./workspace-manager";
import { portfolioApp, portfolioApps } from "./app-registry";
import { portfolioIdentity } from "../lib/portfolio-identity";
import { decodeWorkspaceRoute } from "../lib/workspace-navigation";
import { ChevronIcon, CloseIcon, DownloadIcon, PairIcon, SystemIcon } from "./icons";
import { AppIcon, OwnerMark } from "./app-icons";
import { CaseCover } from "./case-cover";
import { Wallpaper } from "./wallpaper";
import { SoundControl } from "./sound-control";
import { useSound } from "./sound-provider";
import { hop, leaveSpring, springDuration, springTo, windowSpring } from "../lib/motion";
import { useWorkspaceSounds } from "./use-workspace-sounds";
import { useHomeGesture } from "./use-home-gesture";
import { useFlickAway } from "./use-flick-away";
import { experience } from "../lib/content";
import { rowsThatFit } from "../lib/fit-rows";
import { filterProductLinks, indexProductLinks, productLinks, searchProductLinks, type Marketplace } from "../lib/product-links";
import { scenarios, type ScenarioSlug } from "../lib/scenarios";

function appForRoute(pathname: string): PortfolioAppId | null {
  return decodeWorkspaceRoute(pathname).app;
}

/** `small` uses the 16-unit drawing for taskbar-sized marks; it is redrawn, not shrunk. */
export function AppMark({ app, small = false }: { app: PortfolioAppId; small?: boolean }) {
  return <span className="system-app-mark" data-app={app} aria-hidden="true"><AppIcon app={app} variant={small ? "small" : "large"} /></span>;
}

/**
 * A Recents card shows what the app is holding now, from the same document records the apps
 * restore. The phone's taller cards add the document's next lines (`recent-preview-extra`).
 */
function RecentPreview({ app }: { app: PortfolioAppId }) {
  const workspace = useWorkspaceManager();
  if (app === "work") {
    const session = workspace.readDocumentState("work", "session")?.data as { view?: string; slug?: string; repository?: string } | undefined;
    const scenario = session?.view === "full-case" ? scenarios.find((item) => item.slug === session.slug) : undefined;
    if (scenario) {
      return (
        <div className="recent-preview recent-preview-case">
          <CaseCover slug={scenario.slug} />
          <small>{scenario.category}</small>
          <b>{scenario.shortTitle}</b>
          <span className="recent-preview-extra">{scenario.consequence}</span>
        </div>
      );
    }
    if (session?.view === "github-project" && session.repository) {
      return <div className="recent-preview recent-preview-repo"><small>Side project</small><b>{session.repository}</b></div>;
    }
    return (
      <div className="recent-preview recent-preview-index">
        <small>Engineering cases</small>
        {scenarios.map((item) => (
          <Fragment key={item.slug}>
            <b><span className="recent-preview-extra">{item.number} </span>{item.shortTitle}</b>
            <span className="recent-preview-extra recent-preview-line">{item.consequence}</span>
          </Fragment>
        ))}
      </div>
    );
  }
  if (app === "experience") {
    return (
      <div className="recent-preview recent-preview-dossier">
        <small>{portfolioIdentity.name}</small>
        <ol>
          {experience.map((item) => <li key={`${item.company}-${item.period}`}><small>{item.period}</small><b>{item.role}</b><span>{item.company}</span></li>)}
        </ol>
      </div>
    );
  }
  if (app === "contact") {
    return (
      <div className="recent-preview recent-preview-contact">
        <small>Email</small><b>{portfolioIdentity.email}</b>
        <ul><li>LinkedIn</li><li>WhatsApp</li><li>GitHub</li></ul>
      </div>
    );
  }
  const directory = workspace.readDocumentState("products", "directory")?.data as { query?: string; marketplace?: Marketplace | "all" } | undefined;
  const results = filterProductLinks(searchProductLinks(indexProductLinks(productLinks), directory?.query ?? ""), directory?.marketplace ?? "all");
  return (
    <div className="recent-preview recent-preview-catalog">
      <small>{directory?.query ? `Search: ${directory.query}` : "Products I use"}</small>
      <b>{results.length} {results.length === 1 ? "product" : "products"}</b>
      <ul className="recent-preview-extra">{results.slice(0, 6).map((product) => <li key={product.id}>{product.name}</li>)}</ul>
    </div>
  );
}

/** How long the pointer rests on a taskbar button before its caption shows (the stylesheet waits as long). */
const captionDelayMs = 480;

export function SystemShell() {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspaceManager();
  const { play } = useSound();
  useWorkspaceSounds(workspace);
  const [clock, setClock] = useState({ date: "", shortDate: "", time: "--:--", utc: "UTC" });
  const runningApps = useMemo(
    () => workspace.recentApps.filter((app) => workspace.isAppOpen(app)),
    [workspace],
  );
  const routeOwner = appForRoute(pathname);
  // The running session is authoritative; the route only labels the server-rendered first paint.
  const activeEntry = portfolioApps.find((app) => app.id === (workspace.activeApp ?? routeOwner));
  const resumeApp = runningApps.at(-1) ?? "work";
  const recentsListRef = useRef<HTMLDivElement>(null);
  const launchTimer = useRef(0);
  // Taskbar captions: the first waits a moment; once one has shown, the next answer at once.
  const [captionsWarm, setCaptionsWarm] = useState(false);
  const captionTimer = useRef(0);
  const warmCaptions = () => { window.clearTimeout(captionTimer.current); captionTimer.current = window.setTimeout(() => setCaptionsWarm(true), captionDelayMs); };
  const coolCaptions = () => { window.clearTimeout(captionTimer.current); captionTimer.current = window.setTimeout(() => setCaptionsWarm(false), 400); };

  // Recents reads oldest to newest; entering it lands on the newest card with the previous one peeking.
  useLayoutEffect(() => {
    if (workspace.surface !== "recents") return;
    const list = recentsListRef.current;
    if (list) list.scrollLeft = list.scrollWidth;
  }, [workspace.surface, runningApps.length]);
  const resumeEntry = portfolioApp(resumeApp);

  // Tablet Home role history: the list length is data, so it is fitted by measurement rather than
  // by breakpoints. It shows as many whole roles as fit above the shelf, oldest dropped first, and
  // steps aside when fewer than two fit. Rows stay laid out (clipped, not removed) so a larger
  // screen can bring them back.
  const rolesRef = useRef<HTMLOListElement>(null);
  const [roleFit, setRoleFit] = useState<{ count: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const list = rolesRef.current;
    const panel = list?.parentElement;
    const layout = panel?.parentElement;
    const screen = layout?.parentElement;
    if (!list || !panel || !layout || !screen) return;
    const fit = () => {
      if (getComputedStyle(panel).display === "none") return;
      const listTop = list.getBoundingClientRect().top;
      const bottoms = Array.from(list.children, (row) => row.getBoundingClientRect().bottom - listTop);
      const limit = screen.getBoundingClientRect().bottom
        - (parseFloat(getComputedStyle(layout).paddingBottom) || 0)
        - (parseFloat(getComputedStyle(panel).borderBottomWidth) || 0)
        - listTop;
      const count = rowsThatFit(bottoms, limit, 2);
      const next = count === bottoms.length ? null : { count, height: count ? Math.ceil(bottoms[count - 1]) : 0 };
      setRoleFit((current) => (current?.count === next?.count && current?.height === next?.height ? current : next));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(screen);
    for (const node of [...Array.from(layout.children), ...Array.from(list.children)]) if (node !== panel) observer.observe(node);
    return () => observer.disconnect();
  }, [workspace.mode, workspace.surface, runningApps.length]);

  /** Recents' own Return home where it's shown, else the phone bar's or the tablet shelf's Home. */
  const recentsWayHome = () => [...document.querySelectorAll<HTMLElement>(".system-recents-home, .phone-system-navigation [aria-label='Home'], nav.tablet-shelf [aria-label='Home']")].find((button) => button.checkVisibility?.() ?? true) ?? null;

  // When an app closes and takes the keyboard focus with it, focus returns to that app's own
  // taskbar or shelf button, so a keyboard user continues from where the app lived; closed from
  // Recents, it goes to the card that slid into its place (or Return home when none is left).
  const previousRunning = useRef<PortfolioAppId[]>([]);
  useEffect(() => {
    const before = previousRunning.current;
    const closed = before.filter((app) => !runningApps.includes(app));
    previousRunning.current = runningApps;
    if (!closed.length) return;
    const inRecents = workspace.surface === "recents";
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && document.contains(active)) return;
      if (inRecents) {
        const cards = document.querySelectorAll<HTMLElement>(".system-recent-open");
        (cards[Math.min(before.indexOf(closed[0]), cards.length - 1)] ?? recentsWayHome())?.focus({ preventScroll: true });
        return;
      }
      document.querySelector<HTMLElement>(`.taskbar-app[data-app="${closed[0]}"], nav.tablet-shelf button[data-app="${closed[0]}"]`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [runningApps, workspace.surface]);

  // On a phone or tablet, the keyboard's focus follows the visitor between surfaces: opening Recents
  // from its button lands on the current card, and focus that a surface took away with it (Return
  // home from inside Recents) lands on Home.
  const surfaceBefore = useRef(workspace.surface);
  useEffect(() => {
    const before = surfaceBefore.current;
    surfaceBefore.current = workspace.surface;
    if (before === workspace.surface || workspace.mode === "computer") return;
    const active = document.activeElement as HTMLElement | null;
    const lost = !active || active === document.body || Boolean(active.closest("[inert]"));
    const target = workspace.surface === "recents" && (lost || active?.matches("[aria-label='Recents']"))
      ? document.querySelector<HTMLElement>(".system-recent-card[data-current='true'] .system-recent-open") ?? [...document.querySelectorAll<HTMLElement>(".system-recent-open")].at(-1) ?? recentsWayHome()
      : workspace.surface === "home" && lost ? document.querySelector<HTMLElement>(".phone-system-navigation [aria-label='Home'], nav.tablet-shelf [aria-label='Home']") : null;
    if (!target) return;
    // A surface that fades in can't take focus until it's shown, so the move retries for a few frames.
    let frame = 0;
    let tries = 0;
    const land = () => {
      target.focus({ preventScroll: true });
      if (document.activeElement !== target && ++tries < 20) frame = window.requestAnimationFrame(land);
    };
    land();
    return () => window.cancelAnimationFrame(frame);
  }, [workspace.mode, workspace.surface]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const time = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
      }).format(now);
      const date = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        weekday: "long",
      }).format(now);
      const shortDate = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        weekday: "short",
      }).format(now);
      const offsetMinutes = -now.getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? "+" : "−";
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const minutes = Math.abs(offsetMinutes) % 60;
      const utc = offsetMinutes === 0
        ? "UTC"
        : `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;

      setClock({ date, shortDate, time, utc });
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // An iPhone shows a touched control's :active state only once the page listens for touches.
  useEffect(() => {
    const listen = () => undefined;
    document.addEventListener("touchstart", listen, { passive: true });
    return () => document.removeEventListener("touchstart", listen);
  }, []);

  useEffect(() => {
    const preventPageContextMenu = (event: globalThis.MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".desktop-surface") && !target.closest("a, button, input, textarea")) event.preventDefault();
    };
    document.addEventListener("contextmenu", preventPageContextMenu);
    return () => document.removeEventListener("contextmenu", preventPageContextMenu);
  }, []);

  // A launch grows the app out of what launched it; going Home (by Home, Back, Recents or the home
  // gesture) sends it back into its Home icon, or a tablet's shelf button, and opening Recents sends
  // it into its card there. All of it rides springs from wherever the window is and at the speed it
  // has, so tapping Home mid-launch (or the icon mid-leave) swings it round instead of jumping, and an
  // app thrown up from the bar flies home at the speed it was thrown.
  const leftFrom = useRef({ surface: workspace.surface, app: workspace.activeApp });
  const thrown = useRef(0);
  const launchFrom = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    const before = leftFrom.current;
    leftFrom.current = { surface: workspace.surface, app: workspace.activeApp };
    if (workspace.mode === "computer") return;
    const root = document.documentElement;
    const windowOf = (app: string) => document.querySelector<HTMLElement>(`:is(.portfolio-window, .contact-window)[data-app-id="${app}"]`);

    // The scale that makes a window `rect`'s width, about the one point that lands it on `rect`.
    const onto = (element: HTMLElement, rect: DOMRect) => {
      const size = Math.min(0.95, Math.max(0.06, rect.width / element.offsetWidth));
      return { origin: `${Math.round((rect.left - element.offsetLeft) / (1 - size))}px ${Math.round((rect.top - element.offsetTop) / (1 - size))}px`, size };
    };

    // An app opens out of exactly what launched it, as an iPhone's does: from the icon's own size,
    // or the card's, filling the screen on the window spring.
    const launched = root.dataset.launching && workspace.surface === "application" && workspace.activeApp && (before.surface !== "application" || before.app !== workspace.activeApp);
    if (launched) {
      const launching = windowOf(workspace.activeApp!);
      const from = launchFrom.current;
      if (launching && from?.width && launching.offsetWidth) {
        const { origin, size } = onto(launching, from);
        launching.style.transformOrigin = origin;
        springTo(launching, { scale: "1", "--window-fade": "1" }, windowSpring, { from: { scale: String(size), "--window-fade": "0" } });
      }
    }

    if (before.surface !== "application" || !before.app || (workspace.surface !== "home" && workspace.surface !== "recents")) return;
    const leaving = windowOf(before.app);
    if (!leaving) return;
    // Home takes it back into its icon (a tablet's shelf button); Recents into its card.
    const target = workspace.surface === "home"
      ? [...document.querySelectorAll<HTMLElement>(`.system-launcher-app[data-app="${before.app}"] .system-app-mark, .tablet-shelf [data-app="${before.app}"]`)]
        .map((element) => element.getBoundingClientRect())
        .find((rect) => rect.width > 0)
      : document.querySelector<HTMLElement>(`.system-recent-preview[data-app="${before.app}"]`)?.getBoundingClientRect();
    const { origin, size } = target?.width && leaving.offsetWidth ? onto(leaving, target) : { origin: "50% 100%", size: 0.12 };
    // A window held by the home gesture is already off its seat: re-centre its scaling on the new
    // point without moving it on screen, so it carries on from exactly where the finger left it.
    const held = leaving.dataset.held === "true";
    if (held) {
      const style = getComputedStyle(leaving);
      const scale = Number(style.scale) || 1;
      const [shiftX = 0, shiftY = 0] = style.translate === "none" ? [] : style.translate.split(" ").map(parseFloat);
      const [fromX, fromY] = style.transformOrigin.split(" ").map(parseFloat);
      leaving.style.transformOrigin = origin;
      const [toX, toY] = getComputedStyle(leaving).transformOrigin.split(" ").map(parseFloat);
      leaving.style.translate = `${shiftX + (1 - scale) * (fromX - toX)}px ${shiftY + (1 - scale) * (fromY - toY)}px`;
    } else leaving.style.transformOrigin = origin;
    const layer = leaving.closest<HTMLElement>(".contact-window-layer");
    const settle = () => {
      delete leaving.dataset.leaving;
      if (layer) delete layer.dataset.leaving;
    };
    leaving.dataset.leaving = "true";
    if (layer) layer.dataset.leaving = "true";
    // Shrinking away doesn't overshoot: the spring is fully damped.
    const leave = springTo(leaving, { scale: String(size), translate: "0px 0px", "--window-fade": "0" }, leaveSpring, {
      fill: "forwards",
      from: held ? undefined : { scale: "1", translate: "0px 0px", "--window-fade": "1" },
      velocity: held ? thrown.current : undefined,
    });
    thrown.current = 0;
    leaving.style.removeProperty("translate");
    leaving.style.removeProperty("scale");
    delete leaving.dataset.held;
    if (!leave) { settle(); return; }
    leave.addEventListener("finish", () => { settle(); leave.cancel(); });
    return settle;
  }, [workspace.activeApp, workspace.mode, workspace.surface]);

  /**
   * Records where a launch began, so the opening app grows out of that icon, row, shelf button or
   * Recents card, and marks the launch for its one animation. Only a launch plays it: an app that
   * surfaces again (a sheet closed over it, Recents dismissed, Back) simply appears.
   */
  function noteLaunchOrigin(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    // A Home icon launches from its glyph, not the label under it.
    launchFrom.current = (target.querySelector<HTMLElement>(".system-app-mark") ?? target).getBoundingClientRect();
    const root = document.documentElement;
    root.dataset.launching = "true";
    window.clearTimeout(launchTimer.current);
    launchTimer.current = window.setTimeout(() => { delete root.dataset.launching; }, 400);
  }

  // Tapping the status bar takes the open app back to its top, as on an iPhone or iPad.
  function scrollAppToTop(event: ReactMouseEvent<HTMLElement>) {
    if (workspace.mode === "computer" || workspace.surface !== "application" || !workspace.activeApp) return;
    if ((event.target as HTMLElement).closest("button, a, [role='group']")) return;
    const app = document.querySelector<HTMLElement>(`:is(.portfolio-window, .contact-window)[data-app-id="${workspace.activeApp}"]`);
    if (!app) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    for (const element of [app, ...app.querySelectorAll<HTMLElement>("*")]) {
      if (element.scrollTop > 0) element.scrollTo({ behavior: still ? "auto" : "smooth", top: 0 });
    }
  }

  const homeGesture = useHomeGesture({
    app: () => (workspace.surface === "application" && workspace.activeApp ? document.querySelector<HTMLElement>(`:is(.portfolio-window, .contact-window)[data-app-id="${workspace.activeApp}"]`) : null),
    home: (scaleVelocity) => { thrown.current = scaleVelocity; workspace.goHome(); },
    recents: workspace.openRecents,
  });

  function launchApp(app: PortfolioAppId) {
    if (workspace.launchApp(app)) return;
    // No launcher is mounted on this route; open the session and move to the app's own route.
    workspace.focusApp(app);
    if (window.location.pathname !== "/") router.push(portfolioApp(app).href);
  }

  function openCase(slug: ScenarioSlug) {
    if (workspace.launchApp("work", `case:${slug}`)) return;
    router.push(`/case/${slug}`);
  }

  // On the desktop, an app that starts running hops its taskbar button once, as a Mac's Dock does
  // (not for apps a returning visitor finds already running).
  const runningBefore = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = runningBefore.current;
    runningBefore.current = new Set(runningApps);
    if (!before || workspace.mode !== "computer") return;
    for (const app of runningApps) if (!before.has(app)) hop(document.querySelector<HTMLElement>(`.taskbar-app[data-app="${app}"]`));
  }, [runningApps, workspace.mode]);

  // Closing a Recents card lets the cards beside it slide over into the gap on the window spring,
  // from where they stood before, rather than jumping there.
  const cardsBefore = useRef(new Map<string, DOMRect>());
  function closeRecent(app: PortfolioAppId) {
    cardsBefore.current = new Map([...document.querySelectorAll<HTMLElement>(".system-recent-card[data-app]")].map((card) => [card.dataset.app!, card.getBoundingClientRect()]));
    // Each route host rewrites its own address once the session is gone.
    workspace.closeApp(app);
  }
  const flickAway = useFlickAway((app) => closeRecent(app as PortfolioAppId));
  useLayoutEffect(() => {
    const before = cardsBefore.current;
    if (!before.size) return;
    cardsBefore.current = new Map();
    // The row's snapping would pick a new card to centre while they slide; it waits until they land.
    const list = recentsListRef.current;
    if (list) {
      list.style.scrollSnapType = "none";
      list.scrollLeft = list.scrollWidth;
      window.setTimeout(() => list.style.removeProperty("scroll-snap-type"), springDuration(windowSpring) + 40);
    }
    for (const card of document.querySelectorAll<HTMLElement>(".system-recent-card[data-app]")) {
      const was = before.get(card.dataset.app!);
      const now = card.getBoundingClientRect();
      if (was && (Math.abs(was.left - now.left) > 1 || Math.abs(was.top - now.top) > 1)) {
        springTo(card, { translate: "0px 0px" }, windowSpring, { from: { translate: `${was.left - now.left}px ${was.top - now.top}px` } });
      }
    }
  }, [runningApps.length]);

  function activateFromTaskbar(app: PortfolioAppId) {
    if (workspace.surface === "application" && workspace.activeApp === app && !workspace.isMinimized(app)) {
      workspace.minimizeApp(app);
      return;
    }
    launchApp(app);
  }

  return (
    <>
      <header className="system-status-bar" data-mode={workspace.mode} onClick={scrollAppToTop}>
        <div className="system-brand">
          <span aria-hidden="true" />
          <strong>Fattah</strong>
        </div>
        <div className="system-active-app" aria-live="polite">
          {workspace.surface === "home" ? workspace.mode === "computer" ? "Desktop" : "Home" : workspace.surface === "recents" ? "Recents" : activeEntry?.label ?? "Desktop"}
        </div>
        {/* The tray: the sound level beside the clock, in the bar's last slot. */}
        <div className="system-tray">
          <SoundControl />
          <div className="system-status" role="group" aria-label={`Local time ${clock.time}, ${clock.utc}`}>
            <time>
              {/* Tablet shows the date beside the time, as its status bar does; other modes hide it. */}
              <span className="system-status-date">{clock.shortDate}</span>
              <span>{clock.time}</span>
              <small>{clock.utc}</small>
            </time>
          </div>
        </div>
      </header>

      <section className="system-home-screen" data-mode={workspace.mode} aria-label="Portfolio home screen" aria-hidden={workspace.surface !== "home"} inert={workspace.surface !== "home"}>
        <Wallpaper />
        <div className="home-layout" data-resume={runningApps.length ? "true" : undefined}>
          <div className="home-identity" role="group" aria-label={`${portfolioIdentity.name}, ${portfolioIdentity.role}`}>
            <OwnerMark className="home-identity-mark" />
            <div className="home-identity-copy">
              <h1>{portfolioIdentity.name}</h1>
              <p>{portfolioIdentity.role} · {portfolioIdentity.location}</p>
              <p className="home-identity-focus">{portfolioIdentity.focus}</p>
            </div>
            <div className="home-identity-actions">
              <a className="home-action" href={portfolioIdentity.cv} download onClick={() => play("ui.download")}>CV <DownloadIcon /></a>
              <button className="home-action" onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp("contact"); }} type="button">Contact</button>
            </div>
          </div>

          {runningApps.length ? (
            <button className="system-resume-app" onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp(resumeApp); }} type="button">
              <AppMark app={resumeApp} />
              <span>
                <small>Continue</small>
                <strong>{resumeEntry.label}</strong>
              </span>
              <b aria-hidden="true"><ChevronIcon direction="right" /></b>
            </button>
          ) : null}

          <section className="home-work" aria-labelledby="home-work-title">
            <div className="home-work-head">
              <h2 id="home-work-title">Engineering cases</h2>
              <button onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp("work"); }} type="button">Open Projects <ChevronIcon direction="right" /></button>
            </div>
            <ol>
              {scenarios.map((scenario) => (
                <li key={scenario.slug}>
                  <button className="home-case" data-case={scenario.slug} onClick={(event) => { noteLaunchOrigin(event.currentTarget); openCase(scenario.slug); }} type="button">
                    {/* Phone shows the case number; the cover is drawn only where it can be read. */}
                    <span className="home-case-number" aria-hidden="true">{scenario.number}</span>
                    <CaseCover slug={scenario.slug} />
                    <span className="home-case-copy">
                      <small>{scenario.category}</small>
                      <strong>{scenario.shortTitle}</strong>
                      <span className="home-case-summary">{scenario.consequence}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {/* Tablet only: the larger Home shows the role history the phone leaves to the app. */}
          {workspace.mode === "tablet" ? <section className="home-experience" aria-labelledby="home-experience-title" data-fit={roleFit?.count === 0 ? "none" : undefined}>
            <div className="home-work-head">
              <h2 id="home-experience-title">Experience</h2>
              <button onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp("experience"); }} type="button">Open Experience <ChevronIcon direction="right" /></button>
            </div>
            <ol data-clipped={roleFit ? "true" : undefined} ref={rolesRef} style={roleFit ? { maxBlockSize: roleFit.height } : undefined}>
              {experience.map((item, index) => (
                <li aria-hidden={roleFit && index >= roleFit.count ? true : undefined} className="home-role" key={`${item.company}-${item.period}`}>
                  <small>{item.period}</small>
                  <strong>{item.role}</strong>
                  <span>{item.company}</span>
                </li>
              ))}
            </ol>
          </section> : null}

          <div className="system-launcher" role="group" aria-label="Applications">
            {portfolioApps.map((app) => (
              <button aria-label={`${workspace.isAppOpen(app.id) ? "Switch to" : "Open"} ${app.shortLabel ?? app.label}${workspace.isAppOpen(app.id) ? ", application is running" : ""}`} className="system-launcher-app" data-app={app.id} key={app.id} onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp(app.id); }} type="button">
                <AppMark app={app.id} />
                <strong><span className="system-app-label-full">{app.label}</span><span className="system-app-label-compact">{app.shortLabel ?? app.label}</span></strong>
                {workspace.isAppOpen(app.id) ? <i aria-hidden="true" /> : null}
              </button>
            ))}
          </div>

          <p className="home-clock">
            <span>{clock.date}</span>
            <span>{clock.time} {clock.utc}</span>
          </p>
        </div>
      </section>

      <section className="system-recents" aria-label="Recent applications" aria-hidden={workspace.surface !== "recents"} inert={workspace.surface !== "recents"}>
        <Wallpaper />
        <header>
          <div>
            <h2>Recents</h2>
            <p>{runningApps.length ? `${runningApps.length} ${runningApps.length === 1 ? "app" : "apps"} open` : "No apps open"}</p>
          </div>
          {/* A landscape phone hides the status bar, so its sound level lives here instead. */}
          <SoundControl className="sound-control-recents" />
          <button className="system-recents-home" onClick={workspace.goHome} type="button">Return home</button>
        </header>
        {runningApps.length ? null : <p className="system-recents-empty">Nothing is running. Open an app from Home and it will wait here.</p>}
        <div className="system-recents-list" ref={recentsListRef}>
          {runningApps.map((app) => {
            const entry = portfolioApp(app);
            const current = workspace.activeApp === app && !workspace.isMinimized(app);
            const status = current ? "Active" : workspace.isMinimized(app) ? "Minimized" : "Background";
            return (
              <article className="system-recent-card" data-app={app} data-current={current} key={app} {...flickAway}>
                <button className="system-recent-open" onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp(app); }} type="button" aria-label={`Switch to ${entry.label}. ${status}`}>
                  <div className="system-recent-preview" data-app={app}>
                    <div className="system-recent-preview-bar">
                      <AppMark app={app} small />
                      <span>{entry.label}</span>
                      <small>{status}</small>
                    </div>
                    <div className="system-recent-preview-body">
                      <RecentPreview app={app} />
                    </div>
                  </div>
                </button>
                <button className="system-recent-close" onClick={() => closeRecent(app)} type="button" aria-label={`Close ${entry.label}`}><span aria-hidden="true"><CloseIcon /></span></button>
              </article>
            );
          })}
        </div>
      </section>

      {workspace.mode === "computer" ? <nav className="desktop-taskbar" aria-label="System taskbar">
        <button className="taskbar-home" data-active={workspace.surface === "home"} data-label="Desktop" onClick={workspace.goHome} type="button" aria-label="Show desktop"><SystemIcon name="home" /></button>
        <div className="taskbar-apps" data-warm={captionsWarm || undefined} onPointerEnter={warmCaptions} onPointerLeave={coolCaptions}>
          {portfolioApps.map((app) => {
            const running = workspace.isAppOpen(app.id);
            const active = workspace.surface === "application" && workspace.activeApp === app.id;
            const minimized = workspace.isMinimized(app.id);
            const status = minimized ? "Minimized" : active ? "Active" : running ? "Open in background" : "Not running";
            return (
            <button
              className="taskbar-app"
              data-active={active}
              data-app={app.id}
              data-label={app.label}
              data-running={running}
              data-minimized={minimized}
              key={app.id}
              onClick={() => activateFromTaskbar(app.id)}
              type="button"
              aria-label={`${running ? "Switch to" : "Open"} ${app.label}. ${status}`}
            >
              <AppMark app={app.id} small />
              <span>{app.label}</span>
              <i aria-hidden="true" />
              <span aria-hidden="true" className="taskbar-app-preview">
                <strong>{app.label}</strong>
                <small>{status}</small>
              </span>
            </button>
          )})}
        </div>
        <button className="taskbar-overview" data-active={workspace.surface === "recents"} data-label="Overview" onClick={workspace.openRecents} type="button" aria-label="Application overview"><SystemIcon name="overview" /></button>
      </nav> : null}

      {workspace.mode === "tablet" ? <nav className="tablet-shelf" aria-label="Tablet application shelf" {...homeGesture}>
        <div className="tablet-shelf-group" data-group="system">
          {/* Home has nothing behind it, so Back rests disabled there instead of doing nothing. */}
          <button disabled={workspace.surface === "home"} onClick={workspace.requestBack} type="button" aria-label="Back"><SystemIcon name="back" /><span className="tablet-app-label" aria-hidden="true">Back</span></button>
          <button aria-current={workspace.surface === "home" ? "page" : undefined} data-active={workspace.surface === "home"} onClick={workspace.goHome} type="button" aria-label="Home"><SystemIcon name="home" /><span className="tablet-app-label" aria-hidden="true">Home</span></button>
        </div>
        <div className="tablet-shelf-group" data-group="apps">
        {portfolioApps.map((app) => {
          const running = workspace.isAppOpen(app.id);
          const active = workspace.surface === "application" && workspace.activeApp === app.id;
          const minimized = workspace.isMinimized(app.id);
          const state = minimized ? "Minimized" : active ? "Active" : running ? "Open in background" : "Not running";
          return (
            <button
              aria-label={`${running ? "Switch to" : "Open"} ${app.shortLabel ?? app.label}. ${state}`}
              data-active={active}
              data-app={app.id}
              data-minimized={minimized}
              data-running={running}
              key={app.id}
              onClick={(event) => { if (!active) noteLaunchOrigin(event.currentTarget); launchApp(app.id); }}
              type="button"
            >
              <AppMark app={app.id} />
              <span className="tablet-app-label" aria-hidden="true">{app.shortLabel ?? app.label}</span>
              {running ? <i aria-hidden="true" /> : null}
            </button>
          );
        })}
        </div>
        <div className="tablet-shelf-group" data-group="system">
        <button aria-pressed={workspace.surface === "recents"} data-active={workspace.surface === "recents"} onClick={workspace.surface === "recents" ? workspace.dismissRecents : workspace.openRecents} type="button" aria-label="Recents"><SystemIcon name="overview" /><span className="tablet-app-label" aria-hidden="true">Recents</span></button>
        {workspace.capabilities.pairingEligible && workspace.isAppOpen("work") && workspace.isAppOpen("experience") ? <button className="tablet-pair-control" aria-pressed={workspace.paired} onClick={() => {
          workspace.setPaired(!workspace.paired);
          // Projects ends up focused, so its launcher also rewrites the address to the visible document.
          workspace.focusApp("experience");
          launchApp("work");
        }} type="button"><PairIcon className="system-control-icon" /><span className="tablet-pair-label">Side by side</span></button> : null}
        </div>
      </nav> : null}

      {workspace.mode === "phone" ? <nav className="phone-system-navigation" aria-label="Phone system navigation" {...homeGesture}>
        {/* Home is the bottom of the phone's stack, so Back rests disabled there, as on the tablet shelf. */}
        <button disabled={workspace.surface === "home"} onClick={workspace.requestBack} type="button" aria-label="Back"><SystemIcon name="back" /><span>Back</span></button>
        <button aria-current={workspace.surface === "home" ? "page" : undefined} data-active={workspace.surface === "home"} onClick={workspace.goHome} type="button" aria-label="Home"><SystemIcon name="home" /><span>Home</span></button>
        <button aria-pressed={workspace.surface === "recents"} data-active={workspace.surface === "recents"} onClick={workspace.surface === "recents" ? workspace.dismissRecents : workspace.openRecents} type="button" aria-label="Recents"><SystemIcon name="overview" /><span>Recents</span></button>
      </nav> : null}
    </>
  );
}
