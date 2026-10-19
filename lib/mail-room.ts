/*
 * Case 01's toy, the mail room. The visitor is the payment provider's courier and Payflow is the
 * clerk at the desk: every envelope, report, money bag and bank statement goes through
 * `flowStep` (lib/payment-flow.ts), which follows the Payflow Reliability repo, and the desk with
 * no inbox next door takes the same things through `naiveStep`, a comparison for the site.
 *
 * This module decides what is on the desk at any moment. Only things that do something visible
 * right now are offered: an envelope always gets a stamp, a money bag only appears when there is
 * money to pay out (or a hold to show it refused), the bank only answers once a payout is on its
 * way, and a page of the rule book only appears once the visitor has just seen the rule it holds
 * stop something, as the repo's own mutation tests break those rules on purpose.
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
  type ProviderEvent,
} from "./payment-flow";

export type Desk = {
  flow: FlowWorld;
  naive: NaiveWorld;
  /** What the visitor has already used, so a nudge suggests something new. */
  tried: string[];
  /** The rule pages the visitor has seen at work, so each can be torn out. */
  revealed: MutationId[];
  /** A held payment was paid out with its rule torn out: the desk only lets the rule back or a fresh start. */
  frozen: boolean;
};

export const emptyDesk: Desk = { flow: emptyFlow, naive: emptyNaive, tried: [], revealed: [], frozen: false };

/** Where a thing sits in the room. */
export type Place = "bag" | "desk" | "tray" | "bank" | "book";

export type DeskItem = {
  id: string;
  place: Place;
  input: FlowInput;
  /** What the visitor reads on it, in everyday words and in the repo's terms. */
  label: string;
  technical: string;
  /** The line under the label. */
  hint: string;
  /** Which drawing it is. */
  object: "envelope" | "envelope-old" | "envelope-short" | "report" | "money-bag" | "vault" | "reviewer" | "rule-book";
};

const idr = (amount: number) => `${amount.toLocaleString("en-US")} IDR`;

/** What an event says, in the clerk's words. */
function says(event: ProviderEvent) {
  if (event.status === "AUTHORIZED") return "late “authorized”";
  return event.amount === PAYMENT_AMOUNT ? "“paid”" : "the short “paid”";
}

/** The first letter capitalised, after any opening quote. */
const capital = (text: string) => text.replace(/^(“?)(.)/, (_, quote: string, letter: string) => `${quote}${letter.toUpperCase()}`);

const objectOf = (event: ProviderEvent): DeskItem["object"] => (event.status === "AUTHORIZED" ? "envelope-old" : event.amount === PAYMENT_AMOUNT ? "envelope" : "envelope-short");

const captured = (flow: FlowWorld) => flow.journals.includes("CAPTURE");
const held = (flow: FlowWorld) => flow.status === "MANUAL_REVIEW";

/**
 * The order new things join the room. The first visit starts with one envelope; each next one joins
 * once the one before it has been used, so there is always one new thing to try and never a wall of
 * choices. What the visitor has met stays in the room after Start over.
 */
export const introductions = ["paid", "again", "late", "pay-out", "short"] as const;

/** The things introduced so far, given everything the visitor has used (all of them when unknown). */
export function introduced(used?: readonly string[]): Set<string> {
  if (!used) return new Set(introductions);
  const next = introductions.findIndex((id) => !used.includes(id));
  return new Set(next < 0 ? introductions : introductions.slice(0, next + 1));
}

/** Whether a thing is in the room yet: the gated ones once introduced, the rest whenever they apply. */
const present = (item: DeskItem, used?: readonly string[]) => !(introductions as readonly string[]).includes(item.id) || introduced(used).has(item.id);

/** Something the visitor hasn't used yet that has just joined the room. */
export const isNew = (item: DeskItem, used?: readonly string[]) => !!used && (introductions as readonly string[]).includes(item.id) && !used.includes(item.id);

