/*
 * Case 01's toy, the shop counter. A customer pays 750,000 IDR by card; the card machine is the
 * payment provider, which tells Payflow what happened, and Payflow is the cashier at the till, who
 * decides whether the customer's money moves. Every key press goes through `flowStep`
 * (lib/payment-flow.ts), which follows the Payflow Reliability repo; the till next door, which
 * trusts every receipt, takes the same presses through `naiveStep`, a comparison for the site.
 *
 * The picture maps one to one onto the repo: a receipt is a provider webhook and its number the
 * event id, the till's receipt spike is the event inbox, the drawer is the CAPTURE journal, closing
 * the day is the settlement run (747,750 IDR after the 30 bps fee), the shop's bank is the bank
 * statement, the daily report is the provider's report, and the manager is a person's
 * RELEASE_PAYMENT.
 *
 * This module decides what is on the counter at any moment: only keys that do something visible
 * right now, joining one at a time on a first visit, so there is always one clear next thing.
 */

import {
  emptyFlow,
  emptyNaive,
  flowStep,
  mutations,
  naiveStep,
  PAYMENT_AMOUNT,
  PAYOUT_FEE,
  PAYOUT_NET,
  statusWord,
  WRONG_AMOUNT,
  type FlowEntry,
  type FlowInput,
  type FlowOutcome,
  type FlowTone,
  type FlowWorld,
  type MutationId,
  type NaiveWorld,
} from "./payment-flow";

export type Counter = {
  flow: FlowWorld;
  naive: NaiveWorld;
  /** What the visitor has pressed on this payment, so a suggestion is something new. */
  tried: string[];
  /** The rules the visitor has seen stop something, so each can be broken as the repo's tests do. */
  revealed: MutationId[];
  /** A held payment was paid out with its rule broken: only the rule back or a fresh start is left. */
  frozen: boolean;
};

export const emptyCounter: Counter = { flow: emptyFlow, naive: emptyNaive, tried: [], revealed: [], frozen: false };

/** The things on the counter a key belongs to. */
export type Place = "machine" | "till" | "bank" | "rules";

export type CounterKey = {
  id: string;
  place: Place;
  input: FlowInput;
  /** What the key says, in everyday words and in the repo's terms, and the line under it. */
  label: string;
  technical: string;
  hint: string;
};

const idr = (amount: number) => `${amount.toLocaleString("en-US")} IDR`;
const captured = (flow: FlowWorld) => flow.journals.includes("CAPTURE");
const held = (flow: FlowWorld) => flow.status === "MANUAL_REVIEW";

/**
 * The order keys join the counter on a first visit: one to start, and the next once the one before
 * it has been pressed. What the visitor has met stays on the counter after Start over.
 */
export const introductions = ["paid", "again", "late", "pay-out", "short"] as const;

/** The keys introduced so far, given everything the visitor has pressed (all of them when unknown). */
export function introduced(used?: readonly string[]): Set<string> {
  if (!used) return new Set(introductions);
  const next = introductions.findIndex((id) => !used.includes(id));
  return new Set(next < 0 ? introductions : introductions.slice(0, next + 1));
}

const gated = (id: string) => (introductions as readonly string[]).includes(id);
const present = (key: CounterKey, used?: readonly string[]) => !gated(key.id) || introduced(used).has(key.id);

/** A key that has just joined the counter and hasn't been pressed. */
export const isNew = (key: CounterKey, used?: readonly string[]) => !!used && gated(key.id) && !used.includes(key.id);

