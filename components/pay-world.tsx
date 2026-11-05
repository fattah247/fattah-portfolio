"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowIcon, ChevronIcon, ResetIcon, StartOverIcon } from "./icons";
import { PixelObject, PixelSprite, type PixelObjectName } from "./pixel-objects";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { PAYOUT_NET, type FlowEntry, type FlowOutcome, type FlowWorld } from "../lib/payment-flow";
import {
  codeLink,
  emptyWorld,
  openingFor,
  notebook,
  payflowSays,
  receiptNo,
  recorded,
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

/**
 * The world's own units: 35 tiles of 16 by 12.5 tiles, left to right: the shop, the card company,
 * Payflow, the shop's bank. As in the repo, Payflow hears only from the card company and the bank,
 * and the money goes from the card company to the bank without passing through Payflow.
 */
const W = 560;
const H = 200;
type Box = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

const place = {
  customerStart: { x: 4, y: 132, w: 32, h: 48 },
  customer: { x: 58, y: 128, w: 32, h: 48 },
  machine: { x: 106, y: 116, w: 16, h: 16 },
  cashier: { x: 138, y: 124, w: 32, h: 48 },
  antenna: { x: 160, y: 42, w: 20, h: 20 },
  provider: { x: 208, y: 56, w: 64, h: 64 },
  server: { x: 352, y: 76, w: 48, h: 64 },
  operator: { x: 404, y: 128, w: 32, h: 48 },
  bank: { x: 480, y: 72, w: 64, h: 64 },
} satisfies Record<string, Box>;
/** Payflow's notebook hangs by the server, its right edge here. */
const notebookAt: Point = { x: 348, y: 96 };

/** The card payment: from the shop's machine, up its antenna, to the card company. */
const payLine: Point[] = [{ x: 114, y: 116 }, { x: 114, y: 86 }, { x: 170, y: 86 }, { x: 170, y: 50 }, { x: 240, y: 50 }, { x: 240, y: 56 }];
/** The card company's messages to Payflow: they land in its notebook, where each number is looked up. */
const messageLine: Point[] = [{ x: 272, y: 88 }, { x: 292, y: 88 }, { x: 292, y: 44 }, { x: 326, y: 44 }, { x: 326, y: 94 }];
/** The card company's daily report to Payflow's server, and Payflow's payout request back. */
const reportLine: Point[] = [{ x: 272, y: 88 }, { x: 292, y: 88 }, { x: 292, y: 44 }, { x: 376, y: 44 }, { x: 376, y: 76 }];
type LineName = "pay" | "messages" | "report" | "money" | "statements";
/** The money: from the card company along the ground to the bank, never through Payflow. */
const moneyLine: Point[] = [{ x: 240, y: 120 }, { x: 240, y: 190 }, { x: 512, y: 190 }, { x: 512, y: 136 }];
/** The bank's statements to Payflow's server. */
const statementLine: Point[] = [{ x: 480, y: 104 }, { x: 400, y: 104 }];
const centre = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

type Person = Exclude<Speaker, "narrator">;
/** Where each one's bubble points: just over their head. */
const speakerAt: Record<Person, Point> = {
  customer: { x: 74, y: 126 },
  cashier: { x: 154, y: 122 },
  provider: { x: 240, y: 64 },
  server: { x: 376, y: 74 },
  operator: { x: 420, y: 126 },
  bank: { x: 512, y: 70 },
};
const speakerName: Record<Person, string> = { customer: "Customer", cashier: "Cashier", provider: "Card company", server: "Payflow", operator: "Payflow's checker", bank: "Bank" };
const trickIcon: Record<Round["id"], PixelObjectName> = { repeat: "receipt", "old-news": "antenna", short: "report", lost: "money-bag" };

/**
 * The pace, in ms: slow enough to follow a message or the money with the eye. A crossing takes 1.4
 * to 2.2 s (a message on the slow line 2.6 s), messages sent in a hurry go out 0.45 s apart, and a
 * line holds for about as long as it takes to read (a tap on the world moves on sooner).
 */
export const pace = { walk: 1200, card: 700, pay: 1400, message: 1800, late: 2600, request: 1500, money: 2200, slip: 1500, gap: 450 } as const;
export const holdFor = (text: string) => Math.min(3400, Math.max(1500, text.length * 52));
/** A beat's timer: when it's due and what it does, so it can be held and resumed. */
type Timer = { due: number; effect: () => void; id: number };

/**
 * The round's clock: every beat waits on one of its timers, each remembering when it's due, so a
 * pause holds them all and a resume gives each the time it had left. One set while paused waits too.
 */
function createBeatClock() {
  let timers: Timer[] = [];
  let pausedAt: number | null = null;
  const arm = (timer: Timer, ms: number) => {
    timer.id = window.setTimeout(() => {
      timers = timers.filter((other) => other !== timer);
      timer.effect();
    }, ms);
  };
  return {
    later(ms: number, effect: () => void) {
      const timer: Timer = { due: performance.now() + ms, effect, id: 0 };
      timers.push(timer);
      if (pausedAt === null) arm(timer, ms);
      return timer;
    },
    cancel(timer: Timer) {
      window.clearTimeout(timer.id);
      timers = timers.filter((other) => other !== timer);
    },
    clear() {
      timers.forEach((timer) => window.clearTimeout(timer.id));
      timers = [];
      pausedAt = null;
    },
    pause() {
      if (pausedAt !== null) return;
      pausedAt = performance.now();
      timers.forEach((timer) => window.clearTimeout(timer.id));
    },
    resume() {
      if (pausedAt === null) return;
      const now = performance.now();
      for (const timer of timers) {
        timer.due += now - pausedAt;
        arm(timer, timer.due - now);
      }
      pausedAt = null;
    },
  };
}

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

/** The readings at the top: what Payflow's books say the shop got, and what reached the shop's bank. */
function books(flow: FlowWorld) {
  if (recorded(flow)) return amount(recorded(flow));
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

/** Cubic ease-in-out: something already on screen speeds away, travels, and settles where it lands. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Positions along a polyline from one moment to another, one per 60 ms, spaced by the ease and joined smoothly. */
function along(points: Point[], from: number, to: number): Frame[] {
  const lengths = points.slice(1).map((spot, index) => Math.hypot(spot.x - points[index].x, spot.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
  const pointAt = (distance: number): Point => {
    let left = distance;
    for (const [index, length] of lengths.entries()) {
      if (left <= length || index === lengths.length - 1) {
        const share = length ? Math.min(1, left / length) : 0;
        return { x: points[index].x + (points[index + 1].x - points[index].x) * share, y: points[index].y + (points[index + 1].y - points[index].y) * share };
      }
      left -= length;
    }
    return points.at(-1)!;
  };
  const count = Math.max(2, Math.round((to - from) / 60));
  return Array.from({ length: count + 1 }, (_, index) => ({ ...pointAt(easeInOut(index / count) * total), at: from + ((to - from) * index) / count }));
}
/** Taken in where it arrives: it rests a moment, then shrinks away. */
const into = (spot: Point, at: number): Frame[] => [{ ...spot, at: at + 200 }, { ...spot, at: at + 500, scale: 0.4, opacity: 0 }];
/** Turned away where it arrives: it rests, then hops back and fades. */
const away = (spot: Point, at: number): Frame[] => [{ ...spot, at: at + 300 }, { x: spot.x, y: spot.y - 12, at: at + 700, opacity: 0 }];
/** Sets off later than the others: hidden where it starts until its moment. */
const after = (path: Point[], offset: number, ms: number): Frame[] => [...(offset ? [{ ...path[0], at: 0, opacity: 0 }, { ...path[0], at: offset - 1, opacity: 0 }] : []), ...along(path, offset, offset + ms)];

/** Plays a move with the Web Animations API, scaled from world units to pixels. */
function MoveSprite({ move, scale, technical }: { move: Move; scale: number; technical: boolean }) {
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element || typeof element.animate !== "function") return;
    const end = move.frames.at(-1)!.at;
    element.animate(
      move.frames.map((frame, index) => {
        // Travel glides straight between frames (the ease is in how far apart they are); being taken
        // in or turned away eases out, as everything leaving does.
        const next = move.frames[index + 1];
        const shrinks = next && ((next.scale ?? 1) !== (frame.scale ?? 1) || (next.opacity ?? 1) !== (frame.opacity ?? 1));
        return {
          offset: end ? frame.at / end : 0,
          opacity: frame.opacity ?? 1,
          transform: `translate(${frame.x * scale}px, ${frame.y * scale}px) translate(-50%, -50%) scale(${frame.scale ?? 1})`,
          easing: shrinks ? "cubic-bezier(.32, .72, 0, 1)" : "linear",
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
  | { kind: "move"; moves: Move[]; focus: number; line?: LineName; lands?: Array<{ at: number; world: World; cue: CueId }> }
  | { kind: "arrive" }
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
  const latest = () => world.flow.entries.at(-1)!;
  const answers = (last: boolean): Beat => {
    const text = payflowSays(world);
    return { kind: "say", speaker: "server", text, entry: latest(), hold: holdFor(text), stay: last };
  };
  const says = (speaker: Speaker, text: string): Beat => ({ kind: "say", speaker, text, hold: holdFor(text) });
  /** One thing along a line, taken in where it arrives; its sound lands with it when it changes the world. */
  const carry = (key: string, object: PixelObjectName, path: Point[], ms: number, focus: number, line: LineName, sound?: boolean): Beat => ({
    kind: "move", focus, line, moves: [{ key, object, size: object === "money-bag" ? 24 : 22, frames: [...along(path, 0, ms), ...into(path.at(-1)!, ms)] }],
    lands: sound ? [{ at: ms, world, cue: cueFor(latest()) }] : undefined,
  });
  moments.forEach((moment, index) => {
    const last = decisive && index === moments.length - 1;
    if (moment.kind === "walk") beats.push({ kind: "walk" });
    else if (moment.kind === "card") {
      const from = centre(place.customer);
      const to = centre(place.machine);
      beats.push({ kind: "move", focus: 110, moves: [{ key: `card-${index}`, object: "note", size: 18, frames: [...along([from, to], 0, pace.card), { ...to, at: pace.card + 200, scale: 0.5, opacity: 0 }] }] });
    } else if (moment.kind === "tap") beats.push({ kind: "pose", pose: "tap" }, { kind: "wait", ms: 340 }, { kind: "pose", pose: "idle" });
    else if (moment.kind === "pay") beats.push(carry(`pay-${index}`, "note", payLine, pace.pay, 170, "pay"));
    else if (moment.kind === "recap") {
      // The same sale, recalled in one line: the customer is at the counter, and its inputs land at once.
      for (const input of moment.inputs) world = step(world, input);
      beats.push({ kind: "arrive" }, { kind: "show", world }, says("narrator", moment.text));
    }
    else if (moment.kind === "say") beats.push(says(moment.who, moment.text));
    else if (moment.kind === "receipts") {
      // The card company's messages go along their line to Payflow; one already in the notebook is turned away.
      const ms = moment.late ? pace.late : pace.message;
      const moves: Move[] = [];
      const lands: Array<{ at: number; world: World; cue: CueId }> = [];
      moment.inputs.forEach((input, n) => {
        world = step(world, input);
        const entry = latest();
        const offset = n * pace.gap;
        const arrive = messageLine.at(-1)!;
        moves.push({ key: `${entry.n}-message`, object: "receipt", size: 22, tag: entry.event?.id, frames: [...after(messageLine, offset, ms), ...(turnedAway.includes(entry.outcome) ? away : into)(arrive, offset + ms)] });
        lands.push({ at: offset + ms, world, cue: cueFor(entry) });
      });
      beats.push({ kind: "move", moves, focus: 310, line: "messages", lands }, { kind: "show", world }, answers(last));
    } else if (moment.kind === "payout") {
      // Payflow closes the day and asks the card company to pay the shop; the card company pays the bank.
      world = step(world, { kind: "settle" });
      const request = payflowSays(world);
      const sending = `Sending ${amount(PAYOUT_NET)} to the shop's bank.`;
      const money: Frame[] = moment.lost
        ? [...along(moneyLine.slice(0, 2).concat({ x: 380, y: 190 }), 0, pace.money * 0.6), { x: 380, y: 190, at: pace.money * 0.6 + 300, scale: 0.6, opacity: 0 }]
        : [...along(moneyLine, 0, pace.money), ...into(moneyLine.at(-1)!, pace.money)];
      beats.push(
        { kind: "say", speaker: "server", text: request, entry: latest(), hold: holdFor(request) },
        carry(`request-${index}`, "slip", [...reportLine].reverse(), pace.request, 300, "report", true),
        { kind: "show", world },
        says("provider", sending),
        { kind: "move", focus: 380, line: "money", moves: [{ key: `money-${index}`, object: "money-bag", size: 24, frames: money }] },
      );
    } else if (moment.kind === "report") {
      world = step(world, { kind: "report", matches: true });
      beats.push(says("provider", `Today's report: ${amount(PAYOUT_NET)} sent to the shop's bank.`), carry(`report-${index}`, "report", reportLine, pace.message, 310, "report", true), { kind: "show", world }, answers(last));
    } else if (moment.kind === "statement") {
      world = step(world, moment.input);
      beats.push(says("bank", moment.said), carry(`${latest().n}-statement`, latest().outcome === "MISSING_CREDIT" ? "cross" : "slip", statementLine, pace.slip, 440, "statements", true), { kind: "show", world }, answers(last));
    } else {
      world = step(world, { kind: "release" });
      beats.push(says("operator", "I checked with the card company: their mistake. Releasing."), { kind: "show", world, cue: cueFor(latest()) }, answers(last));
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
  const frameBox = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const reveal = useRef(false);
  const queue = useRef<Beat[]>([]);
  const [clock] = useState(createBeatClock);
  const hold = useRef<Timer | null>(null);
  const [paused, setPaused] = useState(false);
  const finishMove = useRef<(() => void) | null>(null);
  const openingSeen = useRef(false);
  const [activeLine, setActiveLine] = useState<LineName | null>(null);
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
    clock.clear();
    hold.current = null;
    finishMove.current = null;
  };
  useEffect(() => () => clock.clear(), [clock]);
  // Back at the tricks, nothing of a round may still be playing.
  useEffect(() => {
    if (phase !== "pick") return;
    clock.clear();
    hold.current = null;
    finishMove.current = null;
    queue.current = [];
  }, [clock, phase]);

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

  // A trick starts where it can be seen: if the visitor had scrolled away (to read a proof, say),
  // the frame comes back into view, below the case's sticky bars (its scroll margin).
  // The result, too, is read where it lands: its band scrolls just into view if it ended up below.
  useEffect(() => {
    const behavior = reducedMotion() ? "auto" : "smooth";
    if (reveal.current) {
      reveal.current = false;
      const frame = frameBox.current;
      if (frame && typeof frame.scrollIntoView === "function") frame.scrollIntoView({ block: "nearest", behavior });
    } else if (phase === "result" && engaged.current && band.current && typeof band.current.scrollIntoView === "function") {
      band.current.scrollIntoView({ block: "nearest", behavior });
    }
  }, [phase, current]);

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
  const later = clock.later;
  const cancel = clock.cancel;

  /** Holds the round where it is: its lines, its timed sounds and whatever is crossing the world. */
  const pause = () => {
    if (paused) return;
    clock.pause();
    view.current?.getAnimations?.({ subtree: true }).forEach((animation) => animation.pause());
    setPaused(true);
  };
  const resume = () => {
    if (!paused) return;
    clock.resume();
    view.current?.getAnimations?.({ subtree: true }).forEach((animation) => animation.play());
    setPaused(false);
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
      const lands = beat.lands ?? [];
      if (still) {
        for (const land of lands) play(land.cue);
        const landed = lands.at(-1);
        if (landed) setShown(landed.world);
        advance();
        return;
      }
      setMoves(beat.moves);
      setActiveLine(beat.line ?? null);
      // Each landing is heard as it lands (the cue starts LANDING ahead of its knock) and shown then.
      const heard = new Set<number>();
      const own: Timer[] = lands.flatMap((land, index) => [
        later(Math.max(0, land.at - LANDING * 1000), () => { heard.add(index); play(land.cue); }),
        later(land.at, () => setShown(land.world)),
      ]);
      const done = () => { finishMove.current = null; setMoves([]); setActiveLine(null); advance(); };
      own.push(later(Math.max(...beat.moves.map((move) => move.frames.at(-1)!.at)), done));
      // A tap finishes it at once: everything lands, the last landing is heard if it wasn't yet.
      finishMove.current = () => {
        own.forEach(cancel);
        const landed = lands.at(-1);
        if (landed) {
          if (!heard.has(lands.length - 1)) play(landed.cue);
          setShown(landed.world);
        }
        done();
      };
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
    } else if (beat.kind === "arrive") {
      setAtCounter(true);
      setFocusX(240);
      advance();
    } else if (beat.kind === "pose") {
      setPose(beat.pose);
      advance();
    } else if (beat.kind === "wait") {
      if (still) advance();
      else later(beat.ms, advance);
    } else if (beat.kind === "ask") {
      setLine(null);
      openingSeen.current = true;
      setPhase("ask");
    } else {
      setPhase("result");
      play(verdict.current ? "pay.check-on" : "pay.check-off");
    }
  };

  /** A tap on the world, or Skip, moves past the line that's holding, or finishes what's moving (and ends a pause). */
  const skip = () => {
    if (!finishMove.current && hold.current === null) return;
    resume();
    if (finishMove.current) { finishMove.current(); return; }
    if (hold.current === null) return;
    cancel(hold.current);
    hold.current = null;
    advance();
  };

  /** A trick: its conditions become the case's, the world starts fresh, and the scene plays to the question. */
  const begin = (index: number) => {
    engaged.current = true;
    reveal.current = true;
    stopAll();
    setPaused(false);
    const next = rounds[index];
    setOwnSignature(conditionsKey({ ...conditions, ...next.conditions }));
    for (const [key, value] of Object.entries(next.conditions)) if (conditions[key] !== value) onChange(key, value);
    // The opening plays in full once; later rounds recall the same sale in one line.
    const { beats, end: asked } = beatsFor(openingFor(next, !openingSeen.current), emptyWorld, false);
    middle.current = asked;
    queue.current = [...beats, { kind: "ask" }];
    setCurrent(index);
    setGuess(null);
    setProofOpen(null);
    setShown(emptyWorld);
    setLine(null);
    setMoves([]);
    setActiveLine(null);
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

  const toTricks = () => { engaged.current = true; reveal.current = true; setPhase("pick"); setShown(emptyWorld); setLine(null); setMoves([]); setAtCounter(false); setPose("idle"); setFocusX(110); };

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
      <div className="pw-frame" ref={frameBox}>
        <div className="pw-hud">
          {phase === "pick" ? (
            <p className="pw-goal"><b>Try to break the payment.</b> Get Payflow&rsquo;s books wrong, or lose the shop&rsquo;s money.</p>
          ) : (
            <>
              <span className="pw-chip" data-chip="trick"><PixelObject name={trickIcon[round.id]} size={32} /><span><small>Trick</small><b>{round.trick}</b></span></span>
              <span className="pw-chip" data-chip="books"><PixelObject name="payflow-face" size={32} /><span><small>Payflow&rsquo;s books</small><b key={books(shown.flow)}>{books(shown.flow)}</b></span></span>
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
              {/* Outside, the card company's plot, outside again, Payflow's room with its notebook, outside, and the bank's square. */}
              <rect fill="#ffffff" height="56" width="12" x="184" y="40" />
              <rect fill="url(#pw-grass)" height="104" width="12" x="184" y="96" />
              <rect fill="#ffffff" height="56" width="88" x="196" y="40" />
              <rect fill="url(#pw-floor)" height="104" width="88" x="196" y="96" />
              <rect fill="#ffffff" height="56" width="16" x="284" y="40" />
              <rect fill="url(#pw-grass)" height="104" width="16" x="284" y="96" />
              <rect fill="#dbe4f3" height="56" width="136" x="300" y="40" />
              <rect fill="#8ea5cb" height="4" width="136" x="300" y="92" />
              <rect fill="url(#pw-tiles)" height="104" width="136" x="300" y="96" />
              <rect fill="#ffffff" height="56" width="32" x="436" y="40" />
              <rect fill="url(#pw-grass)" height="104" width="32" x="436" y="96" />
              <rect fill="#ffffff" height="56" width="492" x="468" y="40" />
              <rect fill="url(#pw-stone)" height="104" width="492" x="468" y="96" />
              {/* The lines: the card payment to the card company, its messages into Payflow's notebook, its report to Payflow's server, the money to the bank, the bank's statements to Payflow. Only the one in use lights up. */}
              {([["pay", payLine], ["messages", messageLine], ["report", reportLine], ["money", moneyLine], ["statements", statementLine]] as const).map(([name, path]) => (
                <polyline className="pw-line" data-active={activeLine === name || undefined} data-line={name} fill="none" key={name} points={path.map((spot) => `${spot.x},${spot.y}`).join(" ")} />
              ))}
            </svg>

            <span aria-hidden="true" className="pw-prop" style={at(place.machine)}><PixelSprite name="card-machine" /></span>
            {actor("customer", atCounter ? place.customer : place.customerStart, <PixelSprite key={walking ? "walking" : "still"} name={walking ? "customer-walk-b" : "customer-walk-a"} />, walking ? <WalkFrom from={place.customerStart} scale={scale} to={place.customer} /> : null)}
            {actor("cashier", place.cashier, <PixelSprite name={pose === "tap" ? "cashier-tap" : "cashier"} />)}
            {actor("signal", place.antenna, <PixelSprite name="antenna" />)}
            {actor("provider", place.provider, <PixelSprite name="card-company" />)}
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
                  {tried.includes(option.id) ? <><PixelObject className="pw-trick-tick" name="tick" size={32} /><span className="sr-only">, tried</span></> : null}
                  {index === suggested ? <><PixelObject className="pw-option-hand" name="hand-left" size={32} /><span className="sr-only">, suggested next</span></> : null}
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
              <p className="pw-verdict">{right ? "Right." : `Not quite: it's “${rightLabel}”.`}</p>
              <p className="pw-why">{round.why}</p>
              <div className="pw-compare">
                <span className="pw-compare-measure">{compare.measure}</span>
                <span className="pw-compare-side" data-side="basic"><small>A basic system</small><b>{compare.basic}</b></span>
                <span className="pw-compare-side" data-side="payflow"><small>Payflow</small><b>{compare.payflow}</b></span>
              </div>
              <div className="pw-result-actions">
                <button aria-expanded={showProof} className="sim-secondary" onClick={() => setProofOpen(!showProof)} type="button">How Payflow decided</button>
                <button className="sim-primary" data-primary onClick={() => begin(nextIndex)} type="button">{tried.length >= rounds.length ? "Play again" : "Next trick"}: {rounds[nextIndex].trick.toLowerCase()}<ChevronIcon direction="right" /></button>
              </div>
            </div>
          ) : (
            <div className="pw-playing">
              <p className="pw-band-note">{round.trick}</p>
              {/* Between beats Skip has nothing to skip, so it says so without losing the keyboard's place. */}
              <button className="sim-secondary" onClick={paused ? resume : pause} type="button">{paused ? "Resume" : "Pause"}</button>
              <button aria-disabled={(!line && !moves.length) || undefined} className="sim-secondary" onClick={skip} type="button">Skip ahead</button>
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
                <figcaption><a href={codeLink(excerpt.file, excerpt.from, excerpt.from + excerpt.lines.length - 1)} rel="noreferrer" target="_blank">{fileName(excerpt.file)}:{excerpt.from}&ndash;{excerpt.from + excerpt.lines.length - 1}<span className="sr-only">, opens in a new tab</span><ArrowIcon /></a></figcaption>
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
    sprite.animate([{ transform: `translate(${(from.x - to.x) * scale}px, ${(from.y - to.y) * scale}px)` }, { transform: "none" }], { duration: pace.walk, easing: "cubic-bezier(.65, 0, .35, 1)" });
  }, [from, scale, to]);
  return <span aria-hidden="true" hidden ref={ref} />;
}
