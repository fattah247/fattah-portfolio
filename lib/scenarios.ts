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
  baselineLabel: string;
  designedLabel: string;
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
    consequence: "The second delivery must not move the payment again, and the books must still agree with the payout and the provider's report.",
    premise:
      "The first delivery completes the payment. The second should be recorded without repeating the change. A duplicate check alone isn't enough: retries need keys that refuse a changed request, every change needs a ledger entry, and every payout needs a verdict from the provider's report.",
    repo: "https://github.com/fattah247/payflow-reliability",
    technology: "Java 21 · Spring Boot · PostgreSQL · Flyway · Prometheus · Docker",
    baselineLabel: "Without a duplicate check",
    designedLabel: "With a duplicate check",
    decision: "Check the callback ID before changing the payment, refuse a reused key with a different request, and reconcile every payout against the provider's report.",
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
        src: "/projects/payflow/04-idempotency-replay.png",
        alt: "Payflow idempotency scenario output: a retry replays the original payment, the same key with a different payload is rejected with HTTP 422, and eight parallel retries create one payment",
        caption: "A retry with the same key replays the original payment. The same key with a changed body is refused, and eight parallel retries still create one payment.",
        focus: "A reused key with a changed request is refused",
      },
      {
        src: "/projects/payflow/07-settlement-batch.png",
        alt: "Payflow settlement scenario output: four parallel settlement runs create one batch, captures minus refunds pay out 5,500 IDR net, a held payment waits, and the ledger owes nothing afterwards",
        caption: "Four settlement runs race and exactly one batch pays out: captures minus refunds, 5,500 IDR net. A held payment waits for a decision, and afterwards the ledger owes the merchant nothing.",
        focus: "Paid out once, net of refunds",
      },
      {
        src: "/projects/payflow/08-reconciliation-mismatch.png",
        alt: "Payflow reconciliation scenario output: each row of the provider's report gets a verdict, a payout missing from the report is flagged, only the clean match is reconciled, and re-importing opens no new cases",
        caption: "The provider's report is checked both ways: every row gets a verdict, a payout the provider didn't report is flagged, only the clean match is reconciled, and re-importing the report opens no new cases.",
        focus: "Every payout gets a verdict",
      },
    ],
    limitation:
      "This public lab is built from common payment engineering practice; it does not represent the systems, code, or business rules of any employer, past or present. The provider is simulated locally, and no bank statement closes the loop yet.",
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
    indexTechnology: "Kotlin · Jetpack Compose",
    indexResult: "Suspicion became confirmation, not an automatic block",
    number: "03",
    shortTitle: "One device signal looked suspicious",
    title: "One device signal looked suspicious, but it was not a verdict",
    consequence: "The action still needed context before allow, confirm, or block.",
    premise:
      "A root signal changes confidence. The final decision also depends on other signals and the risk of the requested action.",
    repo: "https://github.com/fattah247/trustgate-android",
    technology: "Kotlin · Jetpack Compose · Android Keystore · BiometricPrompt",
    baselineLabel: "Block on any suspicious signal",
    designedLabel: "Evaluate signals against action risk",
    decision: "Evaluate signal combinations against action sensitivity, and ask for a confirmation signed by a biometric-bound key when the risk is medium.",
    outcome: "Uncertainty can require confirmation instead of an automatic block.",
    outcomeNodeId: "decision",
    dependencies: {
      root: ["environment", "policy", "decision", "event"],
      emulator: ["environment", "policy", "decision", "event"],
      signature: ["signature", "policy", "decision", "event"],
      sensitivity: ["action", "policy", "decision", "event"],
    },
    defaults: {
      root: "suspected",
      emulator: "clear",
      signature: "valid",
      sensitivity: "high",
    },
    controls: [
      {
        key: "root",
        label: "Root signal",
        options: [
          { label: "No root signal", value: "clear" },
          { label: "Possible root signal", value: "suspected" },
          { label: "Root detected", value: "detected" },
        ],
      },
      {
        key: "emulator",
        label: "Emulator",
        options: [
          { label: "Clear", value: "clear" },
          { label: "Detected", value: "detected" },
        ],
      },
      {
        key: "signature",
        label: "Request signature",
        options: [
          { label: "Valid", value: "valid" },
          { label: "Invalid", value: "invalid" },
        ],
      },
      {
        key: "sensitivity",
        label: "Action sensitivity",
        options: [
          { label: "Low", value: "low" },
          { label: "High", value: "high" },
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
      "Client-side signals raise the cost of abuse but cannot prove device integrity alone. In this lab the server's part runs on the device as a reference backend; production needs it on a server.",
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

  const suspicious = resolvedConditions.root !== "clear" || resolvedConditions.emulator === "detected";
  const invalidSignature = resolvedConditions.signature === "invalid";
  const highSensitivity = resolvedConditions.sensitivity === "high";
  const designed = mode === "designed";
  const designedDecision = invalidSignature || (resolvedConditions.root === "detected" && highSensitivity)
    ? "BLOCK"
    : suspicious && highSensitivity
      ? "REQUIRE CONFIRMATION"
      : "ALLOW";
  const baselineDecision = suspicious ? "BLOCK" : "ALLOW";
  const decision = designed ? designedDecision : baselineDecision;

  return [
    node("action", "Sensitive action", resolvedConditions.sensitivity.toUpperCase(), "The policy starts with what the user is trying to do."),
    node("environment", "Environment signals", suspicious ? "SUSPICIOUS" : "CLEAR", "Root and emulator indicators are collected as evidence.", suspicious ? "uncertain" : "neutral"),
    node("signature", "Request signature", resolvedConditions.signature.toUpperCase(), "Request integrity contributes a separate signal.", invalidSignature ? "adverse" : "neutral"),
    node(
      "policy",
      "Policy",
      designed ? "CONTEXTUAL" : "STRICT ENVIRONMENT",
      designed ? "Signal combinations and action sensitivity are evaluated explicitly." : "Environmental suspicion is decisive, minimizing false negatives at the cost of more false positives.",
      designed ? "designed" : suspicious ? "uncertain" : "neutral",
    ),
    node(
      "decision",
      "Action decision",
      decision,
      decision === "ALLOW"
        ? "The action can continue."
        : decision === "REQUIRE CONFIRMATION"
          ? "Uncertainty triggers an additional user decision."
          : "The action is stopped and recorded.",
      decision === "BLOCK" ? "adverse" : decision === "REQUIRE CONFIRMATION" ? "uncertain" : "confirmed",
    ),
    node("event", "Security event", "WRITTEN", "The inputs, policy result, and action remain inspectable.", designed ? "confirmed" : "neutral"),
  ];
}

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
      text: `${scenario.baselineLabel}: ${finalBaseline?.value.toLowerCase()}. ${scenario.designedLabel}: ${finalDesigned?.value.toLowerCase()}.`,
    },
  ];
}
