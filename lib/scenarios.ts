import { assessDevice, deviceChecks, deviceProfiles, HIGH_SCORE_THRESHOLD, MEDIUM_SCORE_THRESHOLD, SCREEN_LOCK } from "./device-risk";

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
   * A case that compares an old handling with the designed one names both; a case that shows one
   * system as it is (case 03, the repo's own scoring) leaves them out and has no approach toggle.
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
      "The first delivery completes the payment. The second should be recorded without repeating the change. A duplicate check alone isn't enough: retries need keys that refuse a changed request, every change needs a ledger entry, and a payout counts only when the bank statement shows it landed.",
    repo: "https://github.com/fattah247/payflow-reliability",
    technology: "Java 21 · Spring Boot · PostgreSQL · Flyway · Prometheus · Docker",
    baselineLabel: "Without a duplicate check",
    designedLabel: "With a duplicate check",
    decision: "Check the callback ID before changing the payment, derive each outbound key once from its operation, and land a payout only on a matching bank credit.",
    outcome: "Two deliveries are recorded. The payment changes once.",
    outcomeNodeId: "state",
    dependencies: {
      delivery: ["callback", "boundary", "state", "audit"],
      settlement: ["state", "audit"],
      persistence: ["audit"],
    },
    defaults: {
      delivery: "duplicate",
      settlement: "matched",
      persistence: "available",
    },
    controls: [
      {
        key: "delivery",
        label: "Callback delivery",
        options: [
          { label: "One delivery", value: "once" },
          { label: "Same callback twice", value: "duplicate" },
          { label: "Older callback arrives", value: "out-of-order" },
        ],
      },
      {
        key: "settlement",
        label: "Settlement",
        options: [
          { label: "Matched", value: "matched" },
          { label: "Mismatched", value: "mismatched" },
        ],
      },
      {
        key: "persistence",
        label: "Audit persistence",
        options: [
          { label: "Available", value: "available" },
          { label: "Interrupted", value: "interrupted" },
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
    indexResult: "Latency alert while health still passed",
    number: "02",
    shortTitle: "The service was up, but getting slower",
    title: "The service was responding, but getting slower",
    consequence: "Operators needed a warning before it became an outage.",
    premise:
      "The health check still said “up.” Latency showed that users were already experiencing degradation.",
    repo: "https://github.com/fattah247/iYup",
    technology: "Go · Prometheus · Alertmanager · Grafana · Python · Helm",
    baselineLabel: "Health check only",
    designedLabel: "Health, latency, and collection state",
    decision: "Separate availability, performance, and collection state, and call an outage only when most regions see it.",
    outcome: "The operator can distinguish degradation from missing telemetry.",
    outcomeNodeId: "decision",
    dependencies: {
      health: ["service", "health", "decision"],
      latency: ["latency", "decision"],
      scrape: ["latency", "collection", "decision"],
      alert: ["decision"],
    },
    defaults: {
      health: "pass",
      latency: "degraded",
      scrape: "available",
      alert: "present",
    },
    controls: [
      {
        key: "health",
        label: "Health endpoint",
        options: [
          { label: "Pass", value: "pass" },
          { label: "Fail", value: "fail" },
        ],
      },
      {
        key: "latency",
        label: "P95 latency",
        options: [
          { label: "Normal response", value: "normal" },
          { label: "Getting slower", value: "degraded" },
          { label: "Severely delayed", value: "severe" },
        ],
      },
      {
        key: "scrape",
        label: "Scrape target",
        options: [
          { label: "Available", value: "available" },
          { label: "Missing", value: "missing" },
        ],
      },
      {
        key: "alert",
        label: "Alert rule",
        options: [
          { label: "Present", value: "present" },
          { label: "Absent", value: "absent" },
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
    const repeated = resolvedConditions.delivery !== "once";
    const outOfOrder = resolvedConditions.delivery === "out-of-order";
    const mismatched = resolvedConditions.settlement === "mismatched";
    const interrupted = resolvedConditions.persistence === "interrupted";
    const safe = mode === "designed";

    return [
      node("request", "Request", "RECEIVED", "A merchant payment request enters the system."),
      node("intent", "Payment intent", "CREATED", "One durable transaction identity is established."),
      node(
        "callback",
        "Provider callback",
        resolvedConditions.delivery.toUpperCase().replaceAll("-", " "),
        outOfOrder
          ? "An older provider event arrives after a newer transaction state."
          : repeated
            ? "The delivery can refer to an event already processed."
            : "A single provider event is delivered.",
        repeated ? "uncertain" : "neutral",
      ),
      node(
        "boundary",
        "Event boundary",
        safe ? "MATCHED" : "NOT CHECKED",
        safe
          ? "The callback is compared with recorded identity and state order."
          : "The handler stays simple; repeated work is left for reconciliation.",
        safe ? "designed" : repeated ? "adverse" : "neutral",
      ),
      node(
        "state",
        "Transaction state",
        mismatched || (outOfOrder && !safe) ? "REVIEW REQUIRED" : repeated && !safe ? "REAPPLIED" : repeated ? "UNCHANGED" : "PAID",
        mismatched
          ? "Settlement evidence does not agree with the current transaction projection."
          : outOfOrder && !safe
            ? "The older event continues and must be reconciled against newer state."
          : repeated && safe
            ? "The repeated callback is acknowledged without advancing state."
            : repeated
              ? "The same delivery enters the state path again."
              : "The first valid callback advances the transaction.",
        mismatched ? "uncertain" : repeated && !safe ? "adverse" : safe ? "confirmed" : "neutral",
      ),
      node(
        "audit",
        "Audit trail",
        interrupted ? "PENDING" : "WRITTEN",
        interrupted ? "The final evidence boundary is unavailable." : "Previous state, resulting state, and reason remain readable.",
        interrupted ? "uncertain" : safe ? "confirmed" : "neutral",
      ),
    ];
  }

  if (scenario === "iyup") {
    const healthPasses = resolvedConditions.health === "pass";
    const latency = resolvedConditions.latency;
    const missing = resolvedConditions.scrape === "missing";
    const alertPresent = resolvedConditions.alert === "present";
    const designed = mode === "designed";
    const degraded = latency !== "normal";

    return [
      node("service", "Service process", healthPasses ? "RESPONDING" : "UNAVAILABLE", "The process answers its health contract.", healthPasses ? "neutral" : "adverse"),
      node(
        "health",
        "Health projection",
        healthPasses ? "PASS" : "FAIL",
        designed ? "Health answers availability, not performance." : "A low-cost availability check keeps the operating view intentionally narrow.",
        healthPasses && degraded && !designed ? "uncertain" : "neutral",
      ),
      node(
        "latency",
        "P95 latency",
        designed ? (missing ? "UNKNOWN" : latency.toUpperCase()) : "NOT PROJECTED",
        designed
          ? missing
            ? "Missing samples remain unknown rather than becoming zero."
            : "Latency exposes gradual service degradation."
          : "Lower monitoring overhead, with latency diagnosis handled elsewhere.",
        designed ? (missing ? "uncertain" : degraded ? "uncertain" : "confirmed") : degraded ? "adverse" : "neutral",
      ),
      node(
        "collection",
        "Metric collection",
        designed ? (missing ? "INTERRUPTED" : "AVAILABLE") : "NOT INSPECTED",
        designed ? "Collection state distinguishes service behavior from missing evidence." : "Telemetry availability is not part of the operating view.",
        designed ? (missing ? "uncertain" : "designed") : "neutral",
      ),
      node(
        "decision",
        "Operator context",
        designed && !healthPasses
          ? (alertPresent ? "ACTIONABLE" : "INCOMPLETE")
          : designed && degraded && alertPresent && !missing
            ? "ACTIONABLE"
            : designed && missing
              ? "INVESTIGATE COLLECTION"
              : !designed && !healthPasses
                ? "OUTAGE"
                : degraded
                  ? "INCOMPLETE"
                  : "QUIET",
        designed && !healthPasses
          ? "The health contract reports the service unavailable; investigate even without a latency breach."
          : designed && degraded && alertPresent && !missing
          ? "The operator sees the breached signal and where to inspect next."
          : designed && missing
            ? "The next decision is to restore or inspect collection."
            : !designed && !healthPasses
              ? "The failing health check is the one signal this view has; it reports an outage."
              : designed && degraded
                ? "Latency is collected, but no alert rule raises the breach to an operator."
                : degraded
                  ? "The availability view stays simple but cannot localize the degradation."
                  : "No degraded condition requires action.",
        designed ? (!healthPasses || missing ? "uncertain" : degraded && alertPresent ? "confirmed" : "neutral") : !healthPasses || degraded ? "adverse" : "neutral",
      ),
    ];
  }

  // Case 03 shows the repo's one system as it is: the projection is the same in either mode.
  const device = assessDevice(resolvedConditions);
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
      "Server's decision",
      device.decision,
      device.decision === "ALLOW"
        ? "The payment is signed and sent."
        : device.decision === "REQUIRE CONFIRMATION"
          ? "The payment needs a confirmation before it can be signed."
          : "No challenge is issued, so nothing can be signed.",
      device.decision === "BLOCK" ? "adverse" : device.decision === "REQUIRE CONFIRMATION" ? "uncertain" : "confirmed",
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
