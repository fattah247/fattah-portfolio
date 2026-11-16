import {
  decisionEvent,
  deviceChecks,
  type ConfirmationResult,
  type DeviceAssessment,
  type GateDecision,
} from "./device-risk";
import { type CodeExcerpt, type Proof } from "./pay-rounds";

/** The repo at the commit these excerpts were read from, so every link shows the same lines. */
export const TRUSTGATE_REPO = "https://github.com/fattah247/trustgate-android/blob/8ab778f725e6813b359da5e6b156295f9a9fef1b";
export const trustgateCodeLink = (file: string, from: number, to = from) => `${TRUSTGATE_REPO}/${file}#L${from}${to > from ? `-L${to}` : ""}`;

const DOMAIN = "domain/src/main/kotlin/id/fatarc/trustgate/domain";
const DOMAIN_TESTS = "domain/src/test/kotlin/id/fatarc/trustgate/domain";
const BACKEND = "backend/src/main/kotlin/id/fatarc/trustgate/backend";
const APP = "app/src/main/java/id/fatarc/trustgate";
const APP_TESTS = "app/src/test/java/id/fatarc/trustgate";

/** The backend scores the signals the phone reports (`RiskPolicy.assess` calls this). */
const scorerExcerpt: CodeExcerpt = {
  file: `${DOMAIN}/risk/RiskScorer.kt`,
  from: 9,
  lines: [
    "val detectedSignals = signals.filter { it.detected }",
    "val totalScore = detectedSignals.sumOf { it.severity.weight }",
    "val severeSignals = detectedSignals.filter { it.severity == SignalSeverity.HIGH }",
    "// Every severity weighs at least 1, so two or more detected signals always reach the medium threshold.",
    "val (level, reason) = when {",
    "    severeSignals.isNotEmpty() ->",
    "        DeviceRiskLevel.HIGH to RiskReason.SevereSignal(severeSignals.map { it.id })",
    "",
    "    totalScore >= HIGH_SCORE_THRESHOLD ->",
    "        DeviceRiskLevel.HIGH to RiskReason.ScoreThreshold(totalScore, HIGH_SCORE_THRESHOLD)",
    "",
    "    totalScore >= MEDIUM_SCORE_THRESHOLD ->",
    "        DeviceRiskLevel.MEDIUM to RiskReason.ScoreThreshold(totalScore, MEDIUM_SCORE_THRESHOLD)",
    "",
    "    else -> DeviceRiskLevel.LOW to RiskReason.BelowThresholds(totalScore)",
    "}",
  ],
};

/** The backend's gate turns the level into a decision (`ReferenceBackend` calls it). */
const gateExcerpt: CodeExcerpt = {
  file: `${DOMAIN}/actiongate/SensitiveActionGate.kt`,
  from: 12,
  lines: [
    "fun decide(riskLevel: DeviceRiskLevel): SensitiveActionDecision {",
    "    return when (riskLevel) {",
    "        DeviceRiskLevel.LOW -> SensitiveActionDecision.ALLOW",
    "        DeviceRiskLevel.MEDIUM -> SensitiveActionDecision.REQUIRE_CONFIRMATION",
    "        DeviceRiskLevel.HIGH -> SensitiveActionDecision.BLOCK",
    "    }",
    "}",
  ],
};

/** For a payment that needs confirming, the backend picks the key and the way to confirm. */
const confirmationExcerpt: CodeExcerpt = {
  file: `${BACKEND}/ReferenceBackend.kt`,
  from: 492,
  lines: [
    "val stepUp = decision == SensitiveActionDecision.REQUIRE_CONFIRMATION",
    "val hasStepUpKey = store.stepUpKeyOf(deviceKeyId) != null",
    "val signWith = if (stepUp && hasStepUpKey) KeyRole.STEP_UP else KeyRole.DEVICE",
    "val confirmation = when {",
    "    !stepUp -> RequiredConfirmation.NONE",
    "    hasStepUpKey -> RequiredConfirmation.STEP_UP_KEY",
    "    else -> RequiredConfirmation.TAP",
    "}",
  ],
};

/** After the person confirms, the phone checks itself again before it signs. */
const recheckExcerpt: CodeExcerpt = {
  file: `${APP}/ui/TrustGateViewModel.kt`,
  from: 273,
  lines: [
    "// The device may have changed while the person was confirming, so check it again before approving.",
    "val report = reportForSensitiveAction() ?: return@launch abandonAction(\"Couldn't check this phone again.\")",
    "if (report.level == DeviceRiskLevel.HIGH) {",
    "    runCatching { securityService.recordBlockedAfterConfirmation(report) }.rethrowCancellation()",
    "    val stopped = PaymentAuthorization.Blocked(report.level, listOf(DecisionReason(\"Turned high risk while you confirmed\", report.level)))",
    "    updateDecision(PaymentDecisionState.Blocked(report.level), PaymentStage.DONE, stopped)",
    "    return@launch",
    "}",
  ],
};