/** The envelopes in the courier's bag: at most four, each of which gets a stamp. */
export function bagItems(desk: Desk, used?: readonly string[]): DeskItem[] {
  if (desk.frozen) return [];
  const { flow } = desk;
  const items: DeskItem[] = [];
  const again = flow.lastEvent;
  const againItem = again
    ? { id: "again", place: "bag", input: { kind: "webhook", webhook: "again" }, label: `${capital(says(again))}, again`, technical: `redeliver ${again.id}`, hint: "the same envelope: couriers resend when unsure", object: objectOf(again) } satisfies DeskItem
    : null;
  const paid: DeskItem = captured(flow)
    ? { id: "paid", place: "bag", input: { kind: "webhook", webhook: "new-id" }, label: "“Paid”, a new envelope", technical: "new event · SUCCESS, restated", hint: "the same news under a new id", object: "envelope" }
    : { id: "paid", place: "bag", input: { kind: "webhook", webhook: "success" }, label: "“Paid”", technical: "new event · SUCCESS", hint: "the payment went through", object: "envelope" };
  const late: DeskItem = { id: "late", place: "bag", input: { kind: "webhook", webhook: "late-authorized" }, label: "Late “authorized”", technical: "new event · AUTHORIZED", hint: "older news, delivered late", object: "envelope-old" };
  const short: DeskItem = { id: "short", place: "bag", input: { kind: "webhook", webhook: "wrong-amount" }, label: "A short “paid”", technical: `new event · SUCCESS ${WRONG_AMOUNT}`, hint: `${WRONG_AMOUNT.toLocaleString("en-US")} for a ${PAYMENT_AMOUNT.toLocaleString("en-US")} payment`, object: "envelope-short" };

  if (flow.payout !== "NONE") {
    // Once the money has left, the provider's daily report is what the courier carries.
    if (!flow.reportMatched && flow.status === "SETTLED") items.push({ id: "report-matches", place: "bag", input: { kind: "report", matches: true }, label: "The report: it matches", technical: "report row matches", hint: "the provider's word, not the money", object: "report" });
    items.push({ id: "report-differs", place: "bag", input: { kind: "report", matches: false }, label: "The report: it differs", technical: "report row MISMATCH", hint: "its numbers disagree with ours", object: "report" });
    if (againItem) items.push(againItem);
    items.push(late);
  } else if (held(flow)) {
    // On hold, every delivery is deferred or recognised; nothing is recorded until a person decides.
    items.push(paid);
    if (againItem) items.push(againItem);
    items.push(late);
  } else if (captured(flow)) {
    if (againItem) items.push(againItem);
    items.push(late, paid, short);
  } else {
    items.push(paid, short);
    if (againItem) items.push(againItem);
    else items.push(late);
  }
  return items.filter((item) => present(item, used)).slice(0, 4);
}

/** The person's tray: a held payment waits here until someone releases it. */
export function trayItem(desk: Desk): DeskItem | null {
  if (desk.frozen || !held(desk.flow) || !desk.flow.heldFrom) return null;
  return { id: "release", place: "tray", input: { kind: "release" }, label: "Release it", technical: "RELEASE_PAYMENT", hint: "a person checked it", object: "reviewer" };
}

/** The money bag on the desk: there to carry to the bank once the payment is paid (or to show a hold refuses it). */
export function moneyItem(desk: Desk, used?: readonly string[]): DeskItem | null {
  const { flow } = desk;
  if (desk.frozen || flow.payout !== "NONE" || !captured(flow) || !introduced(used).has("pay-out")) return null;
  if (flow.status !== "SUCCESS" && !held(flow)) return null;
  return {
    id: "pay-out",
    place: "desk",
    input: { kind: "settle" },
    label: `Pay out ${idr(PAYOUT_NET)}`,
    technical: "settlement batch",
    hint: held(flow) ? "while it's on hold" : `${idr(PAYMENT_AMOUNT)} less the ${idr(PAYOUT_FEE)} fee`,
    object: "money-bag",
  };
}

/** What the bank can do once a payout is on its way, then once it has answered. */
export function bankItems(desk: Desk): DeskItem[] {
  const { flow } = desk;
  if (desk.frozen) return [];
  if (flow.payout === "IN_TRANSIT") {
    return [
      { id: "bank-credit", place: "bank", input: { kind: "statement", statement: "credit" }, label: "Pays, with reference", technical: "camt.053 credit, EndToEndId = payout reference", hint: `${idr(PAYOUT_NET)}, the payout's reference`, object: "vault" },
      { id: "bank-none", place: "bank", input: { kind: "statement", statement: "no-credit" }, label: "Never pays", technical: "no credit by value date + 2 days", hint: "the value date passes", object: "vault" },
      { id: "bank-no-ref", place: "bank", input: { kind: "statement", statement: "no-reference" }, label: "Pays, no reference", technical: "credit without EndToEndId", hint: "the amount fits, nothing else", object: "vault" },
    ];
  }
  if (flow.payout === "LANDED" || flow.payout === "BROKEN") {
    return [{ id: "bank-again", place: "bank", input: { kind: "statement", statement: "reimport" }, label: "Sends the statement again", technical: "statement re-imported", hint: "banks resend files", object: "vault" }];
  }
  return [];
}

