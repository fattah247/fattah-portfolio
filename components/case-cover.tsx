import type { ScenarioSlug } from "../lib/scenarios";

/**
 * Cover schematics for the three case files. Each one draws the shape of its own problem
 * (a repeated callback, a latency trace crossing a threshold, signals feeding a policy)
 * rather than a generic illustration. They are schematic, not measurements.
 */
export function CaseCover({ slug, className = "" }: { slug: ScenarioSlug; className?: string }) {
  return (
    <svg aria-hidden="true" className={`case-cover case-cover-${slug} ${className}`.trim()} focusable="false" preserveAspectRatio="xMidYMid meet" viewBox="0 0 240 150">
      <rect className="case-cover-ground" height="150" width="240" />
      {slug === "payflow" ? <PaymentCover /> : slug === "iyup" ? <ServiceCover /> : <DeviceCover />}
    </svg>
  );
}

function PaymentCover() {
  return (
    <g>
      <text className="case-cover-label" x="16" y="24">provider</text>
      <text className="case-cover-label" x="112" y="24">id check</text>
      <text className="case-cover-label" x="182" y="24">state</text>
      <path className="case-cover-rule" d="M16 34h208" />
      {/* First delivery passes the boundary and changes state once. */}
      <path className="case-cover-flow" d="M24 62h96" />
      <path className="case-cover-arrow" d="m114 57 6 5-6 5" />
      <rect className="case-cover-event" height="16" width="22" x="18" y="54" />
      <text className="case-cover-event-text" x="23" y="66">01</text>
      {/* Repeated delivery is recorded at the boundary and stops. */}
      <path className="case-cover-flow case-cover-flow-repeat" d="M24 98h82" />
      <rect className="case-cover-event case-cover-event-repeat" height="16" width="22" x="18" y="90" />
      <text className="case-cover-event-text" x="23" y="102">02</text>
      <path className="case-cover-stop" d="M110 88v20" />
      <rect className="case-cover-boundary" height="70" width="30" x="124" y="46" />
      <path className="case-cover-flow case-cover-flow-designed" d="M154 62h28" />
      <rect className="case-cover-state" height="26" width="44" x="182" y="49" />
      <text className="case-cover-state-text" x="190" y="66">PAID</text>
      <text className="case-cover-note" x="16" y="138">2 deliveries · 1 state change</text>
    </g>
  );
}

function ServiceCover() {
  return (
    <g>
      <text className="case-cover-label" x="16" y="24">p95 latency</text>
      <path className="case-cover-rule" d="M16 34h208" />
      <path className="case-cover-threshold" d="M16 74h208" />
      <text className="case-cover-label case-cover-threshold-label" x="168" y="69">threshold</text>
      <path className="case-cover-trace" d="M16 112 46 108 76 110 106 100 136 86 166 66 196 52 224 44" />
      <circle className="case-cover-breach" cx="152" cy="76" r="4" />
      <text className="case-cover-label" x="16" y="128">health</text>
      <path className="case-cover-health" d="M58 125h166" />
      <text className="case-cover-health-text" x="188" y="121">PASS</text>
      <text className="case-cover-note" x="16" y="144">up, but slower</text>
    </g>
  );
}

function DeviceCover() {
  return (
    <g>
      <text className="case-cover-label" x="16" y="24">signals</text>
      <text className="case-cover-label" x="104" y="24">action</text>
      <text className="case-cover-label" x="168" y="24">decision</text>
      <path className="case-cover-rule" d="M16 34h208" />
      <g className="case-cover-signals">
        <rect className="case-cover-signal case-cover-signal-suspect" height="14" width="58" x="16" y="48" />
        <text className="case-cover-signal-text" x="22" y="59">root ?</text>
        <rect className="case-cover-signal" height="14" width="58" x="16" y="70" />
        <text className="case-cover-signal-text" x="22" y="81">emulator</text>
        <rect className="case-cover-signal" height="14" width="58" x="16" y="92" />
        <text className="case-cover-signal-text" x="22" y="103">signature</text>
      </g>
      <path className="case-cover-flow" d="M74 55h22M74 77h22M74 99h22M96 55v44M96 77h8" />
      <rect className="case-cover-boundary" height="26" width="44" x="104" y="64" />
      <text className="case-cover-signal-text" x="112" y="81">high</text>
      <path className="case-cover-flow case-cover-flow-designed" d="M148 77h20" />
      <rect className="case-cover-decision" height="26" width="56" x="168" y="64" />
      <text className="case-cover-decision-text" x="173" y="81">CONFIRM</text>
      <text className="case-cover-note" x="16" y="138">suspicion</text>
      <path className="case-cover-arrow" d="M76 134h16m-5-4 5 4-5 4" />
      <text className="case-cover-note" x="98" y="138">confirmation</text>
    </g>
  );
}
