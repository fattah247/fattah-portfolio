"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useWorkspaceManager,
  type PortfolioAppId,
} from "./workspace-manager";
import { portfolioApp, portfolioApps } from "./app-registry";

function appForRoute(pathname: string): PortfolioAppId | null {
  if (pathname === "/products" || pathname.startsWith("/products/")) return "products";
  if (pathname === "/brief" || pathname.startsWith("/brief/")) return "experience";
  if (
    pathname === "/evidence"
    || pathname.startsWith("/evidence/")
    || pathname.startsWith("/case/")
  ) return "work";
  return null;
}

function SystemGlyph({ name }: { name: "back" | "home" | "overview" }) {
  if (name === "back") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15.5 5 8.5 12l7 7" /></svg>;
  if (name === "home") return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="5" width="5" height="5" /><rect x="14" y="5" width="5" height="5" /><rect x="5" y="14" width="5" height="5" /><rect x="14" y="14" width="5" height="5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="7" width="11" height="12" /><path d="M8 4h11v12" /></svg>;
}

export function AppMark({ app }: { app: PortfolioAppId }) {
  const icon = app === "work" ? (
    <svg viewBox="0 0 24 24"><path d="M3.5 7.5h6l1.7-2h9.3v13h-17z" /><path d="M3.5 9.5h17" /></svg>
  ) : app === "experience" ? (
    <svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" /><circle cx="9" cy="9" r="2.2" /><path d="M6.5 15c.7-1.5 1.7-2.3 2.7-2.3s2 .8 2.7 2.3M14 8h3.5M14 11h3.5M14 15h3.5" /></svg>
  ) : app === "contact" ? (
    <svg viewBox="0 0 24 24"><path d="M4 5.5h16v13H4z" /><path d="m5 7 7 5 7-5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z" /><path d="M13 16.5h7M16.5 13v7" /></svg>
  );

  return <span className="system-app-mark" data-app={app} aria-hidden="true">{icon}</span>;
}

