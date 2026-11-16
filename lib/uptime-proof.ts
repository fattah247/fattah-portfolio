import { type CodeExcerpt, type Proof } from "./pay-rounds";
import { alertFor, alertSeverity, CHECK_INTERVAL_S, DEGRADED_AFTER_MS, firing, STALE_AFTER_S, type Tick, type UptimeConditions } from "./uptime";

/** The repo at the commit these excerpts were read from, so every link shows the same lines. */
export const IYUP_REPO = "https://github.com/fattah247/iYup/blob/a4b5b6a6745e348d2974efd87a08bf209a887d66";
export const iyupCodeLink = (file: string, from: number, to = from) => `${IYUP_REPO}/${file}#L${from}${to > from ? `-L${to}` : ""}`;

const PROBE = "services/ping-agent/probe.go";
const SNAPSHOT = "services/api-gateway/snapshot.py";
const RULES = "config/alert.rules.yml";

/** One attempt: the status code decides up or down, then the expected text in the body. */
const statusExcerpt: CodeExcerpt = {
  file: PROBE,
  from: 174,
  lines: [
    "res.Up, res.Reason = evaluateStatus(t, resp.StatusCode)",
    "switch {",
    "case !res.Up || t.BodyContains == \"\":",
    "case bodyErr != nil:",
    "    // A body that stalls or breaks off is a transport failure, not proof",
    "    // that the page lacks the expected text.",
    "    res.Up, res.Reason, res.Err = false, classifyError(bodyErr), bodyErr",
    "case !bytes.Contains(body, []byte(t.BodyContains)):",
    "    res.Up, res.Reason = false, reasonBodyMismatch",
    "}",
  ],
};

/** The check: retry what a retry might change, then mark an up but slow answer. */
const retryExcerpt: CodeExcerpt = {
  file: PROBE,
  from: 121,
  lines: [
    "    if res.Up || !retryable[res.Reason] {",
    "        break",
    "    }",
    "    if attempt < attempts {",
    "        log.Printf(\"[RETRY] %s attempt=%d/%d reason=%s %s\", c.t.ID, attempt, attempts, res.Reason, describeFailure(res))",
    "    }",
    "}",
    "res.Degraded = res.Up && c.t.DegradedAfter > 0 && res.Latency > c.t.DegradedAfter",
  ],
};

/** One region's view: a result older than its stale budget is unknown, never down. */
const regionExcerpt: CodeExcerpt = {
  file: SNAPSHOT,
  from: 207,
  lines: [
    "stale = age is not None and stale_after is not None and age > stale_after",
    "if m.up is None:",
    "    state, reason = STATE_UNKNOWN, \"pending\"",
    "elif stale:",
    "    state, reason = STATE_UNKNOWN, m.reason",
    "else:",
    "    state, reason = (STATE_UP if m.up == 1 else STATE_DOWN), m.reason",
  ],
};

/** The target's verdict: a majority of the regions with fresh data. */
const verdictExcerpt: CodeExcerpt = {
  file: SNAPSHOT,
  from: 231,
  lines: [
    "fresh = [r for r in regions if r[\"state\"] != STATE_UNKNOWN]",
    "down = [r for r in fresh if r[\"state\"] == STATE_DOWN]",
    "up = [r for r in fresh if r[\"state\"] == STATE_UP]",
    "",
    "if not regions:",
    "    state, reason, rep = STATE_UNKNOWN, \"not_monitored\", None",
    "elif not fresh:",
    "    rep = regions[0]",
    "    state, reason = STATE_UNKNOWN, rep[\"reason\"]",
    "elif len(down) * 2 > len(fresh):",
  ],
};

const slowExcerpt: CodeExcerpt = {
  file: SNAPSHOT,
  from: 250,
  lines: ["slow = state == STATE_UP and sum(1 for r in up if r[\"slow\"]) * 2 > len(up)"],
};

const rule = (from: number, name: string, expr: string, holdFor: string, severity: string): CodeExcerpt => ({
  file: RULES,
  from,
  lines: [`- alert: ${name}`, `  expr: ${expr}`, `  for: ${holdFor}`, "  labels:", `    severity: ${severity}`],
});

const rules = {
  TargetDown: rule(50, "TargetDown", "iyup:target_up:quorum == 0", "1m", "critical"),
  TargetRegionalFailure: rule(64, "TargetRegionalFailure", "iyup:target_up:quorum == 1 and iyup:target_regions_up:count < iyup:target_regions:count", "5m", "warning"),
  TargetSlow: rule(77, "TargetSlow", "iyup:target_degraded:quorum == 1", "5m", "warning"),
  PingAgentDown: rule(197, "PingAgentDown", "up{job=\"ping-agent\"} == 0 and on () sum(up{job=\"ping-agent\"}) > 0", "2m", "warning"),
};

