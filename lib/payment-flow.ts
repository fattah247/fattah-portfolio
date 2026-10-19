/*
 * Case 01's model, taken from the Payflow Reliability repo (fattah247/payflow-reliability) so the
 * site says what the code does:
 *
 * - a provider webhook runs `ProviderWebhookService`'s decision flow in its order: the event inbox
 *   (same event again → DUPLICATE_IGNORED 200), a payment on hold (→ 409 PAYMENT_ON_HOLD, nothing
 *   recorded, so the provider redelivers), an amount that disagrees (→ SENT_TO_REVIEW 202,
 *   AMOUNT_MISMATCH, and a holdable payment goes to MANUAL_REVIEW), a status already recorded under
 *   a new event id (→ DUPLICATE_IGNORED), AUTHORIZED after capture (→ STALE_IGNORED), and
 *   otherwise APPLIED, with a CAPTURE journal when the payment succeeds;
 * - an operator's RELEASE_PAYMENT returns a held payment to the state it was held from;
 * - settlement pays out captures net of the provider's fee (`payout-fee-bps: 30`), skips held
 *   payments (→ 409 NOTHING_TO_SETTLE), and sends the payout under its derived key `payout-<batch>`;
 * - a payout lands only on a bank credit whose reference is the payout's (PFB…), whose amount is
 *   the provider's net and whose value date is in the window; a missing credit breaks it
 *   (BROKEN, MISSING_CREDIT, owner TREASURY); a credit with no reference waits in suspense with an
 *   open break; a statement imported again is ALREADY_IMPORTED;
 * - a payment is RECONCILED only with both a matching row in the provider's report and a landed
 *   payout (`PaymentReconciler`); a report row that disagrees opens a review case and holds nothing.
 *
 * The repo has no switch that turns any of this off. It proves the rules by removing them in its
 * tests (docs/settlement-certainty.md §5.3, README "checked by mutation"); `mutations` lists the
 * three a visitor can reach here, each with what catches it.
 *
 * Alongside it, `naive` runs the same inputs through a system without an event inbox that trusts
 * the provider's report. It is a comparison for the site, not code from the repo.
 */

export const CURRENCY = "IDR";
/** One payment, priced like the repo's bank-reconciliation scenario: 750,000 − 2,250 fee = 747,750. */
export const PAYMENT_AMOUNT = 750_000;
export const WRONG_AMOUNT = 740_000;
export const FEE_BPS = 30;
export const PAYOUT_FEE = Math.round((PAYMENT_AMOUNT * FEE_BPS) / 10_000);
export const PAYOUT_NET = PAYMENT_AMOUNT - PAYOUT_FEE;
export const VALUE_DATE_WINDOW_DAYS = 2;
export const PAYOUT_REFERENCE = "PFB7F3A2C914E";

export type PaymentStatus = "PENDING" | "AUTHORIZED" | "SUCCESS" | "SETTLED" | "RECONCILED" | "MANUAL_REVIEW";
export type PayoutStatus = "NONE" | "IN_TRANSIT" | "LANDED" | "BROKEN";

/** The provider's webhooks a visitor can send. */
export type WebhookKind = "success" | "again" | "new-id" | "late-authorized" | "wrong-amount";
export type StatementKind = "credit" | "no-credit" | "no-reference" | "reimport";
export type MutationId = "settle-held" | "match-by-amount" | "accept-reimport";

export type FlowInput =
  | { kind: "webhook"; webhook: WebhookKind }
  | { kind: "release" }
  | { kind: "settle" }
  | { kind: "report"; matches: boolean }
  | { kind: "statement"; statement: StatementKind }
  | { kind: "mutate"; mutation: MutationId; removed: boolean };

/** The repo's own outcome names; `RULE_BROKEN` marks a step that only happened because a rule was removed. */
export type FlowOutcome =
  | "APPLIED" | "DUPLICATE_IGNORED" | "STALE_IGNORED" | "SENT_TO_REVIEW" | "PAYMENT_ON_HOLD"
  | "RELEASED" | "BATCH_CREATED" | "NOTHING_TO_SETTLE"
  | "MATCHED_AWAITING_BANK" | "RECONCILED" | "MATCHED_NO_ACTION" | "ALREADY_RECONCILED" | "MISMATCH"
  | "LANDED" | "MISSING_CREDIT" | "UNMATCHED_CREDIT" | "ALREADY_IMPORTED" | "NO_PAYOUT_YET"
  | "RULE_REMOVED" | "RULE_RESTORED" | "RULE_BROKEN";

