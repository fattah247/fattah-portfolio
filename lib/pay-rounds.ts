/*
 * Case 01's toy, "try to break the payment": four short rounds in a small world of a shop, the card
 * company (the repo's payment provider), Payflow and the shop's bank. Each round is one way real
 * payments go wrong: the card company sends the same message again because Payflow's reply never
 * reached it, an old message arrives late, a message carries the wrong amount, the payout never
 * reaches the bank. The round sets the scene, asks the visitor what will happen, plays it through
 * Payflow's rules, and shows the answer next to a basic system's.
 *
 * As in the repo, Payflow only ever hears from the card company (its webhooks, its daily report) and
 * from the bank (its statements), and never holds the money: it asks the card company to pay out,
 * and the card company pays the bank. Every outcome comes from `flowStep` (lib/payment-flow.ts),
 * which follows the Payflow Reliability repo; the basic system takes the same inputs through
 * `naiveStep`, a comparison the site models and never a mode of the repo. The right answer to each
 * question is read from the model, not written down. Payflow's "notebook" is the repo's event inbox
 * (the `provider_events` table): a message's number is looked up before anything changes and written
 * down with the change, so a repeat is recognised and changes nothing. A message repeated changes
 * Payflow's books, never the customer's card: the card company charged the card once.
 *
 * Each round also carries its proof for engineers: the request, the lines of the repo that decided
 * it, the result, and the tests that hold it, linked at a fixed commit.
 */

import {
  emptyFlow,
  emptyNaive,
  flowStep,
  naiveStep,
  PAYMENT_AMOUNT,
  PAYOUT_FEE,
  PAYOUT_NET,
  WRONG_AMOUNT,
  type FlowEntry,
  type FlowInput,
  type FlowOutcome,
  type FlowTone,
  type FlowWorld,
  type NaiveWorld,
} from "./payment-flow";

export type World = { flow: FlowWorld; naive: NaiveWorld };
export const emptyWorld: World = { flow: emptyFlow, naive: emptyNaive };

/** One input through both systems; the basic one reads it first, as it sees the same redelivery. */
export function step(world: World, input: FlowInput): World {
  const naive = input.kind === "release" || input.kind === "mutate" ? world.naive : naiveStep(world.naive, input, world.flow);
  return { flow: flowStep(world.flow, input), naive };
}

const amount = (value: number) => value.toLocaleString("en-US");
const webhook = (kind: "success" | "again" | "late-authorized" | "wrong-amount"): FlowInput => ({ kind: "webhook", webhook: kind });
/** A message's number as Payflow's notebook shows it: the provider's event id `evt2` is #2. */
export const receiptNo = (id: string) => id.replace(/^evt/, "#");

export type Speaker = "customer" | "cashier" | "provider" | "server" | "operator" | "bank" | "narrator";

/**
 * What happens in a round, in order. `pay` takes the card payment from the shop's machine to the
 * card company; `receipts` sends one of the card company's messages per input along the line to
 * Payflow (several at once go out a beat apart); Payflow answers each moment that reaches it.
 * `payout` is Payflow asking the card company to pay the shop, and the card company paying the
 * bank (`lost`: the money never gets there).
 */
export type Moment =
  | { kind: "walk" }
  | { kind: "card" }
  | { kind: "tap" }
  | { kind: "pay" }
  | { kind: "say"; who: Speaker; text: string }
  | { kind: "receipts"; inputs: FlowInput[]; late?: boolean }
  | { kind: "payout"; lost?: boolean }
  | { kind: "report" }
  | { kind: "statement"; input: FlowInput; said: string }
  | { kind: "release" }
  /** The same sale recalled in one line, its inputs applied at once (a repeated opening). */
  | { kind: "recap"; text: string; inputs: FlowInput[] };

export type CodeExcerpt = { file: string; from: number; lines: string[] };
export type Proof = {
  request: string[];
  code: CodeExcerpt[];
  notes: string[];
  result: string;
  tests: Array<{ file: string; line: number; name: string }>;
};

export type RoundId = "repeat" | "old-news" | "short" | "lost";

