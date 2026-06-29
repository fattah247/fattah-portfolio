"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowIcon, RewindIcon } from "@/components/icons";
import {
  explainScenario,
  projectScenario,
  scenarios,
  type Conditions,
  type Evidence,
  type ProjectionNode,
  type Scenario,
} from "@/lib/scenarios";

type MotionPhase = "rest" | "rewind" | "reconstruct";

function readableOutcome(slug: Scenario["slug"], value: string) {
  const labels: Record<string, string> = {
    "payflow:REAPPLIED": "Payment updated again",
    "payflow:UNCHANGED": "Payment stayed completed",
    "payflow:PAID": "Payment completed",
    "payflow:REVIEW REQUIRED": "Manual review needed",
    "iyup:DEGRADING": "Degradation detected",
    "iyup:HEALTHY": "Service operating normally",
    "iyup:OUTAGE": "Outage detected",
    "iyup:UNKNOWN": "Not enough telemetry",
    "iyup:INCOMPLETE": "Health check misses degradation",
    "iyup:ACTIONABLE": "Degradation visible before outage",
    "iyup:INVESTIGATE COLLECTION": "Telemetry collection needs investigation",
    "iyup:QUIET": "No warning raised",
    "trustgate:ALLOW": "Allow action",
    "trustgate:BLOCK": "Block action",
    "trustgate:REQUIRE CONFIRMATION": "Ask for confirmation",
  };
  return labels[`${slug}:${value}`] ?? value.toLowerCase().replaceAll("_", " ");
}

