/*
 * Case 01's toy, a small world from a shop to a bank, left to right. A customer pays 750,000 IDR at
 * a shop's counter; the cashier's card machine sends the payment's receipt along a line to Payflow's
 * server; at closing the server sends the money to the bank along a second line, and the bank's
 * settlement comes back to the server and on to the cashier. Every action goes through `flowStep`
 * (lib/payment-flow.ts), which follows the Payflow Reliability repo; a server with no inbox takes
 * the same actions through `naiveStep`, a comparison for the site.
 *
 * The picture maps one to one onto the repo: a receipt is a provider webhook and its number the
 * event id; the cashier tapping again on a weak signal is the provider redelivering the same event;
 * the slow signal's old message is a late AUTHORIZED; a mistyped amount is an amount mismatch; the
 * server's inbox is the event inbox; closing the day is the settlement run (747,750 IDR after the
 * 30 bps fee), followed by the provider's daily report; the bank's answer is the bank statement; the
 * person at the server is RELEASE_PAYMENT.
 *
 * This module decides what can be done at any moment: only actions that do something visible, and
 * on a first visit one at a time, so there is always one clear next thing to tap.
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

export type World = {
  flow: FlowWorld;
  naive: NaiveWorld;
  /** What the visitor has done on this payment, so a suggestion is something new. */
  tried: string[];
  /** The rules the visitor has seen stop something, so each can be broken as the repo's tests do. */
  revealed: MutationId[];
  /** Held money left with its rule broken: only the rule back or a fresh start is left. */
  frozen: boolean;
};

export const emptyWorld: World = { flow: emptyFlow, naive: emptyNaive, tried: [], revealed: [], frozen: false };

/** Who in the world an action belongs to: tap them to do it. The bank answers by a choice. */
export type Actor = "customer" | "cashier" | "signal" | "server" | "operator" | "bank" | "tech";

export type Action = {
  id: string;
  actor: Actor;
  /** One action can be several things in the repo: closing the day is the settlement, then the report. */
  inputs: FlowInput[];
  /** What it does, in everyday words and in the repo's terms. */
  label: string;
  technical: string;
  /** For a story's step: the action it plays as, so the world shows it the same way. */
  as?: string;
};

const idr = (amount: number) => `${amount.toLocaleString("en-US")} IDR`;
const captured = (flow: FlowWorld) => flow.journals.includes("CAPTURE");
const held = (flow: FlowWorld) => flow.status === "MANUAL_REVIEW";
const webhook = (kind: "success" | "again" | "new-id" | "late-authorized" | "wrong-amount"): FlowInput => ({ kind: "webhook", webhook: kind });

/**
 * The order actions join the world on a first visit: one to start, and the next once the one
 * before it has been done. What the visitor has met stays after Start over.
 */
export const introductions = ["pay", "again", "late", "close", "bank-credit", "typo"] as const;

/** The actions introduced so far, given everything the visitor has done (all of them when unknown). */
export function introduced(used?: readonly string[]): Set<string> {
  if (!used) return new Set(introductions);
  const next = introductions.findIndex((id) => !used.includes(id));
  return new Set(next < 0 ? introductions : introductions.slice(0, next + 1));
}

const gated = (id: string) => (introductions as readonly string[]).includes(id);
/** The bank's other answers join with its first one. */
const gateOf = (id: string) => (id === "bank-none" || id === "bank-no-ref" ? "bank-credit" : id);
const present = (action: Action, used?: readonly string[]) => !gated(gateOf(action.id)) || introduced(used).has(gateOf(action.id));

/** An action that has just joined and hasn't been done. */
export const isNew = (action: Action, used?: readonly string[]) => !!used && gated(gateOf(action.id)) && !used.includes(action.id);

