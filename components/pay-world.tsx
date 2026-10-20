"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PlayIcon, ResetIcon, StartOverIcon } from "./icons";
import { PixelObject, PixelSprite, type PixelObjectName } from "./pixel-objects";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { PAYMENT_AMOUNT, PAYOUT_NET, paymentStory, statusWord, type FlowEntry, type FlowOutcome } from "../lib/payment-flow";
import {
  actSteps,
  actions as actionsFor,
  cashierLine,
  customerLine,
  emptyWorld,
  isNew,
  nudge,
  payflowLine,
  stampFor,
  storyActions,
  storyIndex,
  withoutInbox,
  worldStories,
  type Action,
  type Actor,
  type World,
} from "../lib/pay-world";

/* ------------------------------------------------------------------ The map */

/**
 * The world's own units: 30 tiles of 16 by 12.5 tiles, left to right from the shop to the bank,
 * with a band of sky on top where the goal is written and the bubbles have room.
 */
const W = 480;
const H = 200;
type Box = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

const place = {
  customerStart: { x: 4, y: 132, w: 32, h: 48 },
  customer: { x: 58, y: 128, w: 32, h: 48 },
  machine: { x: 106, y: 116, w: 16, h: 16 },
  cashier: { x: 138, y: 124, w: 32, h: 48 },
  antenna: { x: 160, y: 42, w: 20, h: 20 },
  server: { x: 272, y: 76, w: 48, h: 64 },
  operator: { x: 324, y: 128, w: 32, h: 48 },
  bank: { x: 400, y: 72, w: 64, h: 64 },
} satisfies Record<string, Box>;

/** The receipts' line: the card machine, up to the shop's antenna, across to the server. */
const receiptLine: Point[] = [{ x: 114, y: 116 }, { x: 114, y: 86 }, { x: 170, y: 86 }, { x: 170, y: 50 }, { x: 296, y: 50 }, { x: 296, y: 76 }];
/** The money's line: from the server to the bank, and the bank's settlement back. */
const bankLine: Point[] = [{ x: 320, y: 104 }, { x: 400, y: 104 }];
const centre = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

type Speaker = Exclude<Actor, "tech">;
/** Where each one's bubble hangs: above their head, or beside the antenna, and which way it grows. */
const bubbleAt: Record<Speaker, { at: Point; side: "top" | "right" | "left"; align: "center" | "start" | "end" }> = {
  customer: { at: { x: 74, y: 124 }, side: "top", align: "start" },
  cashier: { at: { x: 154, y: 120 }, side: "top", align: "center" },
  signal: { at: { x: 182, y: 52 }, side: "right", align: "start" },
  server: { at: { x: 296, y: 72 }, side: "top", align: "center" },
  operator: { at: { x: 340, y: 124 }, side: "top", align: "center" },
  bank: { at: { x: 398, y: 100 }, side: "left", align: "center" },
};

/** The beats of one step, in ms: it crosses, Payflow looks, the stamp comes down, then it settles. */
export const beats = { receipt: 900, money: 640, near: 160, look: 160, stamp: 220, settle: 380 } as const;
const storyStepMs = 3200;

