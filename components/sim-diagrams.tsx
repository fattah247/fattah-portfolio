"use client";

import { Fragment, useId, type CSSProperties, type ReactNode } from "react";
import { MEDIUM_SCORE_THRESHOLD, HIGH_SCORE_THRESHOLD, type DeviceAssessment, type GateDecision, type Signing } from "../lib/device-risk";
import { BUZZ_AFTER_LANDING } from "../lib/sound/engine";
import { PAYMENT_AMOUNT, payoutWord, statusWord, type FlowEntry, type FlowWorld, type PaymentStatus } from "../lib/payment-flow";
import { alertFor, alertSeverity, CHECK_INTERVAL_S, clockOf, DEGRADED_AFTER_MS, firing, type Region, type RegionView, type Tick } from "../lib/uptime";

/** How long a message takes to reach the payment in the drawing (the packet's travel in environment.css). */
export const messageTravelMs = 440;

/*
 * The simulators' main view: each case's cover schematic drawn large and driven live. Labels are
 * everyday words; with "Technical details" on they switch to the engineering names (message IDs,
 * raw states, p95 in milliseconds, rule names).
 *
 * Each drawing comes in three compositions, and the drawing's own width picks one (environment.css):
 * wide (640 units) from 640px, medium (320) from 320px, and compact (200) below. A composition is
 * never shown smaller than its own units, so its 12px-and-up text never renders below 12px, from a
 * maximised desktop window down to a 262px phone. All three are decorative mirrors of state the
 * simulator also gives as text.
 */

type Layout = "wide" | "medium" | "compact";
const layouts: Layout[] = ["wide", "medium", "compact"];

/** A packet that travels a straight leg: dx/dy in the drawing's own units. */
const leg = (dx: number, dy: number, delay = 0): CSSProperties => ({ "--dx": `${dx}px`, "--dy": `${dy}px`, animationDelay: `${delay}ms` } as CSSProperties);

