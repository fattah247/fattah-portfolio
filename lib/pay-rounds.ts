/*
 * Case 01's toy, "try to break the payment": four short rounds in a small world from a shop to a
 * bank. Each round is one way real payments go wrong (the cashier taps again on a weak signal, an
 * old message arrives late, the wrong amount is typed, the money never reaches the bank). The round
 * sets the scene, asks the visitor what will happen, plays it through Payflow's rules, and shows the
 * answer next to a basic system's.
 *
 * Every outcome comes from `flowStep` (lib/payment-flow.ts), which follows the Payflow Reliability
 * repo; the basic system takes the same inputs through `naiveStep`, a comparison the site models and
 * never a mode of the repo. The right answer to each question is read from the model, not written
 * down. Payflow's "notebook" is the repo's event inbox (the `provider_events` table): every receipt
 * number is written down before any money moves, so a repeat is recognised and changes nothing.
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
/** A receipt's number as the shop would read it: the provider's event id `evt2` is receipt #2. */
export const receiptNo = (id: string) => id.replace(/^evt/, "#");

export type Speaker = "customer" | "cashier" | "server" | "operator" | "bank" | "narrator";

/**
 * What happens in a round, in order. `receipts` sends one receipt per input along the line to
 * Payflow (several at once go out a beat apart); Payflow answers each moment that reaches it.
 */
export type Moment =
  | { kind: "walk" }
  | { kind: "card" }
  | { kind: "tap" }
  | { kind: "say"; who: Speaker; text: string }
  | { kind: "receipts"; inputs: FlowInput[]; late?: boolean }
  | { kind: "payout" }
  | { kind: "report" }
  | { kind: "statement"; input: FlowInput; said: string }
  | { kind: "release" };

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

const captured = (flow: FlowWorld) => flow.journals.filter((journal) => journal === "CAPTURE").length * PAYMENT_AMOUNT;
/** What the basic system has taken from the customer: every "paid" it was sent, at the amount it said. */
export function basicCharged(naive: NaiveWorld) {
  const full = Math.max(0, naive.captures - naive.wrongAmount);
  return full * PAYMENT_AMOUNT + naive.wrongAmount * WRONG_AMOUNT;
}

/** The customer walks up and pays by card; the cashier rings it up and receipt #1 goes to Payflow. */
const paying: Moment[] = [
  { kind: "walk" },
  { kind: "say", who: "customer", text: `Here's my card: ${amount(PAYMENT_AMOUNT)}.` },
  { kind: "card" },
  { kind: "tap" },
  { kind: "receipts", inputs: [webhook("success")] },
];

const SERVICE = "src/main/java/id/fatarc/portfolio/payflowreliability";
const TESTS = "src/test/java/id/fatarc/portfolio/payflowreliability";

