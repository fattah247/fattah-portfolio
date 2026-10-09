import { projectScenario, resolveScenarioConditions, type Conditions, type ProjectionMode, type ScenarioSlug } from "./scenarios";

/*
 * Instrument models for the three public labs. Each is a pure, deterministic function of the
 * case conditions and the handling approach, so every layout (wide window, snapped pane, phone)
 * renders the same result. Outcomes are derived to agree with `projectScenario`, which remains
 * the source of truth for each case's final state. All values are synthetic demonstrations.
 */

/* ------------------------------------------------------------------ Payment */

export type PaymentState = "PENDING" | "PAID" | "REVIEW";

export type PaymentStep = {
  /** Order in which the step happens. */
  index: number;
  kind: "delivery" | "settlement" | "audit";
  title: string;
  /** Provider event carried by a delivery, e.g. "evt-01". */
  eventId?: string;
  /** Provider sequence number of the event, used for ordering. */
  sequence?: number;
  check: string;
  decision: "applied" | "acknowledged" | "ignored-stale" | "applied-again" | "regressed" | "review" | "written" | "pending" | "matched";
  stateBefore: PaymentState;
  stateAfter: PaymentState;
  /** True when the step wrote a transaction state change. */
  stateWrite: boolean;
  note: string;
};

export type PaymentRun = {
  steps: PaymentStep[];
  finalState: PaymentState;
  deliveries: number;
  stateWrites: number;
  acknowledged: number;
  /** The case's projected outcome value for this approach (PAID, UNCHANGED, REAPPLIED, REVIEW REQUIRED). */
  outcome: string;
};

export function simulatePayment(conditions: Conditions, mode: ProjectionMode): PaymentRun {
  const c = resolveScenarioConditions("payflow", conditions);
  const checked = mode === "designed";
  const steps: PaymentStep[] = [];
  let state: PaymentState = "PENDING";
  const push = (step: Omit<PaymentStep, "index">) => steps.push({ ...step, index: steps.length + 1 });

  if (c.delivery === "out-of-order") {
    // The newer provider status arrives first; the older one is delivered late.
    push({ kind: "delivery", title: "Delivery 1", eventId: "evt-02", sequence: 2, check: checked ? "New event · sequence 2 is newer than recorded" : "Not checked", decision: "applied", stateBefore: state, stateAfter: "PAID", stateWrite: true, note: "The newer status completes the payment." });
    state = "PAID";
    if (checked) {
      push({ kind: "delivery", title: "Delivery 2", eventId: "evt-01", sequence: 1, check: "Sequence 1 is older than recorded sequence 2", decision: "ignored-stale", stateBefore: state, stateAfter: state, stateWrite: false, note: "Recorded as received; the state keeps the newer status." });
    } else {
      push({ kind: "delivery", title: "Delivery 2", eventId: "evt-01", sequence: 1, check: "Not checked", decision: "regressed", stateBefore: state, stateAfter: "REVIEW", stateWrite: true, note: "The older status is written over newer state and must be reconciled." });
      state = "REVIEW";
    }
  } else {
    push({ kind: "delivery", title: "Delivery 1", eventId: "evt-01", sequence: 1, check: checked ? "New event ID" : "Not checked", decision: "applied", stateBefore: state, stateAfter: "PAID", stateWrite: true, note: "The first valid callback completes the payment." });
    state = "PAID";
    if (c.delivery === "duplicate") {
      if (checked) {
        push({ kind: "delivery", title: "Delivery 2", eventId: "evt-01", sequence: 1, check: "Event ID evt-01 already processed", decision: "acknowledged", stateBefore: state, stateAfter: state, stateWrite: false, note: "Acknowledged to the provider; no second state change." });
      } else {
        push({ kind: "delivery", title: "Delivery 2", eventId: "evt-01", sequence: 1, check: "Not checked", decision: "applied-again", stateBefore: state, stateAfter: state, stateWrite: true, note: "The same event runs the state path a second time." });
      }
    }
  }

  if (c.settlement === "mismatched") {
    push({ kind: "settlement", title: "Settlement check", check: "Settlement record does not match the payment", decision: "review", stateBefore: state, stateAfter: "REVIEW", stateWrite: state !== "REVIEW", note: "The payment is held for manual review." });
    state = "REVIEW";
  } else {
    push({ kind: "settlement", title: "Settlement check", check: "Settlement record matches", decision: "matched", stateBefore: state, stateAfter: state, stateWrite: false, note: "No change required." });
  }

  const interrupted = c.persistence === "interrupted";
  push({ kind: "audit", title: "Audit trail", check: interrupted ? "Audit store unavailable" : "Previous state, new state, and reason", decision: interrupted ? "pending" : "written", stateBefore: state, stateAfter: state, stateWrite: false, note: interrupted ? "The evidence boundary is pending; the record is retried." : "The change stays readable after the fact." });

  const outcome = projectScenario("payflow", c, mode).find((node) => node.id === "state")?.value ?? "PAID";
  return {
    steps,
    finalState: state,
    deliveries: steps.filter((step) => step.kind === "delivery").length,
    stateWrites: steps.filter((step) => step.stateWrite && step.kind === "delivery").length,
    acknowledged: steps.filter((step) => step.decision === "acknowledged" || step.decision === "ignored-stale").length,
    outcome,
  };
}

