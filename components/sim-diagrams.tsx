"use client";

import { Fragment, useId, type CSSProperties, type ReactNode } from "react";
import { latencyThresholdMs } from "../lib/instruments";
import { MEDIUM_SCORE_THRESHOLD, HIGH_SCORE_THRESHOLD, type DeviceAssessment, type GateDecision, type Signing } from "../lib/device-risk";
import type { ProjectionMode } from "../lib/scenarios";
import { BUZZ_AFTER_LANDING } from "../lib/sound/engine";
import { paymentStateWord, type LiveSample, type PayEntry, type PayWorld } from "../lib/simulators";

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
const flowOf = (entry: PayEntry): Flow => (entry.outcome === "duplicate" || entry.outcome === "stale" ? "stop" : entry.outcome === "applied" ? "pass" : "pass-bad");

/** A message as the bank would say it: “paid”, “paid” again, late “pending”. */
function messageLabel(entry: PayEntry) {
  const says = `“${entry.message?.says}”`;
  if (entry.outcome === "duplicate" || entry.outcome === "applied-again") return `${says} again`;
  if (entry.outcome === "stale" || entry.outcome === "regressed") return `late ${says}`;
  return says;
}

function paymentNote(world: PayWorld, technical: boolean): Segment[] {
  const parts: Segment[] = technical
    ? [{ text: plural(world.deliveries, "delivery", "deliveries") }, { text: plural(world.updates, "state change", "state changes") }]
    : [{ text: plural(world.deliveries, "message", "messages") }, { text: `payment changed ${plural(world.updates, "time", "times")}` }];
  const bad = world.repeats ? (technical ? "ran twice" : "handled twice!") : world.state === "REVIEW" ? (technical ? "needs review" : "needs checking") : "";
  return bad ? [...parts, { text: bad, bad: true }] : parts;
}

