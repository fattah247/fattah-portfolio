import { latencyProfiles, latencyThresholdMs, observeSample, type PaymentState, type SignalInterval } from "./instruments";
import { resolveScenarioConditions, type Conditions, type ProjectionMode } from "./scenarios";

/*
 * Live simulators behind each case's "Try it". The case models in lib/instruments.ts describe one
 * fixed story; these engines let a visitor drive the same rules event by event or minute by
 * minute, and tests hold them to the models wherever both describe the same moment. All values
 * are synthetic demonstrations.
 */

/* ----------------------------------------------------------------- Payments */

/** One message from the bank: what it says in plain words, and the ID and sequence it carries. */
export type PayMessage = { id: string; seq: number; status: "PAID" | "PENDING"; says: string };

/** The bank's two updates for one payment: "pending" first, then "paid". */
export const paidMessage: PayMessage = { id: "evt-02", seq: 2, status: "PAID", says: "paid" };
export const lateMessage: PayMessage = { id: "evt-01", seq: 1, status: "PENDING", says: "pending" };

export type PayInput =
  | { kind: "deliver"; message: PayMessage }
  | { kind: "settle"; matched: boolean }
  | { kind: "store"; online: boolean };

export type PayOutcome = "applied" | "duplicate" | "stale" | "applied-again" | "regressed" | "matched" | "mismatched" | "store-down" | "store-up";
export type PayTone = "confirmed" | "designed" | "uncertain" | "adverse" | "neutral";

export type PayEntry = {
  n: number;
  outcome: PayOutcome;
  tone: PayTone;
  /** What happened, in plain words. */
  plain: string;
  /** The mechanism, in engineering terms. */
  hood: string;
  message?: PayMessage;
  /** For a delivery: whether it went through the id check to the payment. */
  passed?: boolean;
};

export type AuditRecord = { n: number; change: string; status: "written" | "pending" };

export type PayWorld = {
  state: PaymentState;
  processed: string[];
  lastSeq: number;
  deliveries: number;
  /** Deliveries that ran the payment's state path. */
  updates: number;
  /** The same message applied more than once; only possible without the check. */
  repeats: number;
  storeOnline: boolean;
  audit: AuditRecord[];
  entries: PayEntry[];
  lastMessage: PayMessage | null;
};

export const emptyPayWorld: PayWorld = {
  state: "PENDING",
  processed: [],
  lastSeq: 0,
  deliveries: 0,
  updates: 0,
  repeats: 0,
  storeOnline: true,
  audit: [],
  entries: [],
  lastMessage: null,
};

/** Payment states as a customer would say them. */
export const paymentStateWord: Record<PaymentState, string> = { PENDING: "Waiting", PAID: "Paid", REVIEW: "Needs checking" };
const stateWord = paymentStateWord;

function recordChange(world: PayWorld, before: PaymentState, after: PaymentState, reason: string): AuditRecord[] {
  const change = before === after ? `${stateWord[after]} again: ${reason}` : `${stateWord[before]} → ${stateWord[after]}: ${reason}`;
  return [...world.audit, { n: world.audit.length + 1, change, status: world.storeOnline ? "written" : "pending" }];
}

/**
 * One event against the payment. With the check on, a message is applied only if its ID is new
 * and its sequence is the newest seen; without it, every delivery is applied as it arrives.
 */
export function payStep(world: PayWorld, input: PayInput, checked: boolean): PayWorld {
  const n = world.entries.length + 1;
  const log = (entry: Omit<PayEntry, "n">, next: Partial<PayWorld>): PayWorld => ({ ...world, ...next, entries: [...world.entries, { n, ...entry }] });

  if (input.kind === "store") {
    if (input.online === world.storeOnline) return world;
    if (!input.online) {
      return log({ outcome: "store-down", tone: "uncertain", plain: "The record book is unavailable. New entries will wait until it's back.", hood: "audit_store: unavailable → records queue as pending" }, { storeOnline: false });
    }
    const pending = world.audit.filter((record) => record.status === "pending").length;
    return log(
      { outcome: "store-up", tone: "confirmed", plain: pending ? `The record book is back. ${pending} waiting ${pending === 1 ? "entry was" : "entries were"} written down.` : "The record book is available again.", hood: `audit_store: available → retry ${pending} pending ${pending === 1 ? "record" : "records"}, none dropped` },
      { storeOnline: true, audit: world.audit.map((record) => ({ ...record, status: "written" })) },
    );
  }

  if (input.kind === "settle") {
    if (input.matched) {
      return log({ outcome: "matched", tone: "confirmed", plain: "Daily report: the bank's records match ours.", hood: "settlement record = payment record → no state change" }, {});
    }
    const before = world.state;
    return log(
      { outcome: "mismatched", tone: "uncertain", plain: "Daily report: the bank's records don't match ours, so the payment waits for a person to check it.", hood: `settlement ≠ payment record → ${before} → REVIEW` },
      { state: "REVIEW", audit: before === "REVIEW" ? world.audit : recordChange(world, before, "REVIEW", "daily report didn't match") },
    );
  }

  const message = input.message;
  const repeat = world.processed.includes(message.id);
  const older = message.seq < world.lastSeq;
  const before = world.state;
  const base = { deliveries: world.deliveries + 1, lastMessage: message };
  const processed = repeat ? world.processed : [...world.processed, message.id];

  if (checked && repeat) {
    return log({ outcome: "duplicate", tone: "designed", plain: `The bank said “${message.says}” again. Already handled, so we told the bank “got it” and changed nothing.`, hood: `${message.id} ∈ processed IDs → 200 OK, no state write (idempotent)`, message, passed: false }, base);
  }
  if (checked && older) {
    return log({ outcome: "stale", tone: "designed", plain: `An old “${message.says}” message arrived late. We already know newer news, so we noted it and changed nothing.`, hood: `seq ${message.seq} < last seq ${world.lastSeq} → record only, keep the newer state`, message, passed: false }, { ...base, processed });
  }
  if (!checked && repeat) {
    return log(
      { outcome: "applied-again", tone: "adverse", plain: `The bank said “${message.says}” again, and with no check it was processed again: the same payment handled twice.`, hood: `no id check → state path runs again for ${message.id}`, message, passed: true },
      { ...base, updates: world.updates + 1, repeats: world.repeats + 1, audit: recordChange(world, before, before, `“${message.says}” handled a second time`) },
    );
  }
  if (!checked && older) {
    return log(
      { outcome: "regressed", tone: "adverse", plain: `An old “${message.says}” message arrived late and, with no check, overwrote the newer news. Someone now has to fix it by hand.`, hood: `no ordering check → seq ${message.seq} written over seq ${world.lastSeq} → REVIEW`, message, passed: true },
      { ...base, processed, updates: world.updates + 1, state: "REVIEW", audit: recordChange(world, before, "REVIEW", `old “${message.says}” overwrote newer news`) },
    );
  }
  const after: PaymentState = message.status === "PAID" ? "PAID" : before;
  return log(
    { outcome: "applied", tone: "confirmed", plain: after !== before ? `The bank said “${message.says}”. The payment went from ${stateWord[before].toLowerCase()} to ${stateWord[after].toLowerCase()}.` : `The bank said “${message.says}”. Noted; the payment is still ${stateWord[after].toLowerCase()}.`, hood: `${message.id} new · seq ${message.seq} newest → write ${before} → ${after}, add ${message.id} to processed IDs`, message, passed: true },
    { ...base, processed, lastSeq: Math.max(world.lastSeq, message.seq), updates: world.updates + 1, state: after, audit: recordChange(world, before, after, `bank said “${message.says}”`) },
  );
}

