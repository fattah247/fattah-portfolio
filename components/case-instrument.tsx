"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronIcon, PlayIcon, RewindIcon } from "./icons";
import {
  evaluatePolicy,
  latencyThresholdMs,
  readableOutcome,
  simulatePayment,
  simulateSignals,
  type PaymentStep,
} from "../lib/instruments";
import { explainScenario, projectScenario, type Conditions, type ProjectionMode, type Scenario } from "../lib/scenarios";

type Phase = "rest" | "rewind" | "reconstruct";

const narrative: Record<Scenario["slug"], string> = {
  payflow: "Starts at the story's conditions. Choose how the callback arrives, then Run sequence to replay each delivery and its effect on the payment.",
  iyup: "Starts at the story's conditions. Change how the service behaves or what is collected: the chart shows what happened, the rows what monitoring could see.",
  trustgate: "Starts at the story's conditions. Change a signal or the action's sensitivity: the policy reads top to bottom and the first matching rule decides.",
};

/** Each instrument has a name, like a small piece of lab equipment. */
const plateName: Record<Scenario["slug"], string> = {
  payflow: "Callback replay",
  iyup: "Latency monitor",
  trustgate: "Policy evaluator",
};

const primaryKey: Record<Scenario["slug"], string> = { payflow: "delivery", iyup: "latency", trustgate: "root" };

/**
 * Which named values changed in the latest update, so the view can mark them once. Each mark is
 * the update's parity ("odd" / "even"): a value that changes again flips parity, which restarts
 * its animation without remounting anything. Uses React's adjust-state-while-rendering pattern.
 */
export function useChangeMarks(values: Record<string, string>) {
  const signature = JSON.stringify(values);
  const [memory, setMemory] = useState({ generation: 0, marks: {} as Record<string, "odd" | "even">, signature, values });
  if (memory.signature !== signature) {
    const generation = memory.generation + 1;
    const marks: Record<string, "odd" | "even"> = {};
    for (const [id, value] of Object.entries(values)) if (memory.values[id] !== value) marks[id] = generation % 2 ? "odd" : "even";
    setMemory({ generation, marks, signature, values });
    return marks;
  }
  return memory.marks;
}

/**
 * The "Try it" instrument shared by all three cases. One model per case (lib/instruments.ts)
 * feeds one presentation that recomposes by its own container width: wide puts controls, view,
 * and inspector side by side; medium moves the inspector below; compact stacks the primary
 * control, the view, the remaining controls, and the inspector. State lives above this
 * component, so resizing or changing device mode never resets a run.
 */