export function PaymentDiagram({ checked, technical, world }: { checked: boolean; technical: boolean; world: PayWorld }) {
  const deliveries = world.entries.filter((entry) => entry.message);
  const latest = deliveries.at(-1);
  const settlement = [...world.entries].reverse().find((entry) => entry.outcome === "matched" || entry.outcome === "mismatched");
  const note = paymentNote(world, technical);
  const audit = world.audit.slice(-16);
  const lastAudit = audit.at(-1)?.n;
  const says = new Map(deliveries.map((entry) => [entry.message!.id, entry.message!.says]));
  const remembered = world.processed.map((id) => `“${says.get(id)}”`);
  const seen = (compact: boolean) => technical
    ? (world.processed.length ? `seen ${world.processed.join(" ")}` : "seen –")
    : !checked ? (compact ? "lets all messages in" : "lets every message through")
      : !remembered.length ? (compact ? "remembers nothing" : "remembers nothing yet")
        : compact && remembered.length > 1 ? `remembers ${remembered.length} messages` : `remembers ${remembered.join(" ")}`;
  const settleText = settlement
    ? (settlement.outcome === "matched" ? (technical ? "settled ✓" : "report matches ✓") : (technical ? "mismatch" : "report differs"))
    : (technical ? "not settled" : "no report yet");
  const words = technical
    ? { source: "provider", gate: "id check", state: "state", book: "audit", online: "online", offline: "offline", empty: "no records", pass: "applied", stop: "ignored" }
    : { source: "bank", gate: "repeat check", state: "payment", book: "record book", online: "available", offline: "unavailable", empty: "nothing yet", pass: "let in", stop: "stopped" };
  const stateText = technical ? world.state : paymentStateWord[world.state];

  // The parts every composition shares, placed by it.
  // The payment answers what just reached it: a knock when a message lands on it, a jolt (in time
  // with the buzz) when one is handled twice or overwrites newer news.
  const lastOutcome = world.entries.at(-1)?.outcome;
  const hit = lastOutcome === "applied" ? "land" : lastOutcome === "applied-again" || lastOutcome === "regressed" ? "bad" : undefined;
  const hitDelay = messageTravelMs + (hit === "bad" ? BUZZ_AFTER_LANDING * 1000 : 0);
  const stateBox = (x: number, y: number, w: number, h: number) => (
    <>
      <g className="sd-state" data-hit={hit} data-state={world.state.toLowerCase()} key={`state-${world.state}-${world.updates}`} style={{ "--hit-delay": `${hitDelay}ms` } as CSSProperties}>
        <rect height={h} width={w} x={x} y={y} />
        <text textAnchor="middle" x={x + w / 2} y={y + h / 2 + 5}>{stateText}</text>
      </g>
      {world.repeats ? (
        <g className="sd-badge" key={`badge-${world.repeats}`}>
          <rect height="18" width="32" x={x + w - 20} y={y - 10} />
          <text textAnchor="middle" x={x + w - 4} y={y + 3}>×{world.repeats + 1}</text>
        </g>
      ) : null}
    </>
  );
  const settleChip = (x: number, y: number, w: number, h: number) => (
    <g className="sd-settle" data-outcome={settlement?.outcome ?? "none"}>
      <rect height={h} width={w} x={x} y={y} />
      <text textAnchor="middle" x={x + w / 2} y={y + h / 2 + 4}>{settleText}</text>
    </g>
  );
  const book = (place: (index: number) => { x: number; y: number }, empty: { x: number; y: number }, store: { x: number; y: number }) => (
    <>
      {audit.map((record, index) => {
        const at = place(index);
        return <rect className={`sd-record${record.n === lastAudit ? " sd-record-new" : ""}`} data-status={record.status} height="14" key={record.n} width="14" x={at.x} y={at.y} />;
      })}
      {!audit.length ? <text className="sd-small" x={empty.x} y={empty.y}>{words.empty}</text> : null}
      <g className="sd-store" data-online={world.storeOnline ? "true" : "false"}>
        <rect height="10" width="10" x={store.x} y={store.y} />
        <text x={store.x + 16} y={store.y + 9}>{world.storeOnline ? words.online : words.offline}</text>
      </g>
    </>
  );
  const svg = (layout: Layout, w: number, h: number, children: ReactNode) => (
    <svg className={`sd-svg sd-${layout}`} data-check={checked ? "on" : "off"} data-technical={technical || undefined} focusable="false" key={layout} viewBox={`0 0 ${w} ${h}`}>
      <rect className="sd-ground" height="100%" width="100%" />
      {children}
    </svg>
  );
  const gateRect = (x: number, y: number, w: number, h: number) => <rect className="sd-gate" data-check={checked ? "on" : "off"} height={h} key={`gate-${latest?.n ?? 0}`} width={w} x={x} y={y} />;

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
            {!rows.length ? <text className="sd-hint" x="16" y="66">no messages yet: send one from the bank</text> : null}
            {rows.map((entry, index) => {
              const flow = flowOf(entry);
              const isNew = entry.n === latest?.n;
              const y = 62 + index * 38;
              const end = flow === "stop" ? 278 : 300;
              return (
                <g className={`sd-row${isNew ? " sd-row-new" : ""}`} data-flow={flow} key={entry.n}>
                  <path className="sd-flow" d={`M134 ${y}H${end}`} />
                  {flow === "stop" ? <path className="sd-stop" d={`M${end + 7} ${y - 12}v24`} /> : <path className="sd-arrow" d={`m${end - 7} ${y - 5} 6 5-6 5`} />}
                  <g className="sd-event">
                    <rect height="26" width="118" x="16" y={y - 13} />
                    <text x="24" y={y + 4}>{technical ? entry.message!.id : messageLabel(entry)}</text>
                    {technical ? <text className="sd-event-seq" textAnchor="end" x="127" y={y + 4}>s{entry.message!.seq}</text> : null}
                  </g>
                  {isNew ? <circle className="sd-packet" cx="134" cy={y} r="5" style={leg(end - 134, 0)} /> : null}
                </g>
              );
            })}
            {gateRect(300, 44, 40, 150)}
            <text className="sd-gate-text" textAnchor="middle" x="320" y="123">{checked ? "on" : "off"}</text>
            <text className="sd-small" textAnchor="middle" x="320" y="214">{seen(false)}</text>
            <path className="sd-flow sd-flow-out" d="M340 119H394" />
            <path className="sd-arrow sd-arrow-out" d="m388 114 6 5-6 5" />
            {latest?.passed ? <circle className="sd-packet sd-packet-out" cx="340" cy="119" key={`out-${latest.n}`} r="5" style={leg(54, 0, 440)} /> : null}
            {stateBox(400, 96, 124, 46)}
            {settleChip(400, 154, 124, 26)}
            <path className="sd-flow sd-flow-faint" d="M524 119H536" />
            {book((index) => ({ x: 540 + (index % 4) * 19, y: 44 + Math.floor(index / 4) * 19 }), { x: 540, y: 56 }, { x: 540, y: 134 })}
            <Note joiner=" · " max={76} parts={note} step={18} x={16} y={248} />
          </>);
        }

        if (layout === "medium") {
          const rows = deliveries.slice(-2);
          return svg("medium", 320, 498, <>
            <text className="sd-label" x="16" y="20">{words.source}</text>
            <path className="sd-rule" d="M16 30H304" />
            {!rows.length ? <text className="sd-hint" x="16" y="62">no messages yet</text> : null}
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
                    <text x={x + 8} y="61">{technical ? entry.message!.id : messageLabel(entry)}</text>
                    {technical ? <text className="sd-event-seq" textAnchor="end" x={x + 128} y="61">s{entry.message!.seq}</text> : null}
                  </g>
                  {isNew ? <circle className="sd-packet" cx={cx} cy="70" r="5" style={leg(0, end - 70)} /> : null}
                </g>
              );
            })}
            {gateRect(16, 176, 288, 48)}
            <text className="sd-gate-text" textAnchor="middle" x="160" y="195">{words.gate} · {checked ? "on" : "off"}</text>
            <text className="sd-small" textAnchor="middle" x="160" y="214">{seen(false)}</text>
            <path className="sd-flow sd-flow-out" d="M160 224V251" />
            <path className="sd-arrow sd-arrow-out" d="m155 245 5 6 5-6" />
            {latest?.passed ? <circle className="sd-packet sd-packet-out" cx="160" cy="224" key={`out-${latest.n}`} r="5" style={leg(0, 27, 440)} /> : null}
            {stateBox(90, 258, 140, 46)}
            {settleChip(90, 316, 140, 26)}
            <text className="sd-label" x="16" y="372">{words.book}</text>
            {book((index) => ({ x: 16 + index * 18, y: 382 }), { x: 16, y: 394 }, { x: 16, y: 410 })}
            <Note joiner=" · " max={36} parts={note} step={18} x={16} y={448} />
          </>);
        }

        // Compact: the latest three messages as a list; only the newest travels on to the check.
        const rows = deliveries.slice(-3);
        return svg("compact", 200, 434, <>
          <text className="sd-label" x="10" y="18">{words.source}</text>
          <path className="sd-rule" d="M10 26H190" />
          {!rows.length ? <text className="sd-hint" x="10" y="50">no messages yet</text> : null}
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
                  <text x="17" y={y + 16}>{technical ? `${entry.message!.id} s${entry.message!.seq}` : messageLabel(entry)}</text>
                  <text className="sd-event-tag" textAnchor="end" x="183" y={y + 16}>{flow === "stop" ? words.stop : words.pass}</text>
                </g>
                {isNew ? <circle className="sd-packet" cx="100" cy={y + 24} r="5" style={leg(0, end - (y + 24))} /> : null}
              </g>
            );
          })}
          {gateRect(10, 140, 180, 46)}
          <text className="sd-gate-text" textAnchor="middle" x="100" y="159">{words.gate} · {checked ? "on" : "off"}</text>
          <text className="sd-small" textAnchor="middle" x="100" y="177">{seen(true)}</text>
          <path className="sd-flow sd-flow-out" d="M100 186V207" />
          <path className="sd-arrow sd-arrow-out" d="m95 201 5 6 5-6" />
          {latest?.passed ? <circle className="sd-packet sd-packet-out" cx="100" cy="186" key={`out-${latest.n}`} r="5" style={leg(0, 21, 440)} /> : null}
          {stateBox(40, 210, 120, 40)}
          {settleChip(10, 258, 180, 24)}
          <text className="sd-label" x="10" y="304">{words.book}</text>
          {book((index) => ({ x: 10 + (index % 9) * 20, y: 312 + Math.floor(index / 9) * 20 }), { x: 10, y: 324 }, { x: 10, y: 354 })}
          <Note joiner=" · " max={25} parts={note} step={16} x={10} y={390} />
        </>);
      }}
    />
  );
}

