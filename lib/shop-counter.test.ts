import { describe, expect, it } from "vitest";
import { cashierLine, counterKeys, counterStep, counterStories, emptyCounter, flowSteps, machineKeys, nextDoorCharged, nudge, stampFor, storyKeys, tillKeys, type Counter } from "./shop-counter";
import { paymentStory } from "./payment-flow";

/** A small seeded generator, so every walk can be replayed. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Words the plain voice never uses: HTTP codes, message ids, the repo's raw states and outcomes. */
const raw = /\bevt\d|\b(200|202|409)\b|\b[A-Z]{2,}_[A-Z_]+\b|\b(SUCCESS|PENDING|AUTHORIZED|SETTLED|LANDED|RECONCILED)\b/;
/** Answers that say nothing happened: a desk never offers a press that only earns one. */
const idle = ["MATCHED_NO_ACTION", "ALREADY_RECONCILED", "NO_PAYOUT_YET"];

const starts: Array<[string, Counter]> = [
  ["a fresh counter", emptyCounter],
  ...counterStories.map(({ label, conditions }): [string, Counter] => {
    const keys = storyKeys(paymentStory(conditions));
    return [`halfway through “${label}”`, keys.slice(0, Math.ceil(keys.length / 2)).reduce(counterStep, emptyCounter)];
  }),
];

describe("shop counter (Payflow's till as a toy)", () => {
  it.each(starts)("offers only keys that get a stamp, from %s", (_name, start) => {
    const random = mulberry32(start.flow.entries.length + 7);
    for (let walk = 0; walk < 300; walk++) {
      let counter = start;
      for (let step = 0; step < 30; step++) {
        const items = counterKeys(counter);
        if (!items.length) {
          // Only a counter whose held money left with its rule broken (and put back) runs out of keys; Start over is left.
          expect(counter.frozen).toBe(true);
          break;
        }
        expect(machineKeys(counter).length).toBeLessThanOrEqual(4);
        expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
        const hint = nudge(counter, undefined, true);
        if (hint?.key) expect(items.map((item) => item.id)).toContain(hint.key);
        for (const item of items) {
          expect(item.label).not.toMatch(raw);
          expect(item.hint).not.toMatch(raw);
        }

        const item = items[Math.floor(random() * items.length)];
        const next = counterStep(counter, item);
        const entry = next.flow.entries.at(-1)!;
        // Every press lands something: a new entry, with a stamp the visitor can read.
        expect(next.flow.entries.length).toBe(counter.flow.entries.length + 1);
        expect(idle).not.toContain(entry.outcome);
        if (entry.outcome === "NOTHING_TO_SETTLE") expect(next.flow.status).toBe("MANUAL_REVIEW");
        // A rule breaks only once the visitor has torn it out.
        if (entry.outcome === "RULE_BROKEN") expect(counter.flow.removed.length).toBeGreaterThan(0);
        const stamp = stampFor(entry);
        expect(stamp.word).not.toMatch(raw);
        expect(stamp.technical).toMatch(/[A-Z_]{4,}/);
        const line = cashierLine(next);
        expect(line).not.toMatch(raw);
        expect(line.length).toBeLessThanOrEqual(110);
        counter = next;
      }
    }
  });

  it("only lets a rule be broken where the repo's own mutation tests break it, after it was seen at work", () => {
    const press = (counter: Counter, id: string) => counterStep(counter, counterKeys(counter).find((key) => key.id === id)!);
    const held = press(press(emptyCounter, "paid"), "short");
    expect(counterKeys(held).some((key) => key.id === "rule:settle-held")).toBe(false);
    const refused = press(held, "pay-out");
    expect(refused.flow.entries.at(-1)!.outcome).toBe("NOTHING_TO_SETTLE");
    const rule = counterKeys(refused).find((key) => key.id === "rule:settle-held")!;
    expect(rule.label).toBe("Break “pay out held payments”");
    // The rule keys are for Technical details only.
    expect(counterKeys(refused, undefined, false).some((key) => key.id.startsWith("rule:"))).toBe(false);
    const broken = press(counterStep(refused, rule), "pay-out");
    expect(broken.flow.entries.at(-1)!.outcome).toBe("RULE_BROKEN");
    // After held money left, only the rule back is on the counter; Start over does the rest.
    expect(counterKeys(broken).map((key) => key.id)).toEqual(["rule:settle-held"]);
    expect(nudge(broken)?.text).toBe("Start over for a fresh payment.");
  });

  it("starts with one key, and each next one joins once the one before it is pressed", () => {
    const ids = (used: string[], counter = emptyCounter) => [...machineKeys(counter, used), ...tillKeys(counter, used)].map((key) => key.id);
    expect(ids([])).toEqual(["paid"]);
    expect(nudge(emptyCounter, [])).toEqual({ key: "paid", text: "Start here: press “paid” on the card machine." });
    const paid = counterStep(emptyCounter, machineKeys(emptyCounter, [])[0]);
    expect(ids(["paid"], paid)).toEqual(["again", "paid"]);
    expect(ids(["paid", "again"], paid)).toEqual(["again", "late", "paid"]);
    expect(ids(["paid", "again", "late"], paid)).toEqual(["again", "late", "paid", "pay-out"]);
    expect(ids(["paid", "again", "late", "pay-out"])).toEqual(["paid", "short", "late"]);
  });

  it("says where the money is, and what the till next door took", () => {
    const press = (counter: Counter, id: string) => counterStep(counter, counterKeys(counter).find((key) => key.id === id)!);
    const state = (counter: Counter) => flowSteps(counter).map((step) => step.state);
    expect(state(emptyCounter)).toEqual(["now", "todo", "todo", "todo"]);
    const twice = press(press(emptyCounter, "paid"), "again");
    expect(state(twice)).toEqual(["done", "done", "now", "todo"]);
    expect(nextDoorCharged(twice.naive)).toBe(1_500_000);
    const reconciled = press(press(press(twice, "pay-out"), "report-matches"), "bank-credit");
    expect(state(reconciled)).toEqual(["done", "done", "done", "done"]);
    expect(state(press(press(emptyCounter, "paid"), "short"))[1]).toBe("held");
    expect(stampFor(twice.flow.entries.at(-1)!)).toEqual({ word: "Seen it", technical: "DUPLICATE_IGNORED 200", tone: "confirmed" });
    expect(cashierLine(twice)).toBe("That receipt is on my spike already. No money moves.");
  });
});
