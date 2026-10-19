import { assessDevice, blockOnAnySignal, deviceChecks, deviceProfiles, HIGH_SCORE_THRESHOLD, MEDIUM_SCORE_THRESHOLD, SCREEN_LOCK } from "./device-risk";
import { PAYOUT_NET, paymentStory, playBoth } from "./payment-flow";
import { alertSeverity, DEGRADED_AFTER_MS, firing, naiveTally, naiveView, runUptime, STORY_CHECKS, toUptimeConditions } from "./uptime";

export type ScenarioSlug = "payflow" | "iyup" | "trustgate";
export type ProjectionMode = "baseline" | "designed";
export type NodeTone = "neutral" | "designed" | "confirmed" | "uncertain" | "adverse";

export type Conditions = Record<string, string>;

export type ProjectionNode = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: NodeTone;
};

export type ScenarioControl = {
  key: string;
  label: string;
  options: Array<{ label: string; value: string }>;
};

export type Evidence = {
  src: string;
  alt: string;
  caption: string;
  focus: string;
};

export type Scenario = {
  category: string;
  shortcutLabel: string;
  indexTechnology: string;
  indexResult: string;
  slug: ScenarioSlug;
  number: string;
  shortTitle: string;
  title: string;
  consequence: string;
  premise: string;
  repo: string;
  technology: string;
  /**
   * The repo's system (`designedLabel`) and the comparison it is set against (`baselineLabel`). The
   * comparison is a naive system the site models to show what the repo's rules prevent; it is never
   * a mode of the repo, so the simulators run only the repo's rules and show the comparison beside them.
   */
  baselineLabel?: string;
  designedLabel?: string;
  decision: string;
  outcome: string;
  outcomeNodeId: string;
  dependencies: Record<string, string[]>;
  controls: ScenarioControl[];
  defaults: Conditions;
  evidence: Evidence[];
  limitation: string;
};

