"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayIcon, RewindIcon } from "./icons";
import { messageTravelMs, PaymentDiagram, PolicyDiagram, ruleStepMs, ServiceDiagram, toRulesMs } from "./sim-diagrams";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { evaluatePolicy, latencyThresholdMs, type PolicyRun } from "../lib/instruments";
import { type Conditions, type ProjectionMode, type Scenario } from "../lib/scenarios";
import {
  emptyPayWorld,
  lateMessage,
  liveSample,
  liveWindow,
  onCallStatus,
  paidMessage,
  paymentStateWord,
  payStep,
  paymentScript,
  type LiveSample,
  type PayInput,
  type PayOutcome,
  type PayTone,
  type PayWorld,
} from "../lib/simulators";

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
const payCue: Record<PayOutcome, CueId> = {
  applied: "pay.let-in",
  duplicate: "pay.stopped",
  stale: "pay.stopped",
  "applied-again": "pay.twice",
  regressed: "pay.overwritten",
  matched: "pay.report-matches",
  mismatched: "pay.report-differs",
  "store-down": "pay.book-down",
  "store-up": "pay.book-back",
};
/** A message's cue starts early enough that its knock lands as the packet reaches the payment. */
const landingDelay = messageTravelMs / 1000 - LANDING;

/** Each simulator has a name, like a small piece of equipment. */
const simName: Record<Scenario["slug"], string> = {
  payflow: "Payment desk",
  iyup: "Website monitor",
  trustgate: "Security checkpoint",
};

const howTo: Record<Scenario["slug"], string> = {
  payflow: "You run a shop's payment system. Press “Bank sends paid”, then “Bank sends it again”, as banks sometimes do. Then switch the repeat check off and try it again.",
  iyup: "A website runs live here: one second is one minute. Slow it down, stop the speed measurements, or switch to the old dashboard, and see who notices.",
  trustgate: "Someone asks a banking app to do something. Change what their phone looks like and what they want; the bank's rules are read from the top, and the first one that fits decides.",
};

/**
 * Plain names for every condition, so the controls read for anyone. The case's own technical
 * names stay in the model; engineers get them back with "Technical details".
 */
const plainControls: Record<string, { label: string; hint?: string; options: Record<string, string> }> = {
  delivery: { label: "Or watch an example", hint: "it plays through the desk", options: { once: "The bank sends it once", duplicate: "The bank sends it twice", "out-of-order": "An old message arrives late" } },
  latency: { label: "Site speed", options: { normal: "Normal", degraded: "Getting slower", severe: "Very slow" } },
  health: { label: "Does the site answer?", hint: "the basic “are you up?” check", options: { pass: "Yes", fail: "No" } },
  scrape: { label: "Speed measurements", hint: "the tool that times every page", options: { available: "Collected", missing: "Stopped" } },
  alert: { label: "Alarm when too slow", options: { present: "Set up", absent: "Not set up" } },
  root: { label: "Phone's security removed?", hint: "a “rooted” phone", options: { clear: "No", suspected: "Maybe", detected: "Yes" } },
  emulator: { label: "A fake phone?", hint: "an emulator running on a computer", options: { clear: "No", detected: "Yes" } },
  signature: { label: "Request tampered with?", hint: "changed on its way to the bank", options: { valid: "No", invalid: "Yes" } },
  sensitivity: { label: "They want to", options: { low: "Check balance", high: "Send money" } },
};

