"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayIcon, ResetIcon, StartOverIcon } from "./icons";
import { answerDelayMs, DeviceDiagram, messageTravelMs, PaymentDiagram, ruleStepMs, ServiceDiagram, toRulesMs } from "./sim-diagrams";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { assessDevice, blockOnAnySignal, deviceChecks, deviceProfiles, HIGH_SCORE_THRESHOLD, MEDIUM_SCORE_THRESHOLD, SCREEN_LOCK, type DeviceAssessment, type GateDecision, type RiskLevel } from "../lib/device-risk";
import { type Conditions, type ProjectionMode, type Scenario } from "../lib/scenarios";
import {
  emptyFlow,
  emptyNaive,
  flowStep,
  mutations,
  naiveStep,
  paymentStory,
  PAYOUT_NET,
  payoutWord,
  statusWord,
  type FlowInput,
  type FlowOutcome,
  type FlowTone,
  type FlowWorld,
  type MutationId,
  type NaiveWorld,
  type PaymentStatus,
} from "../lib/payment-flow";
import { alertFor, alertSeverity, clockOf, DEGRADED_AFTER_MS, firing, naiveTally, naiveView, runUptime, STORY_CHECKS, toUptimeConditions, type Tick } from "../lib/uptime";

type Phase = "rest" | "rewind" | "reconstruct";

/** Runs `effect` when `value` changes after the first render, with the value it changed from. */
function useOnChange<T>(value: T, effect: (next: T, previous: T) => void) {
  const previous = useRef(value);
  const latest = useRef(effect);
  useEffect(() => {
    latest.current = effect;
  });
  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    const before = previous.current;
    previous.current = value;
    latest.current(value, before);
  }, [value]);
}

/** Every payment outcome has its sound, so a manual send and the played example sound alike. */
const payCue: Record<FlowOutcome, CueId> = {
  APPLIED: "pay.let-in",
  DUPLICATE_IGNORED: "pay.stopped",
  STALE_IGNORED: "pay.stopped",
  PAYMENT_ON_HOLD: "pay.stopped",
  SENT_TO_REVIEW: "pay.report-differs",
  RELEASED: "pay.check-on",
  BATCH_CREATED: "pay.book-back",
  NOTHING_TO_SETTLE: "pay.check-off",
  MATCHED_AWAITING_BANK: "sys.file-open",
  MATCHED_NO_ACTION: "sys.file-open",
  ALREADY_RECONCILED: "sys.file-open",
  RECONCILED: "pay.report-matches",
  MISMATCH: "pay.report-differs",
  LANDED: "pay.let-in",
  MISSING_CREDIT: "pay.book-down",
  UNMATCHED_CREDIT: "pay.report-differs",
  ALREADY_IMPORTED: "pay.stopped",
  NO_PAYOUT_YET: "pay.check-off",
  RULE_REMOVED: "pay.check-off",
  RULE_RESTORED: "pay.check-on",
  RULE_BROKEN: "pay.twice",
};
/** A message's cue starts early enough that its knock lands as the packet reaches the payment. */
const landingDelay = messageTravelMs / 1000 - LANDING;

/** Each simulator has a name, like a small piece of equipment. */
const simName: Record<Scenario["slug"], string> = {
  payflow: "Payment desk",
  iyup: "Website monitor",
  trustgate: "Payment gate",
};

const howTo: Record<Scenario["slug"], string> = {
  payflow: "You run Payflow, a shop's payment system. Send the provider's messages, then follow the money to the bank. Under it, a simpler system gets the same messages, for comparison.",
  iyup: "iYup watches a page from two regions, one check every 30 seconds; here a second is one check. Slow the page, break it in one region, or silence an agent, and see what iYup says and when it alerts.",
  trustgate: "You're sending a payment. Switch on what the phone's checks find: each adds points by how serious it is. The server decides from the total, and the phone writes the decision to its log.",
};

/**
 * Plain names for every condition, so the controls read for anyone. The case's own technical
 * names stay in the model; engineers get them back with "Technical details".
 */
const plainControls: Record<string, { label: string; hint?: string; options: Record<string, string> }> = {
  page: { label: "The page", hint: "what every check finds", options: { quick: "Quick", slow: "Slow (1.2–1.8 s)", error: "Answers 503", "wrong-content": "Wrong content" } },
  scope: { label: "Where", hint: "which regions see it", options: { both: "Both regions", "lab-b": "Only lab-b" } },
  agent: { label: "lab-b's agent", hint: "the program that runs lab-b's checks", options: { reporting: "Reporting", stopped: "Stopped" } },
  [SCREEN_LOCK]: { label: "Screen lock", hint: "a confirmation needs it to sign", options: { set: "Set", none: "None" } },
};

/** The phone's checks in everyday words; "Technical details" shows the repo's own names. */
const plainCheck: Record<string, string> = {
  root_su_path: "Superuser file found",
  root_package: "Root app installed",
  test_keys: "Test build of Android",
  system_partition_writable: "System files writable",
  emulator_fingerprint: "Looks like an emulator",
  debugger_connected: "Debugger attached",
  app_debuggable: "App is a debug build",
  installer_source_unknown: "Installed from outside the store",
};

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
 * The "Try it" simulator shared by the three cases: a live, playable version of the case's own
 * system. Everything reads in everyday words; "Technical details" adds the engineering layer
 * (message IDs, raw states, milliseconds, rule names, and the mechanism behind each event).
 * Conditions and the approach live above this component, so resizing or changing device mode
 * never resets them.
 */
