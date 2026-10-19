/**
 * Case 03's model, taken from the TrustGate Android repo (fattah247/trustgate-android) so the site
 * says what the code does:
 *
 * - the eight device checks, with their severities, from `AndroidDeviceSignalCollector.kt`;
 * - the score and the level, from `RiskScorer.kt`: a found check adds its severity's weight
 *   (low 1, medium 2, high 3); any high-severity check makes the level HIGH on its own, otherwise
 *   5 points or more is HIGH, 2 or more is MEDIUM, and anything less is LOW;
 * - the decision, from `SensitiveActionGate.kt` as `ReferenceBackend.beginPayment` applies it on
 *   the server: LOW allows, MEDIUM requires confirmation, HIGH blocks;
 * - how a confirmed payment is signed: by the step-up key, which only signs after the screen lock
 *   or biometrics, or, on a phone with no screen lock, by the device key with a signed tap. A
 *   blocked payment gets no challenge, so nothing can be signed.
 *
 * The server is told the level on every payment and decides; the phone writes each decision to
 * its own activity log (`TrustGateSecurityService.recordGateDecision`).
 */

export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type GateDecision = "ALLOW" | "REQUIRE CONFIRMATION" | "BLOCK";
/** How the payment ends up signed, or that it can't be. */
export type Signing = "DEVICE KEY" | "STEP-UP KEY" | "SIGNED TAP" | "NOTHING SIGNED";

export const severityWeight: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
export const MEDIUM_SCORE_THRESHOLD = 2;
export const HIGH_SCORE_THRESHOLD = 5;

export type DeviceCheck = {
  /** The repo's signal id, also the condition key on the site. */
  id: string;
  /** The repo's own name for the check. */
  name: string;
  category: "ROOT" | "EMULATOR" | "DEBUGGER" | "INSTALLER";
  severity: Severity;
  explanation: string;
};

/** The collector's eight checks, in its order. */
export const deviceChecks: DeviceCheck[] = [
  { id: "root_su_path", name: "Suspicious su path", category: "ROOT", severity: "HIGH", explanation: "Known su binaries usually indicate a rooted or modified device." },
  { id: "root_package", name: "Root management package", category: "ROOT", severity: "HIGH", explanation: "Root management tools can weaken assumptions about the app runtime." },
  { id: "test_keys", name: "Test-keys build tags", category: "ROOT", severity: "MEDIUM", explanation: "Test builds can be easier to tamper with than normal production builds." },
  { id: "system_partition_writable", name: "Writable system partition", category: "ROOT", severity: "MEDIUM", explanation: "A writable system partition can be a sign of device modification." },
  { id: "emulator_fingerprint", name: "Known emulator build strings", category: "EMULATOR", severity: "MEDIUM", explanation: "Build properties line up with common emulator characteristics." },
  { id: "debugger_connected", name: "Debugger attached", category: "DEBUGGER", severity: "HIGH", explanation: "A connected debugger can change runtime behavior and inspection visibility." },
  { id: "app_debuggable", name: "App debuggable flag", category: "DEBUGGER", severity: "MEDIUM", explanation: "Debuggable builds are useful for development but reduce trust for sensitive actions." },
  { id: "installer_source_unknown", name: "Installer source unknown", category: "INSTALLER", severity: "LOW", explanation: "Unknown install source is a signal to review, not an automatic block." },
];

/** The condition that says whether the phone has a screen lock, so a step-up key exists. */
export const SCREEN_LOCK = "screen_lock";

/** The repo's simulated profiles (`ScenarioRiskReports.kt`), as sets of found checks. */
export const deviceProfiles: Record<RiskLevel, string[]> = {
  LOW: [],
  MEDIUM: ["test_keys", "installer_source_unknown"],
  HIGH: ["root_package", "debugger_connected"],
};

export type RiskReason =
  | { kind: "severe"; checks: string[] }
  | { kind: "score"; score: number; threshold: number }
  | { kind: "below"; score: number };

export type DeviceAssessment = {
  /** Every check, found or not, in the collector's order. */
  checks: Array<DeviceCheck & { found: boolean; points: number }>;
  found: Array<DeviceCheck & { points: number }>;
  score: number;
  level: RiskLevel;
  reason: RiskReason;
  decision: GateDecision;
  signing: Signing;
  screenLock: boolean;
};

/** Scores a phone's checks and applies the server's gate, as the repo does. */
export function assessDevice(conditions: Record<string, string>): DeviceAssessment {
  const checks = deviceChecks.map((check) => {
    const found = conditions[check.id] === "found";
    return { ...check, found, points: found ? severityWeight[check.severity] : 0 };
  });
  const found = checks.filter((check) => check.found);
  const score = found.reduce((total, check) => total + check.points, 0);
  const severe = found.filter((check) => check.severity === "HIGH").map((check) => check.id);
  const [level, reason]: [RiskLevel, RiskReason] = severe.length
    ? ["HIGH", { kind: "severe", checks: severe }]
    : score >= HIGH_SCORE_THRESHOLD
      ? ["HIGH", { kind: "score", score, threshold: HIGH_SCORE_THRESHOLD }]
      : score >= MEDIUM_SCORE_THRESHOLD
        ? ["MEDIUM", { kind: "score", score, threshold: MEDIUM_SCORE_THRESHOLD }]
        : ["LOW", { kind: "below", score }];
  const decision: GateDecision = level === "LOW" ? "ALLOW" : level === "MEDIUM" ? "REQUIRE CONFIRMATION" : "BLOCK";
  const screenLock = conditions[SCREEN_LOCK] !== "none";
  const signing: Signing = decision === "BLOCK" ? "NOTHING SIGNED" : decision === "ALLOW" ? "DEVICE KEY" : screenLock ? "STEP-UP KEY" : "SIGNED TAP";
  return { checks, found, score, level, reason, decision, signing, screenLock };
}
