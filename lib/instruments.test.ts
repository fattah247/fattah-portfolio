import { describe, expect, it } from "vitest";
import { assessDevice, blockOnAnySignal, deviceChecks, deviceProfiles, SCREEN_LOCK } from "./device-risk";
import { projectScenario, scenarios, type Conditions } from "./scenarios";

/** Every combination of a case's control values. */
function combinations(slug: string): Conditions[] {
  const scenario = scenarios.find((item) => item.slug === slug)!;
  return scenario.controls.reduce<Conditions[]>((sets, control) => sets.flatMap((set) => control.options.map((option) => ({ ...set, [control.key]: option.value }))), [{}]);
}

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

  it("sets TrustGate's scoring beside a gate that blocks on any signal, the comparison the case draws", () => {
    expect(blockOnAnySignal(phone(deviceProfiles.MEDIUM))).toBe("BLOCK");
    expect(assessDevice(phone(deviceProfiles.MEDIUM)).decision).toBe("REQUIRE CONFIRMATION");
    expect(blockOnAnySignal(phone(["installer_source_unknown"]))).toBe("BLOCK");
    expect(blockOnAnySignal(phone([]))).toBe("ALLOW");
    expect(projectScenario("trustgate", phone(deviceProfiles.MEDIUM), "baseline").find((node) => node.id === "decision")?.value).toBe("BLOCK");
  });
});