export type Round = {
  id: RoundId;
  trick: string;
  /** One line on the trick's card. */
  hint: string;
  /** The case's conditions this round plays, so the Result chapter and the address follow it. */
  conditions: Record<string, string>;
  before: Moment[];
  question: string;
  choices: Array<{ id: string; label: string }>;
  after: Moment[];
  /** The right choice, read from the world at the end of the round. */
  answer: (end: World) => string;
  /** Why, in everyday words. */
  why: string;
  /** What the round measures, for the basic system and for Payflow. */
  compare: (end: World) => { measure: string; basic: string; payflow: string };
  proof: Proof;
};

/** What Payflow's books say the shop was paid: one capture per payment applied. */
export const recorded = (flow: FlowWorld) => flow.journals.filter((journal) => journal === "CAPTURE").length * PAYMENT_AMOUNT;
/** What the basic system's books say: every "paid" message it was sent, at the amount it said. */
export function basicRecorded(naive: NaiveWorld) {
  const full = Math.max(0, naive.captures - naive.wrongAmount);
  return full * PAYMENT_AMOUNT + naive.wrongAmount * WRONG_AMOUNT;
}

/** The customer pays by card at the shop; the card company charges it and tells Payflow. */
const charging: Moment[] = [
  { kind: "walk" },
  { kind: "say", who: "customer", text: `Here's my card: ${amount(PAYMENT_AMOUNT)}.` },
  { kind: "card" },
  { kind: "tap" },
  { kind: "pay" },
  { kind: "say", who: "provider", text: `Card charged: ${amount(PAYMENT_AMOUNT)}. Telling Payflow.` },
];
/** …and its message, #1, reaches Payflow. */
const paying: Moment[] = [...charging, { kind: "receipts", inputs: [webhook("success")] }];

const SERVICE = "src/main/java/id/fatarc/portfolio/payflowreliability";
const TESTS = "src/test/java/id/fatarc/portfolio/payflowreliability";