export function CaseInstrument({
  approach,
  conditions,
  foreground = true,
  isDefault = true,
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
  isDefault?: boolean;
  onApproachChange: (mode: ProjectionMode) => void;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  phase: Phase;
  scenario: Scenario;
  selectedConditions: Conditions;
}) {
  const titleId = `${scenario.slug}-instrument-title`;
  const [technical, setTechnical] = useState(false);
  const { play } = useSound();
  const shared = { approach, conditions, isDefault, onApproachChange, onChange, onReset, scenario, selectedConditions, technical };
  return (
    <section aria-labelledby={titleId} className="instrument" data-approach={approach} data-instrument={scenario.slug} data-phase={phase} data-technical={technical || undefined} id="replay">
      <header className="instrument-plate">
        <h2 className="interaction-title" id={titleId}>Test the decision</h2>
        <p className="instrument-plate-name"><span>{simName[scenario.slug]}</span> <small>Simulated</small></p>
      </header>
      <div className="instrument-intro">
        <p className="instrument-instruction">{howTo[scenario.slug]}</p>
        <button aria-pressed={technical} className="instrument-technical" onClick={() => { play(technical ? "ui.key-off" : "ui.key-on"); setTechnical((value) => !value); }} type="button">
          <i aria-hidden="true" />Technical details
        </button>
      </div>
      {scenario.slug === "payflow" ? <PaymentSim {...shared} /> : null}
      {scenario.slug === "iyup" ? <ServiceSim {...shared} foreground={foreground} /> : null}
      {scenario.slug === "trustgate" ? <DeviceSim {...shared} /> : null}
    </section>
  );
}

type SimProps = {
  approach: ProjectionMode;
  conditions: Conditions;
  isDefault: boolean;
  onApproachChange: (mode: ProjectionMode) => void;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  scenario: Scenario;
  selectedConditions: Conditions;
  technical: boolean;
};

/** Puts every condition back where the case's example starts. */
function StoryReset({ isDefault, onReset }: Pick<SimProps, "isDefault" | "onReset">) {
  return !isDefault && onReset ? <button className="sim-secondary" onClick={onReset} type="button"><ResetIcon />Reset</button> : null;
}