const plainApproach: Record<Scenario["slug"], { label: string; hint?: string; designed: string; baseline: string }> = {
  payflow: { label: "Repeat check", hint: "remembers which messages it already handled", designed: "On", baseline: "Off" },
  iyup: { label: "Dashboard shows", designed: "Speed and health", baseline: "Only “is it up?”" },
  trustgate: { label: "Bank's rules", hint: "new rules weigh the risk; old ones block anything odd", designed: "Weigh the risk", baseline: "Block anything odd" },
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
      {scenario.slug === "trustgate" ? <PolicySim {...shared} /> : null}
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
  return !isDefault && onReset ? <button className="sim-secondary" onClick={onReset} type="button"><RewindIcon />Reset</button> : null;
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

function ApproachKeys({ approach, onApproachChange, scenario }: Pick<SimProps, "approach" | "onApproachChange" | "scenario">) {
  const plain = plainApproach[scenario.slug];
  return (
    <Keys
      hint={plain.hint}
      label={plain.label}
      onSelect={(value) => onApproachChange(value as ProjectionMode)}
      options={[{ label: plain.designed, value: "designed" }, { label: plain.baseline, value: "baseline" }]}
      selected={approach}
    />
  );
}

/** The engineering layer, shown only with "Technical details": one line of raw values. */
function Wire({ children, technical }: { children: string; technical: boolean }) {
  return technical ? <code className="sim-wire">{children}</code> : null;
}

type JournalEntry = { key: string; badge: string; tone: PayTone; plain: string; hood: string };

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
              {technical ? <code>{entry.hood}</code> : null}
            </li>
          ))}
        </ol>
      ) : <p className="sim-journal-empty">{empty}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ Payment */

const storyStepDelay = 800;