/** The rule book's pages: each appears once its rule has just been seen stopping something. */
export function ruleItems(desk: Desk): DeskItem[] {
  const { flow } = desk;
  return (Object.keys(mutations) as MutationId[]).flatMap((id): DeskItem[] => {
    const removed = flow.removed.includes(id);
    if (!removed && (desk.frozen || !desk.revealed.includes(id) || !guardStillMatters(id, flow))) return [];
    return [{
      id: `rule:${id}`,
      place: "book",
      input: { kind: "mutate", mutation: id, removed: !removed },
      label: removed ? "Put the rule back" : `Tear out “${mutations[id].plain.toLowerCase()}”`,
      technical: removed ? `revert mutation: ${mutations[id].technical}` : `mutation: ${mutations[id].technical}`,
      hint: removed ? mutations[id].plain : "as the repo's tests do, on purpose",
      object: "rule-book",
    }];
  });
}

/** A rule can be torn out only while the step it guards is still the next thing to try. */
function guardStillMatters(id: MutationId, flow: FlowWorld) {
  if (id === "settle-held") return held(flow) && captured(flow) && flow.payout === "NONE";
  if (id === "match-by-amount") return flow.payout === "IN_TRANSIT";
  return flow.payout === "LANDED";
}

/** Everything the visitor can use right now. */
export const deskItems = (desk: Desk, used?: readonly string[]) => [...bagItems(desk, used), ...[trayItem(desk), moneyItem(desk, used)].filter((item): item is DeskItem => item !== null), ...bankItems(desk), ...ruleItems(desk)];

/**
 * Where a delivered thing goes once it is stamped, so the room can show it going there: into the
 * ledger, back to the courier's bag, into a person's tray, into the bank, or back onto the desk.
 */
export type Fate = "filed" | "bounced" | "held" | "returned" | "banked" | "refused" | "answered" | "released" | "page";

export function fateOf(entry: FlowEntry): Fate {
  switch (entry.outcome) {
    case "DUPLICATE_IGNORED":
      return entry.input.kind === "webhook" && entry.input.webhook === "again" ? "bounced" : "filed";
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
      return "page";
    default:
      return entry.input.kind === "statement" ? "answered" : "filed";
  }
}

/** One thing delivered: the comparison takes it first (it reads the repo's last event), then Payflow. */
export function deskStep(desk: Desk, item: DeskItem): Desk {
  const naive = item.input.kind === "release" || item.input.kind === "mutate" ? desk.naive : naiveStep(desk.naive, item.input, desk.flow);
  const flow = flowStep(desk.flow, item.input);
  const entry = flow.entries.at(-1);
  const revealed = new Set(desk.revealed);
  if (entry && entry !== desk.flow.entries.at(-1)) {
    if (entry.outcome === "NOTHING_TO_SETTLE" && held(flow) && captured(flow)) revealed.add("settle-held");
    if (entry.outcome === "UNMATCHED_CREDIT" && flow.payout === "IN_TRANSIT") revealed.add("match-by-amount");
    if (entry.outcome === "ALREADY_IMPORTED" && flow.payout === "LANDED") revealed.add("accept-reimport");
  }
  const frozen = desk.frozen || (entry?.outcome === "RULE_BROKEN" && item.input.kind === "settle");
  return { flow, naive, tried: desk.tried.includes(item.id) ? desk.tried : [...desk.tried, item.id], revealed: [...revealed], frozen };
}

/** The story a set of conditions tells, as the things the courier delivers. */
export function storyItems(inputs: FlowInput[]): DeskItem[] {
  return inputs.map((input, index) => ({ id: `story-${index}`, place: input.kind === "release" ? "tray" : input.kind === "settle" ? "desk" : input.kind === "statement" ? "bank" : "bag", input, label: "", technical: "", hint: "", object: input.kind === "statement" ? "vault" : input.kind === "settle" ? "money-bag" : input.kind === "report" ? "report" : input.kind === "release" ? "reviewer" : input.kind === "webhook" && input.webhook === "wrong-amount" ? "envelope-short" : input.kind === "webhook" && input.webhook === "late-authorized" ? "envelope-old" : "envelope" }));
}

/* ------------------------------------------------------------------ Stamps */

export type Stamp = { word: string; technical: string; tone: FlowTone; place: Place };