/* ------------------------------------------------------------------ Service */

type Sample = LiveSample & { mode: ProjectionMode };
type PagerState = "paging" | "nodata" | "silent" | "off" | "quiet";

const pagerWords: Record<"plain" | "technical", Record<PagerState, string>> = {
  plain: { paging: "alarm: ringing", nodata: "alarm: can't tell", silent: "alarm: not set up", off: "alarm: not watching speed", quiet: "alarm: quiet" },
  technical: { paging: "pager: paging", nodata: "pager: no data", silent: "pager: silent", off: "pager: not watching latency", quiet: "pager: quiet" },
};
/** Shorter words where the compact drawing has no room for the long ones. */
const pagerOffCompact = { plain: "alarm: ignores speed", technical: "pager: no latency rule" };

const pagerFor = (title: string, mode: ProjectionMode): PagerState =>
  title === "Paging on-call" || title === "Outage" ? "paging"
    : title === "Investigate collection" ? "nodata"
      : title === "Breach, nobody paged" ? "silent"
        : mode === "baseline" ? "off"
          : "quiet";

function serviceNote(title: string, over: boolean, technical: boolean) {
  if (technical) {
    return title === "Outage" ? "down" : title === "Paging on-call" ? "up,|but slower" : title === "Investigate collection" ? "up,|but blind"
      : title === "Breach, nobody paged" ? "slower,|nobody told" : title === "Looks fine" && over ? "up, but slower,|and unseen" : "up and quick";
  }
  return title === "Outage" ? "the site is down" : title === "Paging on-call" ? "working,|but slower" : title === "Investigate collection" ? "working,|but unmeasured"
    : title === "Breach, nobody paged" ? "slower,|and nobody told" : title === "Looks fine" && over ? "slower,|and nobody noticed" : "working and quick";
}