export function SystemShell() {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspaceManager();
  const [clock, setClock] = useState({ date: "", time: "--:--", utc: "UTC" });
  const productPage = pathname.startsWith("/products");
  const runningApps = useMemo(
    () => workspace.recentApps.filter((app) => workspace.isAppOpen(app)),
    [workspace],
  );
  const routeOwner = appForRoute(pathname);
  const activeEntry = portfolioApps.find((app) => app.id === (routeOwner ?? workspace.activeApp));
  const resumeApp = runningApps.at(-1) ?? "work";
  const resumeEntry = portfolioApp(resumeApp);

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
      const offsetMinutes = -now.getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? "+" : "−";
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const minutes = Math.abs(offsetMinutes) % 60;
      const utc = offsetMinutes === 0
        ? "UTC"
        : `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;

      setClock({ date, time, utc });
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function launchApp(app: PortfolioAppId) {
    const alreadyOpen = workspace.isAppOpen(app);
    workspace.focusApp(app);
    if (pathname !== "/" && !(app === "products" && productPage)) router.push("/");
    if (!alreadyOpen && app === "work") window.dispatchEvent(new Event("portfolio-open-work"));
    if (!alreadyOpen && app === "experience") window.dispatchEvent(new Event("portfolio-open-experience"));
    if (!alreadyOpen && app === "contact") window.dispatchEvent(new Event("portfolio-contact-open"));
    if (!alreadyOpen && app === "products") window.dispatchEvent(new Event("portfolio-open-products"));
  }

  function closeRecent(app: PortfolioAppId) {
    workspace.closeApp(app);
    if (appForRoute(pathname) === app) router.push("/");
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
        <div className="system-brand" aria-label="Fattah workspace">
          <span aria-hidden="true" />
          <strong>Fattah</strong>
        </div>
        <div className="system-active-app" aria-live="polite">
          {workspace.surface === "home" ? workspace.mode === "computer" ? "Desktop" : "Home" : workspace.surface === "recents" ? "Application overview" : activeEntry?.label ?? "Desktop"}
        </div>
        <div className="system-status" aria-label={`Local time ${clock.time}, ${clock.utc}`}>
          <time>
            <span>{clock.time}</span>
            <small>{clock.utc}</small>
          </time>
        </div>
      </header>

      <section className="system-home-screen" data-mode={workspace.mode} aria-label="Portfolio home screen" aria-hidden={workspace.surface !== "home"}>
        <div className="system-home-dashboard">
          <div className="system-home-time" aria-label={`${clock.date}, ${clock.time}, ${clock.utc}`}>
            <strong>{clock.time}</strong>
            <span>{clock.date}</span>
            <small>{clock.utc}</small>
          </div>
          <div className="system-home-intro">
            <p>Software Engineer · Indonesia</p>
            <h1>Muhammad A. Fattah</h1>
            <span>Android POS and merchant payment systems</span>
          </div>
          <button aria-label={`${runningApps.length ? "Continue" : "Open"} ${resumeEntry.label}`} className="system-resume-app" onClick={() => launchApp(resumeApp)} type="button">
            <AppMark app={resumeApp} />
            <span>
              <small>{runningApps.length ? "Continue" : "Start here"}</small>
              <strong>{resumeEntry.label}</strong>
            </span>
            <b aria-hidden="true">↗</b>
          </button>
        </div>
        <div className="system-launcher" aria-label="Applications">
          {portfolioApps.map((app) => (
            <button aria-label={`${workspace.isAppOpen(app.id) ? "Switch to" : "Open"} ${app.label}${workspace.isAppOpen(app.id) ? ", application is running" : ""}`} className="system-launcher-app" key={app.id} onClick={() => launchApp(app.id)} type="button">
              <AppMark app={app.id} />
              <strong><span className="system-app-label-full">{app.label}</span><span className="system-app-label-compact">{app.shortLabel ?? app.label}</span></strong>
              <span>{app.description}</span>
              {workspace.isAppOpen(app.id) ? <i aria-label="Application is open" /> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="system-recents" aria-label="Recent applications" aria-hidden={workspace.surface !== "recents"}>
        <header>
          <div>
            <p>Open applications</p>
            <h2>{runningApps.length ? `${runningApps.length} ${runningApps.length === 1 ? "app" : "apps"} open.` : "No apps open."}</h2>
          </div>
          <button onClick={workspace.goHome} type="button">Return home</button>
        </header>
        <div className="system-recents-list">
          {[...runningApps].reverse().map((app) => {
            const entry = portfolioApp(app);
            const current = workspace.activeApp === app && !workspace.isMinimized(app);
            return (
              <article className="system-recent-card" data-current={current} key={app}>
                <button className="system-recent-open" onClick={() => launchApp(app)} type="button" aria-label={`Switch to ${entry.label}`}>
                  <div className="system-recent-preview" data-app={app}>
                    <div className="system-recent-preview-bar">
                      <AppMark app={app} />
                      <span>{entry.label}</span>
                      <small>{current ? "Active" : workspace.isMinimized(app) ? "Minimized" : "Background"}</small>
                    </div>
                    <div className="system-recent-preview-body">
                      <b>{entry.description}</b>
                      <span>Restore application</span>
                    </div>
                  </div>
                  <span>{workspace.isMinimized(app) ? "Minimized" : current ? "Current application" : "Open in background"}</span>
                </button>
                <button className="system-recent-close" onClick={() => closeRecent(app)} type="button" aria-label={`Close ${entry.label}`}><span>×</span></button>
              </article>
            );
          })}
        </div>
      </section>

      <nav className="desktop-taskbar" aria-label="System taskbar">
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
              data-label={app.label}
              data-running={running}
              data-minimized={minimized}
              key={app.id}
              onClick={() => activateFromTaskbar(app.id)}
              type="button"
              aria-label={`${running ? "Switch to" : "Open"} ${app.label}. ${status}`}
            >
              <AppMark app={app.id} />
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
      </nav>

      <nav className="tablet-shelf" aria-label="Tablet application shelf">
        <button onClick={workspace.requestBack} type="button" aria-label="Back"><SystemGlyph name="back" /></button>
        <button data-active={workspace.surface === "home"} onClick={workspace.goHome} type="button" aria-label="Home"><SystemGlyph name="home" /></button>
        {portfolioApps.map((app) => {
          const running = workspace.isAppOpen(app.id);
          const active = workspace.surface === "application" && workspace.activeApp === app.id;
          const minimized = workspace.isMinimized(app.id);
          const state = minimized ? "Minimized" : active ? "Active" : running ? "Open in background" : "Not running";
          return (
            <button
              aria-label={`${running ? "Switch to" : "Open"} ${app.label}. ${state}`}
              data-active={active}
              data-minimized={minimized}
              data-running={running}
              key={app.id}
              onClick={() => launchApp(app.id)}
              type="button"
            >
              <AppMark app={app.id} />
              <span className="tablet-app-label">{app.shortLabel ?? app.label}</span>
              {running ? <i aria-hidden="true" /> : null}
            </button>
          );
        })}
        <button data-active={workspace.surface === "recents"} onClick={workspace.openRecents} type="button" aria-label="Application overview"><SystemGlyph name="overview" /></button>
      </nav>

      <nav className="phone-system-navigation" aria-label="Phone system navigation">
        <button onClick={workspace.requestBack} type="button" aria-label="Back"><SystemGlyph name="back" /><span>Back</span></button>
        <button data-active={workspace.surface === "home"} onClick={workspace.goHome} type="button" aria-label="Home"><SystemGlyph name="home" /><span>Home</span></button>
        <button data-active={workspace.surface === "recents"} onClick={workspace.surface === "recents" ? workspace.dismissRecents : workspace.openRecents} type="button" aria-label="Recents"><SystemGlyph name="overview" /><span>Recents</span></button>
      </nav>
    </>
  );
}
