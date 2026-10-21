import { describe, expect, it } from "vitest";
import { scenarios } from "./scenarios";
import { codeLink, emptyWorld, notebook, payflowSays, REPO_AT, roundEnd, roundFor, roundInputs, rounds, step, type Moment } from "./pay-rounds";

/** Words the plain voice never uses: HTTP codes, message ids, the repo's raw states and outcomes. */
const raw = /\bevt\d|\b(200|202|409)\b|\b[A-Z]{2,}_[A-Z_]+\b|\b(SUCCESS|PENDING|AUTHORIZED|SETTLED|LANDED|RECONCILED)\b|inbox/i;
const said = (moments: Moment[]) => moments.flatMap((moment) => (moment.kind === "say" ? [moment.text] : moment.kind === "statement" ? [moment.said] : []));
const outcomes = (index: number) => roundEnd(rounds[index]).flow.entries.map((entry) => entry.outcome);

describe("pay rounds (try to break the payment)", () => {
  it("plays each trick through Payflow's rules as the repo decides it", () => {
    expect(outcomes(0)).toEqual(["APPLIED", "DUPLICATE_IGNORED", "DUPLICATE_IGNORED"]);
    expect(outcomes(1)).toEqual(["APPLIED", "STALE_IGNORED"]);
    expect(outcomes(2)).toEqual(["SENT_TO_REVIEW", "PAYMENT_ON_HOLD", "RELEASED", "APPLIED"]);
    expect(outcomes(3)).toEqual(["APPLIED", "BATCH_CREATED", "MATCHED_AWAITING_BANK", "MISSING_CREDIT"]);
  });

  it("reads each question's right answer from the model, and the basic system always ends up different", () => {
    expect(rounds.map((round) => round.answer(roundEnd(round)))).toEqual(["750000", "paid", "hold", "flag"]);
    for (const round of rounds) {
      const end = roundEnd(round);
      expect(round.choices.map((choice) => choice.id)).toContain(round.answer(end));
      const { basic, payflow } = round.compare(end);
      expect(basic).not.toBe(payflow);
    }
    expect(rounds.map((round) => round.compare(roundEnd(round)))).toEqual([
      { measure: "The books say the shop got", basic: "2,250,000", payflow: "750,000" },
      { measure: "Payflow shows the shop", basic: "Approved, not paid", payflow: "Paid" },
      { measure: "The 740,000 message", basic: "Counted as paid in full", payflow: "Held, then 750,000 once" },
      { measure: "The books say", basic: "Done, with no money", payflow: "Money missing: flagged" },
    ]);
  });

  it("asks before the decisive step: something still has to reach Payflow after the question", () => {
    for (const round of rounds) expect(round.after.some((moment) => moment.kind === "receipts" || moment.kind === "statement")).toBe(true);
  });

  it("says everything in everyday words, and writes receipt numbers in Payflow's notebook", () => {
    for (const round of rounds) {
      for (const text of [round.trick, round.hint, round.question, round.why, ...round.choices.map((choice) => choice.label), ...said([...round.before, ...round.after])]) expect(text).not.toMatch(raw);
      let world = emptyWorld;
      for (const input of roundInputs(round)) {
        world = step(world, input);
        expect(payflowSays(world)).not.toMatch(raw);
        expect(payflowSays(world).length).toBeLessThanOrEqual(70);
      }
    }
    expect(notebook(roundEnd(rounds[0])).map((note) => `${note.no} ${note.said}`)).toEqual(["#1 paid"]);
    expect(notebook(roundEnd(rounds[1])).map((note) => `${note.no} ${note.said}`)).toEqual(["#1 paid", "#2 approved"]);
    expect(notebook(roundEnd(rounds[2])).map((note) => note.technical)).toEqual(["evt1 SUCCESS 740000", "evt2 SUCCESS 750000"]);
  });

  it("plays the case's own conditions, so the Result chapter and the address follow the trick", () => {
    const controls = scenarios[0].controls;
    for (const [index, round] of rounds.entries()) {
      expect(roundFor(round.conditions)).toBe(index);
      for (const [key, value] of Object.entries(round.conditions)) expect(controls.find((control) => control.key === key)?.options.map((option) => option.value)).toContain(value);
    }
    expect(roundFor(scenarios[0].defaults)).toBe(0);
  });

  it("tells the story as the repo has it: the card company sends every message, and Payflow never carries the money", () => {
    for (const round of rounds) {
      const moments = [...round.before, ...round.after];
      // Before anything reaches Payflow, the card payment has gone to the card company.
      expect(moments.findIndex((moment) => moment.kind === "pay")).toBeLessThan(moments.findIndex((moment) => moment.kind === "receipts"));
      expect(said(moments).some((text) => /charged twice|pays? twice/i.test(text))).toBe(false);
    }
    // A wrong amount follows the repo's test: held, the corrected message told to try later, released, then the retry applies.
    const wrong = roundEnd(rounds[2]).flow.entries.map((entry) => `${entry.outcome}${entry.http ? ` ${entry.http}` : ""}`);
    expect(wrong).toEqual(["SENT_TO_REVIEW 202", "PAYMENT_ON_HOLD 409", "RELEASED", "APPLIED 200"]);
  });

  it("links every excerpt and test to the repo at one commit", () => {
    expect(REPO_AT).toMatch(/^https:\/\/github\.com\/fattah247\/Payflow-reliability\/blob\/[0-9a-f]{40}$/);
    expect(codeLink("a/B.java", 93, 98)).toBe(`${REPO_AT}/a/B.java#L93-L98`);
    for (const { proof } of rounds) {
      expect(proof.code.length).toBeGreaterThan(0);
      for (const excerpt of proof.code) expect(excerpt.file).toMatch(/^src\/main\/java\/id\/fatarc\/portfolio\/payflowreliability\/.+\.java$/);
      for (const test of proof.tests) {
        expect(test.file).toMatch(/^src\/test\/java\/.+Test\.java$/);
        expect(test.name).toMatch(/^should[A-Z]\w+$/);
      }
    }
  });
});