export type FlowTone = "neutral" | "confirmed" | "uncertain" | "adverse";

export type ProviderEvent = { id: string; status: "SUCCESS" | "AUTHORIZED"; amount: number };

export type FlowEntry = {
  n: number;
  input: FlowInput;
  outcome: FlowOutcome;
  /** The HTTP answer the provider gets, for a webhook. */
  http?: number;
  event?: ProviderEvent;
  tone: FlowTone;
  /** What happened, in everyday words. */
  plain: string;
  /** What a system without these rules would have done at this moment (a comparison). */
  contrast?: string;
  /** The mechanism, in the repo's terms. */
  hood: string;
};

export type FlowWorld = {
  status: PaymentStatus;
  heldFrom: PaymentStatus | null;
  /** Inbox rows: event id → its payload, as the repo keeps them. */
  inbox: Record<string, ProviderEvent>;
  /** Statuses recorded on the provider transaction. */
  recorded: Array<ProviderEvent["status"]>;
  lastEvent: ProviderEvent | null;
  nextEvent: number;
  journals: string[];
  audit: string[];
  reviewCases: string[];
  breaks: string[];
  payout: PayoutStatus;
  reportMatched: boolean;
  statementImported: boolean;
  bankLines: number;
  removed: MutationId[];
  rulesBroken: MutationId[];
  entries: FlowEntry[];
};

export const emptyFlow: FlowWorld = {
  status: "PENDING",
  heldFrom: null,
  inbox: {},
  recorded: [],
  lastEvent: null,
  nextEvent: 1,
  journals: [],
  audit: [],
  reviewCases: [],
  breaks: [],
  payout: "NONE",
  reportMatched: false,
  statementImported: false,
  bankLines: 0,
  removed: [],
  rulesBroken: [],
  entries: [],
};

/** The tests that remove a rule on purpose, and what catches each one. */
export const mutations: Record<MutationId, { plain: string; technical: string; caughtBy: string; plainCaught: string }> = {
  "settle-held": {
    plain: "Pay out held payments",
    technical: "settle held payments",
    caughtBy: "the test suite fails (README, “checked by mutation”)",
    plainCaught: "the repo's tests fail with this rule removed",
  },
  "match-by-amount": {
    plain: "Match a credit by amount alone",
    technical: "match a bank credit by amount when the reference is missing",
    caughtBy: "LANDING_IS_PROVEN, in the property test and ThreeWayReconciliationTest",
    plainCaught: "the rule that every landed payout carries its reference catches it",
  },
  "accept-reimport": {
    plain: "Accept a statement twice",
    technical: "accept a re-imported statement",
    caughtBy: "BANK_ENTRY_BOOKED_ONCE, in the property test and ThreeWayReconciliationTest",
    plainCaught: "the rule that a bank entry is booked once catches it",
  },
};

export const statusWord: Record<PaymentStatus, string> = {
  PENDING: "Waiting",
  AUTHORIZED: "Authorized",
  SUCCESS: "Paid",
  SETTLED: "Paid out",
  RECONCILED: "Reconciled",
  MANUAL_REVIEW: "On hold",
};

export const payoutWord: Record<PayoutStatus, string> = { NONE: "not paid out", IN_TRANSIT: "on its way", LANDED: "in the bank", BROKEN: "credit missing" };

const HOLDABLE: PaymentStatus[] = ["PENDING", "AUTHORIZED", "SUCCESS", "SETTLED", "RECONCILED"];
const idr = (amount: number) => `${amount.toLocaleString("en-US")} ${CURRENCY}`;
const eventId = (n: number) => `evt${n}`;

/** The event a webhook button sends, given what was sent before. */
function eventFor(world: FlowWorld, kind: WebhookKind): ProviderEvent | null {
  if (kind === "again") return world.lastEvent;
  const id = eventId(world.nextEvent);
  if (kind === "late-authorized") return { id, status: "AUTHORIZED", amount: PAYMENT_AMOUNT };
  if (kind === "wrong-amount") return { id, status: "SUCCESS", amount: WRONG_AMOUNT };
  return { id, status: "SUCCESS", amount: PAYMENT_AMOUNT };
}