export const rounds: Round[] = [
  {
    id: "repeat",
    trick: "Sent twice",
    hint: "Payflow's reply gets lost, so the card company sends the same message again.",
    conditions: { delivery: "duplicate", amount: "matches", bank: "landed" },
    before: [
      ...paying,
      { kind: "say", who: "narrator", text: "Payflow's “got it” never reaches the card company: the line is weak." },
      { kind: "say", who: "provider", text: "No reply… I'll send #1 again. And again." },
    ],
    question: "The card company sends #1 two more times. How much will Payflow's books say the shop got?",
    choices: [1, 2, 3].map((times) => ({ id: String(times * PAYMENT_AMOUNT), label: amount(times * PAYMENT_AMOUNT) })),
    after: [{ kind: "receipts", inputs: [webhook("again"), webhook("again")] }],
    answer: (end) => String(recorded(end.flow)),
    why: "Payflow looks up every message number in its notebook before it changes anything. #1 was already there, so the resends changed nothing. The card was charged once either way: what a resend can break is the books.",
    compare: (end) => ({ measure: "The books say the shop got", basic: amount(basicRecorded(end.naive)), payflow: amount(recorded(end.flow)) }),
    proof: {
      request: ["POST /webhooks/provider  evt1 SUCCESS 750000", "POST /webhooks/provider  evt1 SUCCESS 750000  (resent: no reply reached the provider)", "POST /webhooks/provider  evt1 SUCCESS 750000  (resent again)"],
      code: [
        {
          file: `${SERVICE}/payment/ProviderWebhookService.java`,
          from: 93,
          lines: [
            "Optional<PaymentIntent> intentLookup = paymentIntentRepository.findForUpdate(webhook.paymentIntentId());",
            "",
            "Optional<ProviderEvent> previousDelivery = providerEventRepository.findByProviderEventId(webhook.providerEventId());",
            "if (previousDelivery.isPresent()) {",
            "    return redelivered(previousDelivery.get(), event, intentLookup.orElse(null));",
            "}",
          ],
        },
        {
          file: `${SERVICE}/payment/ProviderWebhookService.java`,
          from: 235,
          lines: [
            "private void recordEvent(Event event, WebhookOutcome outcome, String detail, UUID reviewCaseId) {",
            "    // Flush now so a concurrent duplicate surfaces as a unique violation here, not at commit.",
            "    providerEventRepository.saveAndFlush(new ProviderEvent(event.webhook(), event.source(), outcome, detail, reviewCaseId));",
            "}",
          ],
        },
      ],
      notes: [
        "The notebook is the provider_events table, keyed by a unique provider_event_id (V1__baseline_schema.sql:89). An event is looked up before anything changes, and written in the same transaction as the change.",
        "findForUpdate locks the payment's row first (PESSIMISTIC_WRITE), so two copies arriving together queue; the flush makes a racing copy fail on the unique key.",
        "A cashier pressing pay twice is a different problem, stopped before the card company is called: payment creation takes an idempotency key (PaymentIntentIdempotencyTest).",
      ],
      result: "evt1: 200 APPLIED, one CAPTURE journal. Each resend: 200 DUPLICATE_IGNORED, audit DUPLICATE_WEBHOOK_IGNORED, nothing posted.",
      tests: [{ file: `${TESTS}/payment/ProviderWebhookTest.java`, line: 41, name: "shouldIgnoreAnExactRedeliveryWithoutOpeningAReviewCaseOrPostingTwice" }],
    },
  },
  {
    id: "old-news",
    trick: "Old message",
    hint: "A message the card company sent before the payment arrives after it.",
    conditions: { delivery: "out-of-order", amount: "matches", bank: "landed" },
    before: [
      ...paying,
      { kind: "say", who: "narrator", text: "The card company's earlier message, “card approved”, got stuck on a slow line." },
    ],
    question: "It arrives now, after “paid”. What will Payflow show the shop?",
    choices: [{ id: "paid", label: "Paid" }, { id: "approved", label: "Approved, not paid yet" }],
    after: [{ kind: "receipts", inputs: [webhook("late-authorized")], late: true }],
    answer: (end) => (end.flow.status === "SUCCESS" ? "paid" : "approved"),
    why: "“Approved” always comes before “paid”. Payflow notes the late message, but an older message never undoes a newer one.",
    compare: (end) => ({ measure: "Payflow shows the shop", basic: end.naive.status === "AUTHORIZED" ? "Approved, not paid" : "Paid", payflow: end.flow.status === "SUCCESS" ? "Paid" : "Approved, not paid" }),
    proof: {
      request: ["POST /webhooks/provider  evt1 SUCCESS 750000", "POST /webhooks/provider  evt2 AUTHORIZED 750000  (sent earlier, arrives late)"],
      code: [{
        file: `${SERVICE}/payment/ProviderWebhookService.java`,
        from: 138,
        lines: [
          "if (webhook.status() == ProviderStatus.AUTHORIZED && intent.isCaptured()) {",
          "    return ignore(event, intent, WebhookOutcome.STALE_IGNORED,",
          "            \"Authorization arrived after the payment reached \" + intent.getState() + \"; capture implies authorization.\");",
          "}",
        ],
      }],
      notes: ["A capture implies the authorization, so a late AUTHORIZED is recorded in provider_events and audited, and changes nothing. (A late message that contradicts the payment, such as FAILED after SUCCESS, isn't ignored: it holds the payment for review.)"],
      result: "evt2: 200 STALE_IGNORED. The payment stays SUCCESS.",
      tests: [{ file: `${TESTS}/payment/ProviderWebhookTest.java`, line: 110, name: "shouldIgnoreAnAuthorizationThatArrivesAfterCapture" }],
    },
  },
  {
    id: "short",
    trick: "Wrong amount",
    hint: "The card company's message says 740,000 for a 750,000 sale.",
    conditions: { delivery: "once", amount: "differs", bank: "landed" },
    before: [
      ...charging,
      { kind: "say", who: "narrator", text: `But the card company's message has a mistake in it: ${amount(WRONG_AMOUNT)}.` },
    ],
    question: `The sale is ${amount(PAYMENT_AMOUNT)}, and the card company's message says ${amount(WRONG_AMOUNT)}. What will Payflow do?`,
    choices: [{ id: "take", label: "Count it as paid" }, { id: "hold", label: "Hold it for a person to check" }],
    after: [
      { kind: "receipts", inputs: [webhook("wrong-amount")] },
      { kind: "say", who: "provider", text: `Our mistake. Here's #2, with ${amount(PAYMENT_AMOUNT)}.` },
      { kind: "receipts", inputs: [webhook("success")] },
      { kind: "release" },
      { kind: "say", who: "provider", text: "Trying #2 again." },
      { kind: "receipts", inputs: [webhook("again")] },
    ],
    answer: (end) => (end.flow.entries.some((entry) => entry.outcome === "SENT_TO_REVIEW") ? "hold" : "take"),
    why: "Payflow checks every message's amount against the sale. A mismatch waits for a person, and until they decide, every message for that payment is told to try again later.",
    compare: (end) => ({
      measure: `The ${amount(WRONG_AMOUNT)} message`,
      basic: end.naive.wrongAmount > 0 ? "Counted as paid in full" : "Held",
      payflow: end.flow.entries.some((entry) => entry.outcome === "SENT_TO_REVIEW") && recorded(end.flow) === PAYMENT_AMOUNT ? `Held, then ${amount(PAYMENT_AMOUNT)} once` : "Counted",
    }),
    proof: {
      request: [
        "POST /webhooks/provider  evt1 SUCCESS 740000  (the payment is 750000)",
        "POST /webhooks/provider  evt2 SUCCESS 750000  (the corrected message, while held)",
        "RELEASE_PAYMENT  (a person, after checking with the provider)",
        "POST /webhooks/provider  evt2 SUCCESS 750000  (the provider's retry)",
      ],
      code: [
        {
          file: `${SERVICE}/payment/ProviderWebhookService.java`,
          from: 107,
          lines: ["if (intent.isOnHold()) {", "    return deferred(event, intent);", "}"],
        },
        {
          file: `${SERVICE}/payment/ProviderWebhookService.java`,
          from: 115,
          lines: [
            "if (intent.getAmount().compareTo(webhook.amount()) != 0) {",
            "    return holdAndReview(event, intent, ReviewReason.AMOUNT_MISMATCH,",
            "            \"Event amount \" + webhook.amount().toPlainString() + \" does not match payment amount \"",
            "                    + intent.getAmount().toPlainString() + \".\");",
            "}",
          ],
        },
      ],
      notes: ["A mismatch moves the payment to MANUAL_REVIEW with an AMOUNT_MISMATCH case. While it's held, events aren't recorded and get 409, so the provider's own retry delivers them once the person has decided (ADR 010)."],
      result: "evt1: 202 SENT_TO_REVIEW, payment MANUAL_REVIEW. evt2 while held: 409 PAYMENT_ON_HOLD, not recorded. After RELEASE_PAYMENT, evt2's retry: 200 APPLIED, one CAPTURE of 750000.",
      tests: [
        { file: `${TESTS}/payment/ProviderWebhookTest.java`, line: 151, name: "shouldHoldAnInFlightPaymentForAmountMismatch" },
        { file: `${TESTS}/payment/ProviderWebhookTest.java`, line: 191, name: "shouldDeferEventsWhileAPaymentIsOnHoldAndApplyTheRedeliveryAfterRelease" },
      ],
    },
  },
  {
    id: "lost",
    trick: "Lost money",
    hint: "The card company says it paid the shop. The bank never got the money.",
    conditions: { delivery: "once", amount: "matches", bank: "missing" },
    before: [...paying, { kind: "payout", lost: true }, { kind: "report" }],
    question: `The report says ${amount(PAYOUT_NET)} was sent. The bank's statements for the 2 days after the value date show nothing. Is the sale done?`,
    choices: [{ id: "done", label: "Yes, the report says it was sent" }, { id: "flag", label: "No, flag the missing money" }],
    after: [{ kind: "statement", input: { kind: "statement", statement: "no-credit" }, said: "Nothing came in, 2 days past the value date." }],
    answer: (end) => (end.flow.payout === "BROKEN" ? "flag" : "done"),
    why: "Payflow calls a sale done only when the card company's report and the bank's own statement agree. A report alone proves nothing.",
    compare: (end) => ({ measure: "The books say", basic: end.naive.status === "RECONCILED" ? "Done, with no money" : "Not done", payflow: end.flow.payout === "BROKEN" ? "Money missing: flagged" : "Done" }),
    proof: {
      request: [
        `settlement batch: ${PAYMENT_AMOUNT} − ${PAYOUT_FEE} fee = ${PAYOUT_NET}; payout asked of the provider through the outbox (key payout-<batch>)`,
        "provider payout report: the row matches",
        "camt.053 statements through the value date + 2 days: no credit with the payout reference",
      ],
      code: [
        {
          file: `${SERVICE}/reconciliation/ThreeWayReconciliationService.java`,
          from: 111,
          lines: [
            "for (SettlementBatch batch : batchRepository.findByPayoutStatusInOrderByCreatedAtAsc(EnumSet.of(PayoutStatus.IN_TRANSIT))) {",
            "    Optional<LocalDate> coveredThrough = coveredThrough(batch.getCurrency());",
            "    LocalDate windowEnd = batch.getExpectedValueDate().plusDays(windowDays);",
            "    if (coveredThrough.isEmpty() || coveredThrough.get().isBefore(windowEnd)) {",
            "        continue;",
            "    }",
            "    Boolean declared = transactions.execute(status -> declareMissing(batch.getId(), windowEnd, coveredThrough.get(), actor));",
            "    missing += Boolean.TRUE.equals(declared) ? 1 : 0;",
          ],
        },
        {
          file: `${SERVICE}/reconciliation/PaymentReconciler.java`,
          from: 58,
          lines: [
            "@Transactional(readOnly = true)",
            "public Optional<SettlementBatch> landedBatchOf(UUID paymentIntentId) {",
            "    return itemRepository.findByCapturePaymentIntentId(paymentIntentId)",
            "            .flatMap(item -> batchRepository.findById(item.getBatchId()))",
            "            .filter(batch -> batch.getPayoutStatus() == PayoutStatus.LANDED || batch.getPayoutStatus() == PayoutStatus.LEGACY);",
          ],
        },
      ],
      notes: [
        "Payflow never holds the money: it asks the provider to pay out, and the provider pays the bank.",
        "The provider's report is one piece of evidence; a bank credit matched by reference, amount and value date is the other. A payout is declared missing only once every statement through its window (value-date-window-days, 2) has arrived, and only a LANDED payout reconciles.",
      ],
      result: "The batch goes BROKEN (MISSING_CREDIT) and a break opens for treasury. The payment stays SETTLED, never RECONCILED.",
      tests: [
        { file: `${TESTS}/reconciliation/ThreeWayReconciliationTest.java`, line: 110, name: "shouldDeclareACreditMissingOnlyWhenEveryStatementThroughTheWindowHasArrived" },
        { file: `${TESTS}/reconciliation/ReconciliationTest.java`, line: 41, name: "shouldReconcileOnlyOnceTheReportMatchesAndThePayoutHasLanded" },
      ],
    },
  },
];

