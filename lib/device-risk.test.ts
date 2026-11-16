import { describe, expect, it } from "vitest";
import { assessDevice, cancelPayment, confirmPayment, decisionEvent, deviceChecks, SCREEN_LOCK } from "./device-risk";

const phone = (found: string[], lock = "set") => assessDevice({ ...Object.fromEntries(deviceChecks.map((check) => [check.id, found.includes(check.id) ? "found" : "clear"])), [SCREEN_LOCK]: lock });

describe("device risk confirmation (TrustGateViewModel.confirm and dismissConfirmation)", () => {
  it("logs each server decision under the repo's event names", () => {
    expect(decisionEvent).toEqual({
      ALLOW: "SENSITIVE_ACTION_ALLOWED",
      "REQUIRE CONFIRMATION": "SENSITIVE_ACTION_REQUIRES_CONFIRMATION",
      BLOCK: "SENSITIVE_ACTION_BLOCKED",
    });
  });

  it("signs a confirmed payment with the step-up key behind the screen lock, or a signed tap without one", () => {
    const weak = phone(["test_keys", "installer_source_unknown"]);
    expect(weak.decision).toBe("REQUIRE CONFIRMATION");
    expect(confirmPayment(weak, weak)).toEqual({ outcome: "SENT", event: "SENSITIVE_ACTION_ALLOWED_AFTER_CONFIRMATION", method: "DEVICE_CREDENTIAL", signing: "STEP-UP KEY" });
    const unlocked = phone(["test_keys", "installer_source_unknown"], "none");
    expect(confirmPayment(unlocked, unlocked)).toMatchObject({ outcome: "SENT", method: "TAP", signing: "SIGNED TAP" });
  });

  it("checks the phone again before signing, and the app blocks it if it turned high risk while waiting", () => {
    const weak = phone(["test_keys", "installer_source_unknown"]);
    const debugged = phone(["test_keys", "installer_source_unknown", "debugger_connected"]);
    expect(confirmPayment(weak, debugged)).toEqual({ outcome: "BLOCKED", event: "SENSITIVE_ACTION_BLOCKED", method: "DEVICE_CREDENTIAL", signing: "NOTHING SIGNED", decidedBy: "app" });
    // Cleaner by the time the person confirms still goes through, signed as the waiting decision said.
    expect(confirmPayment(weak, phone([])).signing).toBe("STEP-UP KEY");
  });

  it("logs a cancelled confirmation and signs nothing", () => {
    const weak = phone(["test_keys"], "none");
    expect(cancelPayment(weak)).toEqual({ outcome: "CANCELLED", event: "SENSITIVE_ACTION_CANCELLED", method: "TAP", signing: "NOTHING SIGNED" });
  });
});