function Variants({ className, render }: { className: string; render: (layout: Layout) => ReactNode }) {
  return <div aria-hidden="true" className={`sd ${className}`}>{layouts.map((layout) => render(layout))}</div>;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/* ------------------------------------------------------------------ Notes */

type Segment = { text: string; bad?: boolean };

function wrapWords(text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > max) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

type Piece = Segment & { joins: boolean };

/**
 * Packs a note's parts into lines of at most `max` characters, breaking between parts first. A part
 * may mark where it reads best broken ("working,|but slower"); it only breaks there, then between
 * words, when it cannot fit a line whole. Only a part's first piece can share a line (`joins`).
 */
function packNote(parts: Segment[], max: number, joiner: string) {
  const pieces: Piece[] = parts.flatMap((part) => {
    const whole = part.text.replaceAll("|", " ");
    if (whole.length <= max) return [{ ...part, text: whole, joins: true }];
    return part.text.split("|").map((piece) => piece.trim()).flatMap((piece) => wrapWords(piece, max)).map((text, index) => ({ ...part, text, joins: index === 0 }));
  });
  const lines: Piece[][] = [];
  let length = 0;
  for (const piece of pieces) {
    const line = lines.at(-1);
    if (line && piece.joins && length + joiner.length + piece.text.length <= max) { line.push(piece); length += joiner.length + piece.text.length; }
    else { lines.push([piece]); length = piece.text.length; }
  }
  return lines;
}

/** A note in the cover's voice, wrapped to the composition; `carry` keeps the joiner (an arrow) at a break between parts. */
function Note({ carry = false, joiner, joinerClass, max, parts, step, x, y }: { carry?: boolean; joiner: string; joinerClass?: string; max: number; parts: Segment[]; step: number; x: number; y: number }) {
  const tail = joiner.trimEnd();
  const lines = packNote(parts, max - (carry ? tail.length : 0), joiner);
  return (
    <text className="sd-note" x={x} y={y}>
      {lines.map((line, index) => (
        <tspan dy={index ? step : 0} key={index} x={x}>
          {line.map((part, at) => (
            <Fragment key={at}>
              {at ? <tspan className={joinerClass}>{joiner}</tspan> : null}
              {part.bad ? <tspan className="sd-note-bad">{part.text}</tspan> : part.text}
            </Fragment>
          ))}
          {carry && lines[index + 1]?.[0].joins ? <tspan className={joinerClass}>{tail}</tspan> : null}
        </tspan>
      ))}
    </text>
  );
}

/* ------------------------------------------------------------------ Payment */

type Flow = "pass" | "stop" | "pass-bad";
const flowOf = (entry: FlowEntry): Flow => (entry.outcome === "APPLIED" ? "pass" : entry.outcome === "SENT_TO_REVIEW" ? "pass-bad" : "stop");

/** The payment state's colour family in the drawing: waiting, paid, or held. */
const stateFamily = (status: PaymentStatus) => (status === "MANUAL_REVIEW" ? "review" : status === "PENDING" || status === "AUTHORIZED" ? "pending" : "paid");

/** An event as the provider would say it, or its id and status with technical details. */
function eventLabel(entry: FlowEntry, technical: boolean) {
  const event = entry.event!;
  if (technical) return `${event.id} ${event.amount !== PAYMENT_AMOUNT ? event.amount : event.status}`;
  if (entry.input.kind === "webhook" && entry.input.webhook === "again") return "“paid” again";
  if (event.amount !== PAYMENT_AMOUNT) return "wrong amount";
  if (event.status === "AUTHORIZED") return "late “authorized”";
  return entry.input.kind === "webhook" && entry.input.webhook === "new-id" ? "“paid”, new id" : "“paid”";
}

function paymentNote(world: FlowWorld, technical: boolean): Segment[] {
  const deliveries = world.entries.filter((entry) => entry.event).length;
  const captures = world.journals.filter((journal) => journal === "CAPTURE").length;
  const parts: Segment[] = technical
    ? [{ text: plural(deliveries, "delivery", "deliveries") }, { text: plural(captures, "CAPTURE journal", "CAPTURE journals") }]
    : [{ text: plural(deliveries, "event", "events") }, { text: `money captured ${captures === 1 ? "once" : `${captures} times`}` }];
  const bad = world.rulesBroken.length
    ? (technical ? "rule removed: caught" : "a rule was removed!")
    : world.status === "MANUAL_REVIEW" ? (technical ? "MANUAL_REVIEW" : "on hold")
      : world.payout === "BROKEN" ? (technical ? "break MISSING_CREDIT" : "credit missing") : "";
  return bad ? [...parts, { text: bad, bad: true }] : parts;
}

export function PaymentDiagram({ technical, world }: { technical: boolean; world: FlowWorld }) {
  const deliveries = world.entries.filter((entry) => entry.event);
  const latest = deliveries.at(-1);
  const note = paymentNote(world, technical);
  const audit = world.audit.slice(-16);
  const lastEntry = world.entries.at(-1);
  const inboxSize = Object.keys(world.inbox).length;
  const seen = (compact: boolean) => technical
    ? (inboxSize ? `inbox ${Object.keys(world.inbox).slice(compact ? -2 : -3).join(" ")}` : "inbox –")
    : !inboxSize ? (compact ? "nothing yet" : "nothing recorded yet") : `remembers ${plural(inboxSize, "event", "events")}`;
  const payoutText = technical ? `payout ${world.payout === "NONE" ? "–" : world.payout}` : `payout: ${payoutWord[world.payout]}`;
  const reportText = technical
    ? (world.reportMatched ? "report MATCHED" : world.reviewCases.includes("REPORT_MISMATCH") ? "report MISMATCH" : "report –")
    : (world.reportMatched ? "report matches" : world.reviewCases.includes("REPORT_MISMATCH") ? "report differs" : "no report yet");
  const words = technical
    ? { source: "provider", gate: "inbox", state: "payment", book: "audit", empty: "no events", pass: "in", stop: "stop", held: "held" }
    : { source: "provider", gate: "inbox", state: "payment", book: "audit trail", empty: "nothing yet", pass: "in", stop: "stop", held: "held" };
  const stateText = technical ? world.status : statusWord[world.status];

  // The payment answers what just reached it: a knock when an event is applied or money lands, a
  // jolt (in time with the buzz) when a removed rule lets something through.
  const hit = lastEntry?.outcome === "APPLIED" || lastEntry?.outcome === "LANDED" || lastEntry?.outcome === "RECONCILED" ? "land" : lastEntry?.outcome === "RULE_BROKEN" ? "bad" : undefined;
  const hitDelay = (lastEntry?.event ? messageTravelMs : 0) + (hit === "bad" ? BUZZ_AFTER_LANDING * 1000 : 0);
  const stateBox = (x: number, y: number, w: number, h: number) => (
    <g className="sd-state" data-hit={hit} data-state={stateFamily(world.status)} key={`state-${world.status}-${world.entries.length}`} style={{ "--hit-delay": `${hitDelay}ms` } as CSSProperties}>
      <rect height={h} width={w} x={x} y={y} />
      <text textAnchor="middle" x={x + w / 2} y={y + h / 2 + 5}>{stateText}</text>
    </g>
  );
  const chip = (text: string, outcome: string, x: number, y: number, w: number, h: number) => (
    <g className="sd-settle" data-outcome={outcome}>
      <rect height={h} width={w} x={x} y={y} />
      <text textAnchor="middle" x={x + w / 2} y={y + h / 2 + 4}>{text}</text>
    </g>
  );
  const payoutOutcome = world.payout === "LANDED" ? "matched" : world.payout === "BROKEN" ? "mismatched" : "none";
  const reportOutcome = world.reportMatched ? "matched" : world.reviewCases.includes("REPORT_MISMATCH") ? "mismatched" : "none";
  const book = (place: (index: number) => { x: number; y: number }, empty: { x: number; y: number }) => (
    <>
      {audit.map((record, index) => {
        const at = place(index);
        return <rect className={`sd-record${index === audit.length - 1 ? " sd-record-new" : ""}`} data-status="written" height="14" key={`${index}-${record}`} width="14" x={at.x} y={at.y} />;
      })}
      {!audit.length ? <text className="sd-small" x={empty.x} y={empty.y}>{words.empty}</text> : null}
    </>
  );
  const svg = (layout: Layout, w: number, h: number, children: ReactNode) => (
    <svg className={`sd-svg sd-${layout}`} data-technical={technical || undefined} focusable="false" key={layout} viewBox={`0 0 ${w} ${h}`}>
      <rect className="sd-ground" height="100%" width="100%" />
      {children}
    </svg>
  );
  const gateRect = (x: number, y: number, w: number, h: number) => <rect className="sd-gate" height={h} key={`gate-${latest?.n ?? 0}`} width={w} x={x} y={y} />;
  const tag = (flow: Flow) => (flow === "stop" ? words.stop : flow === "pass-bad" ? words.held : words.pass);

  return (
    <Variants
      className="sd-pay"
      render={(layout) => {
        if (layout === "wide") {
          const rows = deliveries.slice(-4);
          return svg("wide", 640, 262, <>
            <text className="sd-label" x="16" y="20">{words.source}</text>
            <text className="sd-label" textAnchor="middle" x="320" y="20">{words.gate}</text>
            <text className="sd-label" textAnchor="middle" x="462" y="20">{words.state}</text>
            <text className="sd-label" x="540" y="20">{words.book}</text>
            <path className="sd-rule" d="M16 30H624" />
            {!rows.length ? <text className="sd-hint" x="16" y="66">no events yet: send one from the provider</text> : null}
            {rows.map((entry, index) => {
              const flow = flowOf(entry);
              const isNew = entry.n === latest?.n;
              const y = 62 + index * 38;
              const end = flow === "stop" ? 278 : 300;
              return (
                <g className={`sd-row${isNew ? " sd-row-new" : ""}`} data-flow={flow} key={entry.n}>
                  <path className="sd-flow" d={`M152 ${y}H${end}`} />
                  {flow === "stop" ? <path className="sd-stop" d={`M${end + 7} ${y - 12}v24`} /> : <path className="sd-arrow" d={`m${end - 7} ${y - 5} 6 5-6 5`} />}
                  <g className="sd-event">
                    <rect height="26" width="136" x="16" y={y - 13} />
                    <text x="24" y={y + 4}>{eventLabel(entry, technical)}</text>
                  </g>
                  {technical && entry.http ? <text className="sd-event-seq" x="160" y={y - 4}>{entry.http}</text> : null}
                  {isNew ? <circle className="sd-packet" cx="152" cy={y} r="5" style={leg(end - 152, 0)} /> : null}
                </g>
              );
            })}
            {gateRect(300, 44, 40, 150)}
            <text className="sd-gate-text" textAnchor="middle" x="320" y="123">{inboxSize}</text>
            <text className="sd-small" textAnchor="middle" x="320" y="214">{seen(false)}</text>
            <path className="sd-flow sd-flow-out" d="M340 119H394" />
            <path className="sd-arrow sd-arrow-out" d="m388 114 6 5-6 5" />
            {latest && latest.outcome !== "PAYMENT_ON_HOLD" && latest.n === lastEntry?.n && flowOf(latest) !== "stop" ? <circle className="sd-packet sd-packet-out" cx="340" cy="119" key={`out-${latest.n}`} r="5" style={leg(54, 0, 440)} /> : null}
            {stateBox(400, 96, 124, 46)}
            {chip(payoutText, payoutOutcome, 400, 154, 224, 24)}
            {chip(reportText, reportOutcome, 400, 184, 224, 24)}
            {book((index) => ({ x: 540 + (index % 4) * 19, y: 44 + Math.floor(index / 4) * 19 }), { x: 540, y: 56 })}
            <Note joiner=" · " max={76} parts={note} step={18} x={16} y={248} />
          </>);
        }

        if (layout === "medium") {
          const rows = deliveries.slice(-2);
          return svg("medium", 320, 500, <>
            <text className="sd-label" x="16" y="20">{words.source}</text>
            <path className="sd-rule" d="M16 30H304" />
            {!rows.length ? <text className="sd-hint" x="16" y="62">no events yet</text> : null}
            {rows.map((entry, index) => {
              const flow = flowOf(entry);
              const isNew = entry.n === latest?.n;
              const x = 16 + index * 152;
              const cx = x + 68;
              const end = flow === "stop" ? 156 : 176;
              return (
                <g className={`sd-row${isNew ? " sd-row-new" : ""}`} data-flow={flow} key={entry.n}>
                  <path className="sd-flow" d={`M${cx} 70V${end}`} />
                  {flow === "stop" ? <path className="sd-stop" d={`M${cx - 13} ${end + 7}h26`} /> : <path className="sd-arrow" d={`m${cx - 5} ${end - 7} 5 6 5-6`} />}
                  <g className="sd-event">
                    <rect height="26" width="136" x={x} y="44" />
                    <text x={x + 8} y="61">{eventLabel(entry, technical)}</text>
                  </g>
                  {isNew ? <circle className="sd-packet" cx={cx} cy="70" r="5" style={leg(0, end - 70)} /> : null}
                </g>
              );
            })}
            {gateRect(16, 176, 288, 48)}
            <text className="sd-gate-text" textAnchor="middle" x="160" y="195">{words.gate} · {inboxSize}</text>
            <text className="sd-small" textAnchor="middle" x="160" y="214">{seen(false)}</text>
            <path className="sd-flow sd-flow-out" d="M160 224V251" />
            <path className="sd-arrow sd-arrow-out" d="m155 245 5 6 5-6" />
            {stateBox(90, 258, 140, 46)}
            {chip(payoutText, payoutOutcome, 50, 316, 220, 24)}
            {chip(reportText, reportOutcome, 50, 346, 220, 24)}
            <text className="sd-label" x="16" y="396">{words.book}</text>
            {book((index) => ({ x: 16 + index * 18, y: 406 }), { x: 16, y: 418 })}
            <Note joiner=" · " max={36} parts={note} step={18} x={16} y={452} />
          </>);
        }

        // Compact: the latest three events as a list; only the newest travels on to the inbox.
        const rows = deliveries.slice(-3);
        return svg("compact", 200, 444, <>
          <text className="sd-label" x="10" y="18">{words.source}</text>
          <path className="sd-rule" d="M10 26H190" />
          {!rows.length ? <text className="sd-hint" x="10" y="50">no events yet</text> : null}
          {rows.map((entry, index) => {
            const flow = flowOf(entry);
            const isNew = entry.n === latest?.n;
            const y = 34 + index * 30;
            const end = flow === "stop" ? 128 : 140;
            return (
              <g className={`sd-row${isNew ? " sd-row-new" : ""}`} data-flow={flow} key={entry.n}>
                {isNew ? <>
                  <path className="sd-flow" d={`M100 ${y + 24}V${end}`} />
                  {flow === "stop" ? <path className="sd-stop" d={`M87 ${end + 5}h26`} /> : <path className="sd-arrow" d={`m95 ${end - 6} 5 6 5-6`} />}
                </> : null}
                <g className="sd-event">
                  <rect height="24" width="180" x="10" y={y} />
                  <text x="17" y={y + 16}>{eventLabel(entry, technical)}</text>
                  <text className="sd-event-tag" textAnchor="end" x="183" y={y + 16}>{tag(flow)}</text>
                </g>
                {isNew ? <circle className="sd-packet" cx="100" cy={y + 24} r="5" style={leg(0, end - (y + 24))} /> : null}
              </g>
            );
          })}
          {gateRect(10, 140, 180, 46)}
          <text className="sd-gate-text" textAnchor="middle" x="100" y="159">{words.gate} · {inboxSize}</text>
          <text className="sd-small" textAnchor="middle" x="100" y="177">{seen(true)}</text>
          <path className="sd-flow sd-flow-out" d="M100 186V207" />
          <path className="sd-arrow sd-arrow-out" d="m95 201 5 6 5-6" />
          {stateBox(40, 210, 120, 40)}
          {chip(payoutText, payoutOutcome, 10, 258, 180, 24)}
          {chip(reportText, reportOutcome, 10, 288, 180, 24)}
          <text className="sd-label" x="10" y="334">{words.book}</text>
          {book((index) => ({ x: 10 + (index % 9) * 20, y: 342 + Math.floor(index / 9) * 20 }), { x: 10, y: 354 })}
          <Note joiner=" · " max={25} parts={note} step={16} x={10} y={404} />
        </>);
      }}
    />
  );
}

/* ------------------------------------------------------------------ Service */

/** The drawing's scale tops out at 2 s; the page's own limit is the 1 s line. */
const chartTopMs = 2000;
type AlertLamp = "paging" | "warning" | "pending" | "quiet";

function alertLamp(tick: Tick): { state: AlertLamp; plain: string; technical: string; compact: string } {
  const active = firing(tick);
  const top = active[0];
  if (top && alertSeverity[top.name] === "critical") return { state: "paging", plain: "alarm: engineers paged", technical: `${top.name}: page`, compact: "paged" };
  if (top) return { state: "warning", plain: "warning: engineers told", technical: `${top.name}: notify`, compact: "warning sent" };
  const waiting = tick.alerts.filter((alert) => alert.pendingFor > 0).sort((a, b) => (alertFor[a.name] - a.pendingFor) - (alertFor[b.name] - b.pendingFor))[0];
  if (waiting) {
    const left = (alertFor[waiting.name] - waiting.pendingFor) * CHECK_INTERVAL_S;
    const wait = left >= 60 ? `${Math.round(left / 60)} min` : `${left} s`;
    return { state: "pending", plain: `waiting ${wait} before a warning`, technical: `${waiting.name}: in ${wait}`, compact: `alert in ${wait}` };
  }
  return { state: "quiet", plain: "no alert", technical: "no alert pending", compact: "no alert" };
}

function serviceNote(tick: Tick, technical: boolean): string {
  const down = tick.views.filter((view) => view.state === "down");
  const unknown = tick.views.filter((view) => view.state === "unknown");
  if (tick.verdict === "unknown") return technical ? "no fresh region: unknown" : "no fresh checks:|can't tell";
  if (tick.verdict === "down") return technical ? `down in ${down.length} of ${tick.views.length}` : "down in|both regions";
  if (tick.verdict === "slow") return technical ? "up, but slow|(majority)" : "working,|but slow";
  if (down.length) return technical ? `up · ${down[0].region} failing (minority)` : `up · fails in|${down[0].region} only`;
  if (unknown.length) return technical ? `up · ${unknown[0].region} unknown` : `up · ${unknown[0].region}|has gone quiet`;
  return technical ? "up and quick" : "working and quick";
}

export function ServiceDiagram({ technical, ticks, window: slots }: { technical: boolean; ticks: Tick[]; window: number }) {
  const id = useId().replace(/:/g, "");
  const now = ticks.at(-1)!;
  const lamp = alertLamp(now);
  const note = serviceNote(now, technical);
  const padded = Array.from({ length: slots }, (_, index) => ticks[index - (slots - ticks.length)] ?? null);
  const words = technical
    ? { title: "check time per region", top: "2 s", mid: `${DEGRADED_AFTER_MS / 1000} s`, line: "degraded_after", verdict: "verdict" }
    : { title: "how long each check takes", top: "2 s", mid: "1 s", line: "too slow", verdict: "verdict" };
  const regionText = (view: RegionView) => {
    if (view.state === "unknown") return technical ? `${view.region} unknown${view.stale ? " (stale)" : " (pending)"}` : `${view.region}: no fresh result`;
    if (view.state === "down") return technical ? `${view.region} down · ${view.reason}` : `${view.region}: down (${view.reason === "http_5xx" ? "error 503" : "wrong content"})`;
    return technical ? `${view.region} up${view.slow ? " · slow" : ""} · ${view.latencyMs} ms` : `${view.region}: up${view.slow ? ", slow" : ""} · ${((view.latencyMs ?? 0) / 1000).toFixed(2)} s`;
  };

  return (
    <Variants
      className="sd-svc"
      render={(layout) => {
        const g = layout === "wide"
          ? { w: 640, h: 300, margin: 16, x0: 56, x1: 624, top: 44, bottom: 176, regions: 202, verdict: 248, pager: 262, note: 290, max: 76, step: 18 }
          : layout === "medium"
            ? { w: 320, h: 316, margin: 16, x0: 52, x1: 304, top: 44, bottom: 166, regions: 192, verdict: 238, pager: 252, note: 292, max: 36, step: 18 }
            : { w: 200, h: 312, margin: 10, x0: 44, x1: 190, top: 38, bottom: 140, regions: 164, verdict: 210, pager: 222, note: 268, max: 25, step: 16 };
        const slot = (g.x1 - g.x0) / slots;
        const x = (index: number) => g.x0 + (index + .5) * slot;
        const y = (ms: number) => g.bottom - (Math.min(ms, chartTopMs) / chartTopMs) * (g.bottom - g.top);
        const trace = (region: Region) => {
          const runs: string[] = [];
          let run: string[] = [];
          padded.forEach((tick, index) => {
            const result = tick?.results.find((item) => item.region === region);
            if (result?.up) run.push(`${x(index)},${y(result.latencyMs)}`);
            else { if (run.length) runs.push(run.join(" ")); run = []; }
          });
          if (run.length) runs.push(run.join(" "));
          return runs;
        };
        return (
          <svg className={`sd-svg sd-${layout}`} focusable="false" key={layout} viewBox={`0 0 ${g.w} ${g.h}`}>
            <defs>
              <pattern height="8" id={`${id}-${layout}-hatch`} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width="8">
                <rect className="sd-hatch-ground" height="8" width="8" />
                <path className="sd-hatch-line" d="M0 0V8" />
              </pattern>
              <clipPath id={`${id}-${layout}-plot`}><rect height={g.bottom - g.top + 8} width={g.x1 - g.x0} x={g.x0} y={g.top - 4} /></clipPath>
            </defs>
            <rect className="sd-ground" height="100%" width="100%" />
            <text className="sd-label" x={g.margin} y={layout === "compact" ? 18 : 20}>{layout === "compact" ? "check time" : words.title}</text>
            <text className="sd-clock" textAnchor="end" x={g.x1} y={layout === "compact" ? 18 : 20}>{clockOf(now.n)}</text>
            <path className="sd-rule" d={`M${g.margin} ${layout === "compact" ? 26 : 30}H${g.x1}`} />
            <text className="sd-axis" textAnchor="end" x={g.x0 - 6} y={g.top + 4}>{words.top}</text>
            <text className="sd-axis" textAnchor="end" x={g.x0 - 6} y={y(DEGRADED_AFTER_MS) + 4}>{words.mid}</text>
            <text className="sd-axis" textAnchor="end" x={g.x0 - 6} y={g.bottom + 4}>0</text>
            <path className="sd-baseline-axis" d={`M${g.x0} ${g.top}V${g.bottom}H${g.x1}`} />

            <g clipPath={`url(#${id}-${layout}-plot)`}>
              <g className="sd-scroll" key={now.n} style={{ "--slot": `${slot}px` } as CSSProperties}>
                {padded.map((tick, index) => (tick && !tick.results.some((result) => result.region === "lab-b")
                  ? <rect className="svc-gap sd-gap" fill={`url(#${id}-${layout}-hatch)`} height={g.bottom - g.top} key={`gap-${tick.n}`} width={slot} x={x(index) - slot / 2} y={g.top} />
                  : null))}
                {trace("lab-b").map((points) => <polyline className="sd-ghost" key={`b-${points}`} points={points} />)}
                {trace("lab-a").map((points) => <polyline className="sd-trace" key={`a-${points}`} points={points} />)}
                {padded.flatMap((tick, index) => (tick ? tick.results.map((result) => (result.up
                  ? <rect className="sd-point" data-over={result.slow || undefined} data-region={result.region} height="8" key={`${tick.n}-${result.region}`} width="8" x={x(index) - 4} y={y(result.latencyMs) - 4} />
                  : <path className="sd-fail" d={`M${x(index) - 4} ${g.bottom - 12}l8 8m0 -8l-8 8`} key={`${tick.n}-${result.region}`} />)) : []))}
              </g>
            </g>
            <path className="sd-threshold" d={`M${g.x0} ${y(DEGRADED_AFTER_MS)}H${g.x1}`} />
            <text className="sd-threshold-label" textAnchor="end" x={g.x1 - 4} y={y(DEGRADED_AFTER_MS) - 6}>{words.line}</text>

            {now.views.map((view, index) => (
              <g className="sd-region" data-state={view.state} data-slow={view.slow || undefined} key={view.region}>
                <path className={view.region === "lab-a" ? "sd-legend-measured" : "sd-legend-actual"} d={`M${g.margin} ${g.regions + index * 18 - 4}h14`} />
                <text x={g.margin + 20} y={g.regions + index * 18}>{layout === "compact" ? `${view.region} ${view.state === "unknown" ? "?" : view.state === "down" ? "down" : view.slow ? "slow" : "up"}` : regionText(view)}</text>
              </g>
            ))}
            <text className="sd-label" x={g.margin} y={g.verdict - 4}>{words.verdict}: <tspan className="sd-verdict" data-verdict={now.verdict}>{technical ? now.verdict : now.headline}</tspan></text>
            <g className="sd-pager" data-state={lamp.state === "paging" ? "paging" : lamp.state === "warning" ? "warning" : lamp.state === "pending" ? "pending" : "quiet"}>
              <rect height="11" width="11" x={g.margin} y={g.pager} />
              <text x={g.margin + 18} y={g.pager + 10}>{layout === "compact" ? lamp.compact : technical ? lamp.technical : lamp.plain}</text>
            </g>
            <Note joiner=" " max={g.max} parts={[{ text: note }]} step={g.step} x={g.margin} y={g.note} />
          </svg>
        );
      }}
    />
  );
}

/* ------------------------------------------------------------- Device trust */

/** A check's short name in the drawing, in both voices. */
const checkName: Record<string, { plain: string; technical: string }> = {
  root_su_path: { plain: "su file", technical: "su path" },
  root_package: { plain: "root app", technical: "root package" },
  test_keys: { plain: "test build", technical: "test-keys" },
  system_partition_writable: { plain: "system writable", technical: "rw /system" },
  emulator_fingerprint: { plain: "emulator", technical: "emulator build" },
  debugger_connected: { plain: "debugger on", technical: "debugger" },
  app_debuggable: { plain: "debug build", technical: "debuggable" },
  installer_source_unknown: { plain: "unknown installer", technical: "installer ?" },
};
const answerWord: Record<"plain" | "technical", Record<GateDecision, string>> = {
  plain: { ALLOW: "send", "REQUIRE CONFIRMATION": "confirm first", BLOCK: "blocked" },
  technical: { ALLOW: "ALLOW", "REQUIRE CONFIRMATION": "CONFIRM", BLOCK: "BLOCK" },
};
const signingWord: Record<"plain" | "technical", Record<Signing, string>> = {
  plain: { "DEVICE KEY": "signed and sent", "STEP-UP KEY": "screen lock signs it", "SIGNED TAP": "a tap confirms it", "NOTHING SIGNED": "nothing signed" },
  technical: { "DEVICE KEY": "device key", "STEP-UP KEY": "step-up key", "SIGNED TAP": "signed tap", "NOTHING SIGNED": "no challenge" },
};
const answerTone = { ALLOW: "confirmed", "REQUIRE CONFIRMATION": "uncertain", BLOCK: "adverse" } as const;
const levelTone = { LOW: "confirmed", MEDIUM: "uncertain", HIGH: "adverse" } as const;
/** The scoring walk: the first found check lights after `toRulesMs`, then one per `ruleStepMs`; the answer lands after the last. */
export const ruleStepMs = 280;
export const toRulesMs = 320;
/** When the level and the answer land, for a run with `found` checks lit. */
export const answerDelayMs = (found: number) => toRulesMs + found * ruleStepMs;
/** The points track shows ten points; a higher total reads as "+N" past its end. */
const trackPoints = 10;

function deviceNote(run: DeviceAssessment, technical: boolean): Segment[] {
  const voice = technical ? "technical" : "plain";
  const before = run.reason.kind === "severe"
    ? (technical ? `${run.reason.checks.length} high-severity` : `${checkName[run.reason.checks[0]].plain} found`)
    : technical ? `score ${run.score} → ${run.level}` : `${run.score} ${run.score === 1 ? "point" : "points"}`;
  return [{ text: before }, { text: signingWord[voice][run.signing], bad: run.signing === "NOTHING SIGNED" }];
}

export function DeviceDiagram({ requestKey, run, technical }: { requestKey: string; run: DeviceAssessment; technical: boolean }) {
  const voice = technical ? "technical" : "plain";
  const note = deviceNote(run, technical);
  const lit = new Map(run.found.map((check, index) => [check.id, toRulesMs + index * ruleStepMs]));
  // Each point of the track is filled when the check that brings it lights, in that check's tone.
  const cells = run.found.flatMap((check) => Array.from({ length: check.points }, () => ({ d: lit.get(check.id)!, tone: check.severity === "HIGH" ? "adverse" : "uncertain" })));
  const answerAt = answerDelayMs(run.found.length);
  const levelText = technical
    ? `${run.level} · score ${run.score}`
    : `${run.level.toLowerCase()} risk · ${run.score} ${run.score === 1 ? "point" : "points"}`;
  const words = technical
    ? { checks: "signals", points: "score", risk: "level", answer: "server", confirm: "confirm", block: "block" }
    : { checks: "the phone's checks", points: "points", risk: "risk", answer: "the server's answer", confirm: "confirm", block: "block" };

  return (
    <Variants
      className="sd-dev"
      render={(layout) => {
        const wide = layout === "wide";
        const compact = layout === "compact";
        const width = wide ? 640 : compact ? 200 : 320;
        const margin = compact ? 10 : 16;
        const row = (index: number) => (wide ? { x: 16, y: 40 + index * 24, w: 256, h: 20 } : { x: margin, y: (compact ? 34 : 36) + index * 24, w: width - margin * 2, h: 20 });
        const lastRow = row(run.checks.length - 1);
        const cell = compact ? 16 : wide ? 28 : 26;
        const track = wide ? { x: 296, y: 46 } : { x: margin, y: lastRow.y + lastRow.h + 32 };
        const markX = (points: number) => track.x + points * cell;
        const markLabelY = track.y + 22 + 18;
        const level = wide ? { x: 296, y: 124, w: 328, h: 40 } : { x: margin, y: markLabelY + (compact ? 40 : 28), w: width - margin * 2, h: 36 };
        const answer = wide ? { x: 296, y: 190, w: 328, h: 44 } : { x: margin, y: level.y + level.h + 30, w: width - margin * 2, h: compact ? 40 : 44 };
        const noteY = wide ? 262 : answer.y + answer.h + 32;
        const height = wide ? 280 : noteY + 40;
        const extra = run.score - trackPoints;
        return (
          <svg className={`sd-svg sd-${layout}`} data-technical={technical || undefined} focusable="false" key={layout} viewBox={`0 0 ${width} ${height}`}>
            <rect className="sd-ground" height="100%" width="100%" />
            <text className="sd-label" x={margin} y="20">{words.checks}</text>
            {wide ? <>
              <text className="sd-label" x={track.x} y="20">{words.points}</text>
              <text className="sd-label" x={level.x} y={level.y - 8}>{words.risk}</text>
              <text className="sd-label" x={answer.x} y={answer.y - 8}>{words.answer}</text>
            </> : <>
              <text className="sd-label" x={margin} y={track.y - 8}>{words.points}</text>
              <text className="sd-label" x={margin} y={level.y - 8}>{words.risk}</text>
              <text className="sd-label" x={margin} y={answer.y - 8}>{words.answer}</text>
            </>}
            <path className="sd-rule" d={`M${margin} ${compact ? 26 : 30}H${width - margin}`} />

            <g className="sd-walk" key={requestKey}>
              {run.checks.map((check, index) => {
                const box = row(index);
                const found = lit.get(check.id);
                return (
                  <g className="sd-check" data-found={found !== undefined || undefined} data-tone={check.severity === "HIGH" ? "adverse" : "uncertain"} key={check.id} style={found !== undefined ? ({ "--d": `${found}ms` } as CSSProperties) : undefined}>
                    <rect height={box.h} width={box.w} x={box.x} y={box.y} />
                    <text x={box.x + 7} y={box.y + 14}>{found !== undefined ? `+${check.points}` : "·"} {checkName[check.id][voice]}</text>
                    {compact ? null : <text className="sd-check-status" textAnchor="end" x={box.x + box.w - 7} y={box.y + 14}>{found !== undefined ? (technical ? check.severity : "found") : "–"}</text>}
                  </g>
                );
              })}

              {Array.from({ length: trackPoints }, (_, index) => (
                <g className="sd-cell" data-tone={cells[index]?.tone} key={index} style={cells[index] ? ({ "--d": `${cells[index].d}ms` } as CSSProperties) : undefined}>
                  <rect height="22" width={cell} x={track.x + index * cell} y={track.y} />
                </g>
              ))}
              {extra > 0 ? <text className="sd-cell-more" x={track.x + trackPoints * cell + 4} y={track.y + 16}>+{extra}</text> : null}

              <g className="sd-decision" data-tone={levelTone[run.level]} style={{ "--d": `${answerAt}ms` } as CSSProperties}>
                <rect height={level.h} width={level.w} x={level.x} y={level.y} />
                <text textAnchor="middle" x={level.x + level.w / 2} y={level.y + level.h / 2 + 5}>{levelText}</text>
              </g>
              <path className="sd-flow sd-flow-out" d={`M${answer.x + answer.w - 24} ${level.y + level.h}V${answer.y}`} style={{ "--d": `${answerAt}ms` } as CSSProperties} />
              <g className="sd-decision" data-tone={answerTone[run.decision]} style={{ "--d": `${answerAt + ruleStepMs}ms` } as CSSProperties}>
                <rect height={answer.h} width={answer.w} x={answer.x} y={answer.y} />
                <text textAnchor="middle" x={answer.x + answer.w / 2} y={answer.y + answer.h / 2 + 5}>{answerWord[voice][run.decision]}</text>
              </g>
            </g>

            {[[MEDIUM_SCORE_THRESHOLD, words.confirm], [HIGH_SCORE_THRESHOLD, words.block]].map(([points, label], index) => (
              <g className="sd-mark" key={label}>
                <path d={`M${markX(Number(points))} ${track.y - 6}V${track.y + 28}`} />
                <text textAnchor={compact ? "start" : "middle"} x={compact ? markX(Number(points)) + 3 : markX(Number(points))} y={markLabelY + (compact ? index * 16 : 0)}>{points} {label}</text>
              </g>
            ))}

            <Note carry joiner=" → " joinerClass="sd-note-arrow" max={wide ? 76 : compact ? 25 : 36} parts={note} step={compact ? 16 : 18} x={margin} y={noteY} />
          </svg>
        );
      }}
    />
  );
}