function PaymentSim({ approach, conditions, isDefault, onApproachChange, onChange, onReset, scenario, selectedConditions, technical }: SimProps) {
  const [world, setWorld] = useState<PayWorld>(emptyPayWorld);
  const [story, setStory] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const checked = approach === "designed";
  const latest = world.entries.at(-1);
  const marks = useChangeMarks({ state: world.state, updates: String(world.updates), repeats: String(world.repeats) });
  const { play } = useSound();
  useOnChange(world.entries.length, (count, before) => {
    const entry = world.entries.at(-1);
    if (count > before && entry) play(payCue[entry.outcome], entry.message ? landingDelay : 0);
  });
  useOnChange(checked, (on) => play(on ? "pay.check-on" : "pay.check-off"));

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const stopStory = () => { timers.current.forEach(window.clearTimeout); timers.current = []; setStory(null); };
  const send = (input: PayInput) => { stopStory(); setWorld((current) => payStep(current, input, checked)); };
  const playStory = (example: Conditions = conditions) => {
    stopStory();
    const script = paymentScript(example);
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setWorld(script.reduce((current, input) => payStep(current, input, checked), emptyPayWorld)); return; }
    setWorld(emptyPayWorld);
    setStory(0);
    script.forEach((input, index) => {
      timers.current.push(window.setTimeout(() => {
        setWorld((current) => payStep(current, input, checked));
        setStory(index + 1 < script.length ? index + 1 : null);
      }, (index + 1) * storyStepDelay));
    });
  };

  const journal: JournalEntry[] = [...world.entries].reverse().slice(0, 6).map((entry) => ({ key: String(entry.n), badge: `#${entry.n}`, tone: entry.tone, plain: entry.plain, hood: entry.hood }));
  const sub = (plain: string, code: string) => <small>{technical ? <code>{code}</code> : plain}</small>;

  return (
    <div className="sim" data-sim="payflow">
      <PaymentDiagram checked={checked} technical={technical} world={world} />
      <Wire technical={technical}>{`processed IDs [${world.processed.join(", ")}] · last seq ${world.lastSeq || "–"} · state ${world.state} · state writes ${world.updates}${latest ? ` · last: ${latest.hood}` : ""}`}</Wire>

      <div className="sim-controls">
        <div aria-label="The bank sends" className="sim-group" role="group">
          <p className="sim-group-label">The bank sends</p>
          <div className="sim-buttons">
            <button className="sim-send" onClick={() => send({ kind: "deliver", message: paidMessage })} type="button">
              Bank sends “paid”{sub("the payment went through", `${paidMessage.id} · seq ${paidMessage.seq}`)}
            </button>
            <button className="sim-send" disabled={!world.lastMessage} onClick={() => world.lastMessage && send({ kind: "deliver", message: world.lastMessage })} type="button">
              Bank sends it again{sub("banks resend when they're unsure", `retry ${world.lastMessage?.id ?? "–"}`)}
            </button>
            <button className="sim-send" onClick={() => send({ kind: "deliver", message: lateMessage })} type="button">
              Late “pending” update{sub("an older message, delivered late", `${lateMessage.id} · seq ${lateMessage.seq}`)}
            </button>
          </div>
        </div>
        <ApproachKeys approach={approach} onApproachChange={onApproachChange} scenario={scenario} />
        <div aria-label="Bank's daily report" className="sim-group" role="group">
          <p className="sim-group-label">Bank&rsquo;s daily report</p>
          <div className="sim-buttons sim-buttons-pair">
            <button className="sim-send" onClick={() => send({ kind: "settle", matched: true })} type="button">Matches our records{sub("everything adds up", "settlement ok")}</button>
            <button className="sim-send" onClick={() => send({ kind: "settle", matched: false })} type="button">Doesn&rsquo;t match{sub("something's off", "settlement mismatch")}</button>
          </div>
        </div>
        <Keys hint="where every change is written down" label="Record book" onSelect={(value) => send({ kind: "store", online: value === "online" })} options={[{ label: "Available", value: "online" }, { label: "Unavailable", value: "offline" }]} selected={world.storeOnline ? "online" : "offline"} />
        <ConditionKeys control="delivery" onChange={onChange} onSelect={(value) => { onChange("delivery", value); playStory({ ...conditions, delivery: value }); }} scenario={scenario} selectedConditions={selectedConditions} />
      </div>

      <div className="sim-readout">
        <ol aria-label="Payment state" className="pay-states">
          {(["PENDING", "PAID", "REVIEW"] as const).map((state) => (
            <li data-changed={state === world.state ? marks.state : undefined} data-current={state === world.state || undefined} data-state={state.toLowerCase()} key={state}>
              <i aria-hidden="true" />{paymentStateWord[state]}{state === world.state ? <span className="sr-only"> (current)</span> : null}
            </li>
          ))}
        </ol>
        <dl className="sim-counts">
          <div><dt>Messages received</dt><dd>{world.deliveries}</dd></div>
          <div data-changed={marks.updates}><dt>Times the payment changed</dt><dd>{world.updates}</dd></div>
          <div data-changed={marks.repeats} data-tone={world.repeats ? "adverse" : undefined}><dt>Handled twice</dt><dd>{world.repeats}</dd></div>
        </dl>
        <ul aria-label="Processed IDs" className="sr-only">
          {world.processed.length ? world.processed.map((id) => <li key={id}>{id}</li>) : <li>none yet</li>}
        </ul>
        <ol aria-label="Audit records" className="sr-only">
          {world.audit.length ? world.audit.map((record) => <li key={record.n}>#{record.n} {record.change}: {record.status}</li>) : <li>no records yet</li>}
        </ol>
      </div>

      <div className="sim-actions">
        <button className="sim-primary" disabled={story !== null} onClick={() => playStory()} type="button"><PlayIcon />{story !== null ? "Playing the example…" : "Play the example"}</button>
        <button className="sim-secondary" onClick={() => { stopStory(); setWorld(emptyPayWorld); play("pay.start-over"); }} type="button"><RewindIcon />Start over</button>
        <StoryReset isDefault={isDefault} onReset={onReset} />
        <p className="sim-compare">{checked ? "Repeat check on: each message can change the payment only once." : "Repeat check off: every message is processed as it arrives."}</p>
      </div>

      <Journal empty="Nothing yet. Send a message from the bank." entries={journal} technical={technical} />
      <p aria-live="polite" className="sr-only">{latest ? latest.plain : ""}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Service */

type Sample = LiveSample & { mode: ProjectionMode };
type ServiceState = { samples: Sample[]; minute: number; since: number; profile: string };
const minuteMs = 1100;

/** Milliseconds as everyday seconds. */
export const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const limit = seconds(latencyThresholdMs);

/** The on-call screen in everyday words; the model's own titles stay for engineers. */
function plainStatus(sample: Sample, title: string) {
  const wait = seconds(sample.observedLatency ?? sample.actualLatency);
  if (title === "Outage") return { title: "The site is down", detail: "The site isn't answering at all." };
  if (title === "Looks fine") return { title: "Looks fine", detail: "This dashboard only checks that the site answers, and it does." };
  if (title === "Paging on-call") return { title: "Alarm: engineers alerted", detail: `Pages take ${wait}, over the ${limit} limit, so the alarm went off.` };
  if (title === "Investigate collection") return { title: "Can't tell: measurements stopped", detail: "Speed measurements stopped arriving. No news isn't good news." };
  if (title === "Breach, nobody paged") return { title: "Too slow, and no alarm", detail: `Pages take ${wait}, over the limit, but no alarm is set up to tell anyone.` };
  return { title: "All good", detail: `Pages load in ${wait}, under the ${limit} limit.` };
}

const statusHood = (sample: Sample, title: string) => {
  if (title === "Outage") return "health = FAIL → service contract broken; page regardless of latency";
  if (title === "Looks fine") return `dashboard collects health only → p95 not observed (actual ${sample.actualLatency} ms)`;
  if (title === "Paging on-call") return `p95 ${sample.observedLatency} ms > ${latencyThresholdMs} ms threshold → alert rule fires`;
  if (title === "Investigate collection") return "scrape target missing → sample = null, not 0 → alert: no data";
  if (title === "Breach, nobody paged") return `p95 ${sample.observedLatency} ms > ${latencyThresholdMs} ms, no alert rule → nothing fires`;
  return `p95 ${sample.observedLatency} ms ≤ ${latencyThresholdMs} ms · health PASS → quiet`;
};

const troubled = new Set(["Outage", "Paging on-call", "Investigate collection", "Breach, nobody paged"]);

/**
 * What the monitor sounds like as its status changes. "Too slow, and no alarm" is silent: nobody
 * was told, and that silence is the point. "Back to normal" plays only when visitors are really
 * served quickly again, never when a dashboard simply stops looking.
 */
function statusCue(title: string, before: string, sample: Sample): CueId | null {
  if (title === "Paging on-call") return "svc.alarm";
  if (title === "Outage") return "svc.down";
  if (title === "Investigate collection") return "svc.blind";
  if (troubled.has(before) && !troubled.has(title) && sample.health === "pass" && sample.actualLatency <= latencyThresholdMs) return "svc.recovered";
  return null;
}

/** A stepped minute lands as a block pitched to its page time, rising D, F♯, A, and sour past the line. */
function minuteCue(ms: number | null): CueId | null {
  if (ms === null) return null;
  if (ms <= 250) return "svc.minute-quick";
  if (ms <= 400) return "svc.minute-slower";
  if (ms <= latencyThresholdMs) return "svc.minute-slow";
  return "svc.minute-too-slow";
}

function ServiceSim({ approach, conditions, foreground, isDefault, onApproachChange, onChange, onReset, scenario, selectedConditions, technical }: SimProps & { foreground: boolean }) {
  const [sim, setSim] = useState<ServiceState>(() => ({
    // The chart opens on the case's own four minutes, then keeps running.
    samples: [0, 1, 2, 3].map((minute) => ({ ...liveSample(conditions, approach, minute, minute), mode: approach })),
    minute: 4,
    since: 4,
    profile: conditions.latency,
  }));
  const [running, setRunning] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const latest = useRef({ approach, conditions });
  useEffect(() => { latest.current = { approach, conditions }; });

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const advance = () => setSim((current) => {
    const { approach: mode, conditions: now } = latest.current;
    const since = now.latency === current.profile ? current.since : 0;
    const sample = { ...liveSample(now, mode, since, current.minute), mode };
    return { samples: [...current.samples, sample].slice(-liveWindow), minute: current.minute + 1, since: since + 1, profile: now.latency };
  });

  const live = running && foreground && pageVisible;
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(advance, minuteMs);
    return () => window.clearInterval(timer);
  }, [live]);

  const now = sim.samples.at(-1)!;
  const model = onCallStatus(now, now.mode);
  const status = plainStatus(now, model.title);
  const statusMark = useChangeMarks({ status: model.title }).status;
  const { play } = useSound();
  const lever = (key: string, value: string) => {
    play("ui.key-on");
    onChange(key, value);
  };
  useOnChange(model.title, (title, before) => {
    const cue = statusCue(title, before, now);
    if (cue) play(cue);
  });
  // Stepping through minutes by hand lands each one; the running chart stays silent.
  useOnChange(sim.minute, () => {
    const cue = running ? null : minuteCue(now.observedLatency);
    if (cue) play(cue);
  });

  const journal: JournalEntry[] = [];
  sim.samples.forEach((sample, index) => {
    const current = onCallStatus(sample, sample.mode);
    const previous = index ? onCallStatus(sim.samples[index - 1], sim.samples[index - 1].mode).title : null;
    if (current.title === previous) return;
    const plain = plainStatus(sample, current.title);
    journal.unshift({ key: `${sample.minute}`, badge: sample.time, tone: current.tone, plain: `${plain.title}. ${plain.detail}`, hood: statusHood(sample, current.title) });
  });

  return (
    <div className="sim" data-sim="iyup">
      <div className="svc-screen">
        <div className="svc-status" data-changed={statusMark} data-jolt={model.title === "Outage" ? statusMark : undefined} data-tone={model.tone}>
          <span><i aria-hidden="true" />what the dashboard says</span>
          <strong>{status.title}</strong>
          <p>{status.detail}</p>
        </div>
        <div className="svc-users" data-over={now.actualLatency > latencyThresholdMs || undefined}>
          <span>What visitors actually wait</span>
          <strong>{technical ? `${now.actualLatency} ms` : seconds(now.actualLatency)}</strong>
          <small>the real speed, measured or not</small>
        </div>
      </div>

      <ServiceDiagram samples={sim.samples} statusTitle={model.title} technical={technical} window={liveWindow} />
      <p className="sr-only">{`Page load time over the last ${sim.samples.length} minutes. Latest: ${now.time}, visitors wait ${seconds(now.actualLatency)}, the dashboard sees ${now.observedLatency === null ? "nothing" : seconds(now.observedLatency)}. The site ${now.health === "pass" ? "answers" : "does not answer"}.`}</p>
      <Wire technical={technical}>{`p95 = ${now.observedLatency === null ? "null (no sample)" : `${now.observedLatency} ms`} · actual ${now.actualLatency} ms · threshold ${latencyThresholdMs} ms · health ${now.health.toUpperCase()} · alert ${now.alert} · status ${model.title}`}</Wire>

      <div className="svc-lamps">
        <p className="svc-clock"><time>{now.time}</time><small>1 second here = 1 minute</small></p>
        <div className="svc-transport">
          <button className="sim-secondary" onClick={() => { play(running ? "ui.key-off" : "ui.key-on"); setRunning((value) => !value); }} type="button"><PlayIcon paused={running} />{running ? "Pause" : "Run"}</button>
          <button className="sim-secondary" disabled={running} onClick={advance} type="button">Next minute</button>
          <StoryReset isDefault={isDefault} onReset={onReset} />
        </div>
      </div>

      <div className="sim-controls">
        <ConditionKeys control="latency" onChange={lever} scenario={scenario} selectedConditions={selectedConditions} />
        <ConditionKeys control="health" onChange={lever} scenario={scenario} selectedConditions={selectedConditions} />
        <ConditionKeys control="scrape" onChange={lever} scenario={scenario} selectedConditions={selectedConditions} />
        <ConditionKeys control="alert" onChange={lever} scenario={scenario} selectedConditions={selectedConditions} />
        <ApproachKeys approach={approach} onApproachChange={(mode) => { play("ui.key-on"); onApproachChange(mode); }} scenario={scenario} />
      </div>

      <Journal empty="Waiting for the first minute." entries={journal.slice(0, 6)} technical={technical} />
      <p aria-live="polite" className="sr-only">{`${status.title}. ${status.detail}`}</p>
    </div>
  );
}

/* ------------------------------------------------------------- Device trust */

const decisionTone = { ALLOW: "confirmed", "REQUIRE CONFIRMATION": "uncertain", BLOCK: "adverse" } as const;
const decisionCue = { ALLOW: "pol.let-through", "REQUIRE CONFIRMATION": "pol.ask-to-confirm", BLOCK: "pol.block" } as const satisfies Record<keyof typeof decisionTone, CueId>;
export const plainDecision = { ALLOW: "Let through", "REQUIRE CONFIRMATION": "Ask to confirm", BLOCK: "Block" } as const;
type Decision = keyof typeof decisionTone;

type RequestRecord = { n: number; summary: string; decision: Decision; other: Decision; mode: ProjectionMode; hood: string };

function requestSummary(conditions: Conditions) {
  const phone = [
    conditions.root === "detected" ? "security removed" : conditions.root === "suspected" ? "security maybe removed" : null,
    conditions.emulator === "detected" ? "fake phone" : null,
    conditions.signature === "invalid" ? "tampered request" : null,
  ].filter(Boolean);
  return `${phone.length ? phone.join(", ") : "Normal phone"}, wants to ${conditions.sensitivity === "high" ? "send money" : "check their balance"}`;
}

/** Why the bank decided as it did, in everyday words. */
function plainReason(run: PolicyRun, conditions: Conditions, approach: ProjectionMode) {
  const rule = run.rules.find((item) => item.status === "matched");
  if (approach === "baseline") {
    return rule?.id === "any-suspicious"
      ? "The old rule blocks anything that looks odd, even if they only want to check their balance."
      : conditions.signature === "invalid"
        ? "The old rule only looks at the phone, so it lets this tampered request through."
        : "The old rule saw nothing odd about the phone, so it lets the request through.";
  }
  if (rule?.id === "signature") return "The request was changed on its way to the bank, so it's blocked, whatever the phone looks like.";
  if (rule?.id === "root-sensitive") return "The phone's security is removed and they want to move money: too risky to allow.";
  if (rule?.id === "suspicious-sensitive") return "Something about the phone looks off and they want to move money, so they're asked to confirm it's really them.";
  return "Nothing here is risky enough for what they want to do, so it goes through. Any warning is still noted.";
}

function PolicySim({ approach, conditions, isDefault, onApproachChange, onChange, onReset, scenario, selectedConditions, technical }: SimProps) {
  const run = useMemo(() => evaluatePolicy(conditions, approach), [approach, conditions]);
  const other = useMemo(() => evaluatePolicy(conditions, approach === "designed" ? "baseline" : "designed"), [approach, conditions]);
  const matched = run.rules.findIndex((rule) => rule.status === "matched");
  const [sends, setSends] = useState(0);
  const [history, setHistory] = useState<RequestRecord[]>([]);
  const requestKey = `${JSON.stringify(conditions)}:${approach}:${sends}`;
  const lastKey = useRef<string | null>(null);
  const { play } = useSound();
  const walk = useRef<number[]>([]);
  useEffect(() => () => walk.current.forEach(window.clearTimeout), []);
  // Each new request is heard as the drawing shows it: a quiet tick as each rule is read, in order,
  // then the answer landing as the first rule that fits decides.
  useOnChange(requestKey, () => {
    walk.current.forEach(window.clearTimeout);
    const read = Math.max(0, matched);
    const steps: Array<[number, CueId]> = Array.from({ length: read + 1 }, (_, index) => [toRulesMs + index * ruleStepMs, `pol.rule-${Math.min(4, index + 1)}` as CueId]);
    steps.push([toRulesMs + (read + 1) * ruleStepMs, decisionCue[run.decision]]);
    walk.current = steps.map(([at, id]) => window.setTimeout(() => play(id), at));
  });
  const hood = `root: ${conditions.root} · emulator: ${conditions.emulator} · signature: ${conditions.signature} · sensitivity: ${conditions.sensitivity} → rule ${matched + 1} "${run.rules[matched]?.when.toLowerCase()}" → ${run.decision}`;

  // Every new request (a changed signal, policy, or "Send again") is logged once.
  useEffect(() => {
    if (lastKey.current === requestKey) return;
    lastKey.current = requestKey;
    setHistory((current) => [{ n: (current[0]?.n ?? 0) + 1, summary: requestSummary(conditions), decision: run.decision, other: other.decision, mode: approach, hood }, ...current].slice(0, 5));
  }, [approach, conditions, hood, other.decision, requestKey, run.decision]);

  const reason = plainReason(run, conditions, approach);
  const otherRules = approach === "designed" ? "the old rules (block anything odd)" : "the new rules (weigh the risk)";

  return (
    <div className="sim" data-sim="trustgate">
      <PolicyDiagram conditions={conditions} requestKey={requestKey} run={run} technical={technical} />
      <Wire technical={technical}>{hood}</Wire>

      <div className="sim-controls">
        <ConditionKeys control="root" onChange={onChange} scenario={scenario} selectedConditions={selectedConditions} />
        <ConditionKeys control="emulator" onChange={onChange} scenario={scenario} selectedConditions={selectedConditions} />
        <ConditionKeys control="signature" onChange={onChange} scenario={scenario} selectedConditions={selectedConditions} />
        <ConditionKeys control="sensitivity" onChange={onChange} scenario={scenario} selectedConditions={selectedConditions} />
        <ApproachKeys approach={approach} onApproachChange={onApproachChange} scenario={scenario} />
      </div>

      <div className="pol-decision" data-tone={decisionTone[run.decision]}>
        <span>Request #{history[0]?.n ?? 1}: the bank&rsquo;s answer</span>
        <strong>{plainDecision[run.decision]}</strong>
        <p>{reason}</p>
      </div>
      <ol aria-label="Rulebook, first match decides" className="pol-rules sr-only">
        {run.rules.map((rule, index) => (
          <li data-status={rule.status} key={rule.id}>{index + 1}. {rule.when}: {plainDecision[rule.result]}, {rule.status}.</li>
        ))}
      </ol>

      <div className="sim-actions">
        <button className="sim-primary" onClick={() => setSends((value) => value + 1)} type="button"><PlayIcon />Send the request again</button>
        <StoryReset isDefault={isDefault} onReset={onReset} />
        <p className="sim-compare" data-tone={other.decision !== run.decision ? "adverse" : undefined}>
          With {otherRules}: <b>{plainDecision[other.decision]}</b>
          {other.decision !== run.decision ? " (different)" : " (the same)"}
        </p>
      </div>

      <Journal
        empty="Each request you make is listed here."
        entries={history.map((record) => ({
          key: String(record.n),
          badge: `#${record.n}`,
          tone: decisionTone[record.decision],
          plain: `${record.summary}: ${plainDecision[record.decision]}.`,
          hood: `${record.mode === "designed" ? "risk-based policy" : "block-any-signal policy"} · ${record.hood} · other policy → ${record.other}`,
        }))}
        technical={technical}
      />
      <p aria-live="polite" className="sr-only">{`${plainDecision[run.decision]}. ${reason}`}</p>
    </div>
  );
}
