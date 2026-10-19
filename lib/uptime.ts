/*
 * Case 02's model, taken from the iYup repo (fattah247/iYup) so the site says what the code does:
 *
 * - two agents, `lab-a` and `lab-b`, check the same page every 30 s (`config.go`: interval 30s,
 *   timeout 10s, 2 retries); a check is up or down with a reason from the agent's closed set
 *   (`probe.go`: ok, http_5xx, body_mismatch, …), and up-but-slow when its own time passes the
 *   target's `degraded_after` (the demo's slow page: 1 s; it answers in 1.2–1.8 s);
 * - a region's result is unknown once it is older than its stale budget (2 × interval + the worst
 *   case check, 91.5 s); missing data is never down and never 0%;
 * - the verdict is a majority of the fresh regions (`snapshot.py` `target_status`): down when more
 *   than half are down, slow when more than half of the up regions are slow, a tie counts as up,
 *   and with no fresh region the target is unknown;
 * - the status page's headline follows (`status.js` `heroCopy`): "Yup." operational, "Yup…
 *   mostly." degraded, "Nope." outage, "Hold on…" unknown;
 * - the alerts (`config/alert.rules.yml`) fire after their `for:` time: TargetDown 1 m (critical,
 *   pages), TargetSlow 5 m, TargetRegionalFailure 5 m, PingAgentDown 2 m (warnings, notify); a
 *   TargetDown mutes the slow and regional alerts for the target (Alertmanager inhibition).
 *
 * Alongside it, `naive` reads the same page the way a health-only monitor in one region does. It is
 * a comparison for the site, not code from the repo.
 */

export const CHECK_INTERVAL_S = 30;
export const CHECK_TIMEOUT_S = 10;
/** The demo slow page's threshold (`degraded_after: 1s`). */
export const DEGRADED_AFTER_MS = 1000;
export const STALE_AFTER_S = 91.5;
export const regions = ["lab-a", "lab-b"] as const;
export type Region = (typeof regions)[number];

export type PageBehaviour = "quick" | "slow" | "error" | "wrong-content";
export type UptimeConditions = { page: PageBehaviour; scope: "both" | "lab-b"; agent: "reporting" | "stopped" };

export type Reason = "ok" | "http_5xx" | "body_mismatch";
export type RegionState = "up" | "down" | "unknown";
export type Verdict = "up" | "slow" | "down" | "unknown";
export type AlertName = "TargetDown" | "TargetSlow" | "TargetRegionalFailure" | "PingAgentDown";

export type CheckResult = { region: Region; up: boolean; latencyMs: number; reason: Reason; slow: boolean; at: number };
export type RegionView = { region: Region; state: RegionState; slow: boolean; reason: Reason | "pending"; latencyMs: number | null; stale: boolean; reporting: boolean };

/** How long an alert's condition must hold before it fires, in checks (30 s each). */
export const alertFor: Record<AlertName, number> = { TargetDown: 2, TargetSlow: 10, TargetRegionalFailure: 10, PingAgentDown: 4 };
export const alertSeverity: Record<AlertName, "critical" | "warning"> = { TargetDown: "critical", TargetSlow: "warning", TargetRegionalFailure: "warning", PingAgentDown: "warning" };

export type AlertState = { name: AlertName; pendingFor: number; firing: boolean; muted: boolean };

export type Tick = {
  /** Checks since the run began; each is 30 s. */
  n: number;
  results: CheckResult[];
  views: RegionView[];
  verdict: Verdict;
  headline: string;
  alerts: AlertState[];
};

/** The page's own time for a check: quick pages wobble around 0.2 s, the slow page sits at 1.2–1.8 s. */
function pageTime(behaviour: PageBehaviour, region: Region, n: number) {
  const wobble = [0, 34, -22, 51, -9, 18, -40, 27][(n + (region === "lab-b" ? 3 : 0)) % 8];
  if (behaviour === "slow") return 1500 + wobble * 6;
  if (behaviour === "error") return 12 + Math.abs(wobble) / 4;
  return 210 + wobble;
}

function check(conditions: UptimeConditions, region: Region, n: number): CheckResult | null {
  if (region === "lab-b" && conditions.agent === "stopped") return null;
  const affected = conditions.scope === "both" || region === "lab-b";
  const behaviour: PageBehaviour = affected ? conditions.page : "quick";
  const latencyMs = Math.round(pageTime(behaviour, region, n));
  if (behaviour === "error") return { region, up: false, latencyMs, reason: "http_5xx", slow: false, at: n };
  if (behaviour === "wrong-content") return { region, up: false, latencyMs, reason: "body_mismatch", slow: false, at: n };
  return { region, up: true, latencyMs, reason: "ok", slow: latencyMs > DEGRADED_AFTER_MS, at: n };
}

/** Results older than the stale budget no longer count. */
const staleAfterChecks = Math.floor(STALE_AFTER_S / CHECK_INTERVAL_S);

function regionView(region: Region, last: CheckResult | undefined, n: number, reporting: boolean): RegionView {
  if (!last) return { region, state: "unknown", slow: false, reason: "pending", latencyMs: null, stale: false, reporting };
  const stale = n - last.at > staleAfterChecks;
  if (stale) return { region, state: "unknown", slow: false, reason: last.reason, latencyMs: null, stale: true, reporting };
  return { region, state: last.up ? "up" : "down", slow: last.slow, reason: last.reason, latencyMs: last.latencyMs, stale: false, reporting };
}

