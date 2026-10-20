import { describe, expect, it } from "vitest";
import { act, actSteps, actions, emptyWorld, nextDoorCharged, nudge, payflowLine, stampFor, storyActions, withoutInbox, worldStories, type Action, type World } from "./pay-world";
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
/** Answers that say nothing happened: the world never offers an action that only earns one. */
const idle = ["MATCHED_NO_ACTION", "ALREADY_RECONCILED", "NO_PAYOUT_YET"];
const doing = (world: World, id: string) => act(world, actions(world, undefined, true).find((action) => action.id === id)!);

const starts: Array<[string, World]> = [
  ["a fresh world", emptyWorld],
  ...worldStories.map(({ label, conditions }): [string, World] => {
    const steps = storyActions(paymentStory(conditions));
    return [`halfway through “${label}”`, steps.slice(0, Math.ceil(steps.length / 2)).reduce(act, emptyWorld)];
  }),
];

describe("pay world (a shop, Payflow's server and the bank, as a toy)", () => {
  it.each(starts)("offers only actions that land a stamp, from %s", (_name, start) => {
    const random = mulberry32(start.flow.entries.length + 11);
    for (let walk = 0; walk < 300; walk++) {
      let world = start;
      for (let step = 0; step < 30; step++) {
        const list = actions(world, undefined, true);
        if (!list.length) {
          expect(world.frozen).toBe(true);
          break;
        }
        expect(new Set(list.map((action) => action.id)).size).toBe(list.length);
        const hint = nudge(world, undefined, true);
        if (hint?.action) expect(list.map((action) => action.id)).toContain(hint.action);
        for (const action of list) if (action.actor !== "tech") expect(action.label).not.toMatch(raw);

        const action: Action = list[Math.floor(random() * list.length)];
        const steps = actSteps(world, action);
        const next = steps.at(-1)!;
        // Every action lands something new, each with a stamp the visitor can read.
        expect(next.flow.entries.length).toBeGreaterThan(world.flow.entries.length);
        for (const entry of next.flow.entries.slice(world.flow.entries.length)) {
          expect(idle).not.toContain(entry.outcome);
          expect(stampFor(entry).word).not.toMatch(raw);
        }
        if (next.flow.entries.at(-1)!.outcome === "RULE_BROKEN") expect(world.flow.removed.length).toBeGreaterThan(0);
        const line = payflowLine(next);
        expect(line).not.toMatch(raw);
        // Said in a bubble in the world: short.
        expect(line.length).toBeLessThanOrEqual(70);
        world = next;
      }
    }
  });

  it("starts with the customer, then lets each next actor join once the one before has acted", () => {
    const who = (world: World, used: string[]) => actions(world, used).map((action) => `${action.actor}:${action.id}`);
    expect(who(emptyWorld, [])).toEqual(["customer:pay"]);
    expect(nudge(emptyWorld, [])).toEqual({ action: "pay", text: "Tap me to pay 750,000." });
    const paid = doing(emptyWorld, "pay");
    expect(who(paid, ["pay"])).toEqual(["cashier:again"]);
    expect(who(paid, ["pay", "again"])).toEqual(["cashier:again", "signal:late"]);
    expect(who(paid, ["pay", "again", "late"])).toEqual(["cashier:again", "signal:late", "server:close"]);
    expect(nudge(paid, ["pay"])?.text).toBe("Weak signal… did it go? Tap me to send it again.");
  });

  it("charges the customer once however often the cashier taps, while a server with no inbox charges every time", () => {
    let world = doing(emptyWorld, "pay");
    for (let tap = 0; tap < 3; tap++) world = doing(world, "again");
    expect(world.flow.journals.filter((journal) => journal === "CAPTURE")).toHaveLength(1);
    expect(world.flow.entries.slice(1).map((entry) => entry.outcome)).toEqual(["DUPLICATE_IGNORED", "DUPLICATE_IGNORED", "DUPLICATE_IGNORED"]);
    expect(nextDoorCharged(world.naive)).toBe(3_000_000);
    expect(payflowLine(world)).toBe("Same receipt. I already have it: no money moves.");
    expect(withoutInbox(world)).toBe("With no inbox, the customer would have paid 3,000,000 IDR by now.");
  });

  it("closes the day with the payout and then the provider's daily report, so the bank's answer decides", () => {
    const paid = doing(emptyWorld, "pay");
    const close = actions(paid).find((action) => action.id === "close")!;
    expect(actSteps(paid, close).map((world) => world.flow.entries.at(-1)!.outcome)).toEqual(["BATCH_CREATED", "MATCHED_AWAITING_BANK"]);
    const closed = act(paid, close);
    expect(actions(closed).filter((action) => action.actor === "bank").map((action) => action.label)).toEqual(["The money arrives", "It never arrives", "It arrives with no reference"]);
    expect(doing(closed, "bank-credit").flow.status).toBe("RECONCILED");
    expect(doing(closed, "bank-none").flow.payout).toBe("BROKEN");
    // A mistyped amount is held before anything is captured, so there is nothing to pay out.
    expect(actions(doing(emptyWorld, "typo")).some((action) => action.id === "close")).toBe(false);
  });

  it("holds a mistyped amount for a person and lets the corrected receipt through after release (scenario amount-mismatch)", () => {
    const typo = doing(emptyWorld, "typo");
    expect(typo.flow.status).toBe("MANUAL_REVIEW");
    const fixed = doing(typo, "fix");
    expect(fixed.flow.entries.at(-1)!.outcome).toBe("PAYMENT_ON_HOLD");
    const released = doing(fixed, "release");
    expect(released.flow.reviewCases).toEqual([]);
    expect(doing(released, "again").flow.status).toBe("SUCCESS");
  });

  it("plays every story step as the action it is in the world", () => {
    expect(storyActions(paymentStory({ delivery: "duplicate", amount: "matches", bank: "landed" })).map((action) => `${action.actor}:${action.as}`)).toEqual(["customer:pay", "cashier:again", "cashier:new-id", "server:close", "bank:bank-credit"]);
    expect(storyActions(paymentStory({ delivery: "once", amount: "differs", bank: "landed" })).map((action) => action.as)).toEqual(["typo", "fix", "release", "again", "close", "bank-credit"]);
  });
});