export const scenarios: Scenario[] = [
  {
    slug: "payflow",
    category: "Payment reliability",
    shortcutLabel: "Payment case",
    indexTechnology: "Spring Boot · PostgreSQL",
    indexResult: "2 deliveries / 1 payment change",
    number: "01",
    shortTitle: "A payment callback arrived twice",
    title: "The same payment callback arrived twice",
    consequence: "The second delivery must not move the payment again, and its money must still be traced from capture to the bank statement.",
    premise:
      "The first delivery completes the payment. The second should be recorded without repeating the change. A duplicate check alone isn't enough: a wrong amount has to wait for a person, and a payout counts only when the bank statement shows it landed, not when the provider says so.",
    repo: "https://github.com/fattah247/payflow-reliability",
    technology: "Java 21 · Spring Boot · PostgreSQL · Flyway · Prometheus · Docker",
    designedLabel: "Payflow",
    baselineLabel: "Without an event inbox, trusting the provider (comparison)",
    decision: "Record every provider event in an inbox before it can change the payment, hold a payment whose amount disagrees, and land a payout only on a matching bank credit.",
    outcome: "Two deliveries are recorded. The payment changes once.",
    outcomeNodeId: "money",
    dependencies: {
      delivery: ["event", "inbox", "payment", "money"],
      amount: ["event", "inbox", "payment", "money"],
      bank: ["payout", "money"],
    },
    defaults: {
      delivery: "duplicate",
      amount: "matches",
      bank: "landed",
    },
    controls: [
      {
        key: "delivery",
        label: "Provider delivery",
        options: [
          { label: "One delivery", value: "once" },
          { label: "Same event twice", value: "duplicate" },
          { label: "Late AUTHORIZED", value: "out-of-order" },
        ],
      },
      {
        key: "amount",
        label: "Amount",
        options: [
          { label: "Matches", value: "matches" },
          { label: "Disagrees", value: "differs" },
        ],
      },
      {
        key: "bank",
        label: "Bank statement",
        options: [
          { label: "Credit arrives", value: "landed" },
          { label: "No credit", value: "missing" },
        ],
      },
    ],
    evidence: [
      {
        src: "/projects/payflow/05-duplicate-webhook-ignored.png",
        alt: "Payflow duplicate-webhook scenario output: a redelivery, a restated status and a late authorization all absorbed, and ten parallel deliveries applied once with one transaction, one ledger journal and no review cases",
        caption: "Ten parallel deliveries apply once: one provider transaction, one ledger journal, no review cases. A restated status under a new ID and a late authorization are absorbed too.",
        focus: "Applied once; repeats acknowledged",
      },
      {
        src: "/projects/payflow/15-outbound-key-crash.png",
        alt: "Payflow outbound-key scenario output: the provider refunds and then times out, the worker looks the derived key up instead of resending, the refund is applied once, and the payout under its batch key is sent once",
        caption: "The provider refunds, then answers too late. The outbound key comes from the refund, not the attempt, so the worker looks it up instead of resending: refunded once, and the payout under its batch key is sent once.",
        focus: "One operation, one outbound key",
      },
      {
        src: "/projects/payflow/16-three-way-reconciliation.png",
        alt: "Payflow bank-reconciliation scenario output: the provider's report alone reconciles nothing, the payout stays in transit until a bank credit matches its reference, amount and value date, and only then are the payments reconciled",
        caption: "The provider's report alone reconciles nothing. The payout lands only when a bank credit matches its reference, amount and value date, gross minus the fee equals what arrived (750,000 − 2,250 = 747,750 IDR), and only then are the payments reconciled.",
        focus: "Landed only on a matching bank credit",
      },
      {
        src: "/projects/payflow/23-chaos-money-rules.png",
        alt: "Payflow chaos scenario output: a seeded run of 150 steps with lost and doubled webhooks, provider timeouts, racing payouts, bank faults, slowness and risky devices, after which all twelve money rules hold",
        caption: "A seeded run of 150 steps throws lost and doubled webhooks, provider timeouts, racing payouts, bank faults, slowness and risky devices at the running app. Afterwards all twelve money rules hold, from balanced books to payouts sent once.",
        focus: "Twelve money rules hold under chaos",
      },
    ],
    limitation:
      "This public lab is built from common payment engineering practice; it does not represent the systems, code, or business rules of any employer, past or present. The provider, the bank and the customers are simulated, with one currency per payout, and payouts stop at the settlement account.",
  },
  {
    slug: "iyup",
    category: "Service observability",
    shortcutLabel: "Service case",
    indexTechnology: "Prometheus · Grafana",
    indexResult: "Slow warning, no false outage",
    number: "02",
    shortTitle: "The service was up, but getting slower",
    title: "The service was responding, but getting slower",
    consequence: "A page that still answers but makes visitors wait needs a warning, and a page failing in one place is not an outage.",
    premise:
      "Two agents check the page every 30 seconds from two regions. A check is slow when it takes longer than the page's own limit, here one second. The verdict is the majority: down only when most regions see it fail, slow only when most see it slow.",
    repo: "https://github.com/fattah247/iYup",
    technology: "Go · Prometheus · Alertmanager · Grafana · Python · Helm",
    designedLabel: "iYup",
    baselineLabel: "A health-only monitor in one region (comparison)",
    decision: "Time every check against the page's own limit, vote across regions, and let each alert fire only after its condition has held: five minutes for slow, one for down.",
    outcome: "A slow page raises a warning before anyone calls it an outage, and one region failing stays a warning.",
    outcomeNodeId: "alert",
    dependencies: {
      page: ["checks", "verdict", "headline", "alert"],
      scope: ["checks", "verdict", "alert"],
      agent: ["checks", "verdict", "alert"],
    },
    defaults: {
      page: "slow",
      scope: "both",
      agent: "reporting",
    },
    controls: [
      {
        key: "page",
        label: "The page",
        options: [
          { label: "Quick", value: "quick" },
          { label: "Slow", value: "slow" },
          { label: "Answers 503", value: "error" },
          { label: "Wrong content", value: "wrong-content" },
        ],
      },
      {
        key: "scope",
        label: "Where",
        options: [
          { label: "Both regions", value: "both" },
          { label: "Only lab-b", value: "lab-b" },
        ],
      },
      {
        key: "agent",
        label: "lab-b's agent",
        options: [
          { label: "Reporting", value: "reporting" },
          { label: "Stopped", value: "stopped" },
        ],
      },
    ],
    evidence: [
      {
        src: "/projects/iyup/grafana-dashboard.png",
        alt: "iYup Grafana dashboard, Right now: 8 targets up, 3 down, 1 slow, none stale, 6 alerts firing, and a table of targets with their state, last result, failing regions, latency and error budget left",
        caption: "The dashboard opens on right now: 8 up, 3 down, 1 slow, nothing stale. Each target shows its state, the reason for its last result, and how many regions see it failing.",
        focus: "What is down or slow, and why",
      },
      {
        src: "/projects/iyup/status-page.png",
        alt: "iYup status page: a regional outage target still up while failing from one of two regions, and a slow page still up but marked slow at 1.57 seconds against a 1.00 second threshold",
        caption: "A slow page stays up but is marked slow: 1.57 s against its 1.00 s threshold. A failure seen from one of two regions is a warning, not an outage.",
        focus: "Slow is not down; one region is not an outage",
      },
      {
        src: "/projects/iyup/status-api.png",
        alt: "iYup status API output: overall status degraded with 7 up, 3 down, 0 unknown, 1 slow and 1 in maintenance, then each target's state, reason, and what each region saw",
        caption: "The status API reports one verdict (degraded: 7 up, 3 down, 1 slow, 1 in maintenance) and, for each target, its state, its reason, and what each region saw.",
        focus: "Each target's verdict, region by region",
      },
      {
        src: "/projects/iyup/prometheus-targets.png",
        alt: "Prometheus targets page: the API gateway and both regions' ping agents being scraped, all up",
        caption: "Collection is visible at the scrape boundary: both regions' agents and the API are scraped, so missing data reads as unknown, never as down or as zero.",
        focus: "Collection state at the scrape boundary",
      },
    ],
    limitation:
      "The demo's two regions run on one machine, and useful production thresholds still require real traffic history and service objectives.",
  },
  {
    slug: "trustgate",
    category: "Android device trust",
    shortcutLabel: "Device case",
    indexTechnology: "Kotlin · Android Keystore",
    indexResult: "3 points: confirmed first, not blocked",
    number: "03",
    shortTitle: "A phone looked suspicious, but not enough to block",
    title: "The phone looked suspicious, but not enough to block the payment",
    consequence: "Two weak signals asked for a confirmation; one strong signal would have blocked the payment.",
    premise:
      "Each device check adds points by how serious it is: 1, 2, or 3. From 2 points the payment must be confirmed first; from 5, or on any single high-severity check, it is blocked.",
    repo: "https://github.com/fattah247/trustgate-android",
    technology: "Kotlin · Android Keystore · BiometricPrompt · Jetpack Compose",
    designedLabel: "TrustGate",
    baselineLabel: "Block on any signal (comparison)",
    decision: "Score every check, and let the server decide from the risk level.",
    outcome: "Weak signals require a confirmation before the payment is signed; strong ones block it before anything is signed.",
    outcomeNodeId: "decision",
    dependencies: Object.fromEntries([
      ...deviceChecks.map((check) => [check.id, ["checks", "score", "level", "decision", "signing", "event"]]),
      [SCREEN_LOCK, ["signing", "event"]],
    ]),
    defaults: {
      ...Object.fromEntries(deviceChecks.map((check) => [check.id, deviceProfiles.MEDIUM.includes(check.id) ? "found" : "clear"])),
      [SCREEN_LOCK]: "set",
    },
    controls: [
      ...deviceChecks.map((check) => ({
        key: check.id,
        label: check.name,
        options: [
          { label: "Not found", value: "clear" },
          { label: "Found", value: "found" },
        ],
      })),
      {
        key: SCREEN_LOCK,
        label: "Screen lock",
        options: [
          { label: "Set", value: "set" },
          { label: "None", value: "none" },
        ],
      },
    ],
    evidence: [
      {
        src: "/projects/trustgate/02-device-risk-details.png",
        alt: "TrustGate Android Signals tab: three of eight checks flagged, with the points each adds to a high-risk score of 5",
        caption: "Each flagged check shows the points it adds, so the risk verdict can be checked by hand before a sensitive action is evaluated.",
        focus: "The points behind the verdict",
      },
      {
        src: "/projects/trustgate/11-device-keys.png",
        alt: "TrustGate Android Request signing screen: the device key and the step-up key, each with its attestation verified, where it lives, the boot state and the bootloader state",
        caption: "Every request is signed by a P-256 key in Android Keystore. The step-up key signs only after biometrics or the screen lock, and the backend reads each key's attestation: where it lives and the device's boot state.",
        focus: "Keys that never leave the device",
      },
      {
        src: "/projects/trustgate/05-request-signing-reference.png",
        alt: "TrustGate Android backend responses: a request sent after its time window rejected as too late, and a request edited after signing rejected for a signature mismatch",
        caption: "The reference backend refuses a request that arrives too late or was edited after signing, so a held-back or tampered request can't get through.",
        focus: "Late and edited requests refused",
      },
      {
        src: "/projects/trustgate/07-security-event-log.png",
        alt: "TrustGate Android Activity log: the reference verifier rejecting a late, an edited, and a replayed request, and the signals found",
        caption: "Device checks, gate decisions, and the verifier's reasons for accepting or rejecting each request leave a readable local trail.",
        focus: "Why each request was accepted or rejected",
      },
    ],
    limitation:
      "Client-side checks raise the cost of abuse but cannot prove device integrity. The demo's backend runs inside the app; a production server would decide from a Play Integrity verdict.",
  },
];