/** Every action available right now; the repo's own rule-breaking and extras only with Technical details. */
export function actions(world: World, used?: readonly string[], technical = false): Action[] {
  const { flow } = world;
  if (world.frozen) return technical ? ruleActions(world) : [];
  const list: Action[] = [];
  const sent = flow.lastEvent !== null;
  const closed = flow.payout !== "NONE";

  // The shop: the customer pays once; the cashier taps again, mistypes, or corrects.
  if (!sent) {
    list.push({ id: "pay", actor: "customer", inputs: [webhook("success")], label: "The customer pays by card", technical: "provider webhook · SUCCESS" });
    list.push({ id: "typo", actor: "cashier", inputs: [webhook("wrong-amount")], label: `The cashier types ${WRONG_AMOUNT.toLocaleString("en-US")} by mistake`, technical: `provider webhook · SUCCESS ${WRONG_AMOUNT}` });
  } else {
    list.push({ id: "again", actor: "cashier", inputs: [webhook("again")], label: "The cashier taps again: the signal is weak", technical: `redeliver ${flow.lastEvent!.id}` });
    if (held(flow)) list.push({ id: "fix", actor: "cashier", inputs: [webhook("success")], label: `The cashier types the right amount, ${PAYMENT_AMOUNT.toLocaleString("en-US")}`, technical: "provider webhook · SUCCESS (new event)" });
    if (!closed) list.push({ id: "late", actor: "signal", inputs: [webhook("late-authorized")], label: "The slow signal delivers an old message", technical: "provider webhook · AUTHORIZED, late" });
    if (technical && captured(flow)) list.push({ id: "new-id", actor: "tech", inputs: [webhook("new-id")], label: "The same news on a new receipt", technical: "provider webhook · SUCCESS, new event id" });
  }
  // The server: a person checks a held payment; closing the day sends the money to the bank.
  if (held(flow) && flow.heldFrom) list.push({ id: "release", actor: "operator", inputs: [{ kind: "release" }], label: "A person at Payflow checks it and releases it", technical: "RELEASE_PAYMENT" });
  if (!closed && captured(flow) && (flow.status === "SUCCESS" || held(flow))) {
    list.push({ id: "close", actor: "server", inputs: [{ kind: "settle" }], label: held(flow) ? "Close the day while it's on hold" : `Close the day: send ${idr(PAYOUT_NET)} to the bank`, technical: "settlement batch, then the provider's report" });
  }
  // The bank answers once the money is on its way.
  if (flow.payout === "IN_TRANSIT") {
    list.push(
      { id: "bank-credit", actor: "bank", inputs: [{ kind: "statement", statement: "credit" }], label: "The money arrives", technical: "camt.053 credit, EndToEndId = payout reference" },
      { id: "bank-none", actor: "bank", inputs: [{ kind: "statement", statement: "no-credit" }], label: "It never arrives", technical: "no credit by value date + 2 days" },
      { id: "bank-no-ref", actor: "bank", inputs: [{ kind: "statement", statement: "no-reference" }], label: "It arrives with no reference", technical: "credit without EndToEndId" },
    );
  }
  if (technical && (flow.payout === "LANDED" || flow.payout === "BROKEN")) list.push({ id: "bank-again", actor: "tech", inputs: [{ kind: "statement", statement: "reimport" }], label: "The bank sends its statement again", technical: "statement re-imported" });
  if (technical) list.push(...ruleActions(world));
  return list.filter((action) => present(action, used));
}

/** The repo proves its rules by breaking them in its own tests; each appears once seen at work. */
function ruleActions(world: World): Action[] {
  const { flow } = world;
  return (Object.keys(mutations) as MutationId[]).flatMap((id): Action[] => {
    const removed = flow.removed.includes(id);
    if (!removed && (world.frozen || !world.revealed.includes(id) || !guardStillMatters(id, flow))) return [];
    return [{ id: `rule:${id}`, actor: "tech", inputs: [{ kind: "mutate", mutation: id, removed: !removed }], label: removed ? `Put back “${mutations[id].plain.toLowerCase()}”` : `Break “${mutations[id].plain.toLowerCase()}”, as the repo's tests do`, technical: removed ? `revert mutation: ${mutations[id].technical}` : `mutation: ${mutations[id].technical}` }];
  });
}

function guardStillMatters(id: MutationId, flow: FlowWorld) {
  if (id === "settle-held") return held(flow) && captured(flow) && flow.payout === "NONE";
  if (id === "match-by-amount") return flow.payout === "IN_TRANSIT";
  return flow.payout === "LANDED";
}

/** One input through both servers: the one with no inbox reads it first (it sees the repo's last event). */
function both(world: World, input: FlowInput): World {
  const naive = input.kind === "release" || input.kind === "mutate" ? world.naive : naiveStep(world.naive, input, world.flow);
  const flow = flowStep(world.flow, input);
  const entry = flow.entries.at(-1);
  const revealed = new Set(world.revealed);
  if (entry && entry !== world.flow.entries.at(-1)) {
    if (entry.outcome === "NOTHING_TO_SETTLE" && held(flow) && captured(flow)) revealed.add("settle-held");
    if (entry.outcome === "UNMATCHED_CREDIT" && flow.payout === "IN_TRANSIT") revealed.add("match-by-amount");
    if (entry.outcome === "ALREADY_IMPORTED" && flow.payout === "LANDED") revealed.add("accept-reimport");
  }
  const frozen = world.frozen || (entry?.outcome === "RULE_BROKEN" && input.kind === "settle");
  return { ...world, flow, naive, revealed: [...revealed], frozen };
}