/** The card machine's keys: what the provider can tell Payflow. At most four at a time. */
export function machineKeys(counter: Counter, used?: readonly string[]): CounterKey[] {
  if (counter.frozen) return [];
  const { flow } = counter;
  const last = flow.lastEvent;
  const again: CounterKey | null = last
    ? { id: "again", place: "machine", input: { kind: "webhook", webhook: "again" }, label: "Send that again", technical: `redeliver ${last.id}`, hint: "machines resend when unsure" }
    : null;
  const paid: CounterKey = captured(flow)
    ? { id: "paid", place: "machine", input: { kind: "webhook", webhook: "new-id" }, label: "Send “paid”, new number", technical: "new event · SUCCESS, restated", hint: "the same news, a new receipt" }
    : { id: "paid", place: "machine", input: { kind: "webhook", webhook: "success" }, label: "Send “paid”", technical: "new event · SUCCESS", hint: "the customer's card went through" };
  const late: CounterKey = { id: "late", place: "machine", input: { kind: "webhook", webhook: "late-authorized" }, label: "Send an old “authorized”", technical: "new event · AUTHORIZED", hint: "older news, arriving late" };
  const short: CounterKey = { id: "short", place: "machine", input: { kind: "webhook", webhook: "wrong-amount" }, label: `Send “paid ${WRONG_AMOUNT.toLocaleString("en-US")}”`, technical: `new event · SUCCESS ${WRONG_AMOUNT}`, hint: `short of the ${PAYMENT_AMOUNT.toLocaleString("en-US")} price` };

  const keys: CounterKey[] = [];
  if (flow.payout !== "NONE") {
    // Once the day is closed, the provider's daily report is what the machine prints.
    if (!flow.reportMatched && flow.status === "SETTLED") keys.push({ id: "report-matches", place: "machine", input: { kind: "report", matches: true }, label: "Daily report: it matches", technical: "report row matches", hint: "the provider's word, not the money" });
    keys.push({ id: "report-differs", place: "machine", input: { kind: "report", matches: false }, label: "Daily report: it differs", technical: "report row MISMATCH", hint: "its numbers disagree with ours" });
    if (again) keys.push(again);
    keys.push(late);
  } else if (held(flow)) {
    // On hold, everything the machine sends is deferred or recognised until the manager decides.
    keys.push(paid);
    if (again) keys.push(again);
    keys.push(late);
  } else if (captured(flow)) {
    if (again) keys.push(again);
    keys.push(late, paid, short);
  } else {
    keys.push(paid, short);
    if (again) keys.push(again);
    else keys.push(late);
  }
  return keys.filter((key) => present(key, used)).slice(0, 4);
}

/** The till's keys: the manager's release while a payment is held, and closing the day. */
export function tillKeys(counter: Counter, used?: readonly string[]): CounterKey[] {
  const { flow } = counter;
  if (counter.frozen) return [];
  const keys: CounterKey[] = [];
  if (held(flow) && flow.heldFrom) keys.push({ id: "release", place: "till", input: { kind: "release" }, label: "Manager: check and release", technical: "RELEASE_PAYMENT", hint: "a person looked at it" });
  if (flow.payout === "NONE" && captured(flow) && (flow.status === "SUCCESS" || held(flow)) && introduced(used).has("pay-out")) {
    keys.push({ id: "pay-out", place: "till", input: { kind: "settle" }, label: "Close the day: pay out", technical: "settlement batch", hint: held(flow) ? "while it's on hold" : `${idr(PAYOUT_NET)} to the shop's bank, after the ${idr(PAYOUT_FEE)} fee` });
  }
  return keys;
}

/** What the shop's bank can say once money is on its way, then once it has answered. */
export function bankKeys(counter: Counter): CounterKey[] {
  const { flow } = counter;
  if (counter.frozen) return [];
  if (flow.payout === "IN_TRANSIT") {
    return [
      { id: "bank-credit", place: "bank", input: { kind: "statement", statement: "credit" }, label: "Money arrives", technical: "camt.053 credit, EndToEndId = payout reference", hint: `${idr(PAYOUT_NET)}, with its reference` },
      { id: "bank-none", place: "bank", input: { kind: "statement", statement: "no-credit" }, label: "It never arrives", technical: "no credit by value date + 2 days", hint: "the value date passes" },
      { id: "bank-no-ref", place: "bank", input: { kind: "statement", statement: "no-reference" }, label: "It arrives, no reference", technical: "credit without EndToEndId", hint: "the amount fits, nothing else" },
    ];
  }
  if (flow.payout === "LANDED" || flow.payout === "BROKEN") {
    return [{ id: "bank-again", place: "bank", input: { kind: "statement", statement: "reimport" }, label: "Sends the statement again", technical: "statement re-imported", hint: "banks resend files" }];
  }
  return [];
}

/**
 * The repo proves its rules by breaking them in its own tests; these keys break one on purpose. Each
 * appears once its rule has been seen stopping something, and only with Technical details.
 */
