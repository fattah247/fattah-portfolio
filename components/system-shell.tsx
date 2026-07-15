"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useWorkspaceManager,
  type PortfolioAppId,
} from "@/components/workspace-manager";

const apps: Array<{
  description: string;
  glyph: string;
  id: PortfolioAppId;
  label: string;
}> = [
  { id: "work", label: "Work", glyph: "W", description: "Engineering cases and evidence" },
  { id: "experience", label: "Experience", glyph: "CV", description: "Role history and résumé" },
  { id: "contact", label: "Contact", glyph: "@", description: "Email and public profile" },
];

function SystemGlyph({ name }: { name: "back" | "home" | "overview" }) {
  if (name === "back") return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15.5 5 8.5 12l7 7" /></svg>;
  if (name === "home") return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5.5" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="6" y="5" width="12" height="14" rx="1.5" /></svg>;
}

function AppMark({ app }: { app: PortfolioAppId }) {
  const entry = apps.find((item) => item.id === app)!;
  return <span className="system-app-mark" data-app={app} aria-hidden="true">{entry.glyph}</span>;
}

export function SystemShell() {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspaceManager();
  const [clock, setClock] = useState({ time: "--:--", utc: "UTC" });
  const runningApps = useMemo(
    () => workspace.recentApps.filter((app) => workspace.isAppOpen(app)),
    [workspace],
  );
  const activeEntry = apps.find((app) => app.id === workspace.activeApp);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const time = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
      }).format(now);
      const offsetMinutes = -now.getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? "+" : "−";
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const minutes = Math.abs(offsetMinutes) % 60;
      const utc = offsetMinutes === 0
        ? "UTC"
        : `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;

      setClock({ time, utc });
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function launchApp(app: PortfolioAppId) {
    const alreadyOpen = workspace.isAppOpen(app);
    workspace.focusApp(app);
    if (pathname !== "/") router.push("/");
    if (!alreadyOpen && app === "work") window.dispatchEvent(new Event("portfolio-open-work"));
    if (!alreadyOpen && app === "experience") window.dispatchEvent(new Event("portfolio-open-experience"));
    if (!alreadyOpen && app === "contact") window.dispatchEvent(new Event("portfolio-contact-open"));
  }

  function closeRecent(app: PortfolioAppId) {
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
        <button className="system-brand" onClick={workspace.goHome} type="button" aria-label="Show portfolio desktop">
          <span aria-hidden="true" />
          <strong>Fattah OS</strong>
        </button>
        <div className="system-active-app" aria-live="polite">
          {workspace.surface === "home" ? "Desktop" : workspace.surface === "recents" ? "Application overview" : activeEntry?.label ?? "Desktop"}
        </div>
        <div className="system-status" aria-label={`Local time ${clock.time}, ${clock.utc}`}>
          <time>
            <span>{clock.time}</span>
            <small>{clock.utc}</small>
          </time>
        </div>
      </header>

      <section className="system-home-screen" aria-label="Portfolio home screen" aria-hidden={workspace.surface !== "home"}>
        <div className="system-home-intro">
          <p>Software Engineer · Indonesia</p>
          <h1>Muhammad A. Fattah</h1>
          <span>Android POS and merchant payment systems</span>
        </div>
        <div className="system-launcher" aria-label="Applications">
          {apps.map((app) => (
            <button className="system-launcher-app" key={app.id} onClick={() => launchApp(app.id)} type="button">
              <AppMark app={app.id} />
              <strong>{app.label}</strong>
              <span>{app.description}</span>
              {workspace.isAppOpen(app.id) ? <i aria-label="Application is open" /> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="system-recents" aria-label="Recent applications" aria-hidden={workspace.surface !== "recents"}>
        <header>
          <div>
            <p>Application overview</p>
            <h2>{runningApps.length ? "Continue where you left off." : "No applications are open."}</h2>
          </div>
          <button onClick={workspace.goHome} type="button">Return home</button>
        </header>
        <div className="system-recents-list">
          {[...runningApps].reverse().map((app) => {
            const entry = apps.find((item) => item.id === app)!;
            const current = workspace.surface === "application" && workspace.activeApp === app;
            return (
              <article className="system-recent-card" data-current={current} key={app}>
                <button className="system-recent-open" onClick={() => launchApp(app)} type="button" aria-label={`Switch to ${entry.label}`}>
                  <div className="system-recent-preview" data-app={app}>
                    <span>{entry.label}</span>
                    <b>{entry.description}</b>
                    <i />
                  </div>
                  <span>{workspace.isMinimized(app) ? "Minimized" : current ? "Current application" : "Open in background"}</span>
                </button>
                <button className="system-recent-close" onClick={() => closeRecent(app)} type="button" aria-label={`Close ${entry.label}`}>×</button>
              </article>
            );
          })}
        </div>
      </section>

      <nav className="desktop-taskbar" aria-label="System taskbar">
        <button className="taskbar-home" onClick={workspace.goHome} type="button" aria-label="Show desktop"><SystemGlyph name="home" /></button>
        <div className="taskbar-apps">
          {apps.map((app) => (
            <button
              className="taskbar-app"
              data-active={workspace.surface === "application" && workspace.activeApp === app.id}
              data-running={workspace.isAppOpen(app.id)}
              data-minimized={workspace.isMinimized(app.id)}
              key={app.id}
              onClick={() => activateFromTaskbar(app.id)}
              type="button"
              aria-label={`${workspace.isAppOpen(app.id) ? "Switch to" : "Open"} ${app.label}`}
            >
              <AppMark app={app.id} />
              <span>{app.label}</span>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
        <button className="taskbar-overview" onClick={workspace.openRecents} type="button">Overview</button>
      </nav>

      <nav className="tablet-shelf" aria-label="Tablet application shelf">
        <button onClick={workspace.requestBack} type="button" aria-label="Back"><SystemGlyph name="back" /></button>
        <button onClick={workspace.goHome} type="button" aria-label="Home"><SystemGlyph name="home" /></button>
        {apps.map((app) => (
          <button data-active={workspace.surface === "application" && workspace.activeApp === app.id} key={app.id} onClick={() => launchApp(app.id)} type="button" aria-label={`Open ${app.label}`}>
            <AppMark app={app.id} />
            {workspace.isAppOpen(app.id) ? <i aria-hidden="true" /> : null}
          </button>
        ))}
        <button onClick={workspace.openRecents} type="button" aria-label="Application overview"><SystemGlyph name="overview" /></button>
      </nav>

      <nav className="phone-system-navigation" aria-label="Phone system navigation">
        <button onClick={workspace.requestBack} type="button" aria-label="Back"><SystemGlyph name="back" /><span>Back</span></button>
        <button onClick={workspace.goHome} type="button" aria-label="Home"><SystemGlyph name="home" /><span>Home</span></button>
        <button onClick={workspace.surface === "recents" ? workspace.dismissRecents : workspace.openRecents} type="button" aria-label="Recents"><SystemGlyph name="overview" /><span>Recents</span></button>
      </nav>
    </>
  );
}