const scorerTest = (run: DeviceAssessment) => {
  const file = `${DOMAIN_TESTS}/risk/RiskScorerTest.kt`;
  if (run.reason.kind === "severe") return { file, line: 38, name: "a severe signal is high risk even when the total is low" };
  if (run.level === "HIGH") return { file, line: 47, name: "weaker signals that add up to five are high risk by score" };
  if (run.level === "MEDIUM") return { file, line: 24, name: "moderate signals are medium risk by score" };
  return run.score > 0
    ? { file, line: 61, name: "a single weak signal stays low and reports its points" }
    : { file, line: 11, name: "risk score maps clean device to low" };
};

const gateTest: Record<GateDecision, { line: number; name: string }> = {
  BLOCK: { line: 11, name: "high-risk device blocks sensitive action" },
  "REQUIRE CONFIRMATION": { line: 16, name: "medium-risk device requires confirmation" },
  ALLOW: { line: 21, name: "low-risk device allows sensitive action" },
};

const paymentTest = (run: DeviceAssessment, confirmation?: ConfirmationResult | null) => {
  const file = `${APP_TESTS}/ui/TrustGateViewModelTest.kt`;
  if (confirmation?.outcome === "BLOCKED") return { file, line: 224, name: "a device that turns high risk while confirming is blocked before anything is signed" };
  if (run.decision === "BLOCK") return { file, line: 158, name: "high risk is blocked and nothing is signed or charged" };
  if (run.decision === "ALLOW") return { file, line: 101, name: "low risk action is charged once and signed by the device key" };
  return run.screenLock
    ? { file, line: 171, name: "medium risk is charged only after the step-up key signs" }
    : { file, line: 192, name: "without a screen lock medium risk falls back to a signed tap" };
};

/**
 * Builds the engineer proof ("How TrustGate decided") for the current phone assessment and optional
 * confirmation outcome in Case 03, quoting fattah247/trustgate-android at the pinned commit: the
 * backend scores and gates, the phone re-checks itself after a confirmation.
 */
export function deviceProofFor(run: DeviceAssessment, confirmation?: ConfirmationResult | null): Proof {
  const signalLines = run.found.length
    ? run.found.map((check) => `signal=${check.id} category=${check.category} severity=${check.severity} (+${check.points})`)
    : [`no risk signals found (0 of the ${deviceChecks.length} checks this simulator offers)`];
  signalLines.push(`screen_lock=${run.screenLock ? "set (step-up key registered)" : "none (no step-up key)"}`);
  if (confirmation) {
    signalLines.push(`confirmation: method=${confirmation.method} → outcome=${confirmation.outcome}${confirmation.decidedBy ? " (stopped by the app on its re-check)" : ""}`);
  }

  const confirming = run.decision === "REQUIRE CONFIRMATION" || Boolean(confirmation);
  const code = confirming ? [scorerExcerpt, gateExcerpt, confirmationExcerpt, recheckExcerpt] : [scorerExcerpt, gateExcerpt];

  const reasonCode = run.reason.kind === "severe"
    ? `SevereSignal(${run.reason.checks.join(", ")})`
    : run.reason.kind === "score"
      ? `ScoreThreshold(${run.reason.score}, ${run.reason.threshold})`
      : `BelowThresholds(${run.reason.score})`;

  const notes: string[] = [
    "The phone only reports what it found; the backend decides. RiskPolicy.assess takes each signal's severity from SignalCatalog (never from the report) and scores it with RiskScorer: LOW weighs 1, MEDIUM 2, HIGH 3. Any HIGH signal makes the level HIGH; otherwise 5 or more is HIGH and 2 to 4 is MEDIUM.",
    "ALLOW and REQUIRE_CONFIRMATION both get a one-time challenge bound to this payment. ALLOW is signed with the device key (P-256, kept in Android Keystore). REQUIRE_CONFIRMATION is signed with the step-up key behind the screen lock, or, with no screen lock, with the device key plus a signed tap. BLOCK gets no challenge, so nothing can be signed.",
  ];
  if (confirming) {
    notes.push("After the person confirms, TrustGateViewModel.confirm checks the phone again. If it has turned HIGH while the prompt waited, the app stops before signing and logs SENSITIVE_ACTION_BLOCKED.");
  }

  const finalResult = confirmation
    ? `server=${run.decision} (${decisionEvent[run.decision]}) → confirm=${confirmation.outcome} · signing=${confirmation.signing} · event=${confirmation.event}`
    : `score=${run.score} (${reasonCode}) → level=${run.level} → server=${run.decision} · signing=${run.signing} · event=${decisionEvent[run.decision]}`;

  return {
    request: signalLines,
    code,
    notes,
    result: finalResult,
    tests: [
      scorerTest(run),
      { file: `${DOMAIN_TESTS}/actiongate/SensitiveActionGateTest.kt`, ...gateTest[run.decision] },
      paymentTest(run, confirmation),
    ],
  };
}