export const rounds: Round[] = [
  {
    id: "repeat",
    trick: "Tap again",
    hint: "On a weak signal, the cashier sends the same payment again.",
    conditions: { delivery: "duplicate", amount: "matches", bank: "landed" },
    before: [
      ...paying,
      { kind: "say", who: "narrator", text: "The signal is weak. The cashier can't see if it went through." },
      { kind: "tap" },
      { kind: "say", who: "cashier", text: "Did it go? I'll tap again. And again!" },
    ],
    question: "The same receipt goes out 2 more times. How much will the customer pay?",
    choices: [1, 2, 3].map((times) => ({ id: String(times * PAYMENT_AMOUNT), label: amount(times * PAYMENT_AMOUNT) })),
    after: [{ kind: "receipts", inputs: [webhook("again"), webhook("again")] }],
    answer: (end) => String(captured(end.flow)),
    why: "Payflow writes every receipt number in its notebook before any money moves. #1 was already there, so the 2 repeats changed nothing.",
    compare: (end) => ({ measure: "Customer paid", basic: amount(basicCharged(end.naive)), payflow: amount(captured(end.flow)) }),
    proof: {
      request: ["POST /webhooks/provider  evt1 SUCCESS 750000", "POST /webhooks/provider  evt1 SUCCESS 750000  (again)", "POST /webhooks/provider  evt1 SUCCESS 750000  (again)"],
      code: [{
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
      }],
      notes: [
        "The notebook is the provider_events table. Its provider_event_id is unique (V1__baseline_schema.sql:89), so the same receipt can't be written down twice.",
        "findForUpdate locks the payment's row first (PESSIMISTIC_WRITE), so two copies arriving at the same moment queue instead of both passing the check.",
      ],
      result: "evt1: 200 APPLIED, one CAPTURE journal. Each repeat: 200 DUPLICATE_IGNORED, audit DUPLICATE_WEBHOOK_IGNORED, nothing posted.",
      tests: [{ file: `${TESTS}/payment/ProviderWebhookTest.java`, line: 41, name: "shouldIgnoreAnExactRedeliveryWithoutOpeningAReviewCaseOrPostingTwice" }],
    },
  },
  {
    id: "old-news",
    trick: "Old message",
    hint: "A message from before the payment arrives after it.",
    conditions: { delivery: "out-of-order", amount: "matches", bank: "landed" },
    before: [
      ...paying,
      { kind: "say", who: "narrator", text: "An older message, “card approved”, got stuck on the slow signal." },
    ],
    question: "It arrives now, after “paid”. What will the shop's screen say?",
    choices: [{ id: "paid", label: "Paid" }, { id: "approved", label: "Approved, not paid yet" }],
    after: [{ kind: "receipts", inputs: [webhook("late-authorized")], late: true }],
    answer: (end) => (end.flow.status === "SUCCESS" ? "paid" : "approved"),
    why: "“Approved” always comes before “paid”. Payflow notes the late message, but an older message can never undo a newer one.",
    compare: (end) => ({ measure: "The shop's screen says", basic: end.naive.status === "AUTHORIZED" ? "Approved, not paid" : "Paid", payflow: end.flow.status === "SUCCESS" ? "Paid" : "Approved, not paid" }),
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
      notes: ["A capture implies the authorization, so a late AUTHORIZED is written to provider_events and moves nothing. The payment's states only go forward."],
      result: "evt2: 200 STALE_IGNORED. The payment stays SUCCESS.",
      tests: [{ file: `${TESTS}/payment/ProviderWebhookTest.java`, line: 110, name: "shouldIgnoreAnAuthorizationThatArrivesAfterCapture" }],
    },
  },
  {
    id: "short",
    trick: "Wrong amount",
    hint: "The cashier types 740,000 for a 750,000 sale.",
    conditions: { delivery: "once", amount: "differs", bank: "landed" },
    before: [
      { kind: "walk" },
      { kind: "say", who: "customer", text: `Here's my card: ${amount(PAYMENT_AMOUNT)}.` },
      { kind: "card" },
      { kind: "tap" },
      { kind: "say", who: "cashier", text: `Oops, I typed ${amount(WRONG_AMOUNT)}.` },
    ],
    question: `The receipt says ${amount(WRONG_AMOUNT)} for a ${amount(PAYMENT_AMOUNT)} sale. What will Payflow do?`,
    choices: [{ id: "take", label: "Take it as paid" }, { id: "hold", label: "Hold it for a person to check" }],
    after: [
      { kind: "receipts", inputs: [webhook("wrong-amount")] },
      { kind: "release" },
      { kind: "tap" },
      { kind: "say", who: "cashier", text: `The right amount: ${amount(PAYMENT_AMOUNT)}.` },
      { kind: "receipts", inputs: [webhook("success")] },
    ],
    answer: (end) => (end.flow.entries.some((entry) => entry.outcome === "SENT_TO_REVIEW") ? "hold" : "take"),
    why: "Payflow checks every receipt's amount against the sale. A mismatch waits for a person, and it's never counted as paid.",
    compare: (end) => ({ measure: "Customer paid", basic: amount(basicCharged(end.naive)), payflow: amount(captured(end.flow)) }),
    proof: {
      request: ["POST /webhooks/provider  evt1 SUCCESS 740000  (the payment is 750000)", "RELEASE_PAYMENT  (a person, after checking)", "POST /webhooks/provider  evt2 SUCCESS 750000"],
      code: [
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
        {
          file: `${SERVICE}/payment/ProviderWebhookService.java`,
          from: 107,
          lines: ["if (intent.isOnHold()) {", "    return deferred(event, intent);", "}"],
        },
      ],
      notes: ["A mismatch moves the payment to MANUAL_REVIEW with an AMOUNT_MISMATCH case. While it's held, any new event gets 409 PAYMENT_ON_HOLD, so the provider retries once a person has released it."],
      result: "evt1: 202 SENT_TO_REVIEW. After RELEASE_PAYMENT, evt2: 200 APPLIED, one CAPTURE of 750000.",
      tests: [
        { file: `${TESTS}/payment/ProviderWebhookTest.java`, line: 151, name: "shouldHoldAnInFlightPaymentForAmountMismatch" },
        { file: `${TESTS}/payment/ProviderWebhookTest.java`, line: 191, name: "shouldDeferEventsWhileAPaymentIsOnHoldAndApplyTheRedeliveryAfterRelease" },
      ],
    },
  },
  {
    id: "lost",
    trick: "Lost money",
    hint: "The card company says it sent the money. The bank never got it.",
    conditions: { delivery: "once", amount: "matches", bank: "missing" },
    before: [...paying, { kind: "payout" }, { kind: "report" }],
    question: `The report says ${amount(PAYOUT_NET)} was sent, but the bank's statement shows nothing arrived. Is the sale done?`,
    choices: [{ id: "done", label: "Yes, the report says it was sent" }, { id: "flag", label: "No, flag the missing money" }],
    after: [{ kind: "statement", input: { kind: "statement", statement: "no-credit" }, said: "Nothing arrived by the value date." }],
    answer: (end) => (end.flow.payout === "BROKEN" ? "flag" : "done"),
    why: "Payflow calls a sale done only when the card company's report and the bank's own statement agree. A report alone proves nothing.",
    compare: (end) => ({ measure: "The books say", basic: end.naive.status === "RECONCILED" ? "Done, with no money" : "Not done", payflow: end.flow.payout === "BROKEN" ? "Money missing: flagged" : "Done" }),
    proof: {
      request: [`settlement batch: ${PAYMENT_AMOUNT} − ${PAYOUT_FEE} fee = ${PAYOUT_NET}, IN_TRANSIT`, "provider payout report: the row matches", "camt.053 statements through the value date + 2 days: no credit with this reference"],
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
      notes: ["The report is one piece of evidence; a bank credit matched by reference, amount and value date is the other. A payout is declared missing only once every statement through its window has arrived, and only a LANDED payout reconciles."],
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

/** Every input a round sends, in order. */
export const roundInputs = (round: Round): FlowInput[] =>
  [...round.before, ...round.after].flatMap((moment): FlowInput[] => {
    if (moment.kind === "receipts") return moment.inputs;
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
      return entry.event?.status === "AUTHORIZED" ? `New receipt ${no}: card approved.` : `New receipt ${no}. I note it and take the ${amount(PAYMENT_AMOUNT)}.`;
    case "DUPLICATE_IGNORED":
      return input.kind === "webhook" && input.webhook === "again" ? `${no} is already in my notebook. No money moves.` : `${no} says “paid” again. Already noted, no money moves.`;
    case "STALE_IGNORED":
      return `${no} says “approved”, but it's already paid. Old news.`;
    case "SENT_TO_REVIEW":
      return `${amount(WRONG_AMOUNT)} for a ${amount(PAYMENT_AMOUNT)} sale? I hold it for a person.`;
    case "PAYMENT_ON_HOLD":
      return "It's on hold. Send it again after the check.";
    case "RELEASED":
      return "Checked. The right receipt can count now.";
    case "BATCH_CREATED":
      return `Day closed: ${amount(PAYOUT_NET)} goes to the bank (${amount(PAYOUT_FEE)} fee).`;
    case "MATCHED_AWAITING_BANK":
      return "The report says it was sent. I wait for the bank to agree.";
    case "MISSING_CREDIT":
      return "The bank never got it. I flag the missing money.";
    case "RECONCILED":
    case "LANDED":
      return "The bank and the report agree. Done.";
    default:
      return entry.plain;
  }
}

/** Payflow's notebook: every receipt number it has written down, and what that receipt said. */
export function notebook(world: World): Array<{ id: string; no: string; said: string; technical: string }> {
  return Object.values(world.flow.inbox).map((event) => ({
    id: event.id,
    no: receiptNo(event.id),
    said: event.status === "AUTHORIZED" ? "approved" : event.amount === PAYMENT_AMOUNT ? "paid" : amount(event.amount),
    technical: `${event.id} ${event.status} ${event.amount}`,
  }));
}
