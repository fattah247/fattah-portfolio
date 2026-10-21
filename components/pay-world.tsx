"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowIcon, ChevronIcon, ResetIcon, StartOverIcon } from "./icons";
import { PixelObject, PixelSprite, type PixelObjectName } from "./pixel-objects";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { PAYMENT_AMOUNT, PAYOUT_NET, type FlowEntry, type FlowOutcome, type FlowWorld } from "../lib/payment-flow";
import {
  codeLink,
  emptyWorld,
  notebook,
  payflowSays,
  receiptNo,
  roundEnd,
  roundFor,
  rounds,
  stampFor,
  step,
  type Moment,
  type Round,
  type Speaker,
  type World,
} from "../lib/pay-rounds";

/* ------------------------------------------------------------------ The map */

/** The world's own units: 30 tiles of 16 by 12.5 tiles, left to right from the shop to the bank. */
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
/** Payflow's notebook hangs by the server, its right edge here. */
const notebookAt: Point = { x: 268, y: 96 };

/** The receipts' line: the card machine, up to the shop's antenna, across to the server. */
const receiptLine: Point[] = [{ x: 114, y: 116 }, { x: 114, y: 86 }, { x: 170, y: 86 }, { x: 170, y: 50 }, { x: 296, y: 50 }, { x: 296, y: 76 }];
/** The money's line: from the server to the bank, and the bank's statement back. */
const moneyLine: Point[] = [{ x: 320, y: 104 }, { x: 400, y: 104 }];
const centre = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

type Person = Exclude<Speaker, "narrator">;
/** Where each one's bubble points: just over their head. */
const speakerAt: Record<Person, Point> = {
  customer: { x: 74, y: 126 },
  cashier: { x: 154, y: 122 },
  server: { x: 296, y: 74 },
  operator: { x: 340, y: 126 },
  bank: { x: 432, y: 70 },
};
const speakerName: Record<Person, string> = { customer: "Customer", cashier: "Cashier", server: "Payflow", operator: "Payflow's checker", bank: "Bank" };
const trickIcon: Record<Round["id"], PixelObjectName> = { repeat: "receipt", "old-news": "antenna", short: "card-machine", lost: "money-bag" };

/**
 * The pace, in ms: slow enough to follow a receipt or the money with the eye. A crossing takes 1.5
 * to 1.8 s, receipts sent in a hurry go out 0.45 s apart, and a line holds for about as long as it
 * takes to read (a tap on the world moves on sooner).
 */
export const pace = { walk: 1200, card: 700, receipt: 1800, late: 1600, money: 1800, slip: 1500, gap: 450 } as const;
export const holdFor = (text: string) => Math.min(3400, Math.max(1500, text.length * 52));
/** How long the view takes to turn (the camera's transition in the stylesheet). */
const TURN = 420;

/** Every outcome has its sound, landing as what was sent arrives. */
const worldCue: Partial<Record<FlowOutcome, CueId>> = {
  APPLIED: "pay.let-in",
  DUPLICATE_IGNORED: "pay.stopped",
  STALE_IGNORED: "pay.stopped",
  PAYMENT_ON_HOLD: "pay.stopped",
  SENT_TO_REVIEW: "pay.report-differs",
  RELEASED: "pay.check-on",
  BATCH_CREATED: "pay.book-back",
  MATCHED_AWAITING_BANK: "sys.file-open",
  RECONCILED: "pay.report-matches",
  LANDED: "pay.let-in",
  MISSING_CREDIT: "pay.book-down",
};
const cueFor = (entry: FlowEntry) => worldCue[entry.outcome] ?? "sys.file-open";
const amount = (value: number) => value.toLocaleString("en-US");

/** The two readings at the top: what the customer paid, and what reached the shop's bank. */
function charged(flow: FlowWorld) {
  const captures = flow.journals.filter((journal) => journal === "CAPTURE").length;
  if (captures) return amount(captures * PAYMENT_AMOUNT);
  if (flow.status === "MANUAL_REVIEW") return "nothing: on hold";
  return "nothing yet";
}
function inTheBank(flow: FlowWorld) {
  if (flow.payout === "LANDED") return amount(PAYOUT_NET);
  if (flow.payout === "BROKEN") return "never arrived";
  if (flow.payout === "IN_TRANSIT") return "on its way";
  return "nothing yet";
}

/* ----------------------------------------------------------------- Movement */