export function CaseInstrument({
  approach,
  conditions,
  foreground = true,
  isDefault,
  onApproachChange,
  onChange,
  onReset,
  phase,
  scenario,
  selectedConditions,
}: {
  approach: ProjectionMode;
  conditions: Conditions;
  /** False while the case is off screen (Home, Recents, another app, a hidden tab). */
  foreground?: boolean;
  isDefault: boolean;
  onApproachChange: (mode: ProjectionMode) => void;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  phase: Phase;
  scenario: Scenario;
  selectedConditions: Conditions;
}) {
  const titleId = `${scenario.slug}-instrument-title`;
  const primary = scenario.controls.find((control) => control.key === primaryKey[scenario.slug]) ?? scenario.controls[0];
  const others = scenario.controls.filter((control) => control.key !== primary.key);
  const baseline = useMemo(() => projectScenario(scenario.slug, conditions, "baseline"), [conditions, scenario.slug]);
  const designed = useMemo(() => projectScenario(scenario.slug, conditions, "designed"), [conditions, scenario.slug]);
  const nodes = approach === "designed" ? designed : baseline;
  const other = approach === "designed" ? baseline : designed;
  const outcomeValue = nodes.find((node) => node.id === scenario.outcomeNodeId)?.value ?? "";
  const otherValue = other.find((node) => node.id === scenario.outcomeNodeId)?.value ?? "";
  const outcomeNode = nodes.find((node) => node.id === scenario.outcomeNodeId);
  const difference = explainScenario(scenario, conditions, baseline, designed)[1]?.text;
  // On a narrow instrument the secondary conditions and the per-part state fold behind toggles,
  // so the path reads: approach, what happens, the view, the result. Wide layouts show both.
  const changedOthers = others.filter((control) => selectedConditions[control.key] !== scenario.defaults[control.key]).length;
  const [moreOpen, setMoreOpen] = useState(changedOthers > 0);
  const [stateOpen, setStateOpen] = useState(false);

  const stateMarks = useChangeMarks(Object.fromEntries(nodes.map((node) => [node.id, node.value])));
  const outcomeMark = useChangeMarks({ outcome: `${approach}:${outcomeValue}` }).outcome;

  // Inputs are selector keys joined into one object per group: two options read as a switch,
  // three as a short column. The pressed key is set in, tinted, and its marker filled.
  const renderControl = (control: Scenario["controls"][number]) => (
    <fieldset className="instrument-control" data-key={control.key} key={control.key}>
      <legend>{control.label}</legend>
      <div className="instrument-keys" data-count={control.options.length}>
        {control.options.map((option) => (
          <button
            aria-pressed={selectedConditions[control.key] === option.value}
            className="instrument-option"
            data-story={option.value === scenario.defaults[control.key] || undefined}
            key={option.value}
            onClick={() => onChange(control.key, option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <section aria-labelledby={titleId} className="instrument" data-approach={approach} data-instrument={scenario.slug} data-phase={phase} id="replay">
      <header className="instrument-plate">
        <h2 className="interaction-title" id={titleId}>Test the decision</h2>
        <p className="instrument-plate-name"><span>{plateName[scenario.slug]}</span> <small>Simulated</small></p>
      </header>
      <p className="instrument-instruction">{narrative[scenario.slug]}</p>

      <div className="instrument-body">
        <div className="instrument-inputs">
          <fieldset className="instrument-control instrument-approach" data-key="approach">
            <legend>Approach</legend>
            <div className="instrument-keys" data-count={2}>
              {(["designed", "baseline"] as const).map((mode) => (
                <button aria-pressed={approach === mode} className="instrument-option" data-story={mode === "designed" || undefined} key={mode} onClick={() => onApproachChange(mode)} type="button">
                  {mode === "designed" ? scenario.designedLabel : scenario.baselineLabel}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="instrument-primary">{renderControl(primary)}</div>
          <div className="instrument-controls" data-open={moreOpen || undefined}>
            <button aria-controls={`${titleId}-more`} aria-expanded={moreOpen} className="instrument-disclosure" onClick={() => setMoreOpen((open) => !open)} type="button">
              <span>More conditions{changedOthers ? ` · ${changedOthers} changed` : ""}</span>
              <ChevronIcon direction={moreOpen ? "up" : "down"} />
            </button>
            <div className="instrument-more" id={`${titleId}-more`}>
              {others.map(renderControl)}
            </div>
            {!isDefault ? (
              <button className="instrument-reset" onClick={onReset} type="button"><RewindIcon /> Reset conditions</button>
            ) : null}
          </div>
        </div>
        <div className="instrument-view">
          {scenario.slug === "payflow" ? <PaymentView approach={approach} busy={phase !== "rest"} conditions={conditions} foreground={foreground} /> : null}
          {scenario.slug === "iyup" ? <SignalView approach={approach} conditions={conditions} /> : null}
          {scenario.slug === "trustgate" ? <PolicyView approach={approach} conditions={conditions} /> : null}
        </div>
        <aside aria-label="Result and state" className="instrument-inspector" data-open={stateOpen || undefined}>
          <div className="inspector-outcome" data-changed={outcomeMark} data-tone={outcomeNode?.tone}>
            <span><i aria-hidden="true" />Result</span>
            <strong>{readableOutcome(scenario.slug, outcomeValue)}</strong>
            <p>{outcomeNode?.detail}</p>
          </div>
          <p className="inspector-compare">
            {(approach === "designed" ? scenario.baselineLabel : scenario.designedLabel)}: <b>{readableOutcome(scenario.slug, otherValue)}</b>
          </p>
          <button aria-controls={`${titleId}-state`} aria-expanded={stateOpen} className="instrument-disclosure" onClick={() => setStateOpen((open) => !open)} type="button">
            <span>State of each part</span>
            <ChevronIcon direction={stateOpen ? "up" : "down"} />
          </button>
          <div className="inspector-details" id={`${titleId}-state`}>
            {difference ? <p className="inspector-difference">{difference}</p> : null}
            <ol aria-label="State of each part" className="inspector-state">
              {nodes.map((node) => (
                <li data-changed={stateMarks[node.id]} data-tone={node.tone} key={node.id}>
                  <span>{node.label}</span>
                  <b>{node.value.toLowerCase()}</b>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Payment */

const paymentStateLabel = { PENDING: "Pending", PAID: "Paid", REVIEW: "Review" } as const;
const decisionLabel: Record<PaymentStep["decision"], string> = {
  applied: "State changed",
  acknowledged: "Acknowledged, no change",
  "ignored-stale": "Recorded, not applied",
  "applied-again": "State written again",
  regressed: "Older status written",
  review: "Held for review",
  written: "Written",
  pending: "Pending",
  matched: "Matched",
};
const stepDelay = 700;

type RunStatus = "ready" | "running" | "paused" | "completed";
const runStatusLabel: Record<RunStatus, string> = { ready: "Ready", running: "Running", paused: "Paused", completed: "Completed" };

function PaymentView({ approach, busy, conditions, foreground }: { approach: ProjectionMode; busy: boolean; conditions: Conditions; foreground: boolean }) {
  const run = useMemo(() => simulatePayment(conditions, approach), [approach, conditions]);
  const total = run.steps.length;
  // Playback belongs to one run (approach + conditions). A different run starts complete, so a
  // condition change always shows its whole result; Run and Step replay it from the start.
  // `moved` records that the visitor drove the run, so only their steps are marked as arriving.
  const runKey = `${approach}:${JSON.stringify(conditions)}`;
  const [playback, setPlayback] = useState({ key: runKey, revealed: total, playing: false, moved: false });
  const current = playback.key === runKey ? playback : { key: runKey, revealed: total, playing: false, moved: false };
  const revealed = Math.min(current.revealed, total);
  // A replay pauses where it is when the case leaves the screen and waits for Resume, so a
  // visitor returning from Home or Recents finds the step they left rather than a finished run.
  if (!foreground && current.playing && playback.key === runKey) setPlayback({ ...current, playing: false });
  const playing = foreground && current.playing && revealed < total;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setPlayback({ key: runKey, revealed: revealed + 1, playing: revealed + 1 < total, moved: true }), stepDelay);
    return () => window.clearTimeout(timer);
  }, [playing, revealed, runKey, total]);

  const shown = run.steps.slice(0, revealed);
  const state = shown.at(-1)?.stateAfter ?? "PENDING";
  const visited = new Set<string>(["PENDING", ...shown.map((step) => step.stateAfter)]);
  const writes = shown.filter((step) => step.kind === "delivery" && step.stateWrite).length;
  const deliveries = shown.filter((step) => step.kind === "delivery").length;
  const acknowledged = shown.filter((step) => step.decision === "acknowledged" || step.decision === "ignored-stale").length;
  const complete = revealed >= total;
  const latest = shown.at(-1);
  // The run is a small machine: Ready (rewound), Running, Paused part-way, Completed. While new
  // conditions are being applied the controls are disabled rather than acting on a stale run.
  const status: RunStatus = playing ? "running" : complete ? "completed" : revealed === 0 ? "ready" : "paused";
  const arrival = current.moved && revealed > 0 ? (revealed % 2 ? "odd" : "even") : undefined;
  const stateMark = useChangeMarks({ state }).state;

  return (
    <div className="pay-view" data-complete={complete || undefined}>
      {/* Input first: the transport and its readout. Then the sequence it produces, then the
          payment state and counts as the output. Lamps are read, never pressed. */}
      <div className="pay-playback">
        <button
          className="instrument-run"
          data-state={status}
          disabled={busy}
          onClick={() => {
            if (playing) { setPlayback({ key: runKey, revealed, playing: false, moved: true }); return; }
            setPlayback({ key: runKey, revealed: complete ? 0 : revealed, playing: true, moved: true });
          }}
          type="button"
        >
          <PlayIcon paused={status === "running"} />
          {status === "running" ? "Pause" : status === "paused" ? "Resume" : "Run sequence"}
        </button>
        <button
          className="instrument-step"
          disabled={busy || playing}
          onClick={() => setPlayback({ key: runKey, revealed: revealed >= total ? 1 : revealed + 1, playing: false, moved: true })}
          type="button"
        >
          Step
        </button>
        <button
          aria-label="Rewind"
          className="instrument-step instrument-rewind"
          disabled={busy || revealed === 0}
          onClick={() => setPlayback({ key: runKey, revealed: 0, playing: false, moved: true })}
          title="Rewind"
          type="button"
        >
          <RewindIcon />
        </button>
        <p className="pay-run-status" data-state={status}>
          <i aria-hidden="true" />
          <span>{runStatusLabel[status]}</span>
          <small>{revealed} of {total}</small>
        </p>
      </div>

      <ol aria-label="Event sequence" className="pay-steps">
        {run.steps.map((step, index) => {
          const isShown = index < revealed;
          return (
            <li aria-hidden={!isShown || undefined} className="pay-step" data-arrived={index === revealed - 1 ? arrival : undefined} data-decision={step.decision} data-kind={step.kind} data-shown={isShown || undefined} key={`${step.index}-${step.title}`}>
              <span className="pay-step-index" aria-hidden="true">{String(step.index).padStart(2, "0")}</span>
              <span className="pay-step-title">{step.title}</span>
              {step.eventId ? <span className="pay-step-event"><code>{step.eventId}</code> <small>seq {step.sequence}</small></span> : <span className="pay-step-event" />}
              <span className="pay-step-check">{step.check}</span>
              <span className="pay-step-result">
                <b><i aria-hidden="true" />{decisionLabel[step.decision]}</b>
                <small>{step.stateWrite && step.stateBefore !== step.stateAfter ? `${paymentStateLabel[step.stateBefore]} → ${paymentStateLabel[step.stateAfter]}` : step.stateWrite ? `${paymentStateLabel[step.stateAfter]}, written again` : `${paymentStateLabel[step.stateAfter]}, unchanged`}</small>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="pay-output">
        <div className="pay-state-panel">
          <span className="pay-state-caption" aria-hidden="true">Payment state</span>
          <ol aria-label="Payment state" className="pay-states">
            {(["PENDING", "PAID", "REVIEW"] as const).map((option) => (
              <li data-changed={option === state ? stateMark : undefined} data-current={option === state || undefined} data-state={option.toLowerCase()} data-visited={visited.has(option) || undefined} key={option}>
                <i aria-hidden="true" />
                {paymentStateLabel[option]}{option === state ? <span className="sr-only"> (current)</span> : null}
              </li>
            ))}
          </ol>
        </div>
        <dl className="pay-counts">
          <div><dt>Deliveries</dt><dd>{deliveries}</dd></div>
          <div data-tone={writes > 1 ? "adverse" : undefined}><dt>State changes from deliveries</dt><dd>{writes}</dd></div>
          <div><dt>Recorded without change</dt><dd>{acknowledged}</dd></div>
        </dl>
      </div>
      <p aria-live="polite" className="sr-only">
        {complete ? `Sequence complete. Payment state: ${paymentStateLabel[state]}.` : latest ? `Step ${revealed} of ${total}: ${latest.title}, ${decisionLabel[latest.decision]}.` : "Sequence rewound. Ready to run."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ Observability */

const alertLabel = { firing: "Firing", quiet: "Quiet", "no data": "No data", "no rule": "No rule", "not monitored": "Not monitored" } as const;

function SignalView({ approach, conditions }: { approach: ProjectionMode; conditions: Conditions }) {
  const run = useMemo(() => simulateSignals(conditions, approach), [approach, conditions]);
  const maxMs = 1000;
  const point = (value: number, index: number) => `${((index + .5) / run.intervals.length) * 100},${100 - (value / maxMs) * 100}`;
  const actualPath = run.intervals.map((interval, index) => point(interval.actualLatency, index)).join(" ");
  const observed = run.intervals.map((interval, index) => (interval.observedLatency === null ? null : point(interval.observedLatency, index)));
  // Observed line segments only join consecutive collected samples.
  const observedSegments: string[] = [];
  let segment: string[] = [];
  observed.forEach((value) => {
    if (value) segment.push(value);
    else { if (segment.length) observedSegments.push(segment.join(" ")); segment = []; }
  });
  if (segment.length) observedSegments.push(segment.join(" "));
  const cellMarks = useChangeMarks(Object.fromEntries(run.intervals.flatMap((interval, index) => [
    [`latency-${index}`, String(interval.observedLatency)],
    [`health-${index}`, interval.health],
    [`alert-${index}`, interval.alert],
  ])));
  const summary = `Actual P95 latency: ${run.intervals.map((interval) => `${interval.time} ${interval.actualLatency} ms`).join(", ")}. ${
    run.monitorsLatency
      ? run.observedBreaches === null ? "The most recent samples were not collected, so the current latency is unknown." : `${run.observedBreaches} observed interval${run.observedBreaches === 1 ? "" : "s"} above ${latencyThresholdMs} ms.`
      : "This approach does not collect latency."
  }`;

  return (
    <div className="sig-view" style={{ "--sig-cols": run.intervals.length } as CSSProperties}>
      <div className="sig-chart" role="img" aria-label={summary}>
        <div className="sig-axis" aria-hidden="true"><span>1000 ms</span><span>500</span><span>0</span></div>
        <div className="sig-plot">
          <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
            <line className="sig-threshold" x1="0" x2="100" y1="50" y2="50" />
            <polyline className="sig-actual" points={actualPath} vectorEffect="non-scaling-stroke" />
            {observedSegments.map((points) => <polyline className="sig-observed" key={points} points={points} vectorEffect="non-scaling-stroke" />)}
          </svg>
          {run.intervals.map((interval, index) => (
            <span
              className="sig-point"
              data-observed={interval.observedLatency !== null || undefined}
              data-over={interval.actualLatency > latencyThresholdMs || undefined}
              key={interval.time}
              style={{ "--x": `${((index + .5) / run.intervals.length) * 100}%`, "--y": `${(interval.actualLatency / maxMs) * 100}%` } as CSSProperties}
            />
          ))}
          <span className="sig-threshold-label" aria-hidden="true">{latencyThresholdMs} ms threshold</span>
        </div>
      </div>

      <div className="sig-rows">
        <div className="sig-row" data-row="latency">
          <span className="sig-row-label">Observed P95</span>
          {run.intervals.map((interval, index) => (
            <span className="sig-cell" data-changed={cellMarks[`latency-${index}`]} data-state={interval.observedLatency === null ? (run.monitorsLatency ? "missing" : "off") : interval.observedLatency > latencyThresholdMs ? "over" : "ok"} key={interval.time}>
              {interval.observedLatency === null ? (run.monitorsLatency ? "No sample" : "—") : `${interval.observedLatency} ms`}
            </span>
          ))}
        </div>
        <div className="sig-row" data-row="health">
          <span className="sig-row-label">Health check</span>
          {run.intervals.map((interval, index) => <span className="sig-cell" data-changed={cellMarks[`health-${index}`]} data-state={interval.health === "pass" ? "ok" : "fail"} key={interval.time}>{interval.health === "pass" ? "Pass" : "Fail"}</span>)}
        </div>
        <div className="sig-row" data-row="alert">
          <span className="sig-row-label">Latency alert</span>
          {run.intervals.map((interval, index) => <span className="sig-cell" data-changed={cellMarks[`alert-${index}`]} data-state={interval.alert === "firing" ? "over" : interval.alert === "no data" ? "missing" : interval.alert === "quiet" ? "ok" : "off"} key={interval.time}>{alertLabel[interval.alert]}</span>)}
        </div>
        <div aria-hidden="true" className="sig-row sig-times">
          <span className="sig-row-label" />
          {run.intervals.map((interval) => <span className="sig-cell" key={interval.time}>{interval.time}</span>)}
        </div>
      </div>

      <p className="sig-summary">
        Simulated service. Actually above {latencyThresholdMs} ms: <b>{run.actualBreaches} of {run.intervals.length}</b> intervals.
        {" "}Observed: <b>{run.monitorsLatency ? (run.observedBreaches === null ? "unknown, samples missing" : `${run.observedBreaches} of ${run.intervals.length}`) : "not collected"}</b>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- Device trust */

const signalLabel: Record<string, Record<string, string>> = {
  root: { clear: "No root signal", suspected: "Possible root signal", detected: "Root detected" },
  emulator: { clear: "Clear", detected: "Detected" },
  signature: { valid: "Valid", invalid: "Invalid" },
};

function PolicyView({ approach, conditions }: { approach: ProjectionMode; conditions: Conditions }) {
  const run = useMemo(() => evaluatePolicy(conditions, approach), [approach, conditions]);
  const matched = run.rules.find((rule) => rule.status === "matched");
  const marks = useChangeMarks({ ...Object.fromEntries(run.rules.map((rule) => [rule.id, rule.status])), decision: run.decision });
  return (
    <div className="policy-view" data-decision={run.decision.toLowerCase().replaceAll(" ", "-")}>
      <section className="pv-stage" data-stage="signals">
        <h3>Signals</h3>
        <dl>
          <div data-flag={conditions.root !== "clear" || undefined}><dt>Root</dt><dd>{signalLabel.root[conditions.root]}</dd></div>
          <div data-flag={conditions.emulator === "detected" || undefined}><dt>Emulator</dt><dd>{signalLabel.emulator[conditions.emulator]}</dd></div>
          <div data-flag={conditions.signature === "invalid" || undefined}><dt>Request signature</dt><dd>{signalLabel.signature[conditions.signature]}</dd></div>
        </dl>
      </section>
      <section className="pv-stage" data-stage="assessment">
        <h3>Assessment</h3>
        <dl>
          <div data-flag={run.environment === "suspicious" || undefined}><dt>Device environment</dt><dd>{run.environment === "suspicious" ? `Suspicious: ${run.environmentReasons.join(", ").toLowerCase()}` : "Clear"}</dd></div>
          <div data-flag={!run.signatureValid || undefined}><dt>Request integrity</dt><dd>{run.signatureValid ? "Valid" : "Invalid"}</dd></div>
          <div><dt>Action sensitivity</dt><dd>{run.sensitivity === "high" ? "High" : "Low"}</dd></div>
        </dl>
      </section>
      <section className="pv-stage" data-stage="policy">
        <h3>Policy <small>first matching rule decides</small></h3>
        <ol>
          {run.rules.map((rule, index) => (
            <li data-changed={marks[rule.id]} data-status={rule.status} key={rule.id}>
              <span className="pv-rule-index">{index + 1}</span>
              <span className="pv-rule-when">{rule.when}</span>
              {rule.conditions.length ? (
                <span className="pv-rule-conditions">
                  {rule.conditions.map((condition) => <span data-met={condition.met || undefined} key={condition.label}>{condition.label}: {condition.met ? "yes" : "no"}</span>)}
                </span>
              ) : null}
              <span className="pv-rule-result">{readableOutcome("trustgate", rule.result)}</span>
              <span className="pv-rule-status">{rule.status === "matched" ? "Matched" : rule.status === "not met" ? "Not met" : "Not reached"}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="pv-stage" data-changed={marks.decision} data-stage="decision">
        <h3>Decision</h3>
        <strong>{readableOutcome("trustgate", run.decision)}</strong>
        <p>{matched?.when === "Otherwise" ? "No blocking or confirmation rule applies to these signals." : `Rule ${run.rules.indexOf(matched!) + 1}: ${matched?.when.toLowerCase()}.`}</p>
      </section>
    </div>
  );
}