export function ruleKeys(counter: Counter): CounterKey[] {
  const { flow } = counter;
  return (Object.keys(mutations) as MutationId[]).flatMap((id): CounterKey[] => {
    const removed = flow.removed.includes(id);
    if (!removed && (counter.frozen || !counter.revealed.includes(id) || !guardStillMatters(id, flow))) return [];
    return [{
      id: `rule:${id}`,
      place: "rules",
      input: { kind: "mutate", mutation: id, removed: !removed },
      label: removed ? `Put back “${mutations[id].plain.toLowerCase()}”` : `Break “${mutations[id].plain.toLowerCase()}”`,
      technical: removed ? `revert mutation: ${mutations[id].technical}` : `mutation: ${mutations[id].technical}`,
      hint: removed ? "the rule is guarded again" : "as the repo's tests do, on purpose",
    }];
  });
}

/** A rule can be broken only while the step it guards is still the next thing to try. */
function guardStillMatters(id: MutationId, flow: FlowWorld) {
  if (id === "settle-held") return held(flow) && captured(flow) && flow.payout === "NONE";
  if (id === "match-by-amount") return flow.payout === "IN_TRANSIT";
  return flow.payout === "LANDED";
}

/** Every key the visitor can press right now; rule keys only with Technical details. */
export const counterKeys = (counter: Counter, used?: readonly string[], technical = true) => [
  ...machineKeys(counter, used),
  ...tillKeys(counter, used),
  ...bankKeys(counter),
  ...(technical ? ruleKeys(counter) : []),
];

/** One key pressed: the till next door reads it first (it sees the repo's last event), then Payflow. */
export function counterStep(counter: Counter, key: CounterKey): Counter {
  const naive = key.input.kind === "release" || key.input.kind === "mutate" ? counter.naive : naiveStep(counter.naive, key.input, counter.flow);
  const flow = flowStep(counter.flow, key.input);
  const entry = flow.entries.at(-1);
  const revealed = new Set(counter.revealed);
  if (entry && entry !== counter.flow.entries.at(-1)) {
    if (entry.outcome === "NOTHING_TO_SETTLE" && held(flow) && captured(flow)) revealed.add("settle-held");
    if (entry.outcome === "UNMATCHED_CREDIT" && flow.payout === "IN_TRANSIT") revealed.add("match-by-amount");
    if (entry.outcome === "ALREADY_IMPORTED" && flow.payout === "LANDED") revealed.add("accept-reimport");
  }
  const frozen = counter.frozen || (entry?.outcome === "RULE_BROKEN" && key.input.kind === "settle");
  return { flow, naive, tried: counter.tried.includes(key.id) ? counter.tried : [...counter.tried, key.id], revealed: [...revealed], frozen };
}

/** The case's story for a set of conditions, as the keys pressed in order. */
export function storyKeys(inputs: FlowInput[]): CounterKey[] {
  return inputs.map((input, index) => ({ id: `story-${index}`, place: input.kind === "release" || input.kind === "settle" ? "till" : input.kind === "statement" ? "bank" : "machine", input, label: "", technical: "", hint: "" }));
}

/* -------------------------------------------------------- Where the money is */

export type Step = { id: "pays" | "records" | "paid-out" | "bank"; label: string; state: "done" | "now" | "todo" | "held" | "broken"; note: string };

/** The payment's flow along the counter, and where the 750,000 IDR is on it right now. */
export function flowSteps(counter: Counter): Step[] {
  const { flow } = counter;
  const sent = flow.entries.some((entry) => entry.input.kind === "webhook");
  const got = captured(flow);
  const out = flow.payout !== "NONE";
  const reconciled = flow.status === "RECONCILED";
  const state = (done: boolean, now: boolean): Step["state"] => (done ? "done" : now ? "now" : "todo");
  return [
    { id: "pays", label: "Customer pays", state: state(sent, !sent), note: sent ? "by card" : "750,000 IDR" },
    { id: "records", label: "Payflow takes it once", state: held(flow) ? "held" : state(got, sent && !got), note: held(flow) ? "on hold" : got ? "750,000 in the till" : "waiting" },
    { id: "paid-out", label: "Paid out", state: state(out, got && !out), note: out ? `${PAYOUT_NET.toLocaleString("en-US")} sent` : "at closing" },
    { id: "bank", label: "In the shop's bank", state: flow.payout === "BROKEN" ? "broken" : state(reconciled, out && !reconciled), note: reconciled ? "reconciled" : flow.payout === "LANDED" ? "landed, report due" : flow.payout === "BROKEN" ? "never arrived" : out ? "on its way" : "" },
  ];
}

