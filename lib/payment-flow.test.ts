import { describe, expect, it } from "vitest";
import { emptyFlow, flowStep, naiveStep, emptyNaive, PAYOUT_FEE, PAYOUT_NET, paymentStory, playBoth, playFlow, type FlowInput } from "./payment-flow";
import { projectScenario } from "./scenarios";

const send = (webhook: Extract<FlowInput, { kind: "webhook" }>["webhook"]): FlowInput => ({ kind: "webhook", webhook });
const outcomes = (inputs: FlowInput[]) => playFlow(inputs).entries.map((entry) => [entry.outcome, entry.http].filter(Boolean).join(" "));

describe("payment flow (Payflow's ProviderWebhookService, settlement and bank leg)", () => {
  it("answers a repeat from the inbox and a restated status as known news, capturing once (scenario duplicate-webhook)", () => {
    const world = playFlow([send("success"), send("again"), send("new-id"), send("late-authorized")]);
    expect(world.entries.map((entry) => `${entry.outcome} ${entry.http}`)).toEqual(["APPLIED 200", "DUPLICATE_IGNORED 200", "DUPLICATE_IGNORED 200", "STALE_IGNORED 200"]);
    expect(world.status).toBe("SUCCESS");
    expect(world.journals).toEqual(["CAPTURE"]);
    expect(Object.keys(world.inbox)).toHaveLength(3);
  });

  it("holds a wrong amount, defers the corrected event while held, and applies its redelivery after release (scenario amount-mismatch)", () => {
    const world = playFlow([send("wrong-amount"), send("success"), { kind: "release" }, send("again")]);
    expect(world.entries.map((entry) => [entry.outcome, entry.http].filter(Boolean).join(" "))).toEqual(["SENT_TO_REVIEW 202", "PAYMENT_ON_HOLD 409", "RELEASED", "APPLIED 200"]);
    expect(world.status).toBe("SUCCESS");
    expect(world.reviewCases).toEqual(["AMOUNT_MISMATCH"]);
    // The deferred event left no inbox row, which is why its redelivery could be applied.
    expect(world.journals).toEqual(["CAPTURE"]);
  });

  it("pays out net of the provider's fee and reconciles only with both the report and a landed credit (scenario bank-reconciliation)", () => {
    expect([PAYOUT_FEE, PAYOUT_NET]).toEqual([2250, 747750]);
    const reportFirst = playFlow([send("success"), { kind: "settle" }, { kind: "report", matches: true }]);
    expect(reportFirst).toMatchObject({ status: "SETTLED", payout: "IN_TRANSIT", reportMatched: true });
    expect(reportFirst.entries.at(-1)!.outcome).toBe("MATCHED_AWAITING_BANK");
    const landed = flowStep(reportFirst, { kind: "statement", statement: "credit" });
    expect(landed).toMatchObject({ status: "RECONCILED", payout: "LANDED" });
    // Whichever evidence comes second reconciles: the landing first, then the report.
    const bankFirst = playFlow([send("success"), { kind: "settle" }, { kind: "statement", statement: "credit" }, { kind: "report", matches: true }]);
    expect(bankFirst.status).toBe("RECONCILED");
  });

  it("breaks a payout whose credit never arrives, keeps the payment settled, and opens a break for treasury (scenario missing-credit)", () => {
    const world = playFlow([send("success"), { kind: "settle" }, { kind: "report", matches: true }, { kind: "statement", statement: "no-credit" }]);
    expect(world).toMatchObject({ status: "SETTLED", payout: "BROKEN", breaks: ["MISSING_CREDIT"] });
  });

  it("opens a review case for a report that disagrees without holding the payment", () => {
    const world = playFlow([send("success"), { kind: "report", matches: false }]);
    expect(world.status).toBe("SUCCESS");
    expect(world.reviewCases).toEqual(["REPORT_MISMATCH"]);
  });

  it("skips a held payment at settlement and keeps a credit without a reference in suspense", () => {
    expect(outcomes([send("success"), send("wrong-amount"), { kind: "settle" }]).at(-1)).toBe("NOTHING_TO_SETTLE");
    const suspense = playFlow([send("success"), { kind: "settle" }, { kind: "statement", statement: "no-reference" }]);
    expect(suspense).toMatchObject({ payout: "IN_TRANSIT", breaks: ["UNMATCHED_CREDIT"] });
    expect(outcomes([send("success"), { kind: "settle" }, { kind: "statement", statement: "credit" }, { kind: "statement", statement: "reimport" }]).at(-1)).toBe("ALREADY_IMPORTED");
  });

  it("breaks each rule only when the visitor removes it, as the repo's mutation tests do, and names what catches it", () => {
    const removed = (mutation: "settle-held" | "match-by-amount" | "accept-reimport"): FlowInput => ({ kind: "mutate", mutation, removed: true });
    const held = playFlow([send("success"), send("wrong-amount"), removed("settle-held"), { kind: "settle" }]);
    expect(held.entries.at(-1)!).toMatchObject({ outcome: "RULE_BROKEN", tone: "adverse" });
    expect(held.payout).toBe("IN_TRANSIT");
    const guessed = playFlow([send("success"), { kind: "settle" }, removed("match-by-amount"), { kind: "statement", statement: "no-reference" }]);
    expect(guessed.entries.at(-1)!.hood).toContain("LANDING_IS_PROVEN");
    const twice = playFlow([send("success"), { kind: "settle" }, { kind: "statement", statement: "credit" }, removed("accept-reimport"), { kind: "statement", statement: "reimport" }]);
    expect(twice.entries.at(-1)!.hood).toContain("BANK_ENTRY_BOOKED_ONCE");
    expect(twice.rulesBroken).toEqual(["accept-reimport"]);
    // Restored, the same step is guarded again.
    const restored = flowStep(twice, { kind: "mutate", mutation: "accept-reimport", removed: false });
    expect(flowStep(restored, { kind: "statement", statement: "reimport" }).entries.at(-1)!.outcome).toBe("ALREADY_IMPORTED");
  });

  it("shows, beside it, what a system without an inbox that trusts the provider would have done", () => {
    const { flow, naive } = playBoth(paymentStory({ delivery: "duplicate", amount: "matches", bank: "landed" }));
    expect(flow.journals.filter((journal) => journal === "CAPTURE")).toHaveLength(1);
    expect(naive.captures).toBe(3);
    const late = naiveStep(naiveStep(emptyNaive, send("success"), emptyFlow), send("late-authorized"), emptyFlow);
    expect(late).toMatchObject({ status: "AUTHORIZED", overwritten: 1 });
    expect(projectScenario("payflow", { delivery: "duplicate" }, "designed").find((node) => node.id === "money")?.value).toBe("RECONCILED");
    expect(projectScenario("payflow", { delivery: "duplicate" }, "baseline").find((node) => node.id === "money")?.value).toBe("CAPTURED TWICE");
    expect(projectScenario("payflow", { delivery: "once", bank: "missing" }, "designed").find((node) => node.id === "money")?.value).toBe("BREAK OPEN");
    expect(projectScenario("payflow", { delivery: "once", bank: "missing" }, "baseline").find((node) => node.id === "money")?.value).toBe("RECONCILED WITHOUT THE BANK");
  });
});