/** Every outcome has its sound, so a tap and the played story sound alike. */
export const worldCue: Record<FlowOutcome, CueId> = {
  APPLIED: "pay.let-in",
  DUPLICATE_IGNORED: "pay.stopped",
  STALE_IGNORED: "pay.stopped",
  PAYMENT_ON_HOLD: "pay.stopped",
  SENT_TO_REVIEW: "pay.report-differs",
  RELEASED: "pay.check-on",
  BATCH_CREATED: "pay.book-back",
  NOTHING_TO_SETTLE: "pay.stopped",
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

const cueFor = (entry: FlowEntry, world: World) => (entry.outcome === "LANDED" && world.flow.status === "RECONCILED" ? "pay.report-matches" : worldCue[entry.outcome]);
const amount = (value: number) => value.toLocaleString("en-US");

/* ----------------------------------------------------------------- Movement */

type Frame = Point & { at: number; scale?: number; opacity?: number };
/** Something crossing the world for one action: what it is, what it says, and its path in world units at moments (ms). */
type Move = { key: string; object: PixelObjectName; size: number; tag?: string; frames: Frame[] };

/** Positions along a polyline at a constant pace, from one moment to another. */
function along(points: Point[], from: number, to: number): Frame[] {
  const lengths = points.slice(1).map((spot, index) => Math.hypot(spot.x - points[index].x, spot.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  let walked = 0;
  return points.map((spot, index) => {
    if (index > 0) walked += lengths[index - 1];
    return { ...spot, at: from + ((to - from) * walked) / total };
  });
}

/** Plays a move with the Web Animations API, in steps, scaled from world units to pixels. */
function MoveSprite({ move, scale }: { move: Move; scale: number }) {
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element || typeof element.animate !== "function") return;
    const end = move.frames.at(-1)!.at;
    element.animate(
      move.frames.map((frame, index) => {
        const next = move.frames[index + 1];
        const travels = next && (next.x !== frame.x || next.y !== frame.y || (next.scale ?? 1) !== (frame.scale ?? 1));
        return {
          offset: end ? frame.at / end : 0,
          opacity: frame.opacity ?? 1,
          transform: `translate(${frame.x * scale}px, ${frame.y * scale}px) translate(-50%, -50%) scale(${frame.scale ?? 1})`,
          easing: travels ? `steps(${Math.max(3, Math.round((next.at - frame.at) / 60))}, end)` : "linear",
        };
      }),
      { duration: end, fill: "forwards" },
    );
  }, [move, scale]);
  const first = move.frames[0];
  return (
    <div aria-hidden="true" className="pw-move" ref={ref} style={{ inlineSize: move.size * scale, transform: `translate(${first.x * scale}px, ${first.y * scale}px) translate(-50%, -50%)`, opacity: first.opacity ?? 1 }}>
      <PixelSprite name={move.object} />
      {move.tag ? <span className="pw-move-tag">{move.tag}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------- World */

type Choreo = { moves: Move[]; beats: Array<{ at: number; world: World }>; poses: Array<{ at: number; pose: "tap" | "idle" }>; emotes: Array<{ at: number; actor: Actor; text: string }>; focus: Array<{ at: number; x: number }>; end: number; walk: boolean };

const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const conditionsKey = (conditions: Record<string, string>) => JSON.stringify(Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Lays out one action as it plays: who moves, what crosses which line carrying what, when each
 * stamp comes down and when the world's readings change. Each step of the action (closing the day
 * is the payout and then the provider's report) plays after the one before it.
 */
function choreograph(before: World, action: Action, steps: World[]): Choreo {
  const as = action.as ?? action.id;
  const choreo: Choreo = { moves: [], beats: [], poses: [], emotes: [], focus: [], end: 0, walk: false };
  let t = 0;
  let previous = before;
  steps.forEach((world, index) => {
    const entry = world.flow.entries.at(-1);
    if (!entry || entry === previous.flow.entries.at(-1)) { previous = world; return; }
    const input = entry.input;
    const key = `${entry.n}`;
    const look = beats.look + beats.stamp + beats.settle;
    if (input.kind === "webhook") {
      // In the shop: the customer pays (walking up the first time), or the cashier taps the machine.
      if (as === "pay" && index === 0) {
        choreo.walk = true;
        choreo.focus.push({ at: t, x: 110 });
        t += 700;
        choreo.moves.push({ key: `${key}-card`, object: "note", size: 18, frames: [{ ...centre(place.customer), at: 0, opacity: 0 }, { ...centre(place.customer), at: t }, { ...centre(place.machine), at: t + 300, scale: 0.6 }, { ...centre(place.machine), at: t + 340, scale: 0.6, opacity: 0 }] });
        t += 340;
      } else if (as !== "late") {
        choreo.focus.push({ at: t, x: 150 });
        choreo.poses.push({ at: t, pose: "tap" }, { at: t + 180, pose: "idle" }, { at: t + 300, pose: "tap" }, { at: t + 480, pose: "idle" });
        if (as === "again") choreo.emotes.push({ at: t, actor: "cashier", text: "!" });
        t += 480;
      } else {
        choreo.emotes.push({ at: t, actor: "signal", text: "…" });
        choreo.focus.push({ at: t, x: 210 });
        t += 300;
      }
      // The receipt goes along its line to Payflow's server, saying what it reports.
      const path = as === "late" ? receiptLine.slice(3) : receiptLine;
      const travel = as === "late" ? beats.receipt + 400 : beats.receipt;
      const arrive = t + travel;
      const back = (entry.outcome === "DUPLICATE_IGNORED" && input.webhook === "again") || entry.outcome === "PAYMENT_ON_HOLD";
      const stampAt = arrive + beats.look;
      const leave = arrive + look;
      const tag = entry.event?.status === "AUTHORIZED" ? "old: authorized" : `paid ${amount(entry.event?.amount ?? PAYMENT_AMOUNT)}`;
      choreo.moves.push({
        key: `${key}-receipt`, object: "receipt", size: 20, tag, frames: [
          ...along(path, t, arrive),
          { ...path.at(-1)!, at: stampAt + beats.stamp },
          back ? { ...path[path.length - 2], at: leave, opacity: 0 } : { ...centre(place.server), at: leave, scale: 0.5, opacity: 0 },
        ],
      });
      choreo.focus.push({ at: t + travel / 2, x: 296 });
      choreo.beats.push({ at: stampAt, world });
      t = leave;
    } else if (input.kind === "report") {
      // The card company's daily report comes in on the receipts' line.
      const path = receiptLine.slice(3);
      const arrive = t + beats.receipt;
      choreo.moves.push({ key: `${key}-report`, object: "report", size: 20, tag: "daily report", frames: [...along(path, t, arrive), { ...path.at(-1)!, at: arrive + beats.look + beats.stamp }, { ...centre(place.server), at: arrive + look, scale: 0.5, opacity: 0 }] });
      choreo.focus.push({ at: t, x: 296 });
      choreo.beats.push({ at: arrive + beats.look, world });
      t = arrive + look;
    } else if (input.kind === "settle") {
      // At closing the money goes from the server to the bank, or stays when it's held.
      const arrive = t + beats.money;
      const refused = entry.outcome === "NOTHING_TO_SETTLE";
      choreo.focus.push({ at: t, x: 360 });
      choreo.moves.push({ key: `${key}-money`, object: "money-bag", size: 22, tag: amount(PAYOUT_NET), frames: [...along(bankLine, t, arrive), { ...bankLine.at(-1)!, at: arrive + beats.look + beats.stamp }, refused ? { ...bankLine[0], at: arrive + look, opacity: 0 } : { ...centre(place.bank), at: arrive + look, scale: 0.5, opacity: 0 }] });
      choreo.beats.push({ at: arrive + beats.look, world });
      t = arrive + look;
    } else if (input.kind === "statement") {
      // The bank's settlement comes back to the server, and once reconciled, on to the cashier.
      choreo.focus.push({ at: t, x: 400 });
      const back = [...bankLine].reverse();
      const arrive = t + beats.money;
      const missing = entry.outcome === "MISSING_CREDIT";
      const unmatched = entry.outcome === "UNMATCHED_CREDIT";
      choreo.moves.push({ key: `${key}-slip`, object: missing ? "cross" : unmatched ? "suspense" : "slip", size: 20, tag: missing ? "never arrived" : unmatched ? "no reference" : `${amount(PAYOUT_NET)} arrived`, frames: [...along(back, t, arrive), { ...back.at(-1)!, at: arrive + beats.look + beats.stamp }, { ...centre(place.server), at: arrive + look, scale: 0.5, opacity: 0 }] });
      choreo.beats.push({ at: arrive + beats.look, world });
      t = arrive + look;
      if (world.flow.status === "RECONCILED" || missing) {
        const home = [...receiptLine].reverse();
        const reach = t + beats.receipt;
        choreo.focus.push({ at: t, x: 210 });
        choreo.moves.push({ key: `${key}-settled`, object: missing ? "cross" : "slip", size: 20, tag: missing ? "never arrived" : "settled", frames: [...along(home, t, reach), { ...home.at(-1)!, at: reach + 300, opacity: 0 }] });
        choreo.emotes.push({ at: reach, actor: "cashier", text: missing ? "?" : "!" });
        t = reach + 300;
      }
    } else {
      // A release, or a rule changed, happens at the server where it is.
      choreo.focus.push({ at: t, x: 310 });
      if (input.kind === "release") choreo.emotes.push({ at: t, actor: "operator", text: "!" });
      choreo.beats.push({ at: t + beats.near, world });
      t += beats.near + beats.stamp + beats.settle;
    }
    previous = world;
  });
  choreo.end = t + 40;
  return choreo;
}

type PayWorldProps = {
  conditions: Record<string, string>;
  isDefault: boolean;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  technical: boolean;
  /** The "Technical details" key, kept with the toy's own actions. */
  technicalKey?: ReactNode;
};

type Bubble = { actor: Speaker; say?: string; aside?: string; hint?: string; choices?: Action[]; tone?: string };

/**
 * Case 01's toy: a small world from a shop to a bank. The visitor taps who acts (the customer, the
 * cashier, the signal, Payflow's server, the person checking holds); everyone talks in bubbles in
 * the world, and the bank answers by the choices in its bubble.
 */
export function PayWorld({ conditions, isDefault, onChange, onReset, technical, technicalKey }: PayWorldProps) {
  const [world, setWorld] = useState<World>(emptyWorld);
  const [shown, setShown] = useState<World>(emptyWorld);
  const [used, setUsed] = useState<string[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [busy, setBusy] = useState(false);
  const [pose, setPose] = useState<"idle" | "tap">("idle");
  const [emote, setEmote] = useState<{ actor: Actor; text: string; key: number } | null>(null);
  const [walking, setWalking] = useState(false);
  const [said, setSaid] = useState<{ text: string; key: number } | null>(null);
  const [choosing, setChoosing] = useState<Actor | null>(null);
  const [watching, setWatching] = useState<{ step: number; total: number } | null>(null);
  const [watched, setWatched] = useState(false);
  const [frame, setFrame] = useState({ width: 0, scale: 2 });
  const [focusX, setFocusX] = useState(110);
  const view = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const storyTimers = useRef<number[]>([]);
  const taps = useRef(0);
  const lines = useRef(0);
  const pending = useRef<{ action: Action; before: World } | null>(null);
  const { play } = useSound();

  const available = actionsFor(world, used, technical);
  const hint = watching || busy ? null : nudge(world, used, technical);
  const hintActor = available.find((action) => action.id === hint?.action)?.actor;

  useEffect(() => () => [...timers.current, ...storyTimers.current].forEach(window.clearTimeout), []);

  // The world fits its box when it can; a phone shows part of it, and the view follows the action.
  useLayoutEffect(() => {
    const element = view.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      if (width) setFrame({ width, scale: Math.max(width / W, 1.4) });
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  // When the case's conditions change from outside (Reset, a link), the story on offer starts again.
  const signature = conditionsKey(conditions);
  const [seenSignature, setSeenSignature] = useState(signature);
  const [ownSignature, setOwnSignature] = useState<string | null>(null);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    if (signature !== ownSignature) setWatched(false);
  }

  const stopWatching = () => { storyTimers.current.forEach(window.clearTimeout); storyTimers.current = []; setWatching(null); };
  const clearBeats = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };

  /** One action: the rules answer at once; the world plays it on its beats. */
  const run = (action: Action) => {
    pending.current = { action, before: world };
    setChoosing(null);
    setWorld(actSteps(world, action).at(-1) ?? world);
    if (!action.id.startsWith("story-")) setUsed((current) => (current.includes(action.id) ? current : [...current, action.id]));
  };

  useLayoutEffect(() => {
    const press = pending.current;
    if (!press) return;
    pending.current = null;
    clearBeats();
    const steps = actSteps(press.before, press.action);
    const last = steps.at(-1) ?? world;
    const as = press.action.as ?? press.action.id;
    if (as === "again") taps.current += 1;
    const line = cashierLine(last, as, taps.current);
    const settles = press.action.inputs.some((input) => input.kind === "statement");
    const speak = () => { lines.current += 1; setSaid(line ? { text: line, key: lines.current } : null); };
    if (reducedMotion() || !root.current) {
      for (const step of steps) { const entry = step.flow.entries.at(-1); if (entry) play(cueFor(entry, step)); }
      speak();
      setShown(last);
      setMoves([]);
      setBusy(false);
      return;
    }
    // The cashier speaks as they act; their word on the settlement waits until it reaches them.
    if (!settles) speak();
    else setSaid(null);
    const choreo = choreograph(press.before, press.action, steps);
    setMoves(choreo.moves);
    setBusy(true);
    setWalking(choreo.walk);
    const later = (at: number, effect: () => void) => timers.current.push(window.setTimeout(effect, at));
    for (const beat of choreo.beats) {
      const entry = beat.world.flow.entries.at(-1);
      if (entry) play(cueFor(entry, beat.world), Math.max(0, beat.at / 1000 - LANDING));
      later(beat.at, () => setShown(beat.world));
    }
    for (const step of choreo.poses) later(step.at, () => setPose(step.pose));
    for (const step of choreo.emotes) later(step.at, () => setEmote({ actor: step.actor, text: step.text, key: step.at }));
    for (const step of choreo.focus) later(step.at, () => setFocusX(step.x));
    later(choreo.end, () => { setMoves([]); setBusy(false); setWalking(false); setEmote(null); setShown(last); if (settles) speak(); });
  }, [world, play]);

  /* Tapping someone in the world: one thing to do does it; several open as choices in their bubble. */
  const tap = (actor: Actor) => {
    const theirs = available.filter((action) => action.actor === actor);
    if (!theirs.length || busy) return;
    stopWatching();
    if (theirs.length === 1 && actor !== "bank") run(theirs[0]);
    else setChoosing(actor);
  };
  const choose = (action: Action) => { stopWatching(); run(action); };

  /* Watching: the case's story, one action every 3.2 s, through the same world. */
  const watchIndex = Math.max(0, storyIndex(conditions));
  const reset = (to: World) => { clearBeats(); setWorld(to); setShown(to); setMoves([]); setBusy(false); setSaid(null); setChoosing(null); setPose("idle"); setEmote(null); setFocusX(110); taps.current = 0; };
  const watch = (index: number) => {
    stopWatching();
    const story = worldStories[index];
    setOwnSignature(conditionsKey({ ...conditions, ...story.conditions }));
    for (const [key, value] of Object.entries(story.conditions)) if (conditions[key] !== value) onChange(key, value);
    const steps = storyActions(paymentStory({ ...conditions, ...story.conditions }));
    reset(emptyWorld);
    setWatched(false);
    play("pay.start-over");
    if (reducedMotion()) {
      const end = steps.reduce((current, action) => actSteps(current, action).at(-1) ?? current, emptyWorld);
      setWorld(end);
      setShown(end);
      setWatched(true);
      return;
    }
    setWatching({ step: 0, total: steps.length });
    let current = emptyWorld;
    steps.forEach((action, step) => {
      storyTimers.current.push(window.setTimeout(() => {
        pending.current = { action, before: current };
        current = actSteps(current, action).at(-1) ?? current;
        setWorld(current);
        if (step + 1 === steps.length) { setWatching(null); setWatched(true); }
        else setWatching({ step: step + 1, total: steps.length });
      }, step * storyStepMs + 300));
    });
  };
  const startOver = () => { stopWatching(); reset(emptyWorld); setWatched(false); play("pay.start-over"); };

  /* What the world shows, on its beats. */
  const { flow } = shown;
  const latestEntry = shown.flow.entries.at(-1);
  const serverEntry = [...shown.flow.entries].reverse().find((entry) => entry.input.kind !== "settle");
  const bankEntry = [...shown.flow.entries].reverse().find((entry) => entry.input.kind === "settle" || entry.input.kind === "statement");
  const serverStamp = serverEntry ? stampFor(serverEntry) : null;
  const bankStamp = bankEntry && (bankEntry.input.kind === "settle" || bankEntry.outcome !== "LANDED") ? stampFor(bankEntry) : null;
  const atCounter = world.flow.lastEvent !== null || walking;
  const held = flow.status === "MANUAL_REVIEW";
  const inBank = flow.payout === "LANDED";
  const label = (action: Action) => (technical ? action.technical : action.label);

  const { width, scale } = frame;
  const worldWidth = W * scale;
  const camera = worldWidth > width + 1 ? Math.min(0, Math.max(width - worldWidth, width / 2 - focusX * scale)) : 0;
  const at = (box: Box): CSSProperties => ({ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale });
  const point = (spot: Point): CSSProperties => ({ left: spot.x * scale, top: spot.y * scale });

  /* The bubbles: Payflow says what it did; the cashier speaks as they act; whoever's next invites a tap. */
  const bubbles = new Map<Speaker, Bubble>();
  const add = (bubble: Bubble) => bubbles.set(bubble.actor, { ...bubbles.get(bubble.actor), ...bubble });
  add({ actor: "server", say: technical && latestEntry ? stampFor(latestEntry).technical : payflowLine(shown), aside: busy ? undefined : withoutInbox(shown) || undefined, tone: serverStamp?.tone });
  if (said) add({ actor: "cashier", say: said.text });
  const choosers = choosing ? available.filter((action) => action.actor === choosing) : available.filter((action) => action.actor === "bank");
  const asking = !busy && choosers.length ? (choosing ?? "bank") : null;
  if (asking && asking !== "tech") add({ actor: asking, hint: asking === "bank" ? (hint?.action.startsWith("bank") ? hint.text : "Did the 747,750 arrive?") : "What do I do?", choices: choosers });
  if (hint && hintActor && hintActor !== "tech" && hintActor !== asking) add({ actor: hintActor, hint: hint.text });
  if (watching) add({ actor: "server", hint: `Watching: step ${watching.step + 1} of ${watching.total}` });

  // Once the world is still, a phone's view turns to whoever is up next.
  const nextUp: Speaker | null = asking && asking !== "tech" ? asking : hintActor && hintActor !== "tech" ? hintActor : null;
  const [seenNextUp, setSeenNextUp] = useState<Speaker | null>(null);
  if (!busy && nextUp !== seenNextUp) {
    setSeenNextUp(nextUp);
    if (nextUp) setFocusX(nextUp === "bank" ? 380 : nextUp === "signal" ? 200 : bubbleAt[nextUp].at.x);
  }

  const hotspot = (actor: Actor, box: Box, name: string, sprite: ReactNode, extra?: ReactNode) => {
    const theirs = available.filter((action) => action.actor === actor);
    const can = theirs.length > 0 && !busy && actor !== "bank";
    return (
      <button aria-label={can ? `${name}: ${theirs.map(label).join(" or ")}` : name} className="pw-actor" data-actor={actor} data-can={can || undefined} data-new={theirs.some((action) => isNew(action, used)) || undefined} data-nudged={hintActor === actor || undefined} disabled={!can} key={actor} onClick={() => tap(actor)} style={at(box)} type="button">
        {sprite}
        {extra}
      </button>
    );
  };

  return (
    <div className="pay-world" data-busy={busy || undefined} data-technical={technical || undefined} ref={root}>
      <div className="pw-view" ref={view} style={{ height: H * scale }}>
        <div className="pw-world" style={{ width: worldWidth, height: H * scale, transform: `translateX(${camera}px)` }}>
          <svg aria-hidden="true" className="pw-ground" preserveAspectRatio="none" shapeRendering="crispEdges" viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <pattern height="32" id="pw-floor" patternUnits="userSpaceOnUse" width="32"><rect fill="#f7f8f9" height="32" width="32" /><rect fill="#e9edf1" height="16" width="16" /><rect fill="#e9edf1" height="16" width="16" x="16" y="16" /></pattern>
              <pattern height="32" id="pw-grass" patternUnits="userSpaceOnUse" width="32"><rect fill="#cfe3df" height="32" width="32" /><rect fill="#bcd8d2" height="16" width="16" /><rect fill="#bcd8d2" height="16" width="16" x="16" y="16" /></pattern>
              <pattern height="32" id="pw-tiles" patternUnits="userSpaceOnUse" width="32"><rect fill="#dbe4f3" height="32" width="32" /><rect fill="#c8d8f0" height="16" width="16" /><rect fill="#c8d8f0" height="16" width="16" x="16" y="16" /></pattern>
              <pattern height="32" id="pw-stone" patternUnits="userSpaceOnUse" width="32"><rect fill="#e3e7ec" height="32" width="32" /><rect fill="#d3d9e1" height="16" width="16" /><rect fill="#d3d9e1" height="16" width="16" x="16" y="16" /></pattern>
            </defs>
            <rect fill="#ffffff" height="40" width={W} />
            {/* The shop: a wall with its window, a checked floor, the counter. */}
            <rect fill="#e3e7ec" height="56" width="184" y="40" />
            <rect fill="#b8c1cd" height="4" width="184" y="92" />
            <rect fill="#ffffff" height="26" stroke="#252b34" width="44" x="24" y="54" />
            <rect fill="#c8d8f0" height="10" width="18" x="28" y="58" />
            <rect fill="#c8d8f0" height="10" width="18" x="48" y="58" />
            <rect fill="url(#pw-floor)" height="104" width="184" y="96" />
            <rect fill="#d3d9e1" height="8" stroke="#252b34" width="36" x="96" y="132" />
            <rect fill="#8ea5cb" height="36" stroke="#252b34" width="36" x="96" y="140" />
            <rect fill="#6e88b6" height="4" width="34" x="97" y="171" />
            {/* Outside, then Payflow's server room, outside again, and the bank's square. */}
            <rect fill="#ffffff" height="56" width="72" x="184" y="40" />
            <rect fill="url(#pw-grass)" height="104" width="72" x="184" y="96" />
            <rect fill="#dbe4f3" height="56" width="96" x="256" y="40" />
            <rect fill="#8ea5cb" height="4" width="96" x="256" y="92" />
            <rect fill="url(#pw-tiles)" height="104" width="96" x="256" y="96" />
            <rect fill="#ffffff" height="56" width="40" x="352" y="40" />
            <rect fill="url(#pw-grass)" height="104" width="40" x="352" y="96" />
            <rect fill="#ffffff" height="56" width="88" x="392" y="40" />
            <rect fill="url(#pw-stone)" height="104" width="88" x="392" y="96" />
            {/* The two lines: receipts from the shop to the server; the money between the server and the bank. */}
            <polyline className="pw-line" data-line="receipts" fill="none" points={receiptLine.map((spot) => `${spot.x},${spot.y}`).join(" ")} />
            <polyline className="pw-line" data-line="bank" fill="none" points={bankLine.map((spot) => `${spot.x},${spot.y}`).join(" ")} />
          </svg>

          <p className="pw-goal" style={point({ x: 6, y: 6 })}><b>Goal:</b> the customer pays {amount(PAYMENT_AMOUNT)} once, and it reaches the shop&rsquo;s bank.</p>
          <span className="pw-sign" style={point({ x: 6, y: 42 })}>The shop</span>
          <span className="pw-tag" style={point({ x: 214, y: 51 })}>{technical ? "provider webhooks" : "receipts"}</span>
          <span className="pw-tag" style={point({ x: 330, y: 107 })}>{technical ? "payout · camt.053" : "money"}</span>

          <span className="pw-prop" style={at(place.machine)}><PixelSprite name="card-machine" /></span>
          {hotspot("customer", atCounter ? place.customer : place.customerStart, "The customer", <PixelSprite key={walking ? "walking" : "still"} name={walking ? "customer-walk-b" : "customer-walk-a"} />, walking ? <WalkFrom from={place.customerStart} scale={scale} to={place.customer} /> : null)}
          {hotspot("cashier", place.cashier, "The cashier", <PixelSprite name={pose === "tap" ? "cashier-tap" : "cashier"} />)}
          {hotspot("signal", place.antenna, "The signal", <PixelSprite className="pw-antenna" key={emote?.actor === "signal" ? emote.key : 0} name="antenna" />)}
          {hotspot("server", place.server, "Payflow's server", <PixelSprite name="server" />)}
          {hotspot("operator", place.operator, "The person at Payflow", <PixelSprite name="operator" />)}
          {hotspot("bank", place.bank, "The bank", <PixelSprite name="bank" />)}

          <p className="pw-label" data-label="customer" style={point({ x: centre(place.customer).x, y: place.customer.y + place.customer.h + 2 })}><b>{customerLine(shown)}</b></p>
          <p className="pw-label" data-label="server" style={point({ x: centre(place.server).x, y: place.server.y + place.server.h + 2 })}><b>Payflow: {technical ? flow.status : statusWord[flow.status]}</b><small>{technical ? `inbox: ${Object.keys(flow.inbox).join(", ") || "empty"}` : `${Object.keys(flow.inbox).length} receipt${Object.keys(flow.inbox).length === 1 ? "" : "s"} kept`}</small></p>
          <p className="pw-label" data-label="bank" style={point({ x: centre(place.bank).x, y: place.bank.y + place.bank.h + 2 })}><b>Bank: {inBank ? `${amount(PAYOUT_NET)} IDR` : flow.payout === "IN_TRANSIT" ? "on its way" : flow.payout === "BROKEN" ? "never arrived" : "nothing yet"}</b>{technical ? <small>payout {flow.payout}</small> : null}</p>
          {held ? <p className="pw-label pw-label-held" data-label="operator" style={point({ x: centre(place.operator).x, y: place.operator.y + place.operator.h + 2 })}><b>On hold</b></p> : null}

          {serverStamp && serverEntry ? <span className="pw-stamp" data-hit={serverStamp.tone === "adverse" ? "bad" : "land"} data-place="server" data-tone={serverStamp.tone} key={`s${serverEntry.n}`} style={point({ x: 296, y: 118 })}>{technical ? serverStamp.technical : serverStamp.word}</span> : null}
          {bankStamp && bankEntry ? <span className="pw-stamp" data-hit={bankStamp.tone === "adverse" ? "bad" : "land"} data-place="bank" data-tone={bankStamp.tone} key={`b${bankEntry.n}`} style={point({ x: 432, y: 116 })}>{technical ? bankStamp.technical : bankStamp.word}</span> : null}
          {emote ? <span className="pw-emote" key={emote.key} style={point(emote.actor === "signal" ? { x: centre(place.antenna).x, y: place.antenna.y - 2 } : { x: centre(place[emote.actor === "operator" ? "operator" : "cashier"]).x + 14, y: place[emote.actor === "operator" ? "operator" : "cashier"].y + 4 })}>{emote.text}</span> : null}

          {moves.map((move) => <MoveSprite key={move.key} move={move} scale={scale} />)}

          {[...bubbles.values()].map((bubble) => {
            const spot = bubble.actor === "customer" && !atCounter ? { ...bubbleAt.customer, at: { x: 20, y: 128 } } : bubbleAt[bubble.actor];
            const tappable = !!bubble.hint && !bubble.choices && bubble.actor === hintActor;
            const content = (
              <>
                {bubble.say ? <span className="pw-bubble-say" data-tone={bubble.tone}>{bubble.say}</span> : null}
                {bubble.aside ? <span className="pw-bubble-aside">{bubble.aside}</span> : null}
                {bubble.hint ? <span className="pw-bubble-hint">{bubble.hint}</span> : null}
              </>
            );
            if (tappable) {
              return <button className="pw-bubble" data-actor={bubble.actor} data-align={spot.align} data-hint data-side={spot.side} key={bubble.actor} onClick={() => tap(bubble.actor)} style={point(spot.at)} type="button">{content}<PixelObject className="pw-bubble-hand" name="hand-left" size={32} /></button>;
            }
            return (
              <div aria-live={bubble.actor === "server" ? "polite" : undefined} className="pw-bubble" data-actor={bubble.actor} data-align={spot.align} data-hint={bubble.hint ? true : undefined} data-side={spot.side} key={bubble.actor} style={point(spot.at)}>
                {content}
                {bubble.choices ? (
                  <span aria-label={`${bubble.actor === "bank" ? "The bank" : "The cashier"}: what happens?`} className="pw-bubble-choices" role="group">
                    {bubble.choices.map((action) => (
                      <button className="pw-choice" data-nudged={hint?.action === action.id || undefined} key={action.id} onClick={() => choose(action)} type="button">
                        {label(action)}{hint?.action === action.id ? <PixelObject className="pw-choice-hand" name="hand-left" size={32} /> : null}
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {technical && available.some((action) => action.actor === "tech") && !busy ? (
        <div className="pw-tech" role="group" aria-label="Technical actions">
          {available.filter((action) => action.actor === "tech").map((action) => <button className="pw-choice" key={action.id} onClick={() => choose(action)} type="button">{action.technical}</button>)}
        </div>
      ) : null}

      <div className="pw-actions">
        {watching
          ? <button className="sim-secondary" onClick={stopWatching} type="button"><PlayIcon paused />Stop</button>
          : <button className="sim-secondary" onClick={() => watch(watched ? (watchIndex + 1) % worldStories.length : watchIndex)} type="button"><PlayIcon />{watched ? `Watch next: ${worldStories[(watchIndex + 1) % worldStories.length].label.toLowerCase()}` : `Watch it${world.flow.entries.length ? " from the start" : ""}: ${worldStories[watchIndex].label.toLowerCase()}`}</button>}
        <button className="sim-secondary" data-nudged={hint?.action === "" || undefined} disabled={!world.flow.entries.length && !watching} onClick={startOver} type="button"><StartOverIcon />Start over</button>
        {!isDefault && onReset ? <button className="sim-secondary" onClick={onReset} type="button"><ResetIcon />Reset</button> : null}
        {technicalKey}
      </div>

      {technical ? (
        <ol aria-label="What happened, newest first" className="pw-tape">
          {[...shown.flow.entries].reverse().slice(0, 6).map((entry) => <li key={entry.n}><b>#{entry.n} {stampFor(entry).technical}</b> <code>{entry.hood}</code></li>)}
        </ol>
      ) : null}
      <p className="sr-only">{latestEntry ? `${stampFor(latestEntry).word}. ${latestEntry.plain} The customer: ${customerLine(shown)}.` : ""}</p>
    </div>
  );
}

/** The customer's first walk to the counter, played on the sprite already standing there. */
function WalkFrom({ from, scale, to }: { from: Box; scale: number; to: Box }) {
  const ref = useCallback((element: HTMLSpanElement | null) => {
    const button = element?.parentElement;
    if (!button || typeof button.animate !== "function") return;
    button.animate([{ transform: `translate(${(from.x - to.x) * scale}px, ${(from.y - to.y) * scale}px)` }, { transform: "none" }], { duration: 700, easing: "steps(8, end)" });
  }, [from, scale, to]);
  return <span aria-hidden="true" hidden ref={ref} />;
}