/** How much the till next door has taken from its customer so far. */
export function nextDoorCharged(naive: NaiveWorld) {
  const full = Math.max(0, naive.captures - naive.wrongAmount);
  return full * PAYMENT_AMOUNT + naive.wrongAmount * WRONG_AMOUNT;
}

/** What Payflow has taken from the customer: once, or nothing yet. */
export const customerCharged = (counter: Counter) => (captured(counter.flow) ? PAYMENT_AMOUNT : 0);

/* ------------------------------------------------------------------ Stamps */

export type Stamp = { word: string; technical: string; tone: FlowTone };

const stamps: Record<FlowOutcome, Omit<Stamp, "technical">> = {
  APPLIED: { word: "Paid", tone: "confirmed" },
  DUPLICATE_IGNORED: { word: "Seen it", tone: "confirmed" },
  STALE_IGNORED: { word: "Old news", tone: "confirmed" },
  SENT_TO_REVIEW: { word: "On hold", tone: "uncertain" },
  PAYMENT_ON_HOLD: { word: "Try later", tone: "uncertain" },
  RELEASED: { word: "Released", tone: "neutral" },
  BATCH_CREATED: { word: "Paid out", tone: "neutral" },
  NOTHING_TO_SETTLE: { word: "Not while held", tone: "confirmed" },
  MATCHED_AWAITING_BANK: { word: "Matches", tone: "neutral" },
  MATCHED_NO_ACTION: { word: "Matches", tone: "neutral" },
  ALREADY_RECONCILED: { word: "Matches", tone: "confirmed" },
  RECONCILED: { word: "Reconciled", tone: "confirmed" },
  MISMATCH: { word: "Differs", tone: "uncertain" },
  LANDED: { word: "Landed", tone: "confirmed" },
  MISSING_CREDIT: { word: "Missing", tone: "adverse" },
  UNMATCHED_CREDIT: { word: "Suspense", tone: "uncertain" },
  ALREADY_IMPORTED: { word: "Have it", tone: "confirmed" },
  NO_PAYOUT_YET: { word: "Nothing yet", tone: "neutral" },
  RULE_REMOVED: { word: "Rule off", tone: "uncertain" },
  RULE_RESTORED: { word: "Rule back", tone: "neutral" },
  RULE_BROKEN: { word: "Broke a rule", tone: "adverse" },
};

/** The stamp an entry gets, in plain words and in the repo's. */
export function stampFor(entry: FlowEntry): Stamp {
  const technical = entry.http ? (entry.http === 409 ? `409 ${entry.outcome}` : `${entry.outcome} ${entry.http}`) : entry.outcome === "MISSING_CREDIT" ? "BROKEN · MISSING_CREDIT" : entry.outcome;
  const stamp = entry.outcome === "LANDED" && /reconciled/.test(entry.plain) ? stamps.RECONCILED : stamps[entry.outcome];
  return { ...stamp, technical };
}

/**
 * Where the thing a key sent goes once it is stamped, so the counter can show it going there: a
 * receipt onto the spike, back to the machine, or aside for the manager; money into the bank or
 * back into the till; the bank's answer onto the till.
 */
export type Fate = "spiked" | "bounced" | "held" | "returned" | "banked" | "refused" | "answered" | "released" | "rule";

export function fateOf(entry: FlowEntry): Fate {
  switch (entry.outcome) {
    case "DUPLICATE_IGNORED":
      return entry.input.kind === "webhook" && entry.input.webhook === "again" ? "bounced" : "spiked";
    case "SENT_TO_REVIEW":
      return "held";
    case "PAYMENT_ON_HOLD":
      return "returned";
    case "BATCH_CREATED":
      return "banked";
    case "NOTHING_TO_SETTLE":
      return "refused";
    case "RULE_BROKEN":
      return entry.input.kind === "settle" ? "banked" : "answered";
    case "RELEASED":
      return "released";
    case "RULE_REMOVED":
    case "RULE_RESTORED":
      return "rule";
    default:
      return entry.input.kind === "statement" ? "answered" : "spiked";
  }
}