function ScenarioSignature({
  scenario,
  conditions,
  outcome,
  activeKeys,
}: {
  scenario: Scenario;
  conditions: Conditions;
  outcome: string;
  activeKeys: string[];
}) {
  if (scenario.slug === "payflow") {
    const duplicate = conditions.delivery !== "once";
    const order = conditions.delivery === "out-of-order" ? ["02", "01"] : ["01", "02"];
    return (
      <section className="scenario-signature signature-payflow" data-active-keys={activeKeys.join(" ")} aria-label="Callback identity comparison diagram">
        <div className="signature-title"><span>Same input, different handling</span><p>Both lanes receive the same deliveries. The identity check changes only the second result.</p></div>
        <div className="callback-comparison">
          <div className="callback-head" aria-hidden="true"><span /><span>First delivery</span><span>Repeat</span><span>Boundary</span><span>Result</span></div>
          <div className="callback-lane lane-unchecked">
            <span className="lane-label">Without check</span><i className="callback-event">{order[0]}</i>{duplicate ? <i className="callback-event repeated">{order[1]}</i> : <i className="callback-event event-empty">—</i>}<em>No ID check</em><b>Payment updated again<small>State changed twice</small></b>
          </div>
          <div className="callback-lane lane-checked">
            <span className="lane-label">With check</span><i className="callback-event">{order[0]}</i>{duplicate ? <i className="callback-event repeated">{order[1]}</i> : <i className="callback-event event-empty">—</i>}<em>Check callback ID</em><b>{readableOutcome("payflow", outcome)}<small>Delivery recorded; state changed once</small></b>
          </div>
        </div>
        <div className="transaction-flags">
          <span className="settlement-flag">Settlement <b>{conditions.settlement}</b></span>
          <span className="persistence-flag">Audit <b>{conditions.persistence}</b></span>
        </div>
      </section>
    );
  }

  if (scenario.slug === "iyup") {
    const missing = conditions.scrape === "missing";
    const latencyMap = {
      normal: { value: 180, intervals: 0, action: "No action", state: "Normal", path: "M0 82 L25 78 L50 80 L75 76 L100 79" },
      degraded: { value: 620, intervals: 1, action: "Investigate", state: "Degraded", path: "M0 82 L25 75 L50 78 L75 44 L100 38" },
      severe: { value: 940, intervals: 3, action: "Escalate", state: "Severe", path: "M0 82 L25 69 L50 43 L75 24 L100 12" },
    } as const;
    const metric = latencyMap[conditions.latency as keyof typeof latencyMap] ?? latencyMap.normal;
    const degraded = conditions.latency !== "normal";
    return (
      <section className={`scenario-signature signature-iyup health-${conditions.health} latency-${conditions.latency} alert-${conditions.alert} ${missing ? "has-gap" : ""} ${degraded ? "is-degraded" : ""}`} data-active-keys={activeKeys.join(" ")} aria-label="Service health and latency comparison diagram">
        <div className="signature-title"><span>One timeline, three signals</span><p>Read the latency value against the 500 ms line, then check how long it stayed above it.</p></div>
        <div className="latency-summary">
          <span><small>State</small><b>{missing ? "Unknown" : metric.state}</b></span>
          <span><small>Current P95</small><b>{missing ? "—" : `${metric.value} ms`}</b></span>
          <span><small>Above threshold</small><b>{missing ? "Unknown" : `${metric.intervals} interval${metric.intervals === 1 ? "" : "s"}`}</b></span>
          <span><small>Next action</small><b>{missing ? "Check collection" : metric.action}</b></span>
        </div>
        <div className="signal-plot">
          <div className="latency-axis" aria-hidden="true"><span>1000</span><span>500</span><span>0 ms</span></div>
          <svg className="latency-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${metric.value} milliseconds; ${metric.intervals} intervals above threshold`}>
            <line x1="0" x2="100" y1="50" y2="50" className="threshold-line" />
            {!missing ? <path d={metric.path} className="latency-trace" vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          <span className="threshold-label">500 ms threshold</span>
          <div className="signal-row health-row"><span>Health check</span><i /><b>{conditions.health}</b></div>
          <div className="signal-row alert-row"><span>Alert</span><i /><b>{conditions.alert}</b></div>
          <div className="timeline-labels" aria-hidden="true"><span>10:40</span><span>10:41</span><span>10:42</span><span>10:43</span></div>
        </div>
      </section>
    );
  }

  const signals = [
    ["Root", conditions.root],
    ["Emulator", conditions.emulator],
    ["Signature", conditions.signature],
  ];
  const reason = outcome === "ALLOW"
    ? "No suspicious device signal was found."
    : outcome === "BLOCK"
      ? "The signal combination requires this action to be blocked."
      : "A suspicious signal is present and this action is sensitive.";
  const tryNext = conditions.root === "clear" ? "Try Root: Possible root signal" : "Compare with Root: No root signal";
  return (
    <section className="scenario-signature signature-trustgate" data-active-keys={activeKeys.join(" ")} aria-label="Device signal policy diagram">
      <div className="signature-title"><span>Change evidence → watch the decision</span><p>{tryNext}. The explanation on the right updates with it.</p></div>
      <div className="policy-flow">
        <div className="policy-stage policy-evidence"><span className="stage-label">1 · Device evidence</span>{signals.map(([label, value]) => <div className={`signal-state-${value}`} key={label}><span>{label}</span><b>{value}</b></div>)}</div>
        <i className="policy-connector" aria-hidden="true" />
        <div className="policy-stage policy-context"><span className="stage-label">2 · Action context</span><div><span>Sensitivity</span><b>{conditions.sensitivity}</b></div></div>
        <i className="policy-connector" aria-hidden="true" />
        <div className={`policy-boundary outcome-${outcome.toLowerCase().replaceAll(" ", "-")}`}><span className="stage-label">3 · Policy decision</span><strong>{readableOutcome("trustgate", outcome)}</strong><p>{reason}</p></div>
      </div>
    </section>
  );
}

function Projection({
  label,
  variantLabel,
  nodes,
  affectedIds,
  phase,
  outcomeNodeId,
  evidence,
  onOpenEvidence,
}: {
  label: "Baseline" | "Designed";
  variantLabel: string;
  nodes: ProjectionNode[];
  affectedIds: string[];
  phase: MotionPhase;
  outcomeNodeId: string;
  evidence?: Evidence;
  onOpenEvidence?: (evidence: Evidence) => void;
}) {
  return (
    <section className={`projection projection-${label.toLowerCase()}`} aria-label={`${label} system projection`}>
      <div className="projection-heading">
        <p>{variantLabel}</p>
        <span>{label === "Baseline" ? "Without the safeguard" : "With the safeguard"}</span>
      </div>

      <ol className="causal-list">
        {nodes.map((item) => {
          const distance = affectedIds.indexOf(item.id);
          return (
          <li
            className={`causal-node tone-${item.tone} ${distance >= 0 ? "is-affected" : "is-stable"}`}
            data-phase={phase}
            key={item.id}
            style={{ "--distance": Math.max(0, distance) } as CSSProperties}
          >
            <span className="causal-marker" aria-hidden="true" />
            <div className="causal-copy">
              <p className="causal-label">{item.label}</p>
              <p className="causal-value">{item.value}</p>
              <p className="causal-detail">{item.detail}</p>
              {item.id === outcomeNodeId && evidence && onOpenEvidence ? (
                <button className="node-evidence-link" onClick={() => onOpenEvidence(evidence)} type="button">
                  View supporting evidence
                </button>
              ) : null}
            </div>
          </li>
          );
        })}
      </ol>
    </section>
  );
}

function EvidenceDialog({
  evidence,
  exhibitLabel,
  onClose,
}: {
  evidence: Evidence;
  exhibitLabel: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isolated = Array.from(document.querySelectorAll<HTMLElement>(".portfolio-header, .case-page"));
    const previousOverflow = document.body.style.overflow;
    isolated.forEach((element) => element.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      isolated.forEach((element) => element.removeAttribute("inert"));
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title">
      <button className="evidence-scrim" aria-label="Close evidence" onClick={onClose} type="button" />
      <div className="evidence-sheet" ref={sheetRef}>
        <aside className="evidence-inspector">
          <div className="evidence-sheet-head">
            <div>
              <p className="micro-label">Attached evidence</p>
              <p id="evidence-dialog-title">{exhibitLabel}</p>
            </div>
            <button ref={closeRef} className="evidence-close-action" onClick={onClose} type="button" aria-label="Close attached evidence">
              <span aria-hidden="true">×</span>
              <small>Close</small>
            </button>
          </div>
          <div className="evidence-inspector-copy">
            <p className="evidence-focus-label">What to verify</p>
            <h2>{evidence.focus}</h2>
            <p>{evidence.caption}</p>
          </div>
          <dl className="evidence-meta">
            <div>
              <dt>Source</dt>
              <dd>Public project screenshot</dd>
            </div>
            <div>
              <dt>Interaction</dt>
              <dd>Esc or Close returns to the case</dd>
            </div>
          </dl>
          <a className="evidence-original" href={evidence.src} target="_blank" rel="noopener noreferrer">
            Open original image <span className="sr-only">in a new tab</span> <ArrowIcon />
          </a>
        </aside>
        <div className="evidence-stage">
          <div className="evidence-stage-label" aria-hidden="true">
            <span>Inspect</span>
            <span>{evidence.focus}</span>
          </div>
          <div className="evidence-image-wrap">
            <Image src={evidence.src} alt={evidence.alt} fill sizes="(max-width: 760px) 100vw, 70vw" className="evidence-image" unoptimized />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DebuggerWorkspace({
  scenario,
  initialConditions,
}: {
  scenario: Scenario;
  initialConditions: Conditions;
}) {
  const [conditions, setConditions] = useState<Conditions>(initialConditions);
  const [selectedConditions, setSelectedConditions] = useState<Conditions>(initialConditions);
  const [phase, setPhase] = useState<MotionPhase>("rest");
  const [affectedIds, setAffectedIds] = useState<{ baseline: string[]; designed: string[] }>({ baseline: [], designed: [] });
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("Replay ready.");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const timers = useRef<number[]>([]);
  const targetConditions = useRef<Conditions>(initialConditions);
  const workspaceTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    document.body.dataset.workspace = "case";
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => workspaceTitleRef.current?.focus({ preventScroll: true }), 80);
    return () => {
      window.clearTimeout(focusTimer);
      delete document.body.dataset.workspace;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || evidence) return;
      window.location.assign("/#selected-work");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [evidence]);

  const baseline = useMemo(
    () => projectScenario(scenario.slug, conditions, "baseline"),
    [scenario.slug, conditions],
  );
  const designed = useMemo(
    () => projectScenario(scenario.slug, conditions, "designed"),
    [scenario.slug, conditions],
  );
  const audit = useMemo(
    () => explainScenario(scenario, conditions, baseline, designed),
    [scenario, conditions, baseline, designed],
  );
  const baselineOutcome = baseline.find((item) => item.id === scenario.outcomeNodeId)?.value ?? "Unknown";
  const designedOutcome = designed.find((item) => item.id === scenario.outcomeNodeId)?.value ?? "Unknown";
  const baselineOutcomeLabel = readableOutcome(scenario.slug, baselineOutcome);
  const designedOutcomeLabel = readableOutcome(scenario.slug, designedOutcome);
  const primaryKey = scenario.slug === "payflow" ? "delivery" : scenario.slug === "iyup" ? "latency" : "root";
  const primaryControl = scenario.controls.find((control) => control.key === primaryKey) ?? scenario.controls[0];
  const advancedControls = scenario.controls.filter((control) => control.key !== primaryControl.key);
  const explorableControls = scenario.slug === "payflow" ? scenario.controls : advancedControls;
  const isDefault = scenario.controls.every((control) => selectedConditions[control.key] === scenario.defaults[control.key]);
  const caseCategory = scenario.slug === "payflow" ? "Payment reliability" : scenario.slug === "iyup" ? "Service observability" : "Android device trust";
  const scenarioIndex = Math.max(0, scenarios.findIndex((item) => item.slug === scenario.slug));
  const previousScenario = scenarios[(scenarioIndex - 1 + scenarios.length) % scenarios.length];
  const nextScenario = scenarios[(scenarioIndex + 1) % scenarios.length];

  function changedNodeIds(previous: ProjectionNode[], next: ProjectionNode[]) {
    return next
      .filter((item, index) => {
        const before = previous[index];
        return !before || before.value !== item.value || before.detail !== item.detail || before.tone !== item.tone;
      })
      .map((item) => item.id);
  }

  function updateUrl(next: Conditions) {
    const params = new URLSearchParams();
    for (const control of scenario.controls) {
      if (next[control.key] !== scenario.defaults[control.key]) {
        params.set(control.key, next[control.key]);
      }
    }
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  function changeCondition(key: string, value: string, force = false) {
    if (targetConditions.current[key] === value && !force) return;
    const next = { ...targetConditions.current, [key]: value };
    targetConditions.current = next;
    setSelectedConditions(next);
    const changedKeys = force
      ? [key]
      : scenario.controls.map((control) => control.key).filter((controlKey) => conditions[controlKey] !== next[controlKey]);
    const nextBaseline = projectScenario(scenario.slug, next, "baseline");
    const nextDesigned = projectScenario(scenario.slug, next, "designed");
    const nextOutcome = nextDesigned.find((item) => item.id === scenario.outcomeNodeId)?.value ?? "Unknown";
    const forcedAffected = scenario.dependencies[key] ?? [];
    const nextAffected = force
      ? { baseline: forcedAffected, designed: forcedAffected }
      : { baseline: changedNodeIds(baseline, nextBaseline), designed: changedNodeIds(designed, nextDesigned) };
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setAffectedIds(nextAffected);
    setActiveKeys(changedKeys);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setConditions(next);
      updateUrl(next);
      setPhase("rest");
      setAffectedIds({ baseline: [], designed: [] });
      setActiveKeys([]);
      setStatusMessage(`${scenario.controls.find((control) => control.key === key)?.label} changed. Result: ${readableOutcome(scenario.slug, nextOutcome)}.`);
      return;
    }

    setPhase("rewind");
    timers.current.push(
      window.setTimeout(() => {
        setConditions(next);
        updateUrl(next);
        setPhase("reconstruct");
      }, 230),
      window.setTimeout(() => {
        setPhase("rest");
        setAffectedIds({ baseline: [], designed: [] });
        setActiveKeys([]);
        setStatusMessage(`${scenario.controls.find((control) => control.key === key)?.label} changed. Result: ${readableOutcome(scenario.slug, nextOutcome)}.`);
      }, 1260),
    );
  }

  function reset() {
    const changedKeys = scenario.controls
      .map((control) => control.key)
      .filter((key) => targetConditions.current[key] !== scenario.defaults[key]);
    if (changedKeys.length === 0) return;
    const resetBaseline = projectScenario(scenario.slug, scenario.defaults, "baseline");
    const resetDesigned = projectScenario(scenario.slug, scenario.defaults, "designed");
    const resetAffected = {
      baseline: changedNodeIds(baseline, resetBaseline),
      designed: changedNodeIds(designed, resetDesigned),
    };
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    targetConditions.current = scenario.defaults;
    setSelectedConditions(scenario.defaults);
    setAffectedIds(resetAffected);
    setActiveKeys(changedKeys);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setConditions(scenario.defaults);
      updateUrl(scenario.defaults);
      setPhase("rest");
      setAffectedIds({ baseline: [], designed: [] });
      setActiveKeys([]);
      setStatusMessage("Scenario reset.");
      return;
    }
    setPhase("rewind");
    timers.current.push(
      window.setTimeout(() => {
        setConditions(scenario.defaults);
        updateUrl(scenario.defaults);
        setPhase("reconstruct");
      }, 230),
      window.setTimeout(() => {
        setPhase("rest");
        setAffectedIds({ baseline: [], designed: [] });
        setActiveKeys([]);
        setStatusMessage("Scenario reset.");
      }, 1260),
    );
  }

  return (
    <>
      <main className={`case-page case-${scenario.slug}`} data-motion-phase={phase} id="main-content">
        <div className="case-workspace-chrome" aria-label="Selected work workspace">
          <Link className="case-close-action" href="/#selected-work" aria-label="Close selected work and return to the work list">
            <span aria-hidden="true">×</span>
            <small>Close</small>
          </Link>
          <div className="case-location">
            <p className="micro-label">Selected work</p>
            <strong>{scenario.number} / {String(scenarios.length).padStart(2, "0")} · {caseCategory}</strong>
            <span>{scenario.shortTitle}</span>
          </div>
          <div className="case-workspace-actions" aria-label="Move between selected work">
            <Link href={`/case/${previousScenario.slug}`}>Previous</Link>
            <Link href={`/case/${nextScenario.slug}`}>Next</Link>
          </div>
        </div>
        <nav className="case-progress" aria-label="Case chapters">
          <a href="#context"><span>01</span> Context</a>
          <a href="#replay"><span>02</span> Replay</a>
          <a href="#decision"><span>03</span> Decision</a>
          <a href="#evidence"><span>04</span> Evidence</a>
        </nav>
        <section className="case-intro" id="context">
          <div className="case-index-block">
            <p className="micro-label" style={{ viewTransitionName: `case-number-${scenario.slug}` } as CSSProperties}>Engineering case / {scenario.number}</p>
            <p className="case-short-title">{caseCategory}</p>
          </div>
          <div className="case-thesis">
            <h1 ref={workspaceTitleRef} tabIndex={-1} style={{ viewTransitionName: `case-title-${scenario.slug}` } as CSSProperties}>{scenario.title}</h1>
            <p className="case-consequence">{scenario.consequence}</p>
          </div>
          <p className="case-premise">{scenario.premise}</p>
        </section>

        <section className="case-facts" aria-label="Case summary">
          <div><span>Outcome</span><p>{scenario.outcome}</p></div>
          <div><span>Decision</span><p>{scenario.decision}</p></div>
          <div><span>Built with</span><p>{scenario.technology}</p></div>
          <a href={scenario.repo} target="_blank" rel="noopener noreferrer">
            Source code <span className="sr-only">opens in a new tab</span> <ArrowIcon />
          </a>
        </section>

        <div className="case-interaction" id="replay">
        <section className="assumption-panel" aria-label="Replay conditions">
          <div className="assumption-heading">
            <div>
              <h2 className="interaction-title">Replay the behavior</h2>
              <p>Change one condition and watch the affected state.</p>
            </div>
            {!isDefault ? <button className="text-button reset-button" onClick={reset} type="button">
              <RewindIcon /> Reset
            </button> : null}
          </div>

          {scenario.slug === "payflow" ? (
            <div className="guided-case-action">
              <button className="primary-action case-replay-action" onClick={() => changeCondition("delivery", "duplicate", true)} type="button">
                Replay the duplicate callback <ArrowIcon />
              </button>
              <p>Watch the repeated delivery stop before payment state changes again.</p>
            </div>
          ) : <fieldset className="condition-control primary-condition">
            <legend>{primaryControl.label}</legend>
            <div className="condition-options">
              {primaryControl.options.map((option) => (
                <button aria-pressed={selectedConditions[primaryControl.key] === option.value} className="condition-option" key={option.value} onClick={() => changeCondition(primaryControl.key, option.value)} type="button">
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>}

          {scenario.slug === "trustgate" ? <p className="interaction-guidance">Change one device signal. Watch how the policy decision and its explanation update.</p> : null}

          <details className="advanced-conditions">
            <summary>{scenario.slug === "payflow" ? "Try another delivery order" : "Explore other conditions"}</summary>
            <div className="control-grid">
              {explorableControls.map((control) => (
                <fieldset className="condition-control" key={control.key}>
                  <legend>{control.label}</legend>
                  <div className="condition-options">
                    {control.options.map((option) => (
                      <button aria-pressed={selectedConditions[control.key] === option.value} className="condition-option" key={option.value} onClick={() => changeCondition(control.key, option.value)} type="button">
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </details>
        </section>

        <div className="signature-stage" aria-busy={phase !== "rest"}>
          <ScenarioSignature scenario={scenario} conditions={conditions} outcome={designedOutcome} activeKeys={activeKeys} />
        </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>
        <div className="mobile-outcome-strip" id="decision" aria-label="Outcome comparison">
          <div><span>Without safeguard</span><strong>{baselineOutcomeLabel}</strong></div>
          <div><span>With safeguard</span><strong>{designedOutcomeLabel}</strong></div>
        </div>
        <details className="debugger-details">
          <summary>See every state change</summary>
        <section className="debugger-shell">
          <div className="debugger-projections">
            <Projection label="Baseline" variantLabel={scenario.baselineLabel} nodes={baseline} affectedIds={affectedIds.baseline} phase={phase} outcomeNodeId={scenario.outcomeNodeId} />
            <div className="divergence-seam" aria-hidden="true">
              <span>decision point</span>
            </div>
            <Projection label="Designed" variantLabel={scenario.designedLabel} nodes={designed} affectedIds={affectedIds.designed} phase={phase} outcomeNodeId={scenario.outcomeNodeId} evidence={scenario.evidence[0]} onOpenEvidence={setEvidence} />
          </div>

          <aside className="audit-tape" aria-label="Audit explanation">
            <div className="audit-heading">
              <p className="micro-label">Why the result changed</p>
              <span>{phase === "rest" ? "Ready" : phase === "rewind" ? "Revising" : "Updating"}</span>
            </div>
            <ol>
              {audit.map((entry, index) => (
                <li key={entry.label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p>{entry.label}</p>
                    <p>{entry.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </section>
        </details>

        <section className="case-evidence" id="evidence">
          <div className="evidence-intro">
            <p className="micro-label">Code and evidence</p>
            <h2>Check the implementation behind the result.</h2>
            <p>{scenario.technology}</p>
            <a className="inline-link" href={scenario.repo} target="_blank" rel="noopener noreferrer">
              Open repository <span className="sr-only">in a new tab</span> <ArrowIcon />
            </a>
          </div>
          <div className="evidence-grid">
            {scenario.evidence.map((item, index) => (
              <button className="evidence-card" key={item.src} onClick={() => setEvidence(item)} type="button">
                <span className="evidence-number">EXHIBIT {scenario.number}.{index + 1}</span>
                <span className="evidence-focus">{item.focus}</span>
                <span className="evidence-thumb">
                  <Image src={item.src} alt="" fill sizes="(max-width: 800px) 90vw, 30vw" className="evidence-thumb-image" unoptimized />
                </span>
                <span className="evidence-caption">{item.caption}</span>
                <span className="evidence-view">Open evidence <ArrowIcon /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="case-handoff">
          <div>
            <p className="micro-label">Scope of this example</p>
            <p>{scenario.limitation}</p>
          </div>
          <Link className="solid-link" href={scenario.slug === "payflow" ? "/case/iyup" : scenario.slug === "iyup" ? "/case/trustgate" : "/brief"}>
            {scenario.slug === "payflow" ? "Next: Detect degradation" : scenario.slug === "iyup" ? "Next: Evaluate device trust" : "Read the work summary"} <ArrowIcon />
          </Link>
        </section>
      </main>

      {evidence ? (
        <EvidenceDialog
          evidence={evidence}
          exhibitLabel={`Exhibit ${scenario.number}.${Math.max(0, scenario.evidence.findIndex((item) => item.src === evidence.src)) + 1}`}
          onClose={() => setEvidence(null)}
        />
      ) : null}
    </>
  );
}
