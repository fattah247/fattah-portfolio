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
    number: "01",
    shortTitle: "A payment callback arrived twice",
    title: "The same payment callback arrived twice.",
    consequence: "The second delivery must not advance the payment again.",
    premise:
      "The first delivery completes the payment. The second should be recorded without repeating the state change.",
    repo: "https://github.com/fattah247/payflow-reliability",
    technology: "Spring Boot · PostgreSQL · REST · Docker",
    baselineLabel: "Without a duplicate check",
    designedLabel: "With a duplicate check",
    decision: "Check the callback ID before updating payment state.",
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
        src: "/projects/payflow/audit-trail.png",
        alt: "PayFlow audit trail showing transaction state changes",
        caption: "The audit trail keeps previous and resulting transaction state readable.",
        focus: "Previous state → resulting state",
      },
      {
        src: "/projects/payflow/duplicate-webhook.png",
        alt: "PayFlow response for a repeated provider webhook",
        caption: "A repeated delivery is acknowledged as handled behavior instead of silently replaying state.",
        focus: "Duplicate acknowledged; state unchanged",
      },
    ],
    limitation:
      "This public lab demonstrates state and delivery behavior; it is not a representation of BCA infrastructure or provider settlement rules.",
  },
  {
    slug: "iyup",
    number: "02",
    shortTitle: "The service was up, but getting slower",
    title: "The service was responding, but getting slower.",
    consequence: "Operators needed a warning before it became an outage.",
    premise:
      "The health check still said “up.” Latency showed that users were already experiencing degradation.",
    repo: "https://github.com/fattah247/iYup",
    technology: "Prometheus · Grafana · Alertmanager · Go",
    baselineLabel: "Health check only",
    designedLabel: "Health, latency, and collection state",
    decision: "Separate availability, performance, and collection state.",
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
        alt: "iYup Grafana dashboard showing health and latency",
        caption: "Health, latency, and alert state are visible in one operating surface.",
        focus: "Latency panel and active alert state",
      },
      {
        src: "/projects/iyup/prometheus-targets.png",
        alt: "iYup Prometheus target collection status",
        caption: "Collection failure is visible at the scrape boundary instead of being mistaken for a zero value.",
        focus: "Target health at the collection edge",
      },
    ],
    limitation:
      "The demonstration explains signal relationships; useful production thresholds still require real traffic history and service objectives.",
  },
  {
    slug: "trustgate",
    number: "03",
    shortTitle: "One device signal looked suspicious",
    title: "One device signal looked suspicious, but it was not a verdict.",
    consequence: "The action still needed context before allow, confirm, or block.",
    premise:
      "A root signal changes confidence. The final decision also depends on other signals and the risk of the requested action.",
    repo: "https://github.com/fattah247/trustgate-android",
    technology: "Kotlin · Android · Jetpack Compose · Jetpack Security",
    baselineLabel: "Block on any suspicious signal",
    designedLabel: "Evaluate signals against action risk",
    decision: "Evaluate signal combinations against action sensitivity.",
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
        src: "/projects/trustgate/device-risk-details.png",
        alt: "TrustGate Android device risk details",
        caption: "Individual device signals remain inspectable before a sensitive action is evaluated.",
        focus: "Signals visible before the decision",
      },
      {
        src: "/projects/trustgate/security-event-log.png",
        alt: "TrustGate Android local security event trail",
        caption: "Gated and blocked actions leave a readable local security trail.",
        focus: "Recorded action and policy result",
      },
    ],
    limitation:
      "Client-side signals raise the cost of abuse but cannot prove device integrity alone; server-side controls remain necessary.",
  },
];

export function getScenario(slug: string) {
  return scenarios.find((scenario) => scenario.slug === slug);
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
  if (scenario === "payflow") {
    const repeated = conditions.delivery !== "once";
    const outOfOrder = conditions.delivery === "out-of-order";
    const mismatched = conditions.settlement === "mismatched";
    const interrupted = conditions.persistence === "interrupted";
    const safe = mode === "designed";

    return [
      node("request", "Request", "RECEIVED", "A merchant payment request enters the system."),
      node("intent", "Payment intent", "CREATED", "One durable transaction identity is established."),
      node(
        "callback",
        "Provider callback",
        conditions.delivery.toUpperCase().replaceAll("-", " "),
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
    const healthPasses = conditions.health === "pass";
    const latency = conditions.latency;
    const missing = conditions.scrape === "missing";
    const alertPresent = conditions.alert === "present";
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
        designed && degraded && alertPresent && !missing ? "ACTIONABLE" : designed && missing ? "INVESTIGATE COLLECTION" : degraded ? "INCOMPLETE" : "QUIET",
        designed && degraded && alertPresent && !missing
          ? "The operator sees the breached signal and where to inspect next."
          : designed && missing
            ? "The next decision is to restore or inspect collection."
            : degraded
              ? "The availability view stays simple but cannot localize the degradation."
              : "No degraded condition requires action.",
        designed ? (missing ? "uncertain" : degraded && alertPresent ? "confirmed" : "neutral") : degraded ? "adverse" : "neutral",
      ),
    ];
  }

  const suspicious = conditions.root !== "clear" || conditions.emulator === "detected";
  const invalidSignature = conditions.signature === "invalid";
  const highSensitivity = conditions.sensitivity === "high";
  const designed = mode === "designed";
  const designedDecision = invalidSignature || (conditions.root === "detected" && highSensitivity)
    ? "BLOCK"
    : suspicious && highSensitivity
      ? "REQUIRE CONFIRMATION"
      : "ALLOW";
  const baselineDecision = suspicious ? "BLOCK" : "ALLOW";
  const decision = designed ? designedDecision : baselineDecision;

  return [
    node("action", "Sensitive action", conditions.sensitivity.toUpperCase(), "The policy starts with what the user is trying to do."),
    node("environment", "Environment signals", suspicious ? "SUSPICIOUS" : "CLEAR", "Root and emulator indicators are collected as evidence.", suspicious ? "uncertain" : "neutral"),
    node("signature", "Request signature", conditions.signature.toUpperCase(), "Request integrity contributes a separate signal.", invalidSignature ? "adverse" : "neutral"),
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
        .map((control) => `${control.label}: ${conditions[control.key]}`)
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
      text: `Variant A: ${finalBaseline?.value.toLowerCase()}. Variant B: ${finalDesigned?.value.toLowerCase()}.`,
    },
    { label: "Boundary", text: scenario.limitation },
  ];
}
