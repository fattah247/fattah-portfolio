"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useWorkspaceManager,
  type PortfolioAppId,
} from "./workspace-manager";
import { portfolioApp, portfolioApps } from "./app-registry";
import { portfolioIdentity } from "../lib/portfolio-identity";
import { decodeWorkspaceRoute } from "../lib/workspace-navigation";
import { ChevronIcon, CloseIcon, DownloadIcon, PairIcon } from "./icons";
import { AppIcon, OwnerMark } from "./app-icons";
import { CaseCover } from "./case-cover";
import { Wallpaper } from "./wallpaper";
import { experience } from "../lib/content";
import { filterProductLinks, indexProductLinks, productLinks, searchProductLinks, type Marketplace } from "../lib/product-links";
import { scenarios, type ScenarioSlug } from "../lib/scenarios";

function appForRoute(pathname: string): PortfolioAppId | null {
  return decodeWorkspaceRoute(pathname).app;
}

function SystemGlyph({ name }: { name: "back" | "home" | "overview" }) {
  if (name === "back") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15.5 5 8.5 12l7 7" /></svg>;
  if (name === "home") return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="5" width="5" height="5" /><rect x="14" y="5" width="5" height="5" /><rect x="5" y="14" width="5" height="5" /><rect x="14" y="14" width="5" height="5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="7" width="11" height="12" /><path d="M8 4h11v12" /></svg>;
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
        {scenarios.map((item) => <b key={item.slug}><span className="recent-preview-extra">{item.number} </span>{item.shortTitle}</b>)}
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
      <small>{directory?.query ? `Search: ${directory.query}` : "Catalogue"}</small>
      <b>{results.length} {results.length === 1 ? "product" : "products"}</b>
      <ul className="recent-preview-extra">{results.slice(0, 6).map((product) => <li key={product.id}>{product.name}</li>)}</ul>
    </div>
  );
}

