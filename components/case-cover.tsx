import type { ScenarioSlug } from "../lib/scenarios";

/**
 * Cover schematics for the three case files. Each one draws the shape of its own problem
 * (a repeated callback, a latency trace crossing a threshold, device checks adding up to a decision)
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
  // The story's own phone: two weak checks found (+2, +1) and two strong ones clear; three points
  // pass the confirm mark (2) but not the block mark (5).
  return (
    <g>
      <text className="case-cover-label" x="16" y="24">checks</text>
      <text className="case-cover-label" x="114" y="24">points</text>
      <text className="case-cover-label" x="186" y="24">decision</text>
      <path className="case-cover-rule" d="M16 34h208" />
      <g className="case-cover-signals">
        <rect className="case-cover-signal case-cover-signal-suspect" height="14" width="86" x="16" y="44" />
        <text className="case-cover-signal-text" x="22" y="55">+2 test build</text>
        <rect className="case-cover-signal case-cover-signal-suspect" height="14" width="86" x="16" y="62" />
        <text className="case-cover-signal-text" x="22" y="73">+1 installer</text>
        <rect className="case-cover-signal" height="14" width="86" x="16" y="80" />
        <text className="case-cover-signal-text case-cover-signal-clear" x="22" y="91">· root app</text>
        <rect className="case-cover-signal" height="14" width="86" x="16" y="98" />
        <text className="case-cover-signal-text case-cover-signal-clear" x="22" y="109">· debugger</text>
      </g>
      <path className="case-cover-flow" d="M102 51h6M102 69h6M108 51v18M108 60h6" />
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <rect className={index < 3 ? "case-cover-cell case-cover-cell-on" : "case-cover-cell"} height="14" key={index} width="10" x={114 + index * 10} y="53" />
      ))}
      <path className="case-cover-mark" d="M134 48v24M164 48v24" />
      <text className="case-cover-signal-text" textAnchor="middle" x="134" y="82">2</text>
      <text className="case-cover-signal-text" textAnchor="middle" x="164" y="82">5</text>
      <path className="case-cover-flow case-cover-flow-designed" d="M174 60h10" />
      <rect className="case-cover-decision" height="26" width="46" x="184" y="47" />
      <text className="case-cover-decision-text" x="188" y="64">CONFIRM</text>
      <text className="case-cover-note" x="16" y="138">3 points</text>
      <path className="case-cover-arrow" d="M70 134h16m-5-4 5 4-5 4" />
      <text className="case-cover-note" x="92" y="138">confirm first</text>
    </g>
  );
}