/** The repo at the commit these excerpts were read from, so every link shows the same lines. */
export const REPO_AT = "https://github.com/fattah247/Payflow-reliability/blob/b21130a1f7a5c1d81a8e9e128d89c8beab64e4eb";
export const codeLink = (file: string, from: number, to = from) => `${REPO_AT}/${file}#L${from}${to > from ? `-L${to}` : ""}`;

/**
 * A round's opening: in full the first time; after that the same sale is recalled in one line, since
 * an opening seen once only makes the visitor wait the second time.
 */
export function openingFor(round: Round, firstTime: boolean): Moment[] {
  if (firstTime) return round.before;
  const startsWith = (prefix: Moment[]) => prefix.every((moment, index) => round.before[index] === moment);
  if (startsWith(paying)) return [{ kind: "recap", text: `Same sale again: the card company charged ${amount(PAYMENT_AMOUNT)}, and #1 is in Payflow's notebook.`, inputs: [webhook("success")] }, ...round.before.slice(paying.length)];
  if (startsWith(charging)) return [{ kind: "recap", text: `Same sale again: the card company charged ${amount(PAYMENT_AMOUNT)}.`, inputs: [] }, ...round.before.slice(charging.length)];
  return round.before;
}

/** Every input a round sends, in order. */
export const roundInputs = (round: Round): FlowInput[] =>
  [...round.before, ...round.after].flatMap((moment): FlowInput[] => {
    if (moment.kind === "receipts" || moment.kind === "recap") return moment.inputs;
    if (moment.kind === "payout") return [{ kind: "settle" }];
    if (moment.kind === "report") return [{ kind: "report", matches: true }];
    if (moment.kind === "statement") return [moment.input];
    if (moment.kind === "release") return [{ kind: "release" }];
    return [];
  });