const stamps: Record<FlowOutcome, Omit<Stamp, "technical" | "place">> = {
  APPLIED: { word: "In", tone: "confirmed" },
  DUPLICATE_IGNORED: { word: "Seen", tone: "confirmed" },
  STALE_IGNORED: { word: "Old news", tone: "confirmed" },
  SENT_TO_REVIEW: { word: "Hold", tone: "uncertain" },
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
  RULE_REMOVED: { word: "Rule out", tone: "uncertain" },
  RULE_RESTORED: { word: "Rule back", tone: "neutral" },
  RULE_BROKEN: { word: "Broke a rule", tone: "adverse" },
};

/** The stamp an entry lands, and where it lands. */
export function stampFor(entry: FlowEntry): Stamp {
  const place: Place = entry.input.kind === "webhook" || entry.input.kind === "report" ? "desk" : entry.input.kind === "release" ? "tray" : entry.input.kind === "mutate" ? "book" : "bank";
  const technical = entry.http ? (entry.http === 409 ? `409 ${entry.outcome}` : `${entry.outcome} ${entry.http}`) : entry.outcome === "MISSING_CREDIT" ? "BROKEN · MISSING_CREDIT" : entry.outcome;
  // A landing that also reconciles stamps the better news.
  const stamp = entry.outcome === "LANDED" && /reconciled/.test(entry.plain) ? stamps.RECONCILED : stamps[entry.outcome];
  return { ...stamp, technical, place };
}

/* ------------------------------------------------------------------- Words */

/** What the clerk says about the latest thing on the desk: short, in the clerk's voice. */
export function clerkLine(desk: Desk): string {
  const entry = desk.flow.entries.at(-1);
  if (!entry) return "I'm Payflow's clerk. The provider sends me news about a 750,000 IDR payment, and I stamp every envelope.";
  const input = entry.input;
  switch (entry.outcome) {
    case "APPLIED":
      return entry.event?.status === "AUTHORIZED" ? "Authorized. The capture comes next." : "New news: paid. The money is captured, once.";
    case "DUPLICATE_IGNORED":
      return input.kind === "webhook" && input.webhook === "again" ? "Seen it. I answer “got it” and change nothing." : "Same news, new envelope. It's already paid.";
    case "STALE_IGNORED":
      return "That's older than what I have. It stays paid.";
    case "SENT_TO_REVIEW":
      return `${WRONG_AMOUNT.toLocaleString("en-US")} for a ${PAYMENT_AMOUNT.toLocaleString("en-US")} payment? On hold until a person checks.`;
    case "PAYMENT_ON_HOLD":
      return "It's on hold. Bring that back later; I record nothing yet.";
    case "RELEASED":
      return "Checked and released. Bring the last “paid” again.";
    case "BATCH_CREATED":
      return `Paid out ${idr(PAYOUT_NET)}, after the fee. It isn't settled until the bank says so.`;
    case "NOTHING_TO_SETTLE":
      return "Not while it's on hold. It waits for a person, not for the money.";
    case "MATCHED_AWAITING_BANK":
      return "The report agrees. That's its word, not money: I wait for the bank.";
    case "RECONCILED":
      return "Report and bank agree. Reconciled.";
    case "MISMATCH":
      return "The report disagrees. A person will look; the payment stays as it is.";
    case "LANDED":
      return /reconciled/.test(entry.plain) ? "It landed with its reference, and the report agreed. Reconciled." : "It landed with its reference. Now the report has to agree.";
    case "MISSING_CREDIT":
      return "The value date passed and no money came. It's broken; treasury takes it.";
    case "UNMATCHED_CREDIT":
      return "Money with no reference. The amount fits, but that proves nothing: suspense.";
    case "ALREADY_IMPORTED":
      return "I've booked that statement. Not twice.";
    case "RULE_REMOVED":
      return input.kind === "mutate" && input.mutation === "settle-held" ? "That page is out. Try the money bag now." : input.kind === "mutate" && input.mutation === "match-by-amount" ? "That page is out. Have the bank pay with no reference." : "That page is out. Have the bank send its statement again.";
    case "RULE_RESTORED":
      return "The rule is back in the book.";
    case "RULE_BROKEN":
      return input.kind === "settle"
        ? "With that page gone, the held money left. The repo's tests fail on exactly this."
        : input.kind === "statement" && input.statement === "reimport"
          ? "With that page gone, it's booked twice. The rule that a bank entry counts once catches it."
          : "With that page gone, a guess landed the payout. The rule that a landing needs its reference catches it.";
    default:
      return entry.plain;
  }
}

/** What the desk with no inbox did with the same thing, if it did anything. */
export function nextDoorLine(desk: Desk) {
  const entry = desk.flow.entries.at(-1);
  if (!entry || entry.input.kind === "release" || entry.input.kind === "mutate") return "";
  return desk.naive.last;
}