/** The majority verdict over fresh regions, as `target_status` computes it. */
export function verdictOf(views: RegionView[]): Verdict {
  const fresh = views.filter((view) => view.state !== "unknown");
  if (!fresh.length) return "unknown";
  const down = fresh.filter((view) => view.state === "down").length;
  if (down * 2 > fresh.length) return "down";
  const up = fresh.filter((view) => view.state === "up");
  return up.filter((view) => view.slow).length * 2 > up.length ? "slow" : "up";
}

/** The status page's headline for one target. */
export const headlineOf: Record<Verdict, string> = { up: "Yup.", slow: "Yup… mostly.", down: "Nope.", unknown: "Hold on…" };

/** Runs the page for `count` checks under the conditions, each check after the last. */
export function runUptime(conditions: UptimeConditions, count: number, from: Tick[] = []): Tick[] {
  const ticks = [...from];
  for (let i = 0; i < count; i++) {
    const n = (ticks.at(-1)?.n ?? -1) + 1;
    const previous = ticks.at(-1);
    const lastOf = (region: Region) => {
      const now = check(conditions, region, n);
      if (now) return now;
      for (let t = ticks.length - 1; t >= 0; t--) { const hit = ticks[t].results.find((result) => result.region === region); if (hit) return hit; }
      return undefined;
    };
    const results = regions.map((region) => check(conditions, region, n)).filter((result): result is CheckResult => result !== null);
    const views = regions.map((region) => regionView(region, lastOf(region), n, !(region === "lab-b" && conditions.agent === "stopped")));
    const verdict = verdictOf(views);
    const regionalFailure = verdict !== "down" && verdict !== "unknown" && views.some((view) => view.state === "down");
    const agentDown = views.some((view) => !view.reporting);
    const holds: Record<AlertName, boolean> = { TargetDown: verdict === "down", TargetSlow: verdict === "slow", TargetRegionalFailure: regionalFailure, PingAgentDown: agentDown };
    const pending = (Object.keys(alertFor) as AlertName[]).map((name) => ({ name, pendingFor: holds[name] ? (previous?.alerts.find((alert) => alert.name === name)?.pendingFor ?? 0) + 1 : 0 }));
    const fires = (name: AlertName) => (pending.find((alert) => alert.name === name)!.pendingFor >= alertFor[name]);
    // A target that is down mutes its slow and regional alerts.
    const alerts = pending.map(({ name, pendingFor }) => ({ name, pendingFor, firing: fires(name), muted: fires(name) && fires("TargetDown") && (name === "TargetSlow" || name === "TargetRegionalFailure") }));
    ticks.push({ n, results, views, verdict, headline: headlineOf[verdict], alerts });
  }
  return ticks;
}

/** The alerts that are firing and not muted, most serious first. */
export const firing = (tick: Tick) => tick.alerts.filter((alert) => alert.firing && !alert.muted).sort((a, b) => (alertSeverity[a.name] === "critical" ? -1 : 0) - (alertSeverity[b.name] === "critical" ? -1 : 0));

/** Clock time for a check, 30 s apart from 10:40:00. */
export function clockOf(n: number) {
  const seconds = 10 * 3600 + 40 * 60 + n * CHECK_INTERVAL_S;
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/* ------------------------------------------------------------- Comparison */

/**
 * A health-only monitor watching from one region (lab-b): it sees only whether that one check
 * answered, counts missing data as down, and pages on the first failure.
 */
export type NaiveView = { says: "up" | "down"; pages: boolean; why: string };

export function naiveView(tick: Tick): NaiveView {
  const lab = tick.views.find((view) => view.region === "lab-b")!;
  if (lab.state === "unknown") return { says: "down", pages: true, why: "No data from its one region, so it reports the page down and pages." };
  if (lab.state === "down") return { says: "down", pages: true, why: tick.verdict === "down" ? "Its one check failed, so it pages." : "Its one region failed, so it pages, though the page works elsewhere." };
  return { says: "up", pages: false, why: lab.slow || tick.verdict === "slow" ? "The page answered, so it says up, while visitors wait." : "The page answered, so it says up." };
}

export type NaiveTally = { unseenSlow: number; falsePages: number; missingAsDown: number };

/** What the comparison got wrong over a run, check by check. */
export function naiveTally(ticks: Tick[]): NaiveTally {
  let unseenSlow = 0;
  let falsePages = 0;
  let missingAsDown = 0;
  for (const tick of ticks) {
    const view = naiveView(tick);
    const lab = tick.views.find((item) => item.region === "lab-b")!;
    if (view.says === "up" && tick.verdict === "slow") unseenSlow++;
    if (view.pages && tick.verdict !== "down") {
      if (lab.state === "unknown") missingAsDown++;
      else falsePages++;
    }
  }
  return { unseenSlow, falsePages, missingAsDown };
}

/* ------------------------------------------------------------------ Story */

export const toUptimeConditions = (conditions: Record<string, string>): UptimeConditions => ({
  page: (["quick", "slow", "error", "wrong-content"].includes(conditions.page) ? conditions.page : "slow") as PageBehaviour,
  scope: conditions.scope === "lab-b" ? "lab-b" : "both",
  agent: conditions.agent === "stopped" ? "stopped" : "reporting",
});

/** The case's story: twelve checks (six minutes), long enough for every alert's `for:` to pass. */
export const STORY_CHECKS = 12;