/* ------------------------------------------------------------------- Words */

/** What Payflow, the cashier, says about the latest thing: short, about the money. */
export function cashierLine(counter: Counter): string {
  const entry = counter.flow.entries.at(-1);
  if (!entry) return "I'm Payflow, the cashier. A customer is paying 750,000 IDR by card, and the card machine tells me what happened.";
  const input = entry.input;
  switch (entry.outcome) {
    case "APPLIED":
      return entry.event?.status === "AUTHORIZED" ? "Authorized: the card is good. The money moves when “paid” comes." : "Paid. I take the customer's 750,000, once.";
    case "DUPLICATE_IGNORED":
      return input.kind === "webhook" && input.webhook === "again" ? "That receipt is on my spike already. No money moves." : "Same news on a new receipt. It's already paid; no money moves.";
    case "STALE_IGNORED":
      return "That's older news. It stays paid.";
    case "SENT_TO_REVIEW":
      return `${WRONG_AMOUNT.toLocaleString("en-US")} for a ${PAYMENT_AMOUNT.toLocaleString("en-US")} price? I hold it for the manager.`;
    case "PAYMENT_ON_HOLD":
      return "It's on hold, so I record nothing yet. Send that again later.";
    case "RELEASED":
      return "The manager checked it. Send the last “paid” again.";
    case "BATCH_CREATED":
      return `Day closed: ${idr(PAYOUT_NET)} is on its way to the shop's bank, after the ${idr(PAYOUT_FEE)} fee.`;
    case "NOTHING_TO_SETTLE":
      return "Not while it's on hold. The money waits for the manager.";
    case "MATCHED_AWAITING_BANK":
      return "The daily report agrees. That's its word, not money: I wait for the bank.";
    case "RECONCILED":
      return "The report and the bank agree: 747,750 is in the shop's bank.";
    case "MISMATCH":
      return "The report disagrees. A person will look; the payment stays as it is.";
    case "LANDED":
      return /reconciled/.test(entry.plain) ? "It landed with its reference, and the report agreed. Reconciled." : "It landed with its reference. Now the daily report has to agree.";
    case "MISSING_CREDIT":
      return "The value date passed and no money came. It's broken; treasury takes it.";
    case "UNMATCHED_CREDIT":
      return "Money with no reference. The amount fits, but that proves nothing: suspense.";
    case "ALREADY_IMPORTED":
      return "I've booked that statement. Not twice.";
    case "RULE_REMOVED":
      return input.kind === "mutate" && input.mutation === "settle-held" ? "Rule off. Now close the day while it's on hold." : input.kind === "mutate" && input.mutation === "match-by-amount" ? "Rule off. Now let the money arrive with no reference." : "Rule off. Now have the bank send its statement again.";
    case "RULE_RESTORED":
      return "The rule is back.";
    case "RULE_BROKEN":
      return input.kind === "settle"
        ? "With that rule off, held money left the till. The repo's tests fail on exactly this."
        : input.kind === "statement" && input.statement === "reimport"
          ? "With that rule off, it's booked twice. The rule that a bank entry counts once catches it."
          : "With that rule off, a guess landed the payout. The rule that a landing needs its reference catches it.";
    default:
      return entry.plain;
  }
}

/** What the till next door did with the same press, if it did anything. */
export function nextDoorLine(counter: Counter) {
  const entry = counter.flow.entries.at(-1);
  if (!entry || entry.input.kind === "release" || entry.input.kind === "mutate") return "";
  return counter.naive.last;
}

/** What went wrong next door so far. */
export function nextDoorFlags(naive: NaiveWorld) {
  const flags: Array<{ id: string; word: string }> = [];
  if (naive.captures > 1) flags.push({ id: "twice", word: naive.captures > 2 ? `Charged ${naive.captures} times` : "Charged twice" });
  if (naive.overwritten) flags.push({ id: "overwritten", word: "Old news won" });
  if (naive.wrongAmount) flags.push({ id: "short", word: "Took the short amount" });
  if (naive.reconciledWithoutBank) flags.push({ id: "no-money", word: "Reconciled, no money" });
  return flags;
}

