import { describe, expect, it } from "vitest";
import { bagItems, clerkLine, deskItems, deskStep, deskStories, emptyDesk, nudge, stampFor, storyItems, type Desk } from "./mail-room";
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

const starts: Array<[string, Desk]> = [
  ["a fresh desk", emptyDesk],
  ...deskStories.map(({ label, conditions }): [string, Desk] => {
    const items = storyItems(paymentStory(conditions));
    return [`halfway through “${label}”`, items.slice(0, Math.ceil(items.length / 2)).reduce(deskStep, emptyDesk)];
  }),
];

describe("mail room (Payflow's desk as a toy)", () => {
  it.each(starts)("offers only things that land a stamp, from %s", (_name, start) => {
    const random = mulberry32(start.flow.entries.length + 7);
    for (let walk = 0; walk < 300; walk++) {
      let desk = start;
      for (let step = 0; step < 30; step++) {
        const items = deskItems(desk);
        if (!items.length) {
          // Only a desk whose held money left with its rule torn out (and put back) runs out of things; Start over is left.
          expect(desk.frozen).toBe(true);
          break;
        }
        expect(bagItems(desk).length).toBeLessThanOrEqual(4);
        expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
        const hint = nudge(desk);
        if (hint?.item) expect(items.map((item) => item.id)).toContain(hint.item);
        for (const item of items) {
          expect(item.label).not.toMatch(raw);
          expect(item.hint).not.toMatch(raw);
        }

        const item = items[Math.floor(random() * items.length)];
        const next = deskStep(desk, item);
        const entry = next.flow.entries.at(-1)!;
        // Every press lands something: a new entry, with a stamp the visitor can read.
        expect(next.flow.entries.length).toBe(desk.flow.entries.length + 1);
        expect(idle).not.toContain(entry.outcome);
        if (entry.outcome === "NOTHING_TO_SETTLE") expect(next.flow.status).toBe("MANUAL_REVIEW");
        // A rule breaks only once the visitor has torn it out.
        if (entry.outcome === "RULE_BROKEN") expect(desk.flow.removed.length).toBeGreaterThan(0);
        const stamp = stampFor(entry);
        expect(stamp.word).not.toMatch(raw);
        expect(stamp.technical).toMatch(/[A-Z_]{4,}/);
        const line = clerkLine(next);
        expect(line).not.toMatch(raw);
        expect(line.length).toBeLessThanOrEqual(110);
        desk = next;
      }
    }
  });

  it("only lets a rule be torn out where the repo's own mutation tests break it, after it was seen at work", () => {
    const paid = deskStep(emptyDesk, bagItems(emptyDesk).find((item) => item.id === "paid")!);
    const held = deskStep(paid, bagItems(paid).find((item) => item.id === "short")!);
    expect(deskItems(held).some((item) => item.id === "rule:settle-held")).toBe(false);
    const refused = deskStep(held, deskItems(held).find((item) => item.id === "pay-out")!);
    expect(refused.flow.entries.at(-1)!.outcome).toBe("NOTHING_TO_SETTLE");
    const page = deskItems(refused).find((item) => item.id === "rule:settle-held")!;
    expect(page.label).toBe("Tear out “pay out held payments”");
    const torn = deskStep(refused, page);
    const broken = deskStep(torn, deskItems(torn).find((item) => item.id === "pay-out")!);
    expect(broken.flow.entries.at(-1)!.outcome).toBe("RULE_BROKEN");
    // After held money left, the desk only offers the rule back; Start over does the rest.
    expect(deskItems(broken).map((item) => item.id)).toEqual(["rule:settle-held"]);
    expect(nudge(broken)?.text).toBe("Start over for a fresh payment.");
  });

  it("stamps in the clerk's words and the repo's", () => {
    const paid = deskStep(emptyDesk, bagItems(emptyDesk)[0]);
    const again = deskStep(paid, bagItems(paid).find((item) => item.id === "again")!);
    expect(stampFor(again.flow.entries.at(-1)!)).toEqual({ word: "Seen", technical: "DUPLICATE_IGNORED 200", tone: "confirmed", place: "desk" });
    expect(clerkLine(again)).toBe("Seen it. I answer “got it” and change nothing.");
    const held = deskStep(emptyDesk, bagItems(emptyDesk).find((item) => item.id === "short")!);
    const back = deskStep(held, bagItems(held).find((item) => item.id === "paid")!);
    expect(stampFor(back.flow.entries.at(-1)!)).toMatchObject({ word: "Try later", technical: "409 PAYMENT_ON_HOLD" });
  });
});
