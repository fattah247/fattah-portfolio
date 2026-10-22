"use client";

import { Fragment, useId, type CSSProperties, type ReactNode } from "react";
import { MEDIUM_SCORE_THRESHOLD, HIGH_SCORE_THRESHOLD, type DeviceAssessment, type GateDecision, type Signing } from "../lib/device-risk";
import { alertFor, alertSeverity, CHECK_INTERVAL_S, clockOf, DEGRADED_AFTER_MS, firing, type Region, type RegionView, type Tick } from "../lib/uptime";

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

function Variants({ className, render }: { className: string; render: (layout: Layout) => ReactNode }) {
  return <div aria-hidden="true" className={`sd ${className}`}>{layouts.map((layout) => render(layout))}</div>;
}

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
              <g>
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
/**
 * The scoring walk: the first found check lights after `to`, then one per `step`; the answer lands
 * after the last. It teaches at its full pace the first time and whenever the visitor sends the
 * payment again; a check toggled after that answers quickly, the checks still lighting in order.
 */
export type WalkTempo = "teach" | "quick";
export const walkPace: Record<WalkTempo, { to: number; step: number }> = { teach: { to: 320, step: 280 }, quick: { to: 40, step: 50 } };
export const ruleStepMs = walkPace.teach.step;
export const toRulesMs = walkPace.teach.to;
/** When the level and the answer land, for a run with `found` checks lit. */
export const answerDelayMs = (found: number, tempo: WalkTempo = "teach") => walkPace[tempo].to + found * walkPace[tempo].step;
/** The points track shows ten points; a higher total reads as "+N" past its end. */
const trackPoints = 10;

function deviceNote(run: DeviceAssessment, technical: boolean): Segment[] {
  const voice = technical ? "technical" : "plain";
  const before = run.reason.kind === "severe"
    ? (technical ? `${run.reason.checks.length} high-severity` : `${checkName[run.reason.checks[0]].plain} found`)
    : technical ? `score ${run.score} → ${run.level}` : `${run.score} ${run.score === 1 ? "point" : "points"}`;
  return [{ text: before }, { text: signingWord[voice][run.signing], bad: run.signing === "NOTHING SIGNED" }];
}

export function DeviceDiagram({ requestKey, run, technical, tempo = "teach" }: { requestKey: string; run: DeviceAssessment; technical: boolean; tempo?: WalkTempo }) {
  const voice = technical ? "technical" : "plain";
  const note = deviceNote(run, technical);
  const pace = walkPace[tempo];
  const lit = new Map(run.found.map((check, index) => [check.id, pace.to + index * pace.step]));
  // Each point of the track is filled when the check that brings it lights, in that check's tone.
  const cells = run.found.flatMap((check) => Array.from({ length: check.points }, () => ({ d: lit.get(check.id)!, tone: check.severity === "HIGH" ? "adverse" : "uncertain" })));
  const answerAt = answerDelayMs(run.found.length, tempo);
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
              <g className="sd-decision" data-tone={answerTone[run.decision]} style={{ "--d": `${answerAt + pace.step}ms` } as CSSProperties}>
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