type Frame = Point & { at: number; scale?: number; opacity?: number };
/** Something crossing the world: what it is, its receipt number, and its path in world units at moments (ms). */
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
/** Taken in where it arrives: it rests a moment, then shrinks away. */
const into = (spot: Point, at: number): Frame[] => [{ ...spot, at: at + 200 }, { ...spot, at: at + 500, scale: 0.4, opacity: 0 }];
/** Turned away where it arrives: it rests, then hops back and fades. */
const away = (spot: Point, at: number): Frame[] => [{ ...spot, at: at + 300 }, { x: spot.x, y: spot.y - 12, at: at + 700, opacity: 0 }];
/** Sets off later than the others: hidden where it starts until its moment. */
const after = (path: Point[], offset: number, ms: number): Frame[] => [...(offset ? [{ ...path[0], at: 0, opacity: 0 }, { ...path[0], at: offset - 1, opacity: 0 }] : []), ...along(path, offset, offset + ms)];

/** Plays a move with the Web Animations API, in steps, scaled from world units to pixels. */
function MoveSprite({ move, scale, technical }: { move: Move; scale: number; technical: boolean }) {
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
      {move.tag ? <span className="pw-move-tag">{technical ? move.tag : receiptNo(move.tag)}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- Beats */

/**
 * A round plays as a short scene, a beat at a time: someone speaks, something crosses its line,
 * Payflow's notebook and the readings change, Payflow answers. Only one line is ever on screen, and
 * each holds for about as long as it takes to read. The scene stops at the question, and after the
 * answer it plays on to the result, where Payflow's last word stays.
 */
type Beat =
  | { kind: "say"; speaker: Speaker; text: string; entry?: FlowEntry; hold: number; stay?: boolean }
  | { kind: "move"; moves: Move[]; focus: number; lands?: Array<{ at: number; world: World; cue: CueId }> }
  | { kind: "show"; world: World; cue?: CueId }
  | { kind: "walk" }
  | { kind: "pose"; pose: "tap" | "idle" }
  | { kind: "wait"; ms: number }
  | { kind: "ask" }
  | { kind: "reveal" };

type Line = { speaker: Speaker; text: string; entry?: FlowEntry; key: number; turn?: boolean };

const turnedAway: FlowOutcome[] = ["DUPLICATE_IGNORED", "STALE_IGNORED", "PAYMENT_ON_HOLD"];

/** The beats of a round's moments from a world, and the world they end in. */
function beatsFor(moments: Moment[], start: World, decisive: boolean): { beats: Beat[]; end: World } {
  const beats: Beat[] = [];
  let world = start;
  const answers = (last: boolean): Beat => {
    const text = payflowSays(world);
    return { kind: "say", speaker: "server", text, entry: world.flow.entries.at(-1), hold: holdFor(text), stay: last };
  };
  moments.forEach((moment, index) => {
    const last = decisive && index === moments.length - 1;
    if (moment.kind === "walk") beats.push({ kind: "walk" });
    else if (moment.kind === "card") {
      const from = centre(place.customer);
      const to = centre(place.machine);
      beats.push({ kind: "move", focus: 110, moves: [{ key: `card-${index}`, object: "note", size: 18, frames: [...along([from, to], 0, pace.card), { ...to, at: pace.card + 200, scale: 0.5, opacity: 0 }] }] });
    } else if (moment.kind === "tap") beats.push({ kind: "pose", pose: "tap" }, { kind: "wait", ms: 340 }, { kind: "pose", pose: "idle" });
    else if (moment.kind === "say") beats.push({ kind: "say", speaker: moment.who, text: moment.text, hold: holdFor(moment.text) });
    else if (moment.kind === "receipts") {
      // Receipts go along their line to Payflow's server; one already in the notebook is turned away.
      const path = moment.late ? receiptLine.slice(3) : receiptLine;
      const ms = moment.late ? pace.late : pace.receipt;
      const moves: Move[] = [];
      const lands: Array<{ at: number; world: World; cue: CueId }> = [];
      moment.inputs.forEach((input, n) => {
        world = step(world, input);
        const entry = world.flow.entries.at(-1)!;
        const offset = n * pace.gap;
        const arrive = path.at(-1)!;
        moves.push({ key: `${entry.n}-receipt`, object: "receipt", size: 22, tag: entry.event?.id, frames: [...after(path, offset, ms), ...(turnedAway.includes(entry.outcome) ? away : into)(arrive, offset + ms)] });
        lands.push({ at: offset + ms, world, cue: cueFor(entry) });
      });
      beats.push({ kind: "move", moves, focus: 240, lands }, { kind: "show", world }, answers(last));
    } else if (moment.kind === "payout") {
      world = step(world, { kind: "settle" });
      const text = payflowSays(world);
      beats.push(
        { kind: "say", speaker: "server", text, entry: world.flow.entries.at(-1), hold: holdFor(text) },
        { kind: "move", focus: 360, moves: [{ key: `money-${index}`, object: "money-bag", size: 24, frames: [...along(moneyLine, 0, pace.money), ...into(moneyLine.at(-1)!, pace.money)] }], lands: [{ at: pace.money, world, cue: cueFor(world.flow.entries.at(-1)!) }] },
        { kind: "show", world },
      );
    } else if (moment.kind === "report") {
      world = step(world, { kind: "report", matches: true });
      const said = `The card company's daily report: “${amount(PAYOUT_NET)} sent”.`;
      const path = receiptLine.slice(3);
      beats.push(
        { kind: "say", speaker: "narrator", text: said, hold: holdFor(said) },
        { kind: "move", focus: 250, moves: [{ key: `report-${index}`, object: "report", size: 22, frames: [...along(path, 0, pace.late), ...into(path.at(-1)!, pace.late)] }], lands: [{ at: pace.late, world, cue: cueFor(world.flow.entries.at(-1)!) }] },
        { kind: "show", world },
        answers(last),
      );
    } else if (moment.kind === "statement") {
      world = step(world, moment.input);
      const entry = world.flow.entries.at(-1)!;
      const back = [...moneyLine].reverse();
      beats.push(
        { kind: "say", speaker: "bank", text: moment.said, hold: holdFor(moment.said) },
        { kind: "move", focus: 360, moves: [{ key: `${entry.n}-statement`, object: entry.outcome === "MISSING_CREDIT" ? "cross" : "slip", size: 22, frames: [...along(back, 0, pace.slip), ...into(back.at(-1)!, pace.slip)] }], lands: [{ at: pace.slip, world, cue: cueFor(entry) }] },
        { kind: "show", world },
        answers(last),
      );
    } else {
      world = step(world, { kind: "release" });
      const said = "I checked it: just a typo. Releasing.";
      beats.push({ kind: "say", speaker: "operator", text: said, hold: holdFor(said) }, { kind: "show", world, cue: cueFor(world.flow.entries.at(-1)!) }, answers(last));
    }
  });
  return { beats, end: world };
}

/* -------------------------------------------------------------------- World */

const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const conditionsKey = (conditions: Record<string, string>) => JSON.stringify(Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b)));
const fileName = (file: string) => file.split("/").at(-1) ?? file;