export const nextDoorStatus = (naive: NaiveWorld) => statusWord[naive.status];

/** One suggestion, naming a key on the counter the visitor hasn't pressed. */
export function nudge(counter: Counter, used?: readonly string[], technical = false): { key: string; text: string } | null {
  const keys = counterKeys(counter, used, technical);
  const offered = (id: string) => keys.some((key) => key.id === id);
  const fresh = (id: string) => offered(id) && !counter.tried.includes(id);
  const { flow } = counter;
  const removed = flow.removed;
  const closed = flow.payout !== "NONE";
  const candidates: Array<[boolean, string, string]> = [
    [counter.frozen, "", "Start over for a fresh payment."],
    [removed.includes("settle-held") && offered("pay-out"), "pay-out", "Now close the day."],
    [removed.includes("match-by-amount") && offered("bank-no-ref"), "bank-no-ref", "Now let it arrive with no reference."],
    [removed.includes("accept-reimport") && offered("bank-again"), "bank-again", "Now have the bank send its statement again."],
    [!flow.lastEvent && offered("paid"), "paid", "Start here: press “paid” on the card machine."],
    [!closed && fresh("again") && flow.lastEvent?.status === "SUCCESS" && flow.lastEvent.amount === PAYMENT_AMOUNT, "again", "Card machines resend when unsure. Send that again: does the customer pay twice?"],
    [fresh("release"), "release", "Be the manager: check it, and release it."],
    [held(flow) && fresh("pay-out"), "pay-out", "Try closing the day while it's on hold."],
    [technical && fresh("rule:settle-held"), "rule:settle-held", "Break that rule, as the repo's tests do."],
    [!closed && fresh("late") && captured(flow), "late", "News can arrive late. Send an old “authorized”."],
    [fresh("pay-out"), "pay-out", "Close the day: send the money to the shop's bank."],
    [fresh("report-matches"), "report-matches", "The provider's daily report comes next: it matches."],
    [fresh("bank-none") && !flow.reportMatched, "bank-none", "What if the money never arrives?"],
    [fresh("bank-credit"), "bank-credit", "Now let the money arrive at the shop's bank."],
    [technical && fresh("rule:match-by-amount"), "rule:match-by-amount", "Break that rule, as the repo's tests do."],
    [fresh("bank-no-ref"), "bank-no-ref", "What if money arrives with no reference?"],
    [fresh("bank-again"), "bank-again", "Banks resend files. Have it send the statement again."],
    [technical && fresh("rule:accept-reimport"), "rule:accept-reimport", "Break that rule, as the repo's tests do."],
    [fresh("short") && !captured(flow), "short", "Try a short amount: “paid 740,000” for a 750,000 price."],
    [flow.status === "RECONCILED" && !used?.includes("short"), "", "Start over, then try a short amount."],
    [fresh("report-differs"), "report-differs", "What if the daily report disagrees?"],
    [fresh("again"), "again", "Card machines resend when unsure. Send that again."],
    [fresh("late"), "late", "News can arrive late. Send an old “authorized”."],
  ];
  const found = candidates.find(([when]) => when);
  return found ? { key: found[1], text: found[2] } : null;
}

/* ------------------------------------------------------------------ Stories */

/** The stories "Watch it" plays, in order, as the case's conditions. */
export const counterStories: Array<{ label: string; conditions: Record<string, string> }> = [
  { label: "The card machine sends it twice", conditions: { delivery: "duplicate", amount: "matches", bank: "landed" } },
  { label: "An old “authorized” arrives late", conditions: { delivery: "out-of-order", amount: "matches", bank: "landed" } },
  { label: "A short amount", conditions: { delivery: "once", amount: "differs", bank: "landed" } },
  { label: "The money never arrives", conditions: { delivery: "once", amount: "matches", bank: "missing" } },
];

export function storyIndex(conditions: Record<string, string>) {
  return counterStories.findIndex((story) => Object.entries(story.conditions).every(([key, value]) => conditions[key] === value));
}