export function ServiceDiagram({ samples, statusTitle, technical, window: slots }: { samples: Sample[]; statusTitle: string; technical: boolean; window: number }) {
  const id = useId().replace(/:/g, "");
  const now = samples.at(-1)!;
  const pager = pagerFor(statusTitle, now.mode);
  const note = serviceNote(statusTitle, now.actualLatency > latencyThresholdMs, technical);
  const padded = Array.from({ length: slots }, (_, index) => samples[index - (slots - samples.length)] ?? null);
  const voice = technical ? "technical" : "plain";
  const words = technical
    ? { title: "p95 latency", top: "1000", mid: String(latencyThresholdMs), line: "threshold", health: "health", pass: "PASS", fail: "FAIL", measured: "observed", actual: "actual", blind: { wide: "latency not collected here", medium: "latency not collected", compact: "p95 not collected" } }
    : { title: "page load time", top: "1 s", mid: `${latencyThresholdMs / 1000} s`, line: "too slow", health: "site answers", pass: "YES", fail: "NO", measured: "measured", actual: "actual wait", blind: { wide: "this dashboard doesn't measure speed", medium: "speed not measured here", compact: "speed not measured" } };

  return (
    <Variants
      className="sd-svc"
      render={(layout) => {
        const g = layout === "wide"
          ? { w: 640, h: 296, margin: 16, x0: 56, x1: 624, top: 44, bottom: 200, health: 230, pager: 250, legend: { x: 400, y: 260, rows: false }, note: 284, max: 76, step: 18 }
          : layout === "medium"
            ? { w: 320, h: 300, margin: 16, x0: 52, x1: 304, top: 44, bottom: 176, health: 202, pager: 216, legend: { x: 16, y: 250, rows: false }, note: 276, max: 36, step: 18 }
            : { w: 200, h: 290, margin: 10, x0: 44, x1: 190, top: 38, bottom: 148, health: 172, pager: 186, legend: { x: 10, y: 218, rows: true }, note: 262, max: 25, step: 16 };
        const slot = (g.x1 - g.x0) / slots;
        const x = (index: number) => g.x0 + (index + .5) * slot;
        const y = (ms: number) => g.bottom - (Math.min(ms, 1000) / 1000) * (g.bottom - g.top);
        const ghost = padded.flatMap((sample, index) => (sample ? [`${x(index)},${y(sample.actualLatency)}`] : [])).join(" ");
        const runs: string[] = [];
        let run: string[] = [];
        padded.forEach((sample, index) => {
          if (sample?.observedLatency != null) run.push(`${x(index)},${y(sample.observedLatency)}`);
          else { if (run.length) runs.push(run.join(" ")); run = []; }
        });
        if (run.length) runs.push(run.join(" "));
        let breach = -1;
        padded.forEach((sample, index) => {
          const previous = padded[index - 1];
          if (sample?.observedLatency != null && sample.observedLatency > latencyThresholdMs && !(previous?.observedLatency != null && previous.observedLatency > latencyThresholdMs)) breach = index;
        });
        const healthStart = g.margin + words.health.length * 7.7 + 8;
        const blind = words.blind[layout];
        const blindX = layout === "compact" ? g.x0 : g.x0 + 8;
        const pagerText = layout === "compact" && pager === "off" ? pagerOffCompact[voice] : pagerWords[voice][pager];
        const actual = g.legend.rows ? { x: g.legend.x, y: g.legend.y + 18 } : { x: g.legend.x + 104, y: g.legend.y };
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
            <text className="sd-label" x={g.margin} y={layout === "compact" ? 18 : 20}>{words.title}</text>
            <text className="sd-clock" textAnchor="end" x={g.x1} y={layout === "compact" ? 18 : 20}>{now.time}</text>
            <path className="sd-rule" d={`M${g.margin} ${layout === "compact" ? 26 : 30}H${g.x1}`} />
            <text className="sd-axis" textAnchor="end" x={g.x0 - 6} y={g.top + 4}>{words.top}</text>
            <text className="sd-axis" textAnchor="end" x={g.x0 - 6} y={y(latencyThresholdMs) + 4}>{words.mid}</text>
            <text className="sd-axis" textAnchor="end" x={g.x0 - 6} y={g.bottom + 4}>0</text>
            <path className="sd-baseline-axis" d={`M${g.x0} ${g.top}V${g.bottom}H${g.x1}`} />

            <g clipPath={`url(#${id}-${layout}-plot)`}>
              <g className="sd-scroll" key={now.minute} style={{ "--slot": `${slot}px` } as CSSProperties}>
                {padded.map((sample, index) => (sample && sample.mode === "designed" && !sample.collected
                  ? <rect className="svc-gap sd-gap" fill={`url(#${id}-${layout}-hatch)`} height={g.bottom - g.top} key={sample.minute} width={slot} x={x(index) - slot / 2} y={g.top} />
                  : null))}
                <polyline className="sd-ghost" points={ghost} />
                {runs.map((points) => <polyline className="sd-trace" key={points} points={points} />)}
                {padded.map((sample, index) => (sample?.observedLatency != null ? (
                  <rect className="sd-point" data-over={sample.observedLatency > latencyThresholdMs || undefined} height="8" key={sample.minute} width="8" x={x(index) - 4} y={y(sample.observedLatency) - 4} />
                ) : null))}
                {breach >= 0 && padded[breach]?.observedLatency != null ? (
                  <circle className="sd-breach" cx={x(breach)} cy={y(padded[breach]!.observedLatency!)} data-firing={pager === "paging" || undefined} r="7" />
                ) : null}
              </g>
            </g>
            <path className="sd-threshold" d={`M${g.x0} ${y(latencyThresholdMs)}H${g.x1}`} />
            <text className="sd-threshold-label" textAnchor="end" x={g.x1 - 4} y={y(latencyThresholdMs) + 16}>{words.line}</text>
            {now.mode === "baseline" ? (
              <g className="sd-overlay">
                <rect height="24" width={Math.round(blind.length * 7.2 + 16)} x={blindX} y={g.top + 8} />
                <text x={blindX + 8} y={g.top + 24}>{blind}</text>
              </g>
            ) : null}

            <text className="sd-label" x={g.margin} y={g.health + 4}>{words.health}</text>
            <path className="sd-health" d={`M${healthStart} ${g.health}H${g.x1 - (layout === "compact" ? 40 : 50)}`} data-state={now.health} />
            <text className="sd-health-text" data-state={now.health} textAnchor="end" x={g.x1} y={g.health + 4}>{now.health === "pass" ? words.pass : words.fail}</text>

            <g className="sd-pager" data-state={pager}>
              <rect height="11" width="11" x={g.margin} y={g.pager} />
              <text x={g.margin + 18} y={g.pager + 10}>{pagerText}</text>
            </g>
            <g className="sd-legend">
              <path className="sd-legend-measured" d={`M${g.legend.x} ${g.legend.y - 4}h18`} />
              <text x={g.legend.x + 24} y={g.legend.y}>{words.measured}</text>
              <path className="sd-legend-actual" d={`M${actual.x} ${actual.y - 4}h18`} />
              <text x={actual.x + 24} y={actual.y}>{words.actual}</text>
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