/** Whichever evidence arrives second makes the payment RECONCILED: the report row or the landing. */
function reconcile(world: FlowWorld): FlowWorld {
  if (world.status !== "SETTLED" || !world.reportMatched || world.payout !== "LANDED") return world;
  return { ...world, status: "RECONCILED", audit: [...world.audit, "PAYMENT_RECONCILED"] };
}

type Step = Omit<FlowEntry, "n" | "input">;

function record(world: FlowWorld, input: FlowInput, step: Step, next: Partial<FlowWorld>): FlowWorld {
  const updated = { ...world, ...next };
  const entry: FlowEntry = { n: world.entries.length + 1, input, ...step };
  return { ...updated, entries: [...updated.entries, entry] };
}

/** One input against the payment, through the repo's rules (with any rule a visitor removed). */
export function flowStep(world: FlowWorld, input: FlowInput): FlowWorld {
  if (input.kind === "mutate") {
    const removed = input.removed ? [...new Set([...world.removed, input.mutation])] : world.removed.filter((id) => id !== input.mutation);
    const rule = mutations[input.mutation];
    return record(world, input, input.removed
      ? { outcome: "RULE_REMOVED", tone: "uncertain", plain: `Rule removed, as the repo's tests do on purpose: “${rule.plain.toLowerCase()}”. Try the step it guards.`, hood: `mutation: ${rule.technical} · caught by ${rule.caughtBy}` }
      : { outcome: "RULE_RESTORED", tone: "neutral", plain: `Rule restored: “${rule.plain.toLowerCase()}” is guarded again.`, hood: `mutation reverted: ${rule.technical}` }, { removed });
  }

  if (input.kind === "webhook") {
    const event = eventFor(world, input.webhook);
    if (!event) return world;
    const nextEvent = input.webhook === "again" ? world.nextEvent : world.nextEvent + 1;
    const says = event.status === "SUCCESS" ? (event.amount === PAYMENT_AMOUNT ? "“paid”" : `“paid ${idr(event.amount)}”`) : "“authorized”";
    const base = { event, lastEvent: event, nextEvent };

    // 1. The inbox: an event id seen before is answered without running anything again.
    if (world.inbox[event.id]) {
      return record(world, input, {
        outcome: "DUPLICATE_IGNORED", http: 200, event, tone: "confirmed",
        plain: `The provider sent ${says} again. It's already in the inbox, so we answered “got it” and changed nothing.`,
        contrast: event.status === "SUCCESS" && event.amount === PAYMENT_AMOUNT ? "Without an inbox, the money would be captured again." : undefined,
        hood: `inbox has ${event.id}, same payload → 200 DUPLICATE_IGNORED · audit DUPLICATE_WEBHOOK_IGNORED`,
      }, { ...base, audit: [...world.audit, "DUPLICATE_WEBHOOK_IGNORED"] });
    }
    // 2. A held payment takes nothing new; nothing is recorded, so the provider redelivers later.
    if (world.status === "MANUAL_REVIEW") {
      return record(world, input, {
        outcome: "PAYMENT_ON_HOLD", http: 409, event, tone: "uncertain",
        plain: `The provider sent ${says} while the payment is on hold. We asked it to try again later: nothing is recorded until a person decides.`,
        hood: `payment MANUAL_REVIEW → 409 PAYMENT_ON_HOLD (retryable) · audit WEBHOOK_DEFERRED · no inbox row`,
      }, { ...base, audit: [...world.audit, "WEBHOOK_DEFERRED"] });
    }
    const inbox = { ...world.inbox, [event.id]: event };
    // 3. An amount that disagrees holds the payment for a person.
    if (event.amount !== PAYMENT_AMOUNT) {
      const holdable = HOLDABLE.includes(world.status);
      return record(world, input, {
        outcome: "SENT_TO_REVIEW", http: 202, event, tone: "uncertain",
        plain: `The provider says ${idr(event.amount)} was paid, but the payment is ${idr(PAYMENT_AMOUNT)}. It's on hold until a person checks it.`,
        contrast: "Without the check, the wrong amount would be taken as paid in full.",
        hood: `${event.id} amount ${event.amount} ≠ ${PAYMENT_AMOUNT} → 202 SENT_TO_REVIEW AMOUNT_MISMATCH · ${holdable ? `${world.status} → MANUAL_REVIEW` : "already final"} · review case · audit WEBHOOK_SENT_TO_REVIEW`,
      }, { ...base, inbox, status: holdable ? "MANUAL_REVIEW" : world.status, heldFrom: holdable ? world.status : world.heldFrom, reviewCases: [...world.reviewCases, "AMOUNT_MISMATCH"], audit: [...world.audit, "WEBHOOK_SENT_TO_REVIEW"] });
    }
    // 4. The same status under a new event id is news already known.
    if (world.recorded.includes(event.status)) {
      return record(world, input, {
        outcome: "DUPLICATE_IGNORED", http: 200, event, tone: "confirmed",
        plain: `The provider restated ${says} under a new message id. That status is already recorded, so nothing changed.`,
        contrast: event.status === "SUCCESS" ? "Without the check, a second capture would follow." : undefined,
        hood: `${event.id} new, status ${event.status} already recorded on the transaction → 200 DUPLICATE_IGNORED · inbox row · audit WEBHOOK_IGNORED`,
      }, { ...base, inbox, audit: [...world.audit, "WEBHOOK_IGNORED"] });
    }
    // 5. AUTHORIZED after the capture is old news.
    const captured = world.journals.includes("CAPTURE");
    if (event.status === "AUTHORIZED" && captured) {
      return record(world, input, {
        outcome: "STALE_IGNORED", http: 200, event, tone: "confirmed",
        plain: `A late ${says} arrived after the payment was already paid. Old news: noted, and the payment stays paid.`,
        contrast: "Without the check, the older news would overwrite the newer.",
        hood: `${event.id} AUTHORIZED after capture → 200 STALE_IGNORED · inbox row · audit WEBHOOK_IGNORED`,
      }, { ...base, inbox, recorded: [...world.recorded, event.status], audit: [...world.audit, "WEBHOOK_IGNORED"] });
    }
    // 6. Applied: the payment moves, and a capture books its journal.
    const to: PaymentStatus = event.status === "SUCCESS" ? "SUCCESS" : "AUTHORIZED";
    return record(world, input, {
      outcome: "APPLIED", http: 200, event, tone: "confirmed",
      plain: event.status === "SUCCESS"
        ? `The provider sent ${says}. The payment went from ${statusWord[world.status].toLowerCase()} to paid, and the capture is booked once.`
        : `The provider sent ${says}. The payment is authorized, waiting for the capture.`,
      hood: `${event.id} new · ${world.status} → ${to} → 200 APPLIED · audit TRANSACTION_STATE_CHANGED${to === "SUCCESS" ? " · ledger CAPTURE" : ""}`,
    }, { ...base, inbox, status: to, recorded: [...world.recorded, event.status], journals: to === "SUCCESS" ? [...world.journals, "CAPTURE"] : world.journals, audit: [...world.audit, "TRANSACTION_STATE_CHANGED"] });
  }

  if (input.kind === "release") {
    if (world.status !== "MANUAL_REVIEW" || !world.heldFrom) return world;
    return record(world, input, {
      outcome: "RELEASED", tone: "neutral",
      plain: `A person checked it and released the payment back to ${statusWord[world.heldFrom].toLowerCase()}. The provider's next delivery can now be applied.`,
      hood: `review case resolved: RELEASE_PAYMENT → MANUAL_REVIEW → ${world.heldFrom} · audit PAYMENT_STATE_CHANGED`,
    }, { status: world.heldFrom, heldFrom: null, audit: [...world.audit, "PAYMENT_STATE_CHANGED"] });
  }

  if (input.kind === "settle") {
    const held = world.status === "MANUAL_REVIEW";
    const settleHeld = held && world.removed.includes("settle-held") && world.journals.includes("CAPTURE") && world.payout === "NONE";
    if (settleHeld) {
      return record(world, input, {
        outcome: "RULE_BROKEN", tone: "adverse",
        plain: `With the rule removed, the held payment was paid out anyway: money left while a person was still checking it. ${mutations["settle-held"].plainCaught}.`,
        hood: `mutation “settle held payments”: MANUAL_REVIEW included in the batch → PAYOUT sent · caught by ${mutations["settle-held"].caughtBy}`,
      }, { payout: "IN_TRANSIT", journals: [...world.journals, "PAYOUT"], rulesBroken: [...new Set([...world.rulesBroken, "settle-held" as const])] });
    }
    if (world.status !== "SUCCESS" || world.payout !== "NONE") {
      return record(world, input, {
        outcome: "NOTHING_TO_SETTLE", tone: held ? "confirmed" : "neutral",
        plain: held ? "Settlement skipped the payment: it's on hold, so it waits for a person, not for the money." : world.payout !== "NONE" ? "Already paid out: nothing settles twice." : "Nothing to pay out yet: the payment hasn't been paid.",
        contrast: held ? "A system that pays out holds would send the money now." : undefined,
        hood: `settlement run → 409 NOTHING_TO_SETTLE${held ? " · held payment skipped, not failed" : ""}`,
      }, {});
    }
    return record(world, input, {
      outcome: "BATCH_CREATED", tone: "neutral",
      plain: `Paid out: ${idr(PAYMENT_AMOUNT)}, less the provider's fee of ${idr(PAYOUT_FEE)}, so ${idr(PAYOUT_NET)} is on its way to the bank. It isn't settled until the bank says so.`,
      hood: `batch → SUCCESS → SETTLED · ledger PAYOUT · outbox payout-<batch> · provider: gross ${PAYMENT_AMOUNT} − fee ${PAYOUT_FEE} = net ${PAYOUT_NET} · IN_TRANSIT, reference ${PAYOUT_REFERENCE}`,
    }, { status: "SETTLED", payout: "IN_TRANSIT", journals: [...world.journals, "PAYOUT"], audit: [...world.audit, "PAYMENT_SETTLED"] });
  }

  if (input.kind === "report") {
    if (!input.matches) {
      return record(world, input, {
        outcome: "MISMATCH", tone: "uncertain",
        plain: "The provider's daily report disagrees with our records. A review case is opened for a person; the payment itself keeps its state.",
        hood: "report row ≠ payment → MISMATCH · review case AMOUNT_MISMATCH · audit RECONCILIATION_MISMATCH_FOUND · no hold",
      }, { reviewCases: [...world.reviewCases, "REPORT_MISMATCH"], audit: [...world.audit, "RECONCILIATION_MISMATCH_FOUND"] });
    }
    if (world.status === "RECONCILED") return record(world, input, { outcome: "ALREADY_RECONCILED", tone: "neutral", plain: "The report matches, and the payment was already reconciled.", hood: "report row → ALREADY_RECONCILED" }, {});
    if (world.status !== "SETTLED") {
      return record(world, input, {
        outcome: "MATCHED_NO_ACTION", tone: "neutral",
        plain: "The report matches, but the payment hasn't been paid out yet, so there's nothing to reconcile.",
        hood: `report row matches, payment ${world.status} → MATCHED_NO_ACTION`,
      }, {});
    }
    const matched = { ...world, reportMatched: true };
    const after = reconcile(matched);
    return record(world, input, after.status === "RECONCILED"
      ? { outcome: "RECONCILED", tone: "confirmed", plain: "The provider's report matches, and the bank already holds the money: the payment is reconciled.", hood: "report row matches · payout LANDED → SETTLED → RECONCILED" }
      : {
        outcome: "MATCHED_AWAITING_BANK", tone: "neutral",
        plain: "The provider's report matches. That's its word, not the money: the payment waits for the bank statement.",
        contrast: "A system that trusts the report would call it reconciled now.",
        hood: "report row matches, payout not landed → MATCHED_AWAITING_BANK · stays SETTLED",
      }, { reportMatched: true, status: after.status, audit: after.audit });
  }

  // The bank statement.
  const statement = input.statement;
  if (statement === "reimport") {
    if (!world.statementImported) return record(world, input, { outcome: "NO_PAYOUT_YET", tone: "neutral", plain: "No statement has been imported yet.", hood: "no statement to re-import" }, {});
    if (world.removed.includes("accept-reimport")) {
      return record(world, input, {
        outcome: "RULE_BROKEN", tone: "adverse",
        plain: `With the rule removed, the same statement was booked again: the books now show the money twice. ${mutations["accept-reimport"].plainCaught}.`,
        hood: `mutation “accept a re-imported statement”: line booked again (${world.bankLines + 1} lines for 1 credit) · caught by ${mutations["accept-reimport"].caughtBy}`,
      }, { bankLines: world.bankLines + 1, journals: [...world.journals, "PAYOUT_LANDED"], rulesBroken: [...new Set([...world.rulesBroken, "accept-reimport" as const])] });
    }
    return record(world, input, {
      outcome: "ALREADY_IMPORTED", tone: "confirmed",
      plain: "The bank sent the same statement again. It was already imported, so nothing is booked twice.",
      contrast: "Without the check, the credit would be booked a second time.",
      hood: "statement id + line references seen → ALREADY_IMPORTED/0",
    }, {});
  }
  if (world.payout === "NONE") {
    return record(world, input, statement === "no-credit"
      ? { outcome: "NO_PAYOUT_YET", tone: "neutral", plain: "Nothing has been paid out, so no credit is expected yet.", hood: "no payout in transit" }
      : {
        outcome: "UNMATCHED_CREDIT", tone: "uncertain",
        plain: "Money arrived that no payout explains. It waits in suspense, with an open break for treasury.",
        hood: "credit, no payout to match → bank_suspense · break UNMATCHED_CREDIT (48h)",
      }, statement === "no-credit" ? {} : { statementImported: true, bankLines: world.bankLines + 1, breaks: [...world.breaks, "UNMATCHED_CREDIT"] });
  }
  if (statement === "no-credit") {
    if (world.payout !== "IN_TRANSIT") return record(world, input, { outcome: "NO_PAYOUT_YET", tone: "neutral", plain: "No payout is waiting for a credit.", hood: `payout ${world.payout}` }, {});
    return record(world, input, {
      outcome: "MISSING_CREDIT", tone: "adverse",
      plain: `Every statement up to the value date plus ${VALUE_DATE_WINDOW_DAYS} days is in, and the money never arrived. The payout is broken, treasury owns the break, and the payment stays paid out, not reconciled.`,
      contrast: "A system that trusts the report could already have marked it reconciled.",
      hood: `statements through value date + ${VALUE_DATE_WINDOW_DAYS}d, no credit → IN_TRANSIT → BROKEN(MISSING_CREDIT) · break MISSING_CREDIT, owner TREASURY, due 24h · payment stays SETTLED`,
    }, { payout: "BROKEN", statementImported: true, breaks: [...world.breaks, "MISSING_CREDIT"] });
  }
  const referenced = statement === "credit";
  if (!referenced && !world.removed.includes("match-by-amount")) {
    return record(world, input, {
      outcome: "UNMATCHED_CREDIT", tone: "uncertain",
      plain: `${idr(PAYOUT_NET)} arrived with no reference. The amount fits, but the amount alone proves nothing: it waits in suspense with an open break.`,
      contrast: "Matching by amount would land the payout on a guess.",
      hood: `credit ${PAYOUT_NET}, no EndToEndId → bank_suspense · break UNMATCHED_CREDIT (48h) · payout stays ${world.payout}`,
    }, { statementImported: true, bankLines: world.bankLines + 1, breaks: [...world.breaks, "UNMATCHED_CREDIT"] });
  }
  if (world.payout === "LANDED") return record(world, input, { outcome: "ALREADY_IMPORTED", tone: "neutral", plain: "That credit is already booked.", hood: "line already matched" }, {});
  const landed = reconcile({ ...world, payout: "LANDED", statementImported: true, bankLines: world.bankLines + 1, journals: [...world.journals, "PAYOUT_LANDED"] });
  const broken = !referenced;
  return record(world, input, broken
    ? {
      outcome: "RULE_BROKEN", tone: "adverse",
      plain: `With the rule removed, a credit with no reference landed the payout on its amount alone. ${mutations["match-by-amount"].plainCaught}.`,
      hood: `mutation “match by amount”: credit ${PAYOUT_NET} without EndToEndId → LANDED · caught by ${mutations["match-by-amount"].caughtBy}`,
    }
    : {
      outcome: "LANDED", tone: "confirmed",
      plain: landed.status === "RECONCILED"
        ? `The bank shows ${idr(PAYOUT_NET)} with the payout's reference: the money landed, and with the report already matching, the payment is reconciled.`
        : `The bank shows ${idr(PAYOUT_NET)} with the payout's reference: the money landed. It's reconciled once the provider's report matches too.`,
      hood: `credit EndToEndId ${PAYOUT_REFERENCE}, ${PAYOUT_NET} = provider net, value date in window → LANDED · ledger PAYOUT_LANDED (bank_cash + provider_fees = gross)${landed.status === "RECONCILED" ? " · SETTLED → RECONCILED" : ""}`,
    }, { ...landed, entries: world.entries, rulesBroken: broken ? [...new Set([...world.rulesBroken, "match-by-amount" as const])] : world.rulesBroken });
}

