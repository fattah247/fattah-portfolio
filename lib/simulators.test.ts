import { describe, expect, it } from "vitest";
import { simulatePayment, simulateSignals } from "./instruments";
import { projectScenario, scenarios, type Conditions } from "./scenarios";
import { emptyPayWorld, liveSample, onCallStatus, paidMessage, lateMessage, payStep, paymentScript, playPayment } from "./simulators";

function combinations(slug: string): Conditions[] {
  const scenario = scenarios.find((item) => item.slug === slug)!;
  return scenario.controls.reduce<Conditions[]>(
    (all, control) => all.flatMap((partial) => control.options.map((option) => ({ ...partial, [control.key]: option.value }))),
    [{}],
  );
}

describe("payment simulator", () => {
  it.each(combinations("payflow"))("replays each story to where the case model ends, with and without the check: %o", (conditions) => {
    for (const [checked, mode] of [[true, "designed"], [false, "baseline"]] as const) {
      const world = playPayment(paymentScript(conditions), checked);
      const model = simulatePayment(conditions, mode);
      expect(world.state, mode).toBe(model.finalState);
      expect(world.updates, mode).toBe(model.stateWrites);
      expect(world.audit.some((record) => record.status === "pending"), mode).toBe(conditions.persistence === "interrupted");
    }
  });

  it("applies a message once however often the bank retries it, and every time without the check", () => {
    const retries = Array.from({ length: 5 }, () => ({ kind: "deliver", message: paidMessage }) as const);
    const checked = playPayment(retries, true);
    expect(checked).toMatchObject({ state: "PAID", deliveries: 5, updates: 1, repeats: 0 });
    expect(checked.entries.filter((entry) => entry.passed === false)).toHaveLength(4);
    expect(playPayment(retries, false)).toMatchObject({ state: "PAID", deliveries: 5, updates: 5, repeats: 4 });
  });

  it("applies an older update that arrives first, then ignores it once the newer one is in", () => {
    const world = playPayment([{ kind: "deliver", message: lateMessage }, { kind: "deliver", message: paidMessage }, { kind: "deliver", message: lateMessage }], true);
    expect(world.state).toBe("PAID");
    expect(world.entries.map((entry) => entry.outcome)).toEqual(["applied", "applied", "duplicate"]);
  });

  it("queues audit records while the store is down and writes all of them when it returns", () => {
    const down = playPayment([{ kind: "store", online: false }, { kind: "deliver", message: paidMessage }, { kind: "settle", matched: false }], true);
    expect(down.audit.map((record) => record.status)).toEqual(["pending", "pending"]);
    const up = payStep(down, { kind: "store", online: true }, true);
    expect(up.audit.every((record) => record.status === "written")).toBe(true);
    expect(up.entries.at(-1)?.plain).toContain("2 waiting entries were written down");
    expect(payStep(emptyPayWorld, { kind: "store", online: true }, true)).toBe(emptyPayWorld);
  });
});

describe("service simulator", () => {
  it.each(combinations("iyup").filter((conditions) => conditions.scrape === "available"))("matches the case model minute by minute after a change: %o", (conditions) => {
    for (const mode of ["designed", "baseline"] as const) {
      const model = simulateSignals(conditions, mode);
      model.intervals.forEach((interval, minute) => {
        expect(liveSample(conditions, mode, minute, minute)).toEqual({ ...interval, minute });
      });
    }
  });

  it("loses latency samples while the scrape target is missing and says so", () => {
    const sample = liveSample({ health: "pass", latency: "degraded", scrape: "missing", alert: "present" }, "designed", 3, 3);
    expect(sample).toMatchObject({ observedLatency: null, alert: "no data", actualLatency: 620 });
    expect(onCallStatus(sample, "designed").title).toBe("Investigate collection");
  });

  const decisionFor = { Outage: ["ACTIONABLE", "INCOMPLETE"], "Paging on-call": ["ACTIONABLE"], "Investigate collection": ["INVESTIGATE COLLECTION"], "Breach, nobody paged": ["INCOMPLETE"], "All quiet": ["QUIET"] } as Record<string, string[]>;

  it.each(combinations("iyup"))("says on the on-call screen what the case model decides: %o", (conditions) => {
    const sample = liveSample(conditions, "designed", 3, 3);
    const decision = projectScenario("iyup", conditions, "designed").find((node) => node.id === "decision")?.value;
    expect(decisionFor[onCallStatus(sample, "designed").title]).toContain(decision);
  });

  it("shows a green light on the health-only dashboard while users wait, unless health fails", () => {
    const slow = liveSample({ health: "pass", latency: "severe", scrape: "available", alert: "present" }, "baseline", 3, 3);
    expect(slow.actualLatency).toBeGreaterThan(500);
    expect(onCallStatus(slow, "baseline")).toMatchObject({ tone: "confirmed", title: "Looks fine" });
    expect(onCallStatus(liveSample({ health: "fail", latency: "normal", scrape: "available", alert: "present" }, "baseline", 0, 0), "baseline").title).toBe("Outage");
  });
});