export function SystemShell() {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspaceManager();
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

  // Recents reads oldest to newest; entering it lands on the newest card with the previous one peeking.
  useLayoutEffect(() => {
    if (workspace.surface !== "recents") return;
    const list = recentsListRef.current;
    if (list) list.scrollLeft = list.scrollWidth;
  }, [workspace.surface, runningApps.length]);
  const resumeEntry = portfolioApp(resumeApp);

  // When an app closes and takes the keyboard focus with it, focus returns to that app's own
  // taskbar or shelf button, so a keyboard user continues from where the app lived.
  const previousRunning = useRef<PortfolioAppId[]>([]);
  useEffect(() => {
    const closed = previousRunning.current.filter((app) => !runningApps.includes(app));
    previousRunning.current = runningApps;
    if (!closed.length) return;
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && document.contains(active)) return;
      document.querySelector<HTMLElement>(`.taskbar-app[data-app="${closed[0]}"], nav.tablet-shelf button[data-app="${closed[0]}"]`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [runningApps]);

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

  useEffect(() => {
    const preventPageContextMenu = (event: globalThis.MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".desktop-surface") && !target.closest("a, button, input, textarea")) event.preventDefault();
    };
    document.addEventListener("contextmenu", preventPageContextMenu);
    return () => document.removeEventListener("contextmenu", preventPageContextMenu);
  }, []);

  /** Records where a launch began so the opening app can grow out of that icon or row. */
  function noteLaunchOrigin(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    document.documentElement.style.setProperty("--launch-x", `${Math.round(rect.left + rect.width / 2)}px`);
    document.documentElement.style.setProperty("--launch-y", `${Math.round(rect.top + rect.height / 2)}px`);
  }

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

  function closeRecent(app: PortfolioAppId) {
    // Each route host rewrites its own address once the session is gone.
    workspace.closeApp(app);
  }

  function activateFromTaskbar(app: PortfolioAppId) {
    if (workspace.surface === "application" && workspace.activeApp === app && !workspace.isMinimized(app)) {
      workspace.minimizeApp(app);
      return;
    }
    launchApp(app);
  }

  return (
    <>
      <header className="system-status-bar" data-mode={workspace.mode}>
        <div className="system-brand">
          <span aria-hidden="true" />
          <strong>Fattah</strong>
        </div>
        <div className="system-active-app" aria-live="polite">
          {workspace.surface === "home" ? workspace.mode === "computer" ? "Desktop" : "Home" : workspace.surface === "recents" ? "Recents" : activeEntry?.label ?? "Desktop"}
        </div>
        <div className="system-status" role="group" aria-label={`Local time ${clock.time}, ${clock.utc}`}>
          <time>
            {/* Tablet shows the date beside the time, as its status bar does; other modes hide it. */}
            <span className="system-status-date">{clock.shortDate}</span>
            <span>{clock.time}</span>
            <small>{clock.utc}</small>
          </time>
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
              <a className="home-action" href={portfolioIdentity.cv} download>CV <DownloadIcon /></a>
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
              <button onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp("work"); }} type="button">All projects <ChevronIcon direction="right" /></button>
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
          {workspace.mode === "tablet" ? <section className="home-experience" aria-labelledby="home-experience-title">
            <div className="home-work-head">
              <h2 id="home-experience-title">Experience</h2>
              <button onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp("experience"); }} type="button">Open Experience <ChevronIcon direction="right" /></button>
            </div>
            <ol>
              {experience.map((item) => (
                <li className="home-role" key={`${item.company}-${item.period}`}>
                  <small>{item.period}</small>
                  <strong>{item.role}</strong>
                  <span>{item.company}</span>
                </li>
              ))}
            </ol>
          </section> : null}

          <div className="system-launcher" role="group" aria-label="Applications">
            {portfolioApps.map((app) => (
              <button aria-label={`${workspace.isAppOpen(app.id) ? "Switch to" : "Open"} ${app.label}${workspace.isAppOpen(app.id) ? ", application is running" : ""}`} className="system-launcher-app" data-app={app.id} key={app.id} onClick={(event) => { noteLaunchOrigin(event.currentTarget); launchApp(app.id); }} type="button">
                <AppMark app={app.id} />
                <strong><span className="system-app-label-full">{app.label}</span><span className="system-app-label-compact">{app.shortLabel ?? app.label}</span></strong>
                {workspace.isAppOpen(app.id) ? <i aria-hidden="true" /> : null}
              </button>
            ))}
          </div>

          <p className="home-clock" aria-label={`${clock.date}, ${clock.time}, ${clock.utc}`}>
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
            <p>{runningApps.length ? `${runningApps.length} ${runningApps.length === 1 ? "app" : "apps"} open` : "No apps open."}</p>
          </div>
          <button onClick={workspace.goHome} type="button">Return home</button>
        </header>
        {runningApps.length ? null : <p className="system-recents-empty">Nothing is running. Open an app from Home and it will wait here.</p>}
        <div className="system-recents-list" ref={recentsListRef}>
          {runningApps.map((app) => {
            const entry = portfolioApp(app);
            const current = workspace.activeApp === app && !workspace.isMinimized(app);
            const status = current ? "Active" : workspace.isMinimized(app) ? "Minimized" : "Background";
            return (
              <article className="system-recent-card" data-current={current} key={app}>
                <button className="system-recent-open" onClick={() => launchApp(app)} type="button" aria-label={`Switch to ${entry.label}. ${status}`}>
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
        <button className="taskbar-home" data-active={workspace.surface === "home"} data-label="Desktop" onClick={workspace.goHome} type="button" aria-label="Show desktop"><SystemGlyph name="home" /></button>
        <div className="taskbar-apps">
          {portfolioApps.map((app) => {
            const running = workspace.isAppOpen(app.id);
            const active = workspace.surface === "application" && workspace.activeApp === app.id;
            const minimized = workspace.isMinimized(app.id);
            const previewId = `taskbar-preview-${app.id}`;
            const status = minimized ? "Minimized" : active ? "Active" : running ? "Open in background" : "Not running";
            return (
            <button
              className="taskbar-app"
              aria-describedby={previewId}
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
              <span className="taskbar-app-preview" id={previewId} role="tooltip">
                <strong>{app.label}</strong>
                <small>{status}</small>
              </span>
            </button>
          )})}
        </div>
        <button className="taskbar-overview" data-active={workspace.surface === "recents"} data-label="Overview" onClick={workspace.openRecents} type="button" aria-label="Application overview"><SystemGlyph name="overview" /></button>
      </nav> : null}

      {workspace.mode === "tablet" ? <nav className="tablet-shelf" aria-label="Tablet application shelf">
        <div className="tablet-shelf-group" data-group="system">
          {/* Home has nothing behind it, so Back rests disabled there instead of doing nothing. */}
          <button disabled={workspace.surface === "home"} onClick={workspace.requestBack} type="button" aria-label="Back"><SystemGlyph name="back" /><span className="tablet-app-label" aria-hidden="true">Back</span></button>
          <button data-active={workspace.surface === "home"} onClick={workspace.goHome} type="button" aria-label="Home"><SystemGlyph name="home" /><span className="tablet-app-label" aria-hidden="true">Home</span></button>
        </div>
        <div className="tablet-shelf-group" data-group="apps">
        {portfolioApps.map((app) => {
          const running = workspace.isAppOpen(app.id);
          const active = workspace.surface === "application" && workspace.activeApp === app.id;
          const minimized = workspace.isMinimized(app.id);
          const state = minimized ? "Minimized" : active ? "Active" : running ? "Open in background" : "Not running";
          return (
            <button
              aria-label={`${running ? "Switch to" : "Open"} ${app.label}. ${state}`}
              data-active={active}
              data-app={app.id}
              data-minimized={minimized}
              data-running={running}
              key={app.id}
              onClick={() => launchApp(app.id)}
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
        <button data-active={workspace.surface === "recents"} onClick={workspace.surface === "recents" ? workspace.dismissRecents : workspace.openRecents} type="button" aria-label="Recents"><SystemGlyph name="overview" /><span className="tablet-app-label" aria-hidden="true">Recents</span></button>
        {workspace.capabilities.pairingEligible && workspace.isAppOpen("work") && workspace.isAppOpen("experience") ? <button className="tablet-pair-control" aria-label="Pair Projects and Experience" aria-pressed={workspace.paired} onClick={() => {
          workspace.setPaired(!workspace.paired);
          // Projects ends up focused, so its launcher also rewrites the address to the visible document.
          workspace.focusApp("experience");
          launchApp("work");
        }} type="button"><PairIcon className="system-control-icon" /><span className="tablet-pair-label" aria-hidden="true">{workspace.paired ? "Single" : "Side by side"}</span></button> : null}
        </div>
      </nav> : null}

      {workspace.mode === "phone" ? <nav className="phone-system-navigation" aria-label="Phone system navigation">
        {/* Home is the bottom of the phone's stack, so Back rests disabled there, as on the tablet shelf. */}
        <button disabled={workspace.surface === "home"} onClick={workspace.requestBack} type="button" aria-label="Back"><SystemGlyph name="back" /><span>Back</span></button>
        <button data-active={workspace.surface === "home"} onClick={workspace.goHome} type="button" aria-label="Home"><SystemGlyph name="home" /><span>Home</span></button>
        <button data-active={workspace.surface === "recents"} onClick={workspace.surface === "recents" ? workspace.dismissRecents : workspace.openRecents} type="button" aria-label="Recents"><SystemGlyph name="overview" /><span>Recents</span></button>
      </nav> : null}
    </>
  );
}