export const playFlow = (inputs: readonly FlowInput[], from: FlowWorld = emptyFlow) => inputs.reduce(flowStep, from);

/* ------------------------------------------------------------- Comparison */

/** The same inputs through a system without an event inbox that trusts the provider's report. */
export type NaiveWorld = {
  status: PaymentStatus;
  captures: number;
  overwritten: number;
  wrongAmount: number;
  reconciledWithoutBank: number;
  bankHasMoney: boolean;
  /** What it did with the latest input, in everyday words. */
  last: string;
};

export const emptyNaive: NaiveWorld = { status: "PENDING", captures: 0, overwritten: 0, wrongAmount: 0, reconciledWithoutBank: 0, bankHasMoney: false, last: "" };

export function naiveStep(world: NaiveWorld, input: FlowInput, flow: FlowWorld): NaiveWorld {
  if (input.kind === "webhook") {
    const event = input.webhook === "again" ? flow.lastEvent : { status: input.webhook === "late-authorized" ? "AUTHORIZED" : "SUCCESS", amount: input.webhook === "wrong-amount" ? WRONG_AMOUNT : PAYMENT_AMOUNT };
    if (!event) return world;
    if (event.status === "AUTHORIZED") {
      const over = world.status === "SUCCESS" || world.status === "SETTLED" || world.status === "RECONCILED";
      return { ...world, status: "AUTHORIZED", overwritten: world.overwritten + (over ? 1 : 0), last: over ? "Wrote the old “authorized” over “paid”." : "Marked it authorized." };
    }
    const wrong = event.amount !== PAYMENT_AMOUNT;
    const captures = world.captures + 1;
    return {
      ...world,
      status: world.status === "SETTLED" || world.status === "RECONCILED" ? world.status : "SUCCESS",
      captures,
      wrongAmount: world.wrongAmount + (wrong ? 1 : 0),
      last: wrong ? `Took ${idr(event.amount)} as paid in full.` : captures > 1 ? `Captured the money again (${captures} times).` : "Captured the money.",
    };
  }
  if (input.kind === "settle") return world.status === "SUCCESS" ? { ...world, status: "SETTLED", last: "Paid it out." } : { ...world, last: "Nothing to pay out." };
  if (input.kind === "report") {
    if (!input.matches) return { ...world, last: "Ignored a report that disagrees." };
    if (world.status !== "SETTLED") return { ...world, last: "Nothing to reconcile." };
    return { ...world, status: "RECONCILED", reconciledWithoutBank: world.reconciledWithoutBank + (world.bankHasMoney ? 0 : 1), last: world.bankHasMoney ? "Marked it reconciled." : "Marked it reconciled on the provider's word, with no money in the bank." };
  }
  if (input.kind === "statement") {
    if (input.statement === "credit" || input.statement === "no-reference") return { ...world, bankHasMoney: true, last: "Saw money arrive." };
    if (input.statement === "no-credit") return { ...world, last: world.status === "RECONCILED" ? "Still says reconciled; the bank never paid." : "Didn't notice the missing money." };
    return { ...world, last: "Booked the statement again." };
  }
  return world;
}