/** The world at the end of a round. */
export const roundEnd = (round: Round) => roundInputs(round).reduce(step, emptyWorld);

/** The round whose conditions the case is set to, if any. */
export function roundFor(conditions: Record<string, string>) {
  return rounds.findIndex((round) => Object.entries(round.conditions).every(([key, value]) => conditions[key] === value));
}

/* ------------------------------------------------------------------- Words */

export type Stamp = { word: string; technical: string; tone: FlowTone };
const stamps: Partial<Record<FlowOutcome, Omit<Stamp, "technical">>> = {
  APPLIED: { word: "New", tone: "confirmed" },
  DUPLICATE_IGNORED: { word: "Already noted", tone: "confirmed" },
  STALE_IGNORED: { word: "Old news", tone: "confirmed" },
  SENT_TO_REVIEW: { word: "On hold", tone: "uncertain" },
  PAYMENT_ON_HOLD: { word: "Try later", tone: "uncertain" },
  RELEASED: { word: "Released", tone: "neutral" },
  BATCH_CREATED: { word: "Paid out", tone: "neutral" },
  MATCHED_AWAITING_BANK: { word: "Waiting for the bank", tone: "neutral" },
  RECONCILED: { word: "Done", tone: "confirmed" },
  LANDED: { word: "Landed", tone: "confirmed" },
  MISSING_CREDIT: { word: "Missing", tone: "adverse" },
};