/**
 * One action done. Closing the day pays out; once the money has left, the provider's daily report
 * arrives on its own, as it does every day, so the bank's answer decides the reconciliation.
 */
export function actSteps(world: World, action: Action): World[] {
  const steps: World[] = [];
  let next = world;
  for (const input of action.inputs) {
    next = both(next, input);
    steps.push(next);
    if (input.kind === "settle" && next.flow.entries.at(-1)?.outcome === "BATCH_CREATED") {
      next = both(next, { kind: "report", matches: true });
      steps.push(next);
    }
  }
  const tried = world.tried.includes(action.id) ? world.tried : [...world.tried, action.id];
  return steps.map((step) => ({ ...step, tried }));
}

/** One action done: the world after it, through every step it brings. */
export const act = (world: World, action: Action): World => actSteps(world, action).at(-1) ?? world;

/** The case's story for a set of conditions, as the actions done in order. */
export function storyActions(inputs: FlowInput[]): Action[] {
  const list: Action[] = [];
  inputs.forEach((input, index) => {
    // The story's report follows its settlement, which `act` already brings.
    if (input.kind === "report" && inputs[index - 1]?.kind === "settle") return;
    const as = input.kind === "release" ? "release"
      : input.kind === "settle" ? "close"
        : input.kind === "statement" ? (input.statement === "credit" ? "bank-credit" : input.statement === "no-credit" ? "bank-none" : input.statement === "no-reference" ? "bank-no-ref" : "bank-again")
          : input.kind === "webhook" ? (input.webhook === "late-authorized" ? "late" : input.webhook === "wrong-amount" ? "typo" : input.webhook === "again" ? "again" : input.webhook === "new-id" ? "new-id" : index === 0 ? "pay" : "fix")
            : "report";
    const actor: Actor = as === "release" ? "operator" : as === "close" ? "server" : as.startsWith("bank") ? "bank" : as === "late" ? "signal" : as === "pay" ? "customer" : "cashier";
    list.push({ id: `story-${index}`, actor, inputs: [input], label: "", technical: "", as });
  });
  return list;
}

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
  MATCHED_AWAITING_BANK: { word: "Report agrees", tone: "neutral" },
  MATCHED_NO_ACTION: { word: "Report agrees", tone: "neutral" },
  ALREADY_RECONCILED: { word: "Report agrees", tone: "confirmed" },
  RECONCILED: { word: "Reconciled", tone: "confirmed" },
  MISMATCH: { word: "Report differs", tone: "uncertain" },
  LANDED: { word: "Landed", tone: "confirmed" },
  MISSING_CREDIT: { word: "Missing", tone: "adverse" },
  UNMATCHED_CREDIT: { word: "Suspense", tone: "uncertain" },
  ALREADY_IMPORTED: { word: "Have it", tone: "confirmed" },
  NO_PAYOUT_YET: { word: "Nothing yet", tone: "neutral" },
  RULE_REMOVED: { word: "Rule off", tone: "uncertain" },
  RULE_RESTORED: { word: "Rule back", tone: "neutral" },
  RULE_BROKEN: { word: "Broke a rule", tone: "adverse" },
};

export function stampFor(entry: FlowEntry): Stamp {
  const technical = entry.http ? (entry.http === 409 ? `409 ${entry.outcome}` : `${entry.outcome} ${entry.http}`) : entry.outcome === "MISSING_CREDIT" ? "BROKEN · MISSING_CREDIT" : entry.outcome;
  const stamp = entry.outcome === "LANDED" && /reconciled/.test(entry.plain) ? stamps.RECONCILED : stamps[entry.outcome];
  return { ...stamp, technical };
}

/* ------------------------------------------------------------------- Words */

export type Line = { speaker: "payflow" | "cashier" | "customer"; text: string };