/** What went wrong next door so far, as stamps on its desk. */
export function nextDoorFlags(naive: NaiveWorld) {
  const flags: Array<{ id: string; word: string }> = [];
  if (naive.captures > 1) flags.push({ id: "twice", word: naive.captures > 2 ? `Charged ${naive.captures} times` : "Charged twice" });
  if (naive.overwritten) flags.push({ id: "overwritten", word: "Old news won" });
  if (naive.wrongAmount) flags.push({ id: "short", word: "Took the short amount" });
  if (naive.reconciledWithoutBank) flags.push({ id: "no-money", word: "Reconciled, no money" });
  return flags;
}

export const nextDoorStatus = (naive: NaiveWorld) => statusWord[naive.status];

/** One suggestion, naming something on the desk the visitor hasn't tried. */
export function nudge(desk: Desk, used?: readonly string[]): { item: string; text: string } | null {
  const items = deskItems(desk, used);
  const offered = (id: string) => items.some((item) => item.id === id);
  const fresh = (id: string) => offered(id) && !desk.tried.includes(id);
  const { flow } = desk;
  const removed = flow.removed;
  const moneyLeft = flow.payout !== "NONE";
  const candidates: Array<[boolean, string, string]> = [
    [desk.frozen, "", "Start over for a fresh payment."],
    [removed.includes("settle-held") && offered("pay-out"), "pay-out", "Try the money bag now."],
    [removed.includes("match-by-amount") && offered("bank-no-ref"), "bank-no-ref", "Have the bank pay with no reference."],
    [removed.includes("accept-reimport") && offered("bank-again"), "bank-again", "Have the bank send its statement again."],
    [!flow.lastEvent && offered("paid"), "paid", "Drag “paid” into my in-tray, or tap it."],
    [!moneyLeft && fresh("again") && flow.lastEvent?.status === "SUCCESS" && flow.lastEvent.amount === PAYMENT_AMOUNT, "again", "Couriers resend when unsure: try the same envelope again."],
    [fresh("release"), "release", "Be the person: check it, and release it."],
    [held(flow) && fresh("pay-out"), "pay-out", "Try paying it out while it's on hold."],
    [fresh("rule:settle-held"), "rule:settle-held", "Tear that rule out, as the repo's tests do."],
    [!moneyLeft && fresh("late") && captured(flow), "late", "Old news arrives late too. Try a late “authorized”."],
    [fresh("pay-out"), "pay-out", "Now take the money bag to the bank."],
    [fresh("report-matches"), "report-matches", "Bring the provider's report: it matches."],
    [fresh("bank-none") && !flow.reportMatched, "bank-none", "What if the bank never pays?"],
    [fresh("bank-credit"), "bank-credit", "Now let the bank pay, with the reference."],
    [fresh("rule:match-by-amount"), "rule:match-by-amount", "Tear that rule out, as the repo's tests do."],
    [fresh("bank-no-ref"), "bank-no-ref", "What if the money comes with no reference?"],
    [fresh("bank-again"), "bank-again", "Banks resend files. Have it send the statement again."],
    [fresh("rule:accept-reimport"), "rule:accept-reimport", "Tear that rule out, as the repo's tests do."],
    [fresh("short") && !captured(flow), "short", "Try a short amount: 740,000 for a 750,000 payment."],
    [fresh("report-differs"), "report-differs", "What if the provider's report disagrees?"],
    [fresh("again"), "again", "Couriers resend when unsure: try the same envelope again."],
    [fresh("late"), "late", "Old news arrives late too. Try a late “authorized”."],
  ];
  const found = candidates.find(([when]) => when);
  return found ? { item: found[1], text: found[2] } : null;
}

/* ------------------------------------------------------------------ Stories */

/** The stories "Watch it" plays, in order, as the case's conditions. */
export const deskStories: Array<{ label: string; conditions: Record<string, string> }> = [
  { label: "The provider sends it twice", conditions: { delivery: "duplicate", amount: "matches", bank: "landed" } },
  { label: "A late “authorized”", conditions: { delivery: "out-of-order", amount: "matches", bank: "landed" } },
  { label: "A short amount", conditions: { delivery: "once", amount: "differs", bank: "landed" } },
  { label: "The bank never pays", conditions: { delivery: "once", amount: "matches", bank: "missing" } },
];

export function storyIndex(conditions: Record<string, string>) {
  const index = deskStories.findIndex((story) => Object.entries(story.conditions).every(([key, value]) => conditions[key] === value));
  return index;
}