/* ------------------------------------------------------------ Observability */

export const latencyThresholdMs = 500;
export const signalTimes = ["10:40", "10:41", "10:42", "10:43"] as const;

const latencySeries: Record<string, number[]> = {
  normal: [170, 185, 178, 180],
  degraded: [190, 260, 430, 620],
  severe: [240, 560, 780, 940],
};

export type SignalInterval = {
  time: string;
  /** What the service actually did in this simulation. */
  actualLatency: number;
  /** What monitoring observed; null when the sample was not collected or not monitored. */
  observedLatency: number | null;
  collected: boolean;
  health: "pass" | "fail";
  alert: "firing" | "quiet" | "no data" | "no rule" | "not monitored";
};

export type SignalRun = {
  intervals: SignalInterval[];
  monitorsLatency: boolean;
  /** Intervals observed above the threshold. Null when the last samples are missing. */
  observedBreaches: number | null;
  actualBreaches: number;
  decision: string;
  decisionDetail: string;
};

export function simulateSignals(conditions: Conditions, mode: ProjectionMode): SignalRun {
  const c = resolveScenarioConditions("iyup", conditions);
  const monitorsLatency = mode === "designed";
  const missing = c.scrape === "missing";
  const series = latencySeries[c.latency] ?? latencySeries.normal;
  const intervals = series.map((value, index): SignalInterval => {
    // A missing scrape target loses the two most recent samples.
    const collected = !(missing && index >= series.length - 2);
    const observed = monitorsLatency && collected ? value : null;
    const alert: SignalInterval["alert"] = !monitorsLatency
      ? "not monitored"
      : c.alert === "absent"
        ? "no rule"
        : observed === null
          ? "no data"
          : observed > latencyThresholdMs
            ? "firing"
            : "quiet";
    return { time: signalTimes[index], actualLatency: value, observedLatency: observed, collected, health: c.health === "pass" ? "pass" : "fail", alert };
  });
  const decisionNode = projectScenario("iyup", c, mode).find((node) => node.id === "decision");
  const observedTail = intervals.slice(-2).some((interval) => interval.observedLatency === null);
  return {
    intervals,
    monitorsLatency,
    observedBreaches: !monitorsLatency || observedTail ? null : intervals.filter((interval) => (interval.observedLatency ?? 0) > latencyThresholdMs).length,
    actualBreaches: series.filter((value) => value > latencyThresholdMs).length,
    decision: decisionNode?.value ?? "QUIET",
    decisionDetail: decisionNode?.detail ?? "",
  };
}