/** What the server (Payflow) says about the latest thing it got. */
export function payflowLine(world: World): string {
  const entry = world.flow.entries.at(-1);
  if (!entry) return "I'm Payflow, the shop's payment server. Every receipt from the card machine comes to me, and I decide whether money moves.";
  const input = entry.input;
  switch (entry.outcome) {
    case "APPLIED":
      return entry.event?.status === "AUTHORIZED" ? "Authorized: the card is good. The money moves when “paid” comes." : "Paid. I take the customer's 750,000 once, and keep the receipt in my inbox.";
    case "DUPLICATE_IGNORED":
      return input.kind === "webhook" && input.webhook === "again" ? "I have that receipt already. I answer “got it”, and no money moves." : "Same news on a new receipt. It's already paid; no money moves.";
    case "STALE_IGNORED":
      return "That message is older than what I know. It stays paid.";
    case "SENT_TO_REVIEW":
      return `${WRONG_AMOUNT.toLocaleString("en-US")} for a ${PAYMENT_AMOUNT.toLocaleString("en-US")} price? I hold it until a person checks.`;
    case "PAYMENT_ON_HOLD":
      return "It's on hold, so I record nothing yet. Send that again later.";
    case "RELEASED":
      return "Checked and released. The cashier's last receipt can come through now.";
    case "BATCH_CREATED":
      return `Day closed: ${idr(PAYOUT_NET)} goes to the bank, after the ${idr(PAYOUT_FEE)} fee.`;
    case "NOTHING_TO_SETTLE":
      return "Not while it's on hold. The money waits for the person checking it.";
    case "MATCHED_AWAITING_BANK":
      return "The card company's daily report agrees. That's its word, not money: I wait for the bank.";
    case "RECONCILED":
      return "The bank's settlement and the report agree: 747,750 is in the shop's bank. Reconciled.";
    case "MISMATCH":
      return "The daily report disagrees. A person will look; the payment stays as it is.";
    case "LANDED":
      return /reconciled/.test(entry.plain) ? "The bank's settlement came back with its reference, and the report agreed. Reconciled." : "The bank's settlement came back with its reference. Now the report has to agree.";
    case "MISSING_CREDIT":
      return "The value date passed and the bank never got it. Broken: treasury takes it.";
    case "UNMATCHED_CREDIT":
      return "Money arrived with no reference. The amount fits, but that proves nothing: suspense.";
    case "ALREADY_IMPORTED":
      return "I've booked that statement. Not twice.";
    case "RULE_REMOVED":
      return input.kind === "mutate" && input.mutation === "settle-held" ? "Rule off. Now close the day while it's on hold." : input.kind === "mutate" && input.mutation === "match-by-amount" ? "Rule off. Now let the money arrive with no reference." : "Rule off. Now have the bank send its statement again.";
    case "RULE_RESTORED":
      return "The rule is back.";
    case "RULE_BROKEN":
      return input.kind === "settle"
        ? "With that rule off, held money left. The repo's tests fail on exactly this."
        : input.kind === "statement" && input.statement === "reimport"
          ? "With that rule off, it's booked twice. The rule that a bank entry counts once catches it."
          : "With that rule off, a guess landed the payout. The rule that a landing needs its reference catches it.";
    default:
      return entry.plain;
  }
}

/** What the cashier says as they do something, or as the settlement reaches them. */
export function cashierLine(world: World, actionId: string, taps: number): string | null {
  const { flow } = world;
  if (actionId === "again") return ["The signal's weak… did it go? Again!", "Come on… again!", "Still spinning. Again!"][(taps - 1) % 3];
  if (actionId === "typo") return `Oops, I typed ${WRONG_AMOUNT.toLocaleString("en-US")}.`;
  if (actionId === "fix") return `The right amount this time: ${PAYMENT_AMOUNT.toLocaleString("en-US")}.`;
  if (flow.status === "RECONCILED") return `Settled: ${PAYOUT_NET.toLocaleString("en-US")} is in our bank.`;
  if (flow.payout === "BROKEN") return "The bank never got our money?";
  return null;
}

/** What the customer sees on their phone after the latest thing. */
export function customerLine(world: World): string {
  const { flow } = world;
  if (!flow.lastEvent) return `${PAYMENT_AMOUNT.toLocaleString("en-US")} IDR to pay`;
  if (captured(flow)) return `charged ${PAYMENT_AMOUNT.toLocaleString("en-US")} IDR, once`;
  if (held(flow)) return "nothing charged yet: on hold";
  return "nothing charged yet";
}

/** What a server with no inbox did with the same thing, if anything. */
export function nextDoorLine(world: World) {
  const entry = world.flow.entries.at(-1);
  if (!entry || entry.input.kind === "release" || entry.input.kind === "mutate") return "";
  return world.naive.last;
}