export function getScenario(slug: string) {
  return scenarios.find((scenario) => scenario.slug === slug);
}

export function resolveScenarioConditions(
  scenario: Scenario | ScenarioSlug,
  conditions?: Conditions,
): Conditions {
  const definition = typeof scenario === "string" ? getScenario(scenario) : scenario;
  if (!definition) return {};

  const resolved = { ...definition.defaults };
  for (const control of definition.controls) {
    const candidate = conditions?.[control.key];
    if (typeof candidate === "string" && control.options.some((option) => option.value === candidate)) {
      resolved[control.key] = candidate;
    }
  }
  return resolved;
}

const node = (
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: NodeTone = "neutral",
): ProjectionNode => ({ id, label, value, detail, tone });

export function projectScenario(
  scenario: ScenarioSlug,
  conditions: Conditions,
  mode: ProjectionMode,
): ProjectionNode[] {
  const resolvedConditions = resolveScenarioConditions(scenario, conditions);

  if (scenario === "payflow") {
    // The case's story through Payflow's rules (designed) and through the comparison (baseline).
    const { flow, naive } = playBoth(paymentStory(resolvedConditions));
    const repo = mode === "designed";
    const captures = flow.journals.filter((journal) => journal === "CAPTURE").length;
    const deliveries = flow.entries.filter((entry) => entry.event).length;
    const held = flow.entries.some((entry) => entry.outcome === "SENT_TO_REVIEW");
    const money = repo
      ? (flow.status === "RECONCILED" ? "RECONCILED" : flow.payout === "BROKEN" ? "BREAK OPEN" : flow.status)
      : naive.wrongAmount ? "WRONG AMOUNT ACCEPTED" : naive.captures > 1 ? "CAPTURED TWICE" : naive.overwritten ? "STATUS OVERWRITTEN" : naive.reconciledWithoutBank && resolvedConditions.bank === "missing" ? "RECONCILED WITHOUT THE BANK" : "RECONCILED";
    return [
      node("event", "Provider events", `${deliveries} ${deliveries === 1 ? "DELIVERY" : "DELIVERIES"}`, resolvedConditions.delivery === "duplicate" ? "The same event arrives again, then the same status under a new id." : resolvedConditions.delivery === "out-of-order" ? "An AUTHORIZED arrives after the capture." : "One delivery of the payment's success.", resolvedConditions.delivery === "once" ? "neutral" : "uncertain"),
      node("inbox", "Event inbox", repo ? "EVERY EVENT RECORDED" : "NONE", repo ? "Each event id gets one outcome; a repeat is answered, not run again." : "Every delivery runs the payment path.", repo ? "designed" : resolvedConditions.delivery === "once" ? "neutral" : "adverse"),
      node("payment", "Payment", repo ? (held ? "HELD, THEN RELEASED" : `${captures} CAPTURE`) : `${naive.captures} ${naive.captures === 1 ? "CAPTURE" : "CAPTURES"}`, repo ? (held ? "A wrong amount waited for a person before anything was captured." : "The money is captured once.") : naive.captures > 1 ? "Each repeat captures the money again." : "The money is captured.", repo ? "confirmed" : naive.captures > 1 || naive.wrongAmount ? "adverse" : "neutral"),
      node("payout", "Payout", repo ? flow.payout.replace("_", " ") : "SENT", repo ? (flow.payout === "LANDED" ? `${PAYOUT_NET.toLocaleString("en-US")} IDR credited with the payout's reference.` : "Every statement through the value date window is in, and no credit came.") : "Counted as paid once the provider reports it.", repo ? (flow.payout === "LANDED" ? "confirmed" : "adverse") : "neutral"),
      node("money", "Reconciled", money, repo ? (flow.status === "RECONCILED" ? "The provider's report and the bank both agree." : "The payment stays paid out, with a break for treasury.") : "The provider's word is taken as the money.", money === "RECONCILED" ? "confirmed" : repo ? "uncertain" : "adverse"),
    ];
  }

  if (scenario === "iyup") {
    // The story's twelve checks (six minutes) through iYup's rules, and the comparison's view of them.
    const uptime = toUptimeConditions(resolvedConditions);
    const ticks = runUptime(uptime, STORY_CHECKS);
    const last = ticks.at(-1)!;
    const repo = mode === "designed";
    const fired = firing(last);
    const naive = naiveView(last);
    const tally = naiveTally(ticks);
    const top = fired[0];
    const alert = repo
      ? (top ? `${top.name} · ${alertSeverity[top.name] === "critical" ? "PAGE" : "NOTIFY"}` : "QUIET")
      : naive.pages ? (last.verdict === "down" ? "PAGE" : "FALSE PAGE") : last.verdict === "slow" ? "SAYS UP WHILE SLOW" : "QUIET";
    return [
      node("checks", "Checks", last.views.map((view) => `${view.region} ${view.state === "unknown" ? "unknown" : view.slow ? "slow" : view.state}`).join(" · ").toUpperCase(), last.views.map((view) => `${view.region}: ${view.latencyMs === null ? "no fresh result" : `${(view.latencyMs / 1000).toFixed(2)} s, ${view.reason}`}`).join("; "), last.views.some((view) => view.state !== "up" || view.slow) ? "uncertain" : "neutral"),
      node("verdict", "Verdict", repo ? last.verdict.toUpperCase() : naive.says.toUpperCase(), repo ? "The majority of fresh regions; a tie counts as up." : "One region's answer, with speed not looked at.", repo ? (last.verdict === "up" ? "confirmed" : last.verdict === "down" ? "adverse" : "uncertain") : naive.says !== (last.verdict === "down" ? "down" : "up") || last.verdict === "slow" ? "adverse" : "neutral"),
      node("headline", "Status page", repo ? last.headline : naive.says === "up" ? "Up" : "Down", repo ? "The status page's own words." : "What a health-only page would say.", "neutral"),
      node("alert", "Alert", alert, repo ? (top ? `After its condition held for ${top.name === "TargetDown" ? "1 minute" : top.name === "PingAgentDown" ? "2 minutes" : "5 minutes"}.` : `No check passed the ${DEGRADED_AFTER_MS / 1000} s limit for long enough.`) : naive.why, repo ? (top && alertSeverity[top.name] === "critical" ? "adverse" : top ? "uncertain" : "confirmed") : tally.falsePages || tally.missingAsDown || tally.unseenSlow ? "adverse" : "neutral"),
    ];
  }

  // Case 03: TrustGate's scoring (designed), or a gate that blocks on any signal (baseline, a comparison).
  const device = assessDevice(resolvedConditions);
  const comparison = mode === "baseline" ? blockOnAnySignal(resolvedConditions) : null;
  const levelTone = device.level === "HIGH" ? "adverse" : device.level === "MEDIUM" ? "uncertain" : "confirmed";
  const reason = device.reason.kind === "severe"
    ? "A high-severity check makes the risk high on its own, whatever the total."
    : device.reason.kind === "score"
      ? `${device.score} points reach the ${device.reason.threshold === HIGH_SCORE_THRESHOLD ? "high" : "medium"} threshold of ${device.reason.threshold}.`
      : `${device.score} ${device.score === 1 ? "point stays" : "points stay"} under the medium threshold of ${MEDIUM_SCORE_THRESHOLD}.`;
  return [
    node("checks", "Device checks", `${device.found.length} OF ${device.checks.length} FOUND`, device.found.length ? device.found.map((check) => `${check.name} +${check.points}`).join(", ") : "No check found anything.", device.found.length ? "uncertain" : "neutral"),
    node("score", "Risk score", `${device.score} ${device.score === 1 ? "POINT" : "POINTS"}`, "A found check adds 1, 2, or 3 points by its severity."),
    node("level", "Risk level", device.level, reason, levelTone),
    node(
      "decision",
      comparison ? "Gate's decision" : "Server's decision",
      comparison ?? device.decision,
      comparison
        ? (comparison === "BLOCK" ? "Any signal blocks, whatever it is." : "Nothing was found, so it lets the payment through.")
        : device.decision === "ALLOW"
          ? "The payment is signed and sent."
          : device.decision === "REQUIRE CONFIRMATION"
            ? "The payment needs a confirmation before it can be signed."
            : "No challenge is issued, so nothing can be signed.",
      (comparison ?? device.decision) === "BLOCK" ? "adverse" : device.decision === "REQUIRE CONFIRMATION" ? "uncertain" : "confirmed",
    ),
    node(
      "signing",
      "Signed by",
      device.signing,
      device.signing === "STEP-UP KEY"
        ? "A key that only signs after the screen lock or biometrics."
        : device.signing === "SIGNED TAP"
          ? "No screen lock, so no step-up key: a tap confirmation is signed into the request."
          : device.signing === "DEVICE KEY"
            ? "The phone's hardware-backed key signs it."
            : "The payment stops here.",
      device.signing === "NOTHING SIGNED" ? "adverse" : "designed",
    ),
    node("event", "Activity log", "WRITTEN", "The phone records the decision and the reason for it.", "confirmed"),
  ];
}