/** Alertmanager: a down target's other alerts are muted. */
const inhibitExcerpt: CodeExcerpt = {
  file: "config/alertmanager.yml",
  from: 35,
  lines: [
    "# A target that is down already has TargetDown; its other symptoms are noise.",
    "- source_matchers: [alertname=\"TargetDown\"]",
    "  target_matchers: [alertname=~\"TargetSlow|TargetRegionalFailure|ErrorBudgetBurnFast|ErrorBudgetBurnSlow\"]",
    "  equal: [target]",
  ],
};

const probeTest = (conditions: UptimeConditions) => {
  const file = "services/ping-agent/probe_test.go";
  if (conditions.page === "error") return { file, line: 74, name: "TestCheckPersistentServerError" };
  if (conditions.page === "wrong-content") return { file, line: 126, name: "TestBodyContains" };
  if (conditions.page === "slow") return { file, line: 163, name: "TestDegradedWhenSlow" };
  return { file, line: 54, name: "TestCheckUp" };
};

const verdictTest = (now: Tick) => {
  const file = "services/api-gateway/test_main.py";
  if (now.verdict === "unknown") return { file, line: 256, name: "test_stale_data_is_unknown_not_up" };
  if (now.views.some((view) => view.state === "unknown")) return { file, line: 318, name: "test_stale_regions_do_not_vote" };
  if (now.verdict === "down") return { file, line: 294, name: "test_majority_down_is_down_with_the_common_reason" };
  if (now.views.some((view) => view.state === "down")) return { file, line: 286, name: "test_one_of_two_regions_failing_is_still_up" };
  if (now.verdict === "slow") return { file, line: 252, name: "test_slow_target" };
  return { file, line: 323, name: "test_slow_needs_a_majority_of_reachable_regions" };
};

/**
 * Builds the engineer proof ("How iYup decided") for the current check and conditions in Case 02,
 * quoting fattah247/iYup at the pinned commit: the agent's check, the gateway's verdict, the alert rule.
 */
export function uptimeProofFor(conditions: UptimeConditions, now: Tick): Proof {
  const request = now.views.map((view) => {
    if (view.state === "unknown") {
      return `${view.region}: no fresh sample within stale budget (${STALE_AFTER_S}s) → state=unknown (${view.stale ? "stale" : "pending"})`;
    }
    return `${view.region}: probe status=${view.state} reason=${view.reason} latency=${view.latencyMs}ms (degraded_after=${DEGRADED_AFTER_MS}ms → slow=${view.slow})`;
  });

  const active = firing(now);
  const muted = now.alerts.filter((alert) => alert.muted);
  const pending = now.alerts.filter((alert) => alert.pendingFor > 0 && !alert.firing);

  const alertRule = conditions.agent === "stopped"
    ? rules.PingAgentDown
    : conditions.scope === "lab-b" && (conditions.page === "error" || conditions.page === "wrong-content")
      ? rules.TargetRegionalFailure
      : conditions.page === "slow"
        ? rules.TargetSlow
        : rules.TargetDown;

  const code = [
    ...(conditions.page === "slow" ? [retryExcerpt] : [statusExcerpt]),
    ...(now.views.some((view) => view.state === "unknown") ? [regionExcerpt] : []),
    verdictExcerpt,
    ...(conditions.page === "slow" ? [slowExcerpt] : []),
    alertRule,
    ...(muted.length ? [inhibitExcerpt] : []),
  ];

  const notes: string[] = [
    `Each region checks every ${CHECK_INTERVAL_S}s against the target's own degraded_after (${DEGRADED_AFTER_MS}ms for the demo's slow page). A region whose last result is older than ${STALE_AFTER_S}s (2 intervals plus the worst-case check) becomes unknown instead of down.`,
    "target_status votes across fresh regions only: down needs a strict majority (more than half), so 1 of 2 failing regions stays up and raises TargetRegionalFailure (a warning) instead of paging on-call.",
  ];
  if (muted.length) {
    notes.push(`Alertmanager inhibition mutes ${muted.map((item) => item.name).join(" and ")} while TargetDown is firing for the same target.`);
  }

  const alertSummary = active.length
    ? active.map((alert) => `${alert.name} (${alertSeverity[alert.name]}) firing`).join(", ")
    : pending.length
      ? pending.map((alert) => `${alert.name} pending (${alert.pendingFor}/${alertFor[alert.name]} checks)`).join(", ")
      : "no alerts firing or pending";

  return {
    request,
    code,
    notes,
    result: `verdict=${now.verdict} · status page="${now.headline}" · ${alertSummary}`,
    tests: [probeTest(conditions), verdictTest(now)],
  };
}