/** The stamp on Payflow's answer: a word, or the repo's outcome and HTTP code. */
export function stampFor(entry: FlowEntry): Stamp {
  const technical = entry.http ? `${entry.http} ${entry.outcome}` : entry.outcome === "MISSING_CREDIT" ? "BROKEN · MISSING_CREDIT" : entry.outcome;
  const known = stamps[entry.outcome] ?? { word: entry.outcome.toLowerCase().replace(/_/g, " "), tone: entry.tone };
  return { ...known, technical };
}

/** What Payflow says about the latest thing it got. Short: it's said in a bubble in the world. */
export function payflowSays(world: World): string {
  const entry = world.flow.entries.at(-1);
  if (!entry) return "";
  const no = entry.event ? receiptNo(entry.event.id) : "";
  const input = entry.input;
  switch (entry.outcome) {
    case "APPLIED":
      return entry.event?.status === "AUTHORIZED" ? `New message ${no}: card approved.` : `New message ${no}. I note it and record the ${amount(PAYMENT_AMOUNT)}.`;
    case "DUPLICATE_IGNORED":
      return input.kind === "webhook" && input.webhook === "again" ? `${no} is already in my notebook. Nothing changes.` : `${no} says “paid” again. Already noted, nothing changes.`;
    case "STALE_IGNORED":
      return `${no} says “approved”, but it's already paid. Old news.`;
    case "SENT_TO_REVIEW":
      return `${amount(WRONG_AMOUNT)} for a ${amount(PAYMENT_AMOUNT)} sale? I hold it for a person.`;
    case "PAYMENT_ON_HOLD":
      return `It's on hold. Send ${no} again after the check.`;
    case "RELEASED":
      return `Released. Card company, send ${world.flow.lastEvent ? receiptNo(world.flow.lastEvent.id) : "it"} again.`;
    case "BATCH_CREATED":
      return `Day closed. Card company: pay ${amount(PAYOUT_NET)} to the shop's bank.`;
    case "MATCHED_AWAITING_BANK":
      return "The report says it was sent. I wait for the bank's statement.";
    case "MISSING_CREDIT":
      return "The bank never got it. I flag the missing money.";
    case "RECONCILED":
    case "LANDED":
      return "The bank and the report agree. Done.";
    default:
      return entry.plain;
  }
}

/** Payflow's notebook: every message number it has written down, and what that message said. */
export function notebook(world: World): Array<{ id: string; no: string; said: string; technical: string }> {
  return Object.values(world.flow.inbox).map((event) => ({
    id: event.id,
    no: receiptNo(event.id),
    said: event.status === "AUTHORIZED" ? "approved" : event.amount === PAYMENT_AMOUNT ? "paid" : amount(event.amount),
    technical: `${event.id} ${event.status} ${event.amount}`,
  }));
}