/** A labelled group of joined selector keys: two read as a switch, three as a short column. */
function Keys({ hint, label, onSelect, options, selected }: {
  hint?: string;
  label: string;
  onSelect: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  selected: string;
}) {
  return (
    <fieldset className="instrument-control">
      <legend>{label}{hint ? <small>{hint}</small> : null}</legend>
      <div className="instrument-keys" data-count={options.length}>
        {options.map((option) => (
          <button aria-pressed={selected === option.value} className="instrument-option" key={option.value} onClick={() => onSelect(option.value)} type="button">
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ConditionKeys({ control, onChange, scenario, selectedConditions, onSelect }: { control: string; onSelect?: (value: string) => void } & Pick<SimProps, "onChange" | "scenario" | "selectedConditions">) {
  const definition = scenario.controls.find((item) => item.key === control)!;
  const plain = plainControls[control];
  return (
    <Keys
      hint={plain?.hint}
      label={plain?.label ?? definition.label}
      onSelect={onSelect ?? ((value) => onChange(control, value))}
      options={definition.options.map((option) => ({ value: option.value, label: plain?.options[option.value] ?? option.label }))}
      selected={selectedConditions[control]}
    />
  );
}

/** The engineering layer, shown only with "Technical details": one line of raw values. */
function Wire({ children, technical }: { children: string; technical: boolean }) {
  return technical ? <code className="sim-wire">{children}</code> : null;
}

type JournalEntry = { key: string; badge: string; tone: FlowTone; plain: string; contrast?: string; hood: string };

/** What just happened, newest first: plain words, and the mechanism with "Technical details". */
function Journal({ entries, empty, technical }: { entries: JournalEntry[]; empty: string; technical: boolean }) {
  return (
    <section aria-label="What happened" className="sim-journal">
      <h3>What happened <small>newest first</small></h3>
      {entries.length ? (
        <ol>
          {entries.map((entry) => (
            <li data-tone={entry.tone} key={entry.key}>
              <span className="sim-journal-badge"><i aria-hidden="true" />{entry.badge}</span>
              <p>{entry.plain}</p>
              {entry.contrast ? <p className="sim-journal-contrast"><span>For comparison</span>{entry.contrast}</p> : null}
              {technical ? <code>{entry.hood}</code> : null}
            </li>
          ))}
        </ol>
      ) : <p className="sim-journal-empty">{empty}</p>}
    </section>
  );
}

/**
 * The comparison beside every simulator: the same inputs through a simpler system, labelled as a
 * comparison and never as a mode of the repo. It keeps a running tally of what the repo's rules
 * prevented; a visitor only ever operates the repo's system.
 */
function ShadowLane({ last, name, says, tally }: { last: string; name: string; says: string; tally: Array<{ label: string; value: number }> }) {
  return (
    <section aria-label={`For comparison: ${name}`} className="sim-shadow">
      <p className="sim-shadow-label"><span>For comparison, not in the repo</span><strong>{name}</strong></p>
      <p className="sim-shadow-now"><b>{says}</b>{last ? ` ${last}` : ""}</p>
      <dl className="sim-shadow-tally">
        {tally.map((item) => (
          <div data-bad={item.value > 0 || undefined} key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ Payment */

const storyStepDelay = 800;
const idr = (amount: number) => `${amount.toLocaleString("en-US")} IDR`;

/** The examples a visitor can watch, each a set of the case's conditions. */
const paymentExamples: Array<{ value: string; label: string; conditions: Conditions }> = [
  { value: "twice", label: "The provider sends it twice", conditions: { delivery: "duplicate", amount: "matches", bank: "landed" } },
  { value: "late", label: "A late “authorized”", conditions: { delivery: "out-of-order", amount: "matches", bank: "landed" } },
  { value: "wrong", label: "A wrong amount", conditions: { delivery: "once", amount: "differs", bank: "landed" } },
  { value: "no-credit", label: "The bank never pays", conditions: { delivery: "once", amount: "matches", bank: "missing" } },
];

type PayState = { flow: FlowWorld; naive: NaiveWorld };
const emptyPay: PayState = { flow: emptyFlow, naive: emptyNaive };
const stepBoth = (state: PayState, input: FlowInput): PayState => ({ flow: flowStep(state.flow, input), naive: naiveStep(state.naive, input, state.flow) });

const payStates: PaymentStatus[] = ["PENDING", "AUTHORIZED", "SUCCESS", "SETTLED", "RECONCILED", "MANUAL_REVIEW"];

function PaymentSim({ conditions, isDefault, onChange, onReset, selectedConditions, technical }: SimProps) {
  const [state, setState] = useState<PayState>(emptyPay);
  const [story, setStory] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const { flow, naive } = state;
  const latest = flow.entries.at(-1);
  const captures = flow.journals.filter((journal) => journal === "CAPTURE").length;
  const marks = useChangeMarks({ state: flow.status, captures: String(captures), payout: flow.payout });
  const { play } = useSound();
  useOnChange(flow.entries.length, (count, before) => {
    const entry = flow.entries.at(-1);
    // A landing that completes the reconciliation rings the bells rather than the knock.
    const cue = entry?.outcome === "LANDED" && flow.status === "RECONCILED" ? "pay.report-matches" : entry ? payCue[entry.outcome] : null;
    if (count > before && cue) play(cue, entry?.event ? landingDelay : 0);
  });

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const stopStory = () => { timers.current.forEach(window.clearTimeout); timers.current = []; setStory(null); };
  const send = (input: FlowInput) => { stopStory(); setState((current) => stepBoth(current, input)); };
  const playStory = (example: Conditions = conditions) => {
    stopStory();
    const script = paymentStory(example);
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setState(script.reduce(stepBoth, emptyPay)); return; }
    setState(emptyPay);
    setStory(0);
    script.forEach((input, index) => {
      timers.current.push(window.setTimeout(() => {
        setState((current) => stepBoth(current, input));
        setStory(index + 1 < script.length ? index + 1 : null);
      }, (index + 1) * storyStepDelay));
    });
  };
  const example = paymentExamples.find((item) => Object.entries(item.conditions).every(([key, value]) => selectedConditions[key] === value))?.value ?? "";
  const watch = (value: string) => {
    const next = paymentExamples.find((item) => item.value === value)!.conditions;
    for (const [key, item] of Object.entries(next)) if (selectedConditions[key] !== item) onChange(key, item);
    playStory({ ...conditions, ...next });
  };
  const toggleRule = (id: MutationId) => send({ kind: "mutate", mutation: id, removed: !flow.removed.includes(id) });

  const journal: JournalEntry[] = [...flow.entries].reverse().slice(0, 6).map((entry) => ({
    key: String(entry.n),
    badge: entry.http ? `#${entry.n} · ${entry.http}` : `#${entry.n}`,
    tone: entry.tone,
    plain: entry.plain,
    contrast: entry.contrast,
    hood: entry.hood,
  }));
  const sub = (plain: string, code: string) => <small>{technical ? <code>{code}</code> : plain}</small>;
  const held = flow.status === "MANUAL_REVIEW";

  return (
    <div className="sim" data-sim="payflow">
      <PaymentDiagram technical={technical} world={flow} />
      <Wire technical={technical}>{`inbox [${Object.keys(flow.inbox).join(", ")}] · ${flow.status} · journals ${flow.journals.join(" ") || "–"} · payout ${flow.payout}${latest ? ` · last: ${latest.hood}` : ""}`}</Wire>

      <div className="sim-controls">
        <div aria-label="The provider sends" className="sim-group" role="group">
          <p className="sim-group-label">The provider sends</p>
          <div className="sim-buttons">
            <button className="sim-send" onClick={() => send({ kind: "webhook", webhook: "success" })} type="button">“Paid”{sub("the payment went through", "new event · SUCCESS")}</button>
            <button className="sim-send" disabled={!flow.lastEvent} onClick={() => send({ kind: "webhook", webhook: "again" })} type="button">The same event again{sub("providers resend when unsure", `redeliver ${flow.lastEvent?.id ?? "–"}`)}</button>
            <button className="sim-send" onClick={() => send({ kind: "webhook", webhook: "new-id" })} type="button">“Paid”, new id{sub("the same news, restated", "new event · SUCCESS, restated")}</button>
            <button className="sim-send" onClick={() => send({ kind: "webhook", webhook: "late-authorized" })} type="button">Late “authorized”{sub("an older status, delivered late", "new event · AUTHORIZED")}</button>
            <button className="sim-send" onClick={() => send({ kind: "webhook", webhook: "wrong-amount" })} type="button">“Paid”, wrong amount{sub("740,000 for a 750,000 payment", "new event · SUCCESS 740000")}</button>
          </div>
        </div>
        <div aria-label="Then the money" className="sim-group" role="group">
          <p className="sim-group-label">Then the money</p>
          <div className="sim-buttons">
            <button className="sim-send" disabled={!held} onClick={() => send({ kind: "release" })} type="button">A person releases it{sub("after checking the hold", "RELEASE_PAYMENT")}</button>
            <button className="sim-send" onClick={() => send({ kind: "settle" })} type="button">Pay out{sub("the day's settlement run", "settlement batch")}</button>
            <button className="sim-send" onClick={() => send({ kind: "report", matches: true })} type="button">Provider&rsquo;s report matches{sub("its word, not the money", "report row matches")}</button>
            <button className="sim-send" onClick={() => send({ kind: "report", matches: false })} type="button">Report disagrees{sub("its numbers differ", "report row MISMATCH")}</button>
          </div>
        </div>
        <div aria-label="The bank's statement" className="sim-group" role="group">
          <p className="sim-group-label">The bank&rsquo;s statement</p>
          <div className="sim-buttons">
            <button className="sim-send" onClick={() => send({ kind: "statement", statement: "credit" })} type="button">Credit arrives{sub(`${idr(PAYOUT_NET)}, with the payout's reference`, "camt.053 credit, EndToEndId = payout reference")}</button>
            <button className="sim-send" onClick={() => send({ kind: "statement", statement: "no-credit" })} type="button">No credit{sub("the value date passes", "no credit by value date + 2 days")}</button>
            <button className="sim-send" onClick={() => send({ kind: "statement", statement: "no-reference" })} type="button">Credit, no reference{sub("the amount fits, nothing else", "credit without EndToEndId")}</button>
            <button className="sim-send" onClick={() => send({ kind: "statement", statement: "reimport" })} type="button">Same statement again{sub("the bank resends it", "statement re-imported")}</button>
          </div>
        </div>
        <fieldset className="instrument-control sim-mutations">
          <legend>Remove a rule, as the repo&rsquo;s tests do<small>each is a deliberate break the repo&rsquo;s own tests make, and catch</small></legend>
          <div className="instrument-keys" data-count="3">
            {(Object.keys(mutations) as MutationId[]).map((id) => (
              <button aria-pressed={flow.removed.includes(id)} className="instrument-option" key={id} onClick={() => toggleRule(id)} type="button">
                {technical ? mutations[id].technical : mutations[id].plain}
              </button>
            ))}
          </div>
        </fieldset>
        <Keys hint="it plays through the desk" label="Or watch an example" onSelect={watch} options={paymentExamples.map(({ label, value }) => ({ label, value }))} selected={example} />
      </div>

      <div className="sim-readout">
        <ol aria-label="Payment state" className="pay-states">
          {payStates.map((status) => (
            <li data-changed={status === flow.status ? marks.state : undefined} data-current={status === flow.status || undefined} data-state={status === "MANUAL_REVIEW" ? "review" : status === "PENDING" || status === "AUTHORIZED" ? "pending" : "paid"} key={status}>
              <i aria-hidden="true" />{technical ? status : statusWord[status]}{status === flow.status ? <span className="sr-only"> (current)</span> : null}
            </li>
          ))}
        </ol>
        <dl className="sim-counts">
          <div><dt>Events received</dt><dd>{flow.entries.filter((entry) => entry.event).length}</dd></div>
          <div data-changed={marks.captures}><dt>Money captured</dt><dd>{captures === 1 ? "once" : `${captures}×`}</dd></div>
          <div data-changed={marks.payout} data-tone={flow.payout === "BROKEN" ? "adverse" : undefined}><dt>Payout</dt><dd>{technical ? flow.payout : payoutWord[flow.payout]}</dd></div>
          <div><dt>Waiting for a person</dt><dd>{flow.reviewCases.length + flow.breaks.length}</dd></div>
          {flow.rulesBroken.length ? <div data-tone="adverse"><dt>Rules broken</dt><dd>{flow.rulesBroken.length}</dd></div> : null}
        </dl>
        <ol aria-label="Audit trail" className="sr-only">
          {flow.audit.length ? flow.audit.map((record, index) => <li key={index}>{record}</li>) : <li>no records yet</li>}
        </ol>
      </div>

      <ShadowLane
        last={naive.last}
        name="Without an event inbox, trusting the provider"
        says={technical ? naive.status : statusWord[naive.status]}
        tally={[
          { label: "Charged twice", value: Math.max(0, naive.captures - 1) },
          { label: "Newer news overwritten", value: naive.overwritten },
          { label: "Wrong amount taken", value: naive.wrongAmount },
          { label: "Reconciled with no money in the bank", value: naive.reconciledWithoutBank },
        ]}
      />

      <div className="sim-actions">
        <button className="sim-primary" disabled={story !== null} onClick={() => playStory()} type="button"><PlayIcon />{story !== null ? "Playing the example…" : "Play the example"}</button>
        <button className="sim-secondary" onClick={() => { stopStory(); setState(emptyPay); play("pay.start-over"); }} type="button"><StartOverIcon />Start over</button>
        <StoryReset isDefault={isDefault} onReset={onReset} />
        <p className="sim-compare">Every event gets one outcome, and the money counts only when the bank says so.</p>
      </div>

      <Journal empty="Nothing yet. Send a message from the provider." entries={journal} technical={technical} />
      <p aria-live="polite" className="sr-only">{latest ? latest.plain : ""}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Service */

const checkMs = 1000;
const liveWindow = 12;

/** Milliseconds as everyday seconds. */
export const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const limit = seconds(DEGRADED_AFTER_MS);

/** What the status page says, with the reason under it, in everyday words. */
function plainVerdict(tick: Tick) {
  const down = tick.views.filter((view) => view.state === "down");
  const unknown = tick.views.filter((view) => view.state === "unknown");
  const slowest = Math.max(...tick.views.map((view) => view.latencyMs ?? 0));
  if (tick.verdict === "unknown") return "No region has a fresh result, so iYup won't guess: unknown is not down.";
  if (tick.verdict === "down") return `Down in ${down.length === tick.views.length ? "both regions" : "most regions"}: ${down[0].reason === "http_5xx" ? "the page answers with error 503" : "the page answers, but not with the expected text"}.`;
  if (tick.verdict === "slow") return `Up, but slow: checks take ${seconds(slowest)}, over the page's ${limit} limit, in most regions.`;
  if (down.length) return `Up: only ${down[0].region} fails (1 of 2 regions), so it's a warning, not an outage.`;
  if (unknown.length) return `Up: ${unknown[0].region} has gone quiet, so the verdict comes from the region that still reports.`;
  const slow = tick.views.filter((view) => view.slow);
  if (slow.length) return `Up: only ${slow[0].region} is slow (1 of 2 regions), so the page isn't marked slow.`;
  return `Up: checks take ${seconds(slowest)}, under the ${limit} limit.`;
}

const verdictTone = { up: "confirmed", slow: "uncertain", down: "adverse", unknown: "uncertain" } as const;

/**
 * What the monitor sounds like as it changes: the buzz when the page goes down, the alarm bell when
 * iYup pages, a softer ask when it sends a warning, a relay when a region goes quiet, and two soft
 * bells only when the page is really up and quick again.
 */
function tickCue(tick: Tick, before: Tick | undefined): CueId | null {
  if (!before) return null;
  const now = firing(tick).map((alert) => alert.name);
  const was = firing(before).map((alert) => alert.name);
  const fresh = now.filter((name) => !was.includes(name));
  if (fresh.some((name) => alertSeverity[name] === "critical")) return "svc.alarm";
  if (tick.verdict === "down" && before.verdict !== "down") return "svc.down";
  if (fresh.length) return "pay.report-differs";
  if (tick.views.some((view) => view.state === "unknown") && !before.views.some((view) => view.state === "unknown")) return "svc.blind";
  if (tick.verdict === "up" && before.verdict !== "up" && !tick.views.some((view) => view.state !== "up" || view.slow)) return "svc.recovered";
  return null;
}

/** A stepped check lands as a block pitched to its time, rising D, F♯, A, and sour past the limit. */
function checkCue(tick: Tick): CueId | null {
  const times = tick.results.filter((result) => result.up).map((result) => result.latencyMs);
  if (!times.length) return null;
  const ms = Math.max(...times);
  if (ms <= 300) return "svc.minute-quick";
  if (ms <= 600) return "svc.minute-slower";
  if (ms <= DEGRADED_AFTER_MS) return "svc.minute-slow";
  return "svc.minute-too-slow";
}

function ServiceSim({ conditions, foreground, isDefault, onChange, onReset, scenario, selectedConditions, technical }: SimProps & { foreground: boolean }) {
  // The chart opens on the case's own first checks, then keeps running.
  const [ticks, setTicks] = useState<Tick[]>(() => runUptime(toUptimeConditions(conditions), 4));
  const [running, setRunning] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const latestConditions = useRef(conditions);
  useEffect(() => { latestConditions.current = conditions; });

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const advance = () => setTicks((current) => runUptime(toUptimeConditions(latestConditions.current), 1, current).slice(-(STORY_CHECKS * 4)));
  const live = running && foreground && pageVisible;
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(advance, checkMs);
    return () => window.clearInterval(timer);
  }, [live]);

  const now = ticks.at(-1)!;
  const before = ticks.at(-2);
  const active = firing(now);
  const statusMark = useChangeMarks({ verdict: now.verdict, alerts: active.map((alert) => alert.name).join() }).verdict;
  const { play } = useSound();
  const lever = (key: string, value: string) => {
    play("ui.key-on");
    onChange(key, value);
  };
  useOnChange(now.n, () => {
    const cue = tickCue(now, before) ?? (running ? null : checkCue(now));
    if (cue) play(cue);
  });

  const naive = naiveView(now);
  const tally = naiveTally(ticks);
  const pending = now.alerts.filter((alert) => alert.pendingFor > 0 && !alert.firing);

  const journal: JournalEntry[] = [];
  ticks.forEach((tick, index) => {
    const previous = ticks[index - 1];
    const fired = firing(tick).map((alert) => alert.name).filter((name) => !previous || !firing(previous).some((alert) => alert.name === name));
    if (previous && previous.verdict === tick.verdict && !fired.length) return;
    const comparison = naiveView(tick);
    const plain = fired.length
      ? `${fired.map((name) => (alertSeverity[name] === "critical" ? "Engineers paged" : "Warning sent")).join(", ")}: ${plainVerdict(tick)}`
      : `${tick.headline} ${plainVerdict(tick)}`;
    journal.unshift({
      key: String(tick.n),
      badge: clockOf(tick.n).slice(0, 5),
      tone: verdictTone[tick.verdict],
      plain,
      contrast: comparison.says === (tick.verdict === "down" ? "down" : "up") && tick.verdict !== "slow" ? undefined : comparison.why,
      hood: `${tick.views.map((view) => `${view.region} ${view.state}${view.slow ? "/slow" : ""} ${view.reason}${view.latencyMs !== null ? ` ${view.latencyMs}ms` : ""}`).join(" · ")} → ${tick.verdict}${fired.length ? ` · ${fired.join(", ")} firing` : ""}`,
    });
  });

  return (
    <div className="sim" data-sim="iyup">
      <div className="svc-screen">
        <div className="svc-status" data-changed={statusMark} data-jolt={now.verdict === "down" ? statusMark : undefined} data-tone={verdictTone[now.verdict]}>
          <span><i aria-hidden="true" />{technical ? `verdict: ${now.verdict}` : "the status page says"}</span>
          <strong>{now.headline}</strong>
          <p>{plainVerdict(now)}</p>
        </div>
        <div className="svc-users" data-over={active.length > 0 || undefined}>
          <span>Alerts</span>
          <strong>{active.length ? active.map((alert) => (technical ? alert.name : alertSeverity[alert.name] === "critical" ? "Paged" : "Warning")).join(", ") : pending.length ? (technical ? `${pending[0].name} pending` : "Waiting") : "None"}</strong>
          <small>{active.length
            ? active.map((alert) => `${alert.name}, ${alertSeverity[alert.name] === "critical" ? "pages on-call" : "notifies"}`).join("; ")
            : pending.length ? `${pending[0].name} fires after ${alertFor[pending[0].name] / 2 >= 1 ? `${alertFor[pending[0].name] / 2} min` : "30 s"}; ${pending[0].pendingFor} of ${alertFor[pending[0].name]} checks so far` : "every alert waits for its condition to hold"}</small>
        </div>
      </div>

      <ServiceDiagram technical={technical} ticks={ticks} window={liveWindow} />
      <p className="sr-only">{`Checks over the last ${Math.min(ticks.length, liveWindow)} intervals. Latest at ${clockOf(now.n)}: ${now.views.map((view) => `${view.region} ${view.state}${view.slow ? ", slow" : ""}`).join("; ")}. ${now.headline}`}</p>
      <Wire technical={technical}>{`${now.views.map((view) => `${view.region} ${view.state}${view.slow ? "/slow" : ""} ${view.reason}${view.latencyMs !== null ? ` ${view.latencyMs}ms` : ""}`).join(" · ")} · degraded_after ${DEGRADED_AFTER_MS}ms · verdict ${now.verdict} · ${now.alerts.map((alert) => `${alert.name} ${alert.firing ? (alert.muted ? "muted" : "firing") : `${alert.pendingFor}/${alertFor[alert.name]}`}`).join(" ")}`}</Wire>

      <div className="svc-lamps">
        <p className="svc-clock"><time>{clockOf(now.n)}</time><small>1 second here = one 30-second check</small></p>
        <div className="svc-transport">
          <button className="sim-secondary" onClick={() => { play(running ? "ui.key-off" : "ui.key-on"); setRunning((value) => !value); }} type="button"><PlayIcon paused={running} />{running ? "Pause" : "Run"}</button>
          <button className="sim-secondary" disabled={running} onClick={advance} type="button">Next check</button>
          <StoryReset isDefault={isDefault} onReset={onReset} />
        </div>
      </div>

      <div className="sim-controls">
        <ConditionKeys control="page" onChange={lever} scenario={scenario} selectedConditions={selectedConditions} />
        <ConditionKeys control="scope" onChange={lever} scenario={scenario} selectedConditions={selectedConditions} />
        <ConditionKeys control="agent" onChange={lever} scenario={scenario} selectedConditions={selectedConditions} />
      </div>

      <ShadowLane
        last={naive.why}
        name="A health-only monitor in one region (lab-b)"
        says={naive.says === "up" ? "Says up." : naive.pages ? "Pages: down." : "Says down."}
        tally={[
          { label: "Checks visitors waited, unseen", value: tally.unseenSlow },
          { label: "False pages", value: tally.falsePages },
          { label: "Missing data called down", value: tally.missingAsDown },
        ]}
      />

      <Journal empty="Waiting for the first check." entries={journal.slice(0, 6)} technical={technical} />
      <p aria-live="polite" className="sr-only">{`${now.headline} ${plainVerdict(now)}`}</p>
    </div>
  );
}

/* ------------------------------------------------------------- Device trust */

const decisionTone = { ALLOW: "confirmed", "REQUIRE CONFIRMATION": "uncertain", BLOCK: "adverse" } as const satisfies Record<GateDecision, FlowTone>;
const decisionCue = { ALLOW: "pol.let-through", "REQUIRE CONFIRMATION": "pol.ask-to-confirm", BLOCK: "pol.block" } as const satisfies Record<GateDecision, CueId>;
/** The server's answer in everyday words, which depends on how a confirmation can be signed. */
export function plainAnswer(run: DeviceAssessment) {
  if (run.decision === "ALLOW") return "Sent";
  if (run.decision === "BLOCK") return "Blocked";
  return run.screenLock ? "Confirm with the screen lock" : "Confirm with a tap";
}
/** The repo's own log entry for a decision (`SecurityEventType`). */
const logEvent: Record<GateDecision, string> = {
  ALLOW: "SENSITIVE_ACTION_ALLOWED",
  "REQUIRE CONFIRMATION": "SENSITIVE_ACTION_REQUIRES_CONFIRMATION",
  BLOCK: "SENSITIVE_ACTION_BLOCKED",
};
const profileLabel: Record<RiskLevel, string> = { LOW: "Clean phone", MEDIUM: "A few weak signals", HIGH: "Rooted, debugger on" };

type PaymentRecord = { n: number; run: DeviceAssessment; naive: GateDecision; hood: string };

const pointsText = (run: DeviceAssessment) => `${run.score} ${run.score === 1 ? "point" : "points"}`;
/** A check's everyday name mid-sentence: only its first letter lowered, so "Android" keeps its capital. */
const midSentence = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
const foundText = (run: DeviceAssessment) => run.found.map((check) => `${midSentence(plainCheck[check.id])} +${check.points}`).join(", ");

/** Why the server answered as it did, in everyday words. */
function plainReason(run: DeviceAssessment) {
  if (run.reason.kind === "severe") {
    const strong = run.found.filter((check) => check.severity === "HIGH").map((check) => plainCheck[check.id].toLowerCase());
    const named = strong.join(" and ");
    return `${named.charAt(0).toUpperCase()}${named.slice(1)}: a high-severity check blocks on its own, whatever the total. The server issues no challenge, so nothing can be signed.`;
  }
  if (run.level === "HIGH") return `${pointsText(run)} reach the block mark of ${HIGH_SCORE_THRESHOLD}. The server issues no challenge, so nothing can be signed.`;
  if (run.level === "MEDIUM") {
    return `${pointsText(run)}: past the confirm mark of ${MEDIUM_SCORE_THRESHOLD}, under the block mark of ${HIGH_SCORE_THRESHOLD}. ${run.screenLock
      ? "The payment is signed only after the screen lock or a fingerprint unlocks the confirmation key."
      : "With no screen lock there's no confirmation key, so a tap confirmation is signed into the request."}`;
  }
  return run.score
    ? `${pointsText(run)}: under the confirm mark of ${MEDIUM_SCORE_THRESHOLD}, so it's sent. The check stays in the log.`
    : "No check found anything, so the payment is signed and sent.";
}

function DeviceSim({ conditions, isDefault, onChange, onReset, selectedConditions, technical }: SimProps) {
  const run = useMemo(() => assessDevice(conditions), [conditions]);
  const [sends, setSends] = useState(0);
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const requestKey = `${JSON.stringify(conditions)}:${sends}`;
  const lastKey = useRef<string | null>(null);
  const { play } = useSound();
  const walk = useRef<number[]>([]);
  useEffect(() => () => walk.current.forEach(window.clearTimeout), []);
  // Each payment is heard as the drawing shows it: a quiet tick as each found check adds its
  // points, in order, then the server's answer landing.
  useOnChange(requestKey, () => {
    walk.current.forEach(window.clearTimeout);
    const steps: Array<[number, CueId]> = run.found.map((_, index) => [toRulesMs + index * ruleStepMs, `pol.rule-${Math.min(4, index + 1)}` as CueId]);
    steps.push([answerDelayMs(run.found.length) + ruleStepMs, decisionCue[run.decision]]);
    walk.current = steps.map(([at, id]) => window.setTimeout(() => play(id), at));
  });
  const reasonId = run.reason.kind === "severe" ? `SevereSignal(${run.reason.checks.join(", ")})` : run.reason.kind === "score" ? `ScoreThreshold(${run.reason.score}, ${run.reason.threshold})` : `BelowThresholds(${run.reason.score})`;
  const hood = `${run.found.length ? run.found.map((check) => `${check.id} ${check.severity}(${check.points})`).join(" + ") : "no signals"} = ${run.score} → ${reasonId} → ${run.level} → beginPayment: ${run.decision.replace(" ", "_")} · ${run.signing.toLowerCase()} · ${logEvent[run.decision]}`;

  // Every new payment (a changed check, the screen lock, or "Send again") is logged once, as the phone does.
  useEffect(() => {
    if (lastKey.current === requestKey) return;
    lastKey.current = requestKey;
    setHistory((current) => [{ n: (current[0]?.n ?? 0) + 1, run, naive: blockOnAnySignal(conditions), hood }, ...current].slice(0, 5));
  }, [conditions, hood, requestKey, run]);

  const reason = plainReason(run);
  const naive = blockOnAnySignal(conditions);
  const overBlocked = (record: PaymentRecord) => record.naive === "BLOCK" && record.run.decision !== "BLOCK";
  const profile = (Object.keys(deviceProfiles) as RiskLevel[]).find((level) => deviceChecks.every((check) => (selectedConditions[check.id] === "found") === deviceProfiles[level].includes(check.id)));
  const applyProfile = (level: string) => {
    for (const check of deviceChecks) {
      const value = deviceProfiles[level as RiskLevel].includes(check.id) ? "found" : "clear";
      if (selectedConditions[check.id] !== value) onChange(check.id, value);
    }
  };

  return (
    <div className="sim" data-sim="trustgate">
      <DeviceDiagram requestKey={requestKey} run={run} technical={technical} />
      <Wire technical={technical}>{hood}</Wire>

      <div className="sim-controls">
        <Keys hint="the repo's three test phones" label="Try a phone" onSelect={applyProfile} options={(Object.keys(deviceProfiles) as RiskLevel[]).map((level) => ({ label: profileLabel[level], value: level }))} selected={profile ?? ""} />
        <fieldset className="instrument-control dev-checks">
          <legend>What the phone&rsquo;s checks find<small>each adds 1, 2, or 3 points by how serious it is</small></legend>
          <div className="dev-check-keys">
            {deviceChecks.map((check) => {
              const found = selectedConditions[check.id] === "found";
              return (
                <button aria-pressed={found} className="instrument-option dev-check" data-severity={check.severity.toLowerCase()} key={check.id} onClick={() => onChange(check.id, found ? "clear" : "found")} type="button">
                  <span>{technical ? <code>{check.id}</code> : plainCheck[check.id]}</span>
                  <b>+{check.severity === "HIGH" ? 3 : check.severity === "MEDIUM" ? 2 : 1}</b>
                </button>
              );
            })}
          </div>
        </fieldset>
        <Keys hint={plainControls[SCREEN_LOCK].hint} label={plainControls[SCREEN_LOCK].label} onSelect={(value) => onChange(SCREEN_LOCK, value)} options={[{ label: "Set", value: "set" }, { label: "None", value: "none" }]} selected={selectedConditions[SCREEN_LOCK]} />
      </div>

      <div className="pol-decision" data-tone={decisionTone[run.decision]}>
        <span>Payment #{history[0]?.n ?? 1}: {run.level.toLowerCase()} risk, {pointsText(run)}. The server&rsquo;s answer</span>
        <strong>{plainAnswer(run)}</strong>
        <p>{reason}</p>
      </div>

      <ShadowLane
        last={naive === "BLOCK" ? (run.decision === "BLOCK" ? "It blocks this one too." : run.decision === "REQUIRE CONFIRMATION" ? "It blocks a payment that only needed a confirmation." : "It blocks a low-risk payment over one weak signal.") : "Nothing was found, so it lets the payment through."}
        name="A gate that blocks on any signal"
        says={naive === "BLOCK" ? "Blocked." : "Sent."}
        tally={[
          { label: "Blocked, though a confirmation was enough", value: history.filter((record) => overBlocked(record) && record.run.decision === "REQUIRE CONFIRMATION").length },
          { label: "Blocked, though it was low risk", value: history.filter((record) => overBlocked(record) && record.run.decision === "ALLOW").length },
        ]}
      />

      <div className="sim-actions">
        <button className="sim-primary" onClick={() => setSends((value) => value + 1)} type="button"><PlayIcon />Send the payment again</button>
        <StoryReset isDefault={isDefault} onReset={onReset} />
        <p className="sim-compare">Confirm from {MEDIUM_SCORE_THRESHOLD} points, block from {HIGH_SCORE_THRESHOLD} or on any high-severity check.</p>
      </div>

      <Journal
        empty="Each payment you make is listed here, as the phone logs it."
        entries={history.map((record) => ({
          key: String(record.n),
          badge: `#${record.n}`,
          tone: decisionTone[record.run.decision],
          plain: `${record.run.found.length ? foundText(record.run) : "Nothing found"} = ${pointsText(record.run)}: ${plainAnswer(record.run).toLowerCase()}.`,
          contrast: overBlocked(record) ? "A gate that blocks on any signal would have blocked this payment." : undefined,
          hood: record.hood,
        }))}
        technical={technical}
      />
      <p aria-live="polite" className="sr-only">{`${plainAnswer(run)}. ${reason}`}</p>
    </div>
  );
}
