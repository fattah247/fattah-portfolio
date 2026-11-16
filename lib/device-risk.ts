/**
 * Case 03's model, taken from the TrustGate Android repo (fattah247/trustgate-android) so the site
 * says what the code does:
 *
 * - the eleven device checks, in `AndroidDeviceSignalCollector.kt`'s order, with the names, severities
 *   and explanations of `SignalCatalog.kt`; the three SCAM checks score like the rest, and the server
 *   also raises a scam warning for them (`RiskPolicy.assess`), which the simulator does not draw;
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
 *
 * A payment that needs a confirmation waits for the person (`TrustGateViewModel`): they confirm with
 * the screen lock or biometrics (the step-up key signs), or with a tap when the phone has no screen
 * lock (the device key signs the tap), or they back out. Before signing, the phone checks itself
 * again; if it turned high risk while it waited, the app stops the payment itself.
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
  category: "ROOT" | "EMULATOR" | "DEBUGGER" | "INSTALLER" | "SCAM";
  severity: Severity;
  explanation: string;
};

/** The collector's eleven checks, in its order. */
export const deviceChecks: DeviceCheck[] = [
  { id: "root_su_path", name: "Rooted", category: "ROOT", severity: "HIGH", explanation: "A root tool is on this phone, so other apps could take full control of it." },
  { id: "root_package", name: "Root app installed", category: "ROOT", severity: "HIGH", explanation: "Apps like Magisk give anything that asks full control of the phone." },
  { id: "test_keys", name: "Test build of Android", category: "ROOT", severity: "MEDIUM", explanation: "The phone runs a test version of Android, which is easier to tamper with." },
  { id: "system_partition_writable", name: "System files changeable", category: "ROOT", severity: "MEDIUM", explanation: "Android's own files can be changed, so the system may have been modified." },
  { id: "emulator_fingerprint", name: "Emulator", category: "EMULATOR", severity: "MEDIUM", explanation: "This isn't a real phone, and an emulator can fake what it reports." },
  { id: "debugger_connected", name: "Debugger attached", category: "DEBUGGER", severity: "HIGH", explanation: "A debugger can read and change the app while it runs." },
  { id: "app_debuggable", name: "Debug version of the app", category: "DEBUGGER", severity: "MEDIUM", explanation: "This copy of the app was built for development, which lets tools look inside it." },
  { id: "installer_source_unknown", name: "Not from an app store", category: "INSTALLER", severity: "LOW", explanation: "The app wasn't installed from a store, so it could be a modified copy." },
  { id: "call_active", name: "On a call", category: "SCAM", severity: "MEDIUM", explanation: "Scammers often stay on the line and talk people through a payment." },
  { id: "screen_reader_app", name: "App reading the screen", category: "SCAM", severity: "MEDIUM", explanation: "An app with accessibility access, other than a real accessibility tool, can read and tap anything on screen." },
  { id: "screen_recording", name: "Screen being recorded", category: "SCAM", severity: "MEDIUM", explanation: "Something is recording or sharing this screen, so someone else may be watching." },
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

/* ----------------------------------------------------------- Confirmation */

/** The phone's activity log entries for a payment (`SecurityEventType`). */
export type SecurityEventType =
  | "SENSITIVE_ACTION_ALLOWED"
  | "SENSITIVE_ACTION_REQUIRES_CONFIRMATION"
  | "SENSITIVE_ACTION_BLOCKED"
  | "SENSITIVE_ACTION_ALLOWED_AFTER_CONFIRMATION"
  | "SENSITIVE_ACTION_CANCELLED";

/** The entry the phone logs for the server's decision (`recordGateDecision`). */
export const decisionEvent: Record<GateDecision, SecurityEventType> = {
  ALLOW: "SENSITIVE_ACTION_ALLOWED",
  "REQUIRE CONFIRMATION": "SENSITIVE_ACTION_REQUIRES_CONFIRMATION",
  BLOCK: "SENSITIVE_ACTION_BLOCKED",
};

/** How the person confirms (`ConfirmationMethod`): the screen lock or biometrics, or a tap. */
export type ConfirmationMethod = "DEVICE_CREDENTIAL" | "TAP";
export const confirmationMethod = (pending: DeviceAssessment): ConfirmationMethod => (pending.screenLock ? "DEVICE_CREDENTIAL" : "TAP");

export type ConfirmationResult = {
  outcome: "SENT" | "BLOCKED" | "CANCELLED";
  event: SecurityEventType;
  method: ConfirmationMethod;
  signing: Signing;
  /** Who stopped it, when it is stopped after the confirmation: the app itself. */
  decidedBy?: "app";
};

/**
 * The person confirmed a payment that was waiting (`TrustGateViewModel.confirm`). The phone checks
 * itself again first: still low or medium, the payment is signed the way the waiting decision said;
 * high now, the app blocks it before anything is signed.
 */
export function confirmPayment(pending: DeviceAssessment, now: DeviceAssessment): ConfirmationResult {
  const method = confirmationMethod(pending);
  if (now.level === "HIGH") return { outcome: "BLOCKED", event: "SENSITIVE_ACTION_BLOCKED", method, signing: "NOTHING SIGNED", decidedBy: "app" };
  return { outcome: "SENT", event: "SENSITIVE_ACTION_ALLOWED_AFTER_CONFIRMATION", method, signing: method === "DEVICE_CREDENTIAL" ? "STEP-UP KEY" : "SIGNED TAP" };
}

/** The person backed out at the confirmation (`dismissConfirmation`): nothing is signed. */
export function cancelPayment(pending: DeviceAssessment): ConfirmationResult {
  return { outcome: "CANCELLED", event: "SENSITIVE_ACTION_CANCELLED", method: confirmationMethod(pending), signing: "NOTHING SIGNED" };
}

/* ------------------------------------------------------------- Comparison */

/**
 * A gate that blocks on any suspicious signal, the way a simple root check does. It is a comparison
 * for the site, not code from the repo: TrustGate weighs the signals instead.
 */
export function blockOnAnySignal(conditions: Record<string, string>): GateDecision {
  return deviceChecks.some((check) => conditions[check.id] === "found") ? "BLOCK" : "ALLOW";
}