/* ------------------------------------------------------------- Device trust */

export type PolicyCondition = { label: string; met: boolean };
export type PolicyRule = {
  id: string;
  when: string;
  conditions: PolicyCondition[];
  result: "ALLOW" | "REQUIRE CONFIRMATION" | "BLOCK";
  status: "matched" | "not met" | "not reached";
};

export type PolicyRun = {
  environment: "suspicious" | "clear";
  environmentReasons: string[];
  signatureValid: boolean;
  sensitivity: "high" | "low";
  rules: PolicyRule[];
  decision: PolicyRule["result"];
};

export function evaluatePolicy(conditions: Conditions, mode: ProjectionMode): PolicyRun {
  const c = resolveScenarioConditions("trustgate", conditions);
  const reasons = [
    c.root === "detected" ? "Root detected" : c.root === "suspected" ? "Possible root signal" : null,
    c.emulator === "detected" ? "Emulator detected" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const suspicious = reasons.length > 0;
  const signatureValid = c.signature === "valid";
  const high = c.sensitivity === "high";

  const definitions: Array<Omit<PolicyRule, "status">> = mode === "designed"
    ? [
        { id: "signature", when: "Request signature is invalid", conditions: [{ label: "Signature invalid", met: !signatureValid }], result: "BLOCK" },
        { id: "root-sensitive", when: "Root detected on a sensitive action", conditions: [{ label: "Root detected", met: c.root === "detected" }, { label: "Sensitivity high", met: high }], result: "BLOCK" },
        { id: "suspicious-sensitive", when: "Suspicious environment on a sensitive action", conditions: [{ label: "Environment suspicious", met: suspicious }, { label: "Sensitivity high", met: high }], result: "REQUIRE CONFIRMATION" },
        { id: "default", when: "Otherwise", conditions: [], result: "ALLOW" },
      ]
    : [
        { id: "any-suspicious", when: "Any suspicious environment signal", conditions: [{ label: "Environment suspicious", met: suspicious }], result: "BLOCK" },
        { id: "default", when: "Otherwise", conditions: [], result: "ALLOW" },
      ];

  let matched = false;
  const rules = definitions.map((rule): PolicyRule => {
    if (matched) return { ...rule, status: "not reached" };
    const hit = rule.conditions.every((condition) => condition.met);
    if (hit) matched = true;
    return { ...rule, status: hit ? "matched" : "not met" };
  });
  const decision = rules.find((rule) => rule.status === "matched")?.result ?? "ALLOW";
  return {
    environment: suspicious ? "suspicious" : "clear",
    environmentReasons: reasons,
    signatureValid,
    sensitivity: high ? "high" : "low",
    rules,
    decision,
  };
}

/** Plain-language label for a projected outcome value. */
export function readableOutcome(slug: ScenarioSlug, value: string) {
  const labels: Record<string, string> = {
    "payflow:REAPPLIED": "Payment updated again",
    "payflow:UNCHANGED": "Payment stayed completed",
    "payflow:PAID": "Payment completed",
    "payflow:REVIEW REQUIRED": "Manual review needed",
    "iyup:DEGRADING": "Degradation detected",
    "iyup:HEALTHY": "Service operating normally",
    "iyup:OUTAGE": "Outage detected",
    "iyup:UNKNOWN": "Not enough telemetry",
    "iyup:INCOMPLETE": "Health check misses degradation",
    "iyup:ACTIONABLE": "Degradation visible before outage",
    "iyup:INVESTIGATE COLLECTION": "Telemetry collection needs investigation",
    "iyup:QUIET": "No warning raised",
    "trustgate:ALLOW": "Allow action",
    "trustgate:BLOCK": "Block action",
    "trustgate:REQUIRE CONFIRMATION": "Ask for confirmation",
  };
  return labels[`${slug}:${value}`] ?? value.toLowerCase().replaceAll("_", " ");
}