/** The story a case starts from, as the events that make it up. */
export function paymentScript(conditions: Conditions): PayInput[] {
  const c = resolveScenarioConditions("payflow", conditions);
  const script: PayInput[] = [];
  if (c.persistence === "interrupted") script.push({ kind: "store", online: false });
  script.push({ kind: "deliver", message: paidMessage });
  if (c.delivery === "duplicate") script.push({ kind: "deliver", message: paidMessage });
  if (c.delivery === "out-of-order") script.push({ kind: "deliver", message: lateMessage });
  script.push({ kind: "settle", matched: c.settlement === "matched" });
  return script;
}

export const playPayment = (inputs: readonly PayInput[], checked: boolean, from: PayWorld = emptyPayWorld) => inputs.reduce((world, input) => payStep(world, input, checked), from);

/* ------------------------------------------------------------------ Service */

/** Minutes shown on the live chart. */
export const liveWindow = 12;

/**
 * The service's actual p95, a number of minutes after its behaviour last changed: the case's
 * four-minute ramp, then holding with a small steady wobble so the line stays alive.
 */
export function liveLatency(profile: string, sinceChange: number, minute: number) {
  const series = latencyProfiles[profile] ?? latencyProfiles.normal;
  const settled = sinceChange >= series.length;
  return series[Math.min(sinceChange, series.length - 1)] + (settled ? [0, 9, -6, 4, -8, 3][minute % 6] : 0);
}

export const clockAt = (minute: number) => {
  const total = 10 * 60 + 40 + minute;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export type LiveSample = SignalInterval & { minute: number };

/** One minute of the live service, observed the way the chosen dashboard observes it. */
export function liveSample(conditions: Conditions, mode: ProjectionMode, sinceChange: number, minute: number): LiveSample {
  const c = resolveScenarioConditions("iyup", conditions);
  return { minute, time: clockAt(minute), ...observeSample(liveLatency(c.latency, sinceChange, minute), c.scrape !== "missing", c, mode) };
}

export type OnCallStatus = { tone: PayTone; title: string; detail: string };

/** What the on-call screen says about the latest minute. */
export function onCallStatus(sample: SignalInterval, mode: ProjectionMode): OnCallStatus {
  if (sample.health === "fail") return { tone: "adverse", title: "Outage", detail: "The health check is failing: the service is not answering." };
  if (mode === "baseline") return { tone: "confirmed", title: "Looks fine", detail: "The health check passes. This dashboard collects nothing else." };
  // Missing data outranks the alert rule: with nothing collected, quiet is unknown, rule or not.
  if (!sample.collected) return { tone: "uncertain", title: "Investigate collection", detail: "No samples are arriving. Quiet is not the same as fine." };
  if (sample.alert === "firing") return { tone: "adverse", title: "Paging on-call", detail: `Response time ${sample.observedLatency} ms is over the ${latencyThresholdMs} ms line.` };
  if (sample.alert === "no rule" && (sample.observedLatency ?? 0) > latencyThresholdMs) return { tone: "uncertain", title: "Breach, nobody paged", detail: `Response time ${sample.observedLatency} ms is over the line, but no alert rule raises it.` };
  return { tone: "confirmed", title: "All quiet", detail: `Response time ${sample.observedLatency ?? "–"} ms, under the ${latencyThresholdMs} ms line.` };
}