/** Runs the repo and the comparison side by side over the same inputs. */
export function playBoth(inputs: readonly FlowInput[]) {
  let flow = emptyFlow;
  let naive = emptyNaive;
  for (const input of inputs) {
    naive = naiveStep(naive, input, flow);
    flow = flowStep(flow, input);
  }
  return { flow, naive };
}

/* ------------------------------------------------------------------ Story */

/** The case's story for a set of conditions: the deliveries, then the money's path to the bank. */
export function paymentStory(conditions: Record<string, string>): FlowInput[] {
  // A wrong amount runs the repo's amount-mismatch scenario: held, the corrected event waits (409),
  // a person releases the payment, and the provider's redelivery of the corrected event applies.
  const inputs: FlowInput[] = conditions.amount === "differs"
    ? [{ kind: "webhook", webhook: "wrong-amount" }, { kind: "webhook", webhook: "success" }, { kind: "release" }, { kind: "webhook", webhook: "again" }]
    : [{ kind: "webhook", webhook: "success" }];
  if (conditions.delivery === "duplicate") inputs.push({ kind: "webhook", webhook: "again" }, { kind: "webhook", webhook: "new-id" });
  if (conditions.delivery === "out-of-order") inputs.push({ kind: "webhook", webhook: "late-authorized" });
  inputs.push({ kind: "settle" }, { kind: "report", matches: true });
  inputs.push({ kind: "statement", statement: conditions.bank === "missing" ? "no-credit" : "credit" });
  return inputs;
}