type Phase = "pick" | "play" | "ask" | "result";

type PayWorldProps = {
  conditions: Record<string, string>;
  isDefault: boolean;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  technical: boolean;
  /** The "Technical details" key, kept with the toy's own actions. */
  technicalKey?: ReactNode;
};

/**
 * Case 01's toy, "try to break the payment": four tricks that go wrong in real payments, played in
 * a small world from a shop to a bank. A round sets the scene, asks what will happen, plays it
 * through Payflow's rules, and shows the answer next to a basic system's; under each result, "How
 * Payflow decided" gives an engineer the request, the repo's lines that decided it, and its tests.
 */
export function PayWorld({ conditions, isDefault, onChange, onReset, technical, technicalKey }: PayWorldProps) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [current, setCurrent] = useState(() => Math.max(0, roundFor(conditions)));
  const [guess, setGuess] = useState<string | null>(null);
  const [tried, setTried] = useState<string[]>([]);
  const [proofOpen, setProofOpen] = useState<boolean | null>(null);
  const [shown, setShown] = useState<World>(emptyWorld);
  const [moves, setMoves] = useState<Move[]>([]);
  const [line, setLine] = useState<Line | null>(null);
  const [pose, setPose] = useState<"idle" | "tap">("idle");
  const [walking, setWalking] = useState(false);
  const [atCounter, setAtCounter] = useState(false);
  const [frame, setFrame] = useState({ width: 0, scale: 2 });
  const [focusX, setFocusX] = useState(110);
  const view = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const queue = useRef<Beat[]>([]);
  const timers = useRef<number[]>([]);
  const hold = useRef<number | null>(null);
  const lines = useRef(0);
  const middle = useRef<World>(emptyWorld);
  const verdict = useRef(false);
  const engaged = useRef(false);
  const seen = useRef({ camera: 0, width: 0, scale: 2 });
  const { play } = useSound();

  const round = rounds[current];
  const end = roundEnd(round);
  const answerId = round.answer(end);
  const right = guess === answerId;
  // The proof follows Technical details until the visitor opens or closes it themselves.
  const showProof = phase === "result" && (proofOpen ?? technical);

  const stopAll = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    hold.current = null;
  };
  useEffect(() => () => stopAll(), []);
  // Back at the tricks, nothing of a round may still be playing.
  useEffect(() => {
    if (phase !== "pick") return;
    stopAll();
    queue.current = [];
  }, [phase]);

  // The world fits its box when it can, up to 1.8 times its size (a wide box centres it, its ground
  // running on to the edges); a phone shows part of it, and the view follows the action.
  useLayoutEffect(() => {
    const element = view.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      if (width) setFrame({ width, scale: Math.min(Math.max(width / W, 1.4), 1.8) });
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  // The question's choices, the result's next trick, and the tricks take the keyboard's place when the button that had it goes.
  useEffect(() => {
    if (!engaged.current) return;
    const active = document.activeElement;
    if (active && active !== document.body && !band.current?.contains(active)) return;
    band.current?.querySelector<HTMLButtonElement>("[data-primary]")?.focus({ preventScroll: true });
  }, [phase]);

  // When the case's conditions change from outside (Reset, a link), the tricks are offered again from the one they name.
  const signature = conditionsKey(conditions);
  const [seenSignature, setSeenSignature] = useState(signature);
  const [ownSignature, setOwnSignature] = useState<string | null>(null);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    if (signature !== ownSignature) {
      setPhase("pick");
      setCurrent(Math.max(0, roundFor(conditions)));
      setShown(emptyWorld);
      setLine(null);
      setMoves([]);
      setAtCounter(false);
    }
  }

  const inSight = (x: number) => {
    const { camera: offset, width: across, scale: size } = seen.current;
    const spot = x * size + offset;
    return across > 0 && spot > 48 && spot < across - 48;
  };
  const later = (ms: number, effect: () => void) => {
    const timer = window.setTimeout(() => {
      timers.current = timers.current.filter((id) => id !== timer);
      effect();
    }, ms);
    timers.current.push(timer);
    return timer;
  };

  /** Plays the next beat. The queue stops at the question, and at the result. */
  const advance = () => {
    const beat = queue.current.shift();
    if (!beat) return;
    const still = reducedMotion();
    if (beat.kind === "say") {
      lines.current += 1;
      // The view turns only to someone out of sight, and then the line waits for it, so it never slides in.
      const turn = beat.speaker !== "narrator" && !inSight(speakerAt[beat.speaker].x);
      if (turn && beat.speaker !== "narrator") setFocusX(speakerAt[beat.speaker].x);
      setLine({ speaker: beat.speaker, text: beat.text, entry: beat.entry, key: lines.current, turn: turn && !still });
      if (beat.stay) { advance(); return; }
      hold.current = later(beat.hold + (turn && !still ? TURN : 0), () => { hold.current = null; advance(); });
    } else if (beat.kind === "move") {
      setLine(null);
      setFocusX(beat.focus);
      for (const land of beat.lands ?? []) play(land.cue, still ? 0 : Math.max(0, land.at / 1000 - LANDING));
      if (still) {
        const landed = beat.lands?.at(-1);
        if (landed) setShown(landed.world);
        advance();
        return;
      }
      setMoves(beat.moves);
      for (const land of beat.lands ?? []) later(land.at, () => setShown(land.world));
      later(Math.max(...beat.moves.map((move) => move.frames.at(-1)!.at)), () => { setMoves([]); advance(); });
    } else if (beat.kind === "show") {
      setShown(beat.world);
      if (beat.cue) play(beat.cue);
      advance();
    } else if (beat.kind === "walk") {
      setLine(null);
      setFocusX(60);
      setAtCounter(true);
      if (still) { advance(); return; }
      setWalking(true);
      later(pace.walk, () => { setWalking(false); advance(); });
    } else if (beat.kind === "pose") {
      setPose(beat.pose);
      advance();
    } else if (beat.kind === "wait") {
      if (still) advance();
      else later(beat.ms, advance);
    } else if (beat.kind === "ask") {
      setLine(null);
      setPhase("ask");
    } else {
      setPhase("result");
      play(verdict.current ? "pay.check-on" : "pay.check-off");
    }
  };

  /** A tap on the world, or Skip, moves past the line that's holding. */
  const skip = () => {
    if (hold.current === null) return;
    window.clearTimeout(hold.current);
    timers.current = timers.current.filter((id) => id !== hold.current);
    hold.current = null;
    advance();
  };

  /** A trick: its conditions become the case's, the world starts fresh, and the scene plays to the question. */
  const begin = (index: number) => {
    engaged.current = true;
    stopAll();
    const next = rounds[index];
    setOwnSignature(conditionsKey({ ...conditions, ...next.conditions }));
    for (const [key, value] of Object.entries(next.conditions)) if (conditions[key] !== value) onChange(key, value);
    const { beats, end: asked } = beatsFor(next.before, emptyWorld, false);
    middle.current = asked;
    queue.current = [...beats, { kind: "ask" }];
    setCurrent(index);
    setGuess(null);
    setProofOpen(null);
    setShown(emptyWorld);
    setLine(null);
    setMoves([]);
    setPose("idle");
    setWalking(false);
    setAtCounter(false);
    setFocusX(60);
    setPhase("play");
    play("pay.start-over");
    advance();
  };

  /** The visitor's answer: the scene plays on through Payflow's rules to the result. */
  const answer = (choice: string) => {
    if (phase !== "ask") return;
    engaged.current = true;
    const { beats } = beatsFor(round.after, middle.current, true);
    verdict.current = choice === answerId;
    queue.current = [...beats, { kind: "reveal" }];
    setGuess(choice);
    setTried((list) => (list.includes(round.id) ? list : [...list, round.id]));
    setPhase("play");
    advance();
  };

  const toTricks = () => { engaged.current = true; setPhase("pick"); setShown(emptyWorld); setLine(null); setMoves([]); setAtCounter(false); setPose("idle"); setFocusX(110); };

  /* What the world shows. */
  const { width, scale } = frame;
  const worldWidth = W * scale;
  const camera = worldWidth > width + 1 ? Math.min(0, Math.max(width - worldWidth, width / 2 - focusX * scale)) : Math.round((width - worldWidth) / 2);
  useLayoutEffect(() => { seen.current = { camera, width, scale }; });
  const at = (box: Box): CSSProperties => ({ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale });
  const stamp = line?.entry ? stampFor(line.entry) : null;
  const notes = notebook(shown);
  const lastEntry = shown.flow.entries.at(-1);
  const flashed = lastEntry?.outcome === "DUPLICATE_IGNORED" || lastEntry?.outcome === "STALE_IGNORED" ? lastEntry : null;
  const suggested = (() => {
    const from = Math.max(0, roundFor(conditions));
    for (let offset = 0; offset < rounds.length; offset += 1) {
      const index = (from + offset) % rounds.length;
      if (!tried.includes(rounds[index].id)) return index;
    }
    return from;
  })();
  const nextIndex = (() => {
    for (let offset = 1; offset <= rounds.length; offset += 1) {
      const index = (current + offset) % rounds.length;
      if (!tried.includes(rounds[index].id)) return index;
    }
    return (current + 1) % rounds.length;
  })();
  const compare = round.compare(end);
  const rightLabel = round.choices.find((choice) => choice.id === answerId)?.label ?? "";

  // A bubble stays inside the view: it centres over its speaker and slides in from the view's edges,
  // its tail still pointing at whoever speaks.
  const bubbleStyle = (() => {
    if (!line || line.speaker === "narrator") return undefined;
    const spot = line.speaker === "customer" && !atCounter ? { x: 20, y: 130 } : speakerAt[line.speaker];
    const anchor = spot.x * scale;
    if (!width) return { left: anchor, top: spot.y * scale } as CSSProperties;
    const half = Math.min(150, width / 2 - 8);
    const left = Math.min(Math.max(anchor, -camera + half + 8), -camera + width - half - 8);
    return { left, top: spot.y * scale, "--tail": `${anchor - left}px`, "--most": `${half * 2}px` } as CSSProperties;
  })();

  const actor = (who: string, box: Box, sprite: ReactNode, extra?: ReactNode) => (
    <span aria-hidden="true" className="pw-actor" data-actor={who} key={who} style={at(box)}>{sprite}{extra}</span>
  );

  return (
    <div className="pay-world" data-phase={phase} data-technical={technical || undefined}>
      <div className="pw-frame">
        <div className="pw-hud">
          {phase === "pick" ? (
            <p className="pw-goal"><b>Try to break the payment.</b> Make the customer pay the wrong amount, or lose the shop&rsquo;s money.</p>
          ) : (
            <>
              <span className="pw-chip" data-chip="trick"><PixelObject name={trickIcon[round.id]} size={32} /><span><small>Trick</small><b>{round.trick}</b></span></span>
              <span className="pw-chip" data-chip="charged"><PixelObject name="wallet" size={32} /><span><small>Customer paid</small><b key={charged(shown.flow)}>{charged(shown.flow)}</b></span></span>
              {round.id === "lost" ? <span className="pw-chip" data-chip="bank"><PixelObject name="slip" size={32} /><span><small>In the shop&rsquo;s bank</small><b key={inTheBank(shown.flow)}>{inTheBank(shown.flow)}</b></span></span> : null}
            </>
          )}
        </div>

        <div className="pw-view" onClick={skip} ref={view} style={{ height: H * scale }}>
          <div className="pw-world" style={{ width: worldWidth, height: H * scale, transform: `translateX(${camera}px)` }}>
            <svg aria-hidden="true" className="pw-ground" overflow="visible" preserveAspectRatio="none" shapeRendering="crispEdges" viewBox={`0 0 ${W} ${H}`}>
              <defs>
                <pattern height="32" id="pw-floor" patternUnits="userSpaceOnUse" width="32"><rect fill="#f7f8f9" height="32" width="32" /><rect fill="#e9edf1" height="16" width="16" /><rect fill="#e9edf1" height="16" width="16" x="16" y="16" /></pattern>
                <pattern height="32" id="pw-grass" patternUnits="userSpaceOnUse" width="32"><rect fill="#cfe3df" height="32" width="32" /><rect fill="#bcd8d2" height="16" width="16" /><rect fill="#bcd8d2" height="16" width="16" x="16" y="16" /></pattern>
                <pattern height="32" id="pw-tiles" patternUnits="userSpaceOnUse" width="32"><rect fill="#dbe4f3" height="32" width="32" /><rect fill="#c8d8f0" height="16" width="16" /><rect fill="#c8d8f0" height="16" width="16" x="16" y="16" /></pattern>
                <pattern height="32" id="pw-stone" patternUnits="userSpaceOnUse" width="32"><rect fill="#e3e7ec" height="32" width="32" /><rect fill="#d3d9e1" height="16" width="16" /><rect fill="#d3d9e1" height="16" width="16" x="16" y="16" /></pattern>
              </defs>
              <rect fill="#ffffff" height="40" width={W + 800} x="-400" />
              {/* The shop: a wall with its window, a checked floor, the counter. */}
              <rect fill="#e3e7ec" height="56" width="584" x="-400" y="40" />
              <rect fill="#b8c1cd" height="4" width="584" x="-400" y="92" />
              <rect fill="#ffffff" height="26" stroke="#252b34" width="44" x="24" y="54" />
              <rect fill="#c8d8f0" height="10" width="18" x="28" y="58" />
              <rect fill="#c8d8f0" height="10" width="18" x="48" y="58" />
              <rect fill="url(#pw-floor)" height="104" width="584" x="-400" y="96" />
              <rect fill="#d3d9e1" height="8" stroke="#252b34" width="36" x="96" y="132" />
              <rect fill="#8ea5cb" height="36" stroke="#252b34" width="36" x="96" y="140" />
              <rect fill="#6e88b6" height="4" width="34" x="97" y="171" />
              {/* Outside, then Payflow's room with its notebook, outside again, and the bank's square. */}
              <rect fill="#ffffff" height="56" width="48" x="184" y="40" />
              <rect fill="url(#pw-grass)" height="104" width="48" x="184" y="96" />
              <rect fill="#dbe4f3" height="56" width="120" x="232" y="40" />
              <rect fill="#8ea5cb" height="4" width="120" x="232" y="92" />
              <rect fill="url(#pw-tiles)" height="104" width="120" x="232" y="96" />
              <rect fill="#ffffff" height="56" width="40" x="352" y="40" />
              <rect fill="url(#pw-grass)" height="104" width="40" x="352" y="96" />
              <rect fill="#ffffff" height="56" width="488" x="392" y="40" />
              <rect fill="url(#pw-stone)" height="104" width="488" x="392" y="96" />
              {/* The two lines: receipts from the shop to the server; the money between the server and the bank. */}
              <polyline className="pw-line" data-line="receipts" fill="none" points={receiptLine.map((spot) => `${spot.x},${spot.y}`).join(" ")} />
              <polyline className="pw-line" data-line="money" fill="none" points={moneyLine.map((spot) => `${spot.x},${spot.y}`).join(" ")} />
            </svg>

            <span aria-hidden="true" className="pw-prop" style={at(place.machine)}><PixelSprite name="card-machine" /></span>
            {actor("customer", atCounter ? place.customer : place.customerStart, <PixelSprite key={walking ? "walking" : "still"} name={walking ? "customer-walk-b" : "customer-walk-a"} />, walking ? <WalkFrom from={place.customerStart} scale={scale} to={place.customer} /> : null)}
            {actor("cashier", place.cashier, <PixelSprite name={pose === "tap" ? "cashier-tap" : "cashier"} />)}
            {actor("signal", place.antenna, <PixelSprite name="antenna" />)}
            {actor("server", place.server, <PixelSprite name="server" />)}
            {actor("operator", place.operator, <PixelSprite name="operator" />)}
            {actor("bank", place.bank, <PixelSprite name="bank" />)}

            {/* Payflow's notebook: every receipt number written down before any money moves. */}
            <div aria-label={technical ? "provider_events" : "Payflow's notebook"} className="pw-notebook" role="list" style={{ right: worldWidth - notebookAt.x * scale, top: notebookAt.y * scale }}>
              <span aria-hidden="true" className="pw-notebook-title">{technical ? "provider_events" : "Notebook"}</span>
              {notes.length ? notes.map((note) => (
                <span className="pw-note" data-flash={flashed?.event?.id === note.id || undefined} key={flashed?.event?.id === note.id ? `${note.id}-${flashed.n}` : note.id} role="listitem">
                  {technical ? note.technical : <><b>{note.no}</b> {note.said}</>}
                </span>
              )) : <span className="pw-note" data-empty role="listitem">{technical ? "no rows" : "empty"}</span>}
            </div>

            {moves.map((move) => <MoveSprite key={move.key} move={move} scale={scale} technical={technical} />)}

            {line && line.speaker !== "narrator" ? (
              <p className="pw-bubble" data-hit={stamp?.tone === "adverse" ? "bad" : undefined} data-speaker={line.speaker} data-turn={line.turn || undefined} key={`line-${line.key}`} style={bubbleStyle}>
                <span className="pw-bubble-head">
                  <b>{speakerName[line.speaker]}</b>
                  {stamp ? <span className="pw-bubble-stamp" data-tone={stamp.tone}>{technical ? stamp.technical : stamp.word}</span> : null}
                </span>
                <span className="pw-bubble-text">{line.text}</span>
              </p>
            ) : null}
          </div>
          {line?.speaker === "narrator" ? <p className="pw-narration" key={`line-${line.key}`}>{line.text}</p> : null}
        </div>

        <div className="pw-band" ref={band}>
          {phase === "pick" ? (
            <div aria-label="Pick a trick" className="pw-tricks" role="group">
              {rounds.map((option, index) => (
                <button className="pw-trick" data-primary={index === suggested || undefined} data-suggested={index === suggested || undefined} data-tried={tried.includes(option.id) || undefined} key={option.id} onClick={() => begin(index)} type="button">
                  <PixelObject name={trickIcon[option.id]} size={32} />
                  <span><b>{option.trick}</b><small>{option.hint}</small></span>
                  {tried.includes(option.id) ? <PixelObject className="pw-trick-tick" name="tick" size={32} /> : null}
                  {index === suggested ? <PixelObject className="pw-option-hand" name="hand-left" size={32} /> : null}
                </button>
              ))}
            </div>
          ) : phase === "ask" ? (
            <div className="pw-ask">
              <p className="pw-question">{round.question}</p>
              <div aria-label={round.question} className="pw-choices" role="group">
                {round.choices.map((choice, index) => <button className="pw-choice" data-primary={index === 0 || undefined} key={choice.id} onClick={() => answer(choice.id)} type="button">{choice.label}</button>)}
              </div>
            </div>
          ) : phase === "result" ? (
            <div className="pw-result" data-right={right || undefined}>
              <p className="pw-verdict">{right ? "Right!" : `Not quite: it's “${rightLabel}”.`}</p>
              <p className="pw-why">{round.why}</p>
              <div className="pw-compare">
                <span className="pw-compare-measure">{compare.measure}</span>
                <span className="pw-compare-side" data-side="basic"><small>A basic system</small><b>{compare.basic}</b></span>
                <span className="pw-compare-side" data-side="payflow"><small>Payflow</small><b>{compare.payflow}</b></span>
              </div>
              <div className="pw-result-actions">
                <button aria-expanded={showProof} className="sim-secondary" onClick={() => setProofOpen(!showProof)} type="button">How Payflow decided</button>
                <button className="sim-primary" data-primary onClick={() => begin(nextIndex)} type="button">{tried.length >= rounds.length ? "Play" : "Next trick"}: {rounds[nextIndex].trick.toLowerCase()}<ChevronIcon direction="right" /></button>
              </div>
            </div>
          ) : (
            <div className="pw-playing">
              <p className="pw-band-note">{round.trick}</p>
              <button className="sim-secondary" disabled={!line} onClick={skip} type="button">Skip ahead</button>
            </div>
          )}
        </div>

        {showProof ? (
          <section aria-label="How Payflow decided" className="pw-proof">
            <p className="pw-proof-lead">How Payflow decided, from the Payflow Reliability repo:</p>
            <p className="pw-proof-label">What arrived</p>
            <pre className="pw-proof-request">{round.proof.request.join("\n")}</pre>
            <p className="pw-proof-label">The code that decided it</p>
            {round.proof.code.map((excerpt) => (
              <figure className="pw-code" key={`${excerpt.file}:${excerpt.from}`}>
                <figcaption><a href={codeLink(excerpt.file, excerpt.from, excerpt.from + excerpt.lines.length - 1)} rel="noreferrer" target="_blank">{fileName(excerpt.file)}:{excerpt.from}&ndash;{excerpt.from + excerpt.lines.length - 1}<ArrowIcon /></a></figcaption>
                <pre><code>{excerpt.lines.map((text, index) => <span className="pw-code-line" data-n={excerpt.from + index} key={index}>{text || " "}</span>)}</code></pre>
              </figure>
            ))}
            {round.proof.notes.map((note) => <p className="pw-proof-note" key={note}>{note}</p>)}
            <p className="pw-proof-label">What Payflow answered</p>
            <p className="pw-proof-result">{round.proof.result}</p>
            <p className="pw-proof-label">The tests that hold it</p>
            <ul className="pw-proof-tests">
              {round.proof.tests.map((test) => <li key={test.name}><a href={codeLink(test.file, test.line)} rel="noreferrer" target="_blank">{fileName(test.file)}:{test.line}<ArrowIcon /></a> <code>{test.name}</code></li>)}
            </ul>
            <p className="pw-proof-compare">The basic system is the site&rsquo;s comparison, not code from the repo: it applies every message it gets and trusts the card company&rsquo;s report.</p>
          </section>
        ) : null}
      </div>

      <div className="pw-actions">
        {phase !== "pick" ? <button className="sim-secondary" onClick={toTricks} type="button"><StartOverIcon />All tricks</button> : null}
        {!isDefault && onReset ? <button className="sim-secondary" onClick={onReset} type="button"><ResetIcon />Reset</button> : null}
        {technicalKey}
      </div>

      <p aria-live="polite" className="sr-only">
        {phase === "ask" ? round.question : phase === "result" ? `${right ? "Right." : `Not quite: it's ${rightLabel}.`} ${compare.measure}: a basic system ${compare.basic}, Payflow ${compare.payflow}.` : line ? `${line.speaker === "narrator" ? "" : `${speakerName[line.speaker]}: `}${line.text}` : ""}
      </p>
    </div>
  );
}

/** The customer's walk to the counter, played on the sprite already standing there. */
function WalkFrom({ from, scale, to }: { from: Box; scale: number; to: Box }) {
  const ref = useCallback((element: HTMLSpanElement | null) => {
    const sprite = element?.parentElement;
    if (!sprite || typeof sprite.animate !== "function") return;
    sprite.animate([{ transform: `translate(${(from.x - to.x) * scale}px, ${(from.y - to.y) * scale}px)` }, { transform: "none" }], { duration: pace.walk, easing: "steps(12, end)" });
  }, [from, scale, to]);
  return <span aria-hidden="true" hidden ref={ref} />;
}