export function nextDoorFlags(naive: NaiveWorld) {
  const flags: Array<{ id: string; word: string }> = [];
  if (naive.captures > 1) flags.push({ id: "twice", word: naive.captures > 2 ? `Charged ${naive.captures} times` : "Charged twice" });
  if (naive.overwritten) flags.push({ id: "overwritten", word: "Old news won" });
  if (naive.wrongAmount) flags.push({ id: "short", word: "Took the short amount" });
  if (naive.reconciledWithoutBank) flags.push({ id: "no-money", word: "Reconciled, no money" });
  return flags;
}

/** How much a server with no inbox has taken from the customer so far. */
export function nextDoorCharged(naive: NaiveWorld) {
  const full = Math.max(0, naive.captures - naive.wrongAmount);
  return full * PAYMENT_AMOUNT + naive.wrongAmount * WRONG_AMOUNT;
}

export const nextDoorStatus = (naive: NaiveWorld) => statusWord[naive.status];

/** One suggestion: who to tap next, and why. */
export function nudge(world: World, used?: readonly string[], technical = false): { action: string; text: string } | null {
  const list = actions(world, used, technical);
  const offered = (id: string) => list.some((action) => action.id === id);
  const fresh = (id: string) => offered(id) && !world.tried.includes(id);
  const { flow } = world;
  const removed = flow.removed;
  const candidates: Array<[boolean, string, string]> = [
    [world.frozen, "", "Start over for a fresh payment."],
    [removed.includes("settle-held") && offered("close"), "close", "Now tap the server to close the day."],
    [removed.includes("match-by-amount") && offered("bank-no-ref"), "bank-no-ref", "Now let it arrive with no reference."],
    [removed.includes("accept-reimport") && offered("bank-again"), "bank-again", "Now have the bank send its statement again."],
    [!flow.lastEvent && offered("pay"), "pay", "Tap the customer: they pay 750,000 IDR by card."],
    [fresh("again") && captured(flow) && flow.payout === "NONE", "again", "The signal is weak. Tap the cashier: they tap the card machine again."],
    [fresh("fix"), "fix", "Tap the cashier: they type the right amount."],
    [held(flow) && fresh("release") && world.tried.includes("fix"), "release", "Tap the person at the server: they check it and release it."],
    [fresh("release") && world.tried.includes("fix"), "release", "Tap the person at the server: they check it and release it."],
    [held(flow) && fresh("close"), "close", "Tap the server: try closing the day while it's on hold."],
    [technical && fresh("rule:settle-held"), "rule:settle-held", "Break that rule, as the repo's tests do."],
    [fresh("again") && !captured(flow) && !held(flow), "again", "Tap the cashier: they tap the card machine again."],
    [fresh("late") && captured(flow), "late", "Tap the signal: a slow network delivers an old message."],
    [fresh("close"), "close", "Tap the server: close the day and send the money to the bank."],
    [fresh("bank-credit"), "bank-credit", "What does the bank do? Choose: the money arrives."],
    [technical && fresh("rule:match-by-amount"), "rule:match-by-amount", "Break that rule, as the repo's tests do."],
    [technical && fresh("bank-again"), "bank-again", "Banks resend files. Have it send its statement again."],
    [technical && fresh("rule:accept-reimport"), "rule:accept-reimport", "Break that rule, as the repo's tests do."],
    [fresh("typo") && !flow.lastEvent, "typo", "Try a mistake: tap the cashier to type 740,000."],
    [(flow.status === "RECONCILED" || flow.payout === "BROKEN") && !used?.includes("typo"), "", "Start over, then try a mistake at the till."],
    [fresh("again"), "again", "Tap the cashier: they tap again. Does any money move?"],
  ];
  const found = candidates.find(([when]) => when);
  return found ? { action: found[1], text: found[2] } : null;
}

/* ------------------------------------------------------------------ Stories */

export const worldStories: Array<{ label: string; conditions: Record<string, string> }> = [
  { label: "The cashier taps twice", conditions: { delivery: "duplicate", amount: "matches", bank: "landed" } },
  { label: "An old message arrives late", conditions: { delivery: "out-of-order", amount: "matches", bank: "landed" } },
  { label: "The cashier mistypes the amount", conditions: { delivery: "once", amount: "differs", bank: "landed" } },
  { label: "The money never arrives", conditions: { delivery: "once", amount: "matches", bank: "missing" } },
];

export function storyIndex(conditions: Record<string, string>) {
  return worldStories.findIndex((story) => Object.entries(story.conditions).every(([key, value]) => conditions[key] === value));
}
