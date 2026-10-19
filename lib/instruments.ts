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

/** The simulated service's p95 over four minutes for each behaviour. */
export const latencyProfiles: Record<string, readonly number[]> = {
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

/**
 * What monitoring makes of one sample of the service: whether latency is observed at all, and
 * what the alert says. Shared by the case model and the live simulator, so both alert alike.
 */
export function observeSample(actualLatency: number, collected: boolean, conditions: Conditions, mode: ProjectionMode): Omit<SignalInterval, "time"> {
  const c = resolveScenarioConditions("iyup", conditions);
  const monitorsLatency = mode === "designed";
  const observed = monitorsLatency && collected ? actualLatency : null;
  const alert: SignalInterval["alert"] = !monitorsLatency
    ? "not monitored"
    : c.alert === "absent"
      ? "no rule"
      : observed === null
        ? "no data"
        : observed > latencyThresholdMs
          ? "firing"
          : "quiet";
  return { actualLatency, observedLatency: observed, collected, health: c.health === "pass" ? "pass" : "fail", alert };
}

export function simulateSignals(conditions: Conditions, mode: ProjectionMode): SignalRun {
  const c = resolveScenarioConditions("iyup", conditions);
  const monitorsLatency = mode === "designed";
  const missing = c.scrape === "missing";
  const series = latencyProfiles[c.latency] ?? latencyProfiles.normal;
  // A missing scrape target loses the two most recent samples.
  const intervals = series.map((value, index): SignalInterval => ({ time: signalTimes[index], ...observeSample(value, !(missing && index >= series.length - 2), c, mode) }));
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

// Case 03's instrument is the repo's own scorer and gate: see `assessDevice` in ./device-risk.

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
    "trustgate:ALLOW": "Payment allowed",
    "trustgate:BLOCK": "Blocked, nothing signed",
    "trustgate:REQUIRE CONFIRMATION": "Confirmation required",
  };
  return labels[`${slug}:${value}`] ?? value.toLowerCase().replaceAll("_", " ");
}
