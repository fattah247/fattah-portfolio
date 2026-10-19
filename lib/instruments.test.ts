import { describe, expect, it } from "vitest";
import { latencyThresholdMs, simulatePayment, simulateSignals } from "./instruments";
import { assessDevice, deviceChecks, deviceProfiles, SCREEN_LOCK } from "./device-risk";
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

describe("device trust instrument (TrustGate's RiskScorer and gate)", () => {
  /** A phone with these checks found. */
  const phone = (found: string[], lock = "set") => ({ ...Object.fromEntries(deviceChecks.map((check) => [check.id, found.includes(check.id) ? "found" : "clear"])), [SCREEN_LOCK]: lock });

  it("agrees with the case model and is deterministic for every phone", () => {
    for (const conditions of combinations("trustgate")) {
      const run = assessDevice(conditions);
      expect(run).toEqual(assessDevice(conditions));
      expect(run.decision).toBe(projectScenario("trustgate", conditions, "designed").find((node) => node.id === "decision")?.value);
      expect(run.score).toBe(run.found.reduce((total, check) => total + check.points, 0));
    }
  });

  it("scores the repo's three test phones to their own levels", () => {
    expect(assessDevice(phone(deviceProfiles.LOW))).toMatchObject({ score: 0, level: "LOW", reason: { kind: "below", score: 0 }, decision: "ALLOW", signing: "DEVICE KEY" });
    expect(assessDevice(phone(deviceProfiles.MEDIUM))).toMatchObject({ score: 3, level: "MEDIUM", reason: { kind: "score", score: 3, threshold: 2 }, decision: "REQUIRE CONFIRMATION", signing: "STEP-UP KEY" });
    expect(assessDevice(phone(deviceProfiles.HIGH))).toMatchObject({ score: 6, level: "HIGH", reason: { kind: "severe", checks: ["root_package", "debugger_connected"] }, decision: "BLOCK", signing: "NOTHING SIGNED" });
  });

  it("makes one high-severity check high risk on its own, whatever the total", () => {
    const run = assessDevice(phone(["root_su_path"]));
    expect(run.score).toBe(3);
    expect(run).toMatchObject({ level: "HIGH", reason: { kind: "severe", checks: ["root_su_path"] }, decision: "BLOCK" });
  });

  it("reaches high risk on points alone, as the Signals screenshot shows (2 + 2 + 1)", () => {
    const run = assessDevice(phone(["emulator_fingerprint", "app_debuggable", "installer_source_unknown"]));
    expect(run).toMatchObject({ score: 5, level: "HIGH", reason: { kind: "score", score: 5, threshold: 5 }, decision: "BLOCK" });
  });

  it("lets a single weak check through, below the medium threshold", () => {
    expect(assessDevice(phone(["installer_source_unknown"]))).toMatchObject({ score: 1, level: "LOW", decision: "ALLOW" });
  });

  it("signs a confirmation with the step-up key, or with a signed tap when there is no screen lock", () => {
    expect(assessDevice(phone(deviceProfiles.MEDIUM, "set")).signing).toBe("STEP-UP KEY");
    expect(assessDevice(phone(deviceProfiles.MEDIUM, "none")).signing).toBe("SIGNED TAP");
    expect(assessDevice(phone(deviceProfiles.HIGH, "none")).signing).toBe("NOTHING SIGNED");
  });
});
