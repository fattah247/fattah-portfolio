import { describe, expect, it } from "vitest";
import { evaluatePolicy, latencyThresholdMs, simulatePayment, simulateSignals } from "./instruments";
import { projectScenario, scenarios, type Conditions, type ProjectionMode } from "./scenarios";

/** Every combination of a case's control values. */
function combinations(slug: string): Conditions[] {
  const scenario = scenarios.find((item) => item.slug === slug)!;
  return scenario.controls.reduce<Conditions[]>((sets, control) => sets.flatMap((set) => control.options.map((option) => ({ ...set, [control.key]: option.value }))), [{}]);
}
const modes: ProjectionMode[] = ["baseline", "designed"];

describe("payment instrument", () => {
  it("agrees with the case model and is deterministic for every condition and approach", () => {
    for (const conditions of combinations("payflow")) for (const mode of modes) {
      const run = simulatePayment(conditions, mode);
      expect(run).toEqual(simulatePayment(conditions, mode));
      expect(run.outcome).toBe(projectScenario("payflow", conditions, mode).find((node) => node.id === "state")?.value);
      expect(run.steps.map((step) => step.index)).toEqual(run.steps.map((_, index) => index + 1));
      expect(run.steps[0].stateBefore).toBe("PENDING");
      // Each step starts from the state the previous step left.
      run.steps.slice(1).forEach((step, index) => expect(step.stateBefore).toBe(run.steps[index].stateAfter));
      expect(run.finalState).toBe(run.steps.at(-1)?.stateAfter);
    }
  });

  it("records a duplicate delivery without a second state change when the callback ID is checked", () => {
    const designed = simulatePayment({ delivery: "duplicate" }, "designed");
    expect(designed.deliveries).toBe(2);
    expect(designed.stateWrites).toBe(1);
    expect(designed.acknowledged).toBe(1);
    expect(designed.steps[1]).toMatchObject({ eventId: "evt-01", decision: "acknowledged", stateWrite: false });

    const unchecked = simulatePayment({ delivery: "duplicate" }, "baseline");
    expect(unchecked.stateWrites).toBe(2);
    expect(unchecked.steps[1].decision).toBe("applied-again");
  });

  it("never lets an older event overwrite newer state when ordering is checked", () => {
    const designed = simulatePayment({ delivery: "out-of-order" }, "designed");
    expect(designed.steps[0].sequence).toBeGreaterThan(designed.steps[1].sequence!);
    expect(designed.steps[1]).toMatchObject({ decision: "ignored-stale", stateWrite: false, stateAfter: "PAID" });
    expect(simulatePayment({ delivery: "out-of-order" }, "baseline").steps[1]).toMatchObject({ decision: "regressed", stateAfter: "REVIEW" });
  });

  it("holds a mismatched settlement for review and keeps an interrupted audit pending", () => {
    for (const mode of modes) {
      expect(simulatePayment({ settlement: "mismatched" }, mode).finalState).toBe("REVIEW");
      expect(simulatePayment({ persistence: "interrupted" }, mode).steps.at(-1)).toMatchObject({ kind: "audit", decision: "pending" });
    }
  });
});

describe("observability instrument", () => {
  it("agrees with the case model for every condition and approach", () => {
    for (const conditions of combinations("iyup")) for (const mode of modes) {
      const run = simulateSignals(conditions, mode);
      expect(run).toEqual(simulateSignals(conditions, mode));
      expect(run.decision).toBe(projectScenario("iyup", conditions, mode).find((node) => node.id === "decision")?.value);
      expect(run.intervals).toHaveLength(4);
    }
  });

  it("treats a missing sample as unknown, never as zero or as a quiet alert", () => {
    const run = simulateSignals({ latency: "severe", scrape: "missing", alert: "present" }, "designed");
    const missing = run.intervals.filter((interval) => !interval.collected);
    expect(missing).toHaveLength(2);
    for (const interval of missing) {
      expect(interval.observedLatency).toBeNull();
      expect(interval.alert).toBe("no data");
    }
    expect(run.observedBreaches).toBeNull();
    expect(run.actualBreaches).toBe(3);
    expect(run.decision).toBe("INVESTIGATE COLLECTION");
  });

  it("fires the latency alert exactly when an observed sample is above the threshold", () => {
    for (const conditions of combinations("iyup")) {
      const run = simulateSignals(conditions, "designed");
      for (const interval of run.intervals) {
        if (interval.alert === "firing") expect(interval.observedLatency!).toBeGreaterThan(latencyThresholdMs);
        if (interval.observedLatency !== null && interval.observedLatency > latencyThresholdMs && conditions.alert !== "absent") expect(interval.alert).toBe("firing");
      }
    }
  });

  it("does not report a failing health check as quiet in either approach", () => {
    for (const mode of modes) {
      expect(simulateSignals({ health: "fail", latency: "normal", scrape: "available", alert: "absent" }, mode).decision).not.toBe("QUIET");
    }
  });

  it("shows latency degradation before health fails, which the health-only view cannot see", () => {
    expect(simulateSignals({ health: "pass", latency: "degraded" }, "baseline").decision).toBe("INCOMPLETE");
    expect(simulateSignals({ health: "pass", latency: "degraded", alert: "present" }, "designed").decision).toBe("ACTIONABLE");
  });
});

describe("device trust instrument", () => {
  it("agrees with the case model and matches exactly one rule, first match wins", () => {
    for (const conditions of combinations("trustgate")) for (const mode of modes) {
      const run = evaluatePolicy(conditions, mode);
      expect(run).toEqual(evaluatePolicy(conditions, mode));
      expect(run.decision).toBe(projectScenario("trustgate", conditions, mode).find((node) => node.id === "decision")?.value);
      expect(run.rules.filter((rule) => rule.status === "matched")).toHaveLength(1);
      const matchedIndex = run.rules.findIndex((rule) => rule.status === "matched");
      expect(run.rules.slice(0, matchedIndex).every((rule) => rule.status === "not met")).toBe(true);
      expect(run.rules.slice(matchedIndex + 1).every((rule) => rule.status === "not reached")).toBe(true);
    }
  });

  it("asks for confirmation on uncertainty for a sensitive action instead of blocking", () => {
    const run = evaluatePolicy({ root: "suspected", emulator: "clear", signature: "valid", sensitivity: "high" }, "designed");
    expect(run.decision).toBe("REQUIRE CONFIRMATION");
    expect(run.environmentReasons).toEqual(["Possible root signal"]);
    expect(evaluatePolicy({ root: "suspected", emulator: "clear", signature: "valid", sensitivity: "high" }, "baseline").decision).toBe("BLOCK");
  });

  it("keeps request integrity separate from device environment", () => {
    const run = evaluatePolicy({ root: "clear", emulator: "clear", signature: "invalid", sensitivity: "low" }, "designed");
    expect(run.environment).toBe("clear");
    expect(run.decision).toBe("BLOCK");
    expect(run.rules[0]).toMatchObject({ id: "signature", status: "matched" });
  });
});
