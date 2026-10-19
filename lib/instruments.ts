import type { ScenarioSlug } from "./scenarios";

/*
 * The simulators' models live with their repos' rules: case 01 in ./payment-flow (Payflow), case 02
 * in ./uptime (iYup) and case 03 in ./device-risk (TrustGate). This file keeps the plain-language
 * labels for the outcomes the case model projects.
 */

/** Plain-language label for a projected outcome value. */
export function readableOutcome(slug: ScenarioSlug, value: string) {
  const labels: Record<string, string> = {
    "payflow:RECONCILED": "Captured once, reconciled at the bank",
    "payflow:BREAK OPEN": "Paid out, credit missing: a break for treasury",
    "payflow:SETTLED": "Paid out, waiting for the bank",
    "payflow:MANUAL_REVIEW": "On hold for a person",
    "payflow:CAPTURED TWICE": "Charged twice",
    "payflow:STATUS OVERWRITTEN": "Newer news overwritten",
    "payflow:WRONG AMOUNT ACCEPTED": "Wrong amount taken as paid",
    "payflow:RECONCILED WITHOUT THE BANK": "Reconciled with no money in the bank",
    "iyup:QUIET": "No alert",
    "iyup:TargetSlow · NOTIFY": "Slow warning after 5 minutes",
    "iyup:TargetDown · PAGE": "Paged after 1 minute down",
    "iyup:TargetRegionalFailure · NOTIFY": "Regional warning, no outage",
    "iyup:PingAgentDown · NOTIFY": "Agent warning, verdict from the other region",
    "iyup:PAGE": "Paged",
    "iyup:FALSE PAGE": "Paged for an outage that isn't one",
    "iyup:SAYS UP WHILE SLOW": "Says up while visitors wait",
    "trustgate:ALLOW": "Payment allowed",
    "trustgate:BLOCK": "Blocked, nothing signed",
    "trustgate:REQUIRE CONFIRMATION": "Confirmation required",
  };
  return labels[`${slug}:${value}`] ?? value.toLowerCase().replaceAll("_", " ");
}