/** Whether a case compares an old handling with the designed one. */
export const hasComparison = (scenario: Scenario) => Boolean(scenario.baselineLabel && scenario.designedLabel);

export function explainScenario(
  scenario: Scenario,
  conditions: Conditions,
  baseline: ProjectionNode[],
  designed: ProjectionNode[],
) {
  const divergence = designed.find((item, index) => item.value !== baseline[index]?.value);
  const finalBaseline = baseline.find((item) => item.id === scenario.outcomeNodeId);
  const finalDesigned = designed.find((item) => item.id === scenario.outcomeNodeId);

  return [
    {
      label: "Condition",
      text: scenario.controls
        .map((control) => `${control.label}: ${control.options.find((option) => option.value === conditions[control.key])?.label ?? conditions[control.key]}`)
        .join(" · "),
    },
    {
      label: "Difference",
      text: divergence
        ? `${divergence.label} changes from ${baseline.find((item) => item.id === divergence.id)?.value.toLowerCase()} to ${divergence.value.toLowerCase()}.`
        : "Both projections currently reach the same visible state.",
    },
    {
      label: "Outcome",
      text: hasComparison(scenario)
        ? `${scenario.baselineLabel}: ${finalBaseline?.value.toLowerCase()}. ${scenario.designedLabel}: ${finalDesigned?.value.toLowerCase()}.`
        : `${finalDesigned?.label}: ${finalDesigned?.value.toLowerCase()}.`,
    },
  ];
}
