"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PlayIcon, ResetIcon, StartOverIcon } from "./icons";
import { PixelObject, PixelSprite, type PixelObjectName } from "./pixel-objects";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { PAYMENT_AMOUNT, PAYOUT_NET, paymentStory, type FlowEntry, type FlowOutcome, type FlowWorld } from "../lib/payment-flow";
import {
  actSteps,
  actions as actionsFor,
  bankLine,
  cashierLine,
  emptyWorld,
  isNew,
  narratorLine,
  nextDoorCharged,
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

/** The receipts' line: the card machine, up to the shop's antenna, across to the server. */
const receiptLine: Point[] = [{ x: 114, y: 116 }, { x: 114, y: 86 }, { x: 170, y: 86 }, { x: 170, y: 50 }, { x: 296, y: 50 }, { x: 296, y: 76 }];
/** The money's line: from the server to the bank, and the bank's settlement back. */
const moneyLine: Point[] = [{ x: 320, y: 104 }, { x: 400, y: 104 }];
const centre = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/** Who can speak. The narrator says what no one in the world says, from the sky. */
type Speaker = "customer" | "cashier" | "server" | "operator" | "bank" | "narrator";
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
/** Where the view turns when someone is up next. */
const lookAt: Record<Exclude<Actor, "tech">, number> = { customer: 74, cashier: 154, signal: 200, server: 296, operator: 340, bank: 400 };
const portrait: Record<Actor, PixelObjectName | null> = { customer: "wallet", cashier: "clerk", signal: "antenna", server: "payflow-face", operator: "reviewer", bank: "slip", tech: null };

/**
 * The pace, in ms: slow enough to follow the receipt and the money with the eye. Each crossing takes
 * about 1.5 to 1.8 s; a line that isn't a reaction holds on its own for about as long as it takes to
 * read; a reaction waits for Continue.
 */
export const pace = { walk: 1200, card: 700, receipt: 1800, late: 1600, money: 1800, slip: 1500, home: 1800 } as const;
export const holdFor = (text: string) => Math.min(2600, Math.max(1300, text.length * 50));
/** Watching, the lines that would wait for Continue hold a little longer instead. */
const watchHold = (text: string) => holdFor(text) + 1000;

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

/** The two readings at the top: what the customer paid, and what reached the shop's bank. */
function charged(flow: FlowWorld) {
  if (flow.journals.includes("CAPTURE")) return `${amount(PAYMENT_AMOUNT)}, once`;
  if (flow.status === "MANUAL_REVIEW") return "nothing: on hold";
  return "nothing yet";
}
function inTheBank(flow: FlowWorld) {
  if (flow.payout === "LANDED") return flow.status === "RECONCILED" ? `${amount(PAYOUT_NET)}, settled` : amount(PAYOUT_NET);
  if (flow.payout === "BROKEN") return "never arrived";
  if (flow.payout === "IN_TRANSIT") return flow.breaks.includes("UNMATCHED_CREDIT") ? "no reference" : "on its way";
  return "nothing yet";
}

/* ----------------------------------------------------------------- Movement */

type Frame = Point & { at: number; scale?: number; opacity?: number };
/** Something crossing the world: what it is, and its path in world units at moments (ms). */
type Move = { key: string; object: PixelObjectName; size: number; frames: Frame[] };

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
    </div>
  );
}

/* ------------------------------------------------------------------- Beats */

/**
 * One action plays as a short scene, a beat at a time, like a story in a language game: someone
 * says something, something crosses a line, the readings change, someone answers. Only one line is
 * ever on screen. A line someone says as they act holds on its own; an answer waits for Continue.
 */
type Beat =
  | { kind: "say"; speaker: Speaker; text: string; entry?: FlowEntry; hold?: number }
  | { kind: "move"; move: Move; land: number; focus: number; cue?: CueId }
  | { kind: "show"; world: World; cue?: CueId }
  | { kind: "walk" }
  | { kind: "pose"; pose: "tap" | "idle" }
  | { kind: "wait"; ms: number }
  | { kind: "step"; step: number; total: number };

/** One line on screen; `turn` when the view turns to the speaker first, so the line waits for it. */
type Line = { speaker: Speaker; text: string; entry?: FlowEntry; key: number; invite?: boolean; turn?: boolean };
/** How long the view takes to turn (the camera's transition in the stylesheet). */
const TURN = 420;

/** The scene one action plays, from the world before it and the world after each of its steps. */
function scene(before: World, action: Action, steps: World[], taps: number): Beat[] {
  const as = action.as ?? action.id;
  const beats: Beat[] = [];
  let previous = before;
  for (const world of steps) {
    const entry = world.flow.entries.at(-1);
    if (!entry || entry === previous.flow.entries.at(-1)) { previous = world; continue; }
    const input = entry.input;
    const key = `${entry.n}`;
    const cue = cueFor(entry, world);
    const travel = (name: string, object: PixelObjectName, path: Point[], ms: number, focus: number, end: "into" | "away", size = 22): Beat => ({
      kind: "move", move: { key: `${key}-${name}`, object, size, frames: [...along(path, 0, ms), ...(end === "into" ? into(path.at(-1)!, ms) : away(path.at(-1)!, ms))] }, land: ms, focus, cue,
    });
    // Payflow answers once what was sent has arrived; the comparison, when it matters, comes after.
    const answer = () => {
      beats.push({ kind: "show", world }, { kind: "say", speaker: "server", text: payflowLine(world), entry });
      const aside = withoutInbox(world);
      if (aside) beats.push({ kind: "say", speaker: "narrator", text: aside });
    };
    const tapping = (text: string): Beat[] => [{ kind: "pose", pose: "tap" }, { kind: "say", speaker: "cashier", text, hold: holdFor(text) }, { kind: "pose", pose: "idle" }];

    if (input.kind === "webhook") {
      // The first time, the customer walks up to the counter and hands over the card.
      if (!previous.flow.lastEvent) {
        beats.push({ kind: "walk" }, { kind: "say", speaker: "customer", text: `Here's my card: ${amount(PAYMENT_AMOUNT)}.`, hold: 1500 });
        beats.push({ kind: "move", move: { key: `${key}-card`, object: "note", size: 18, frames: [{ ...centre(place.customer), at: 0 }, ...along([centre(place.customer), centre(place.machine)], 0, pace.card).slice(1), { ...centre(place.machine), at: pace.card + 200, scale: 0.5, opacity: 0 }] }, land: pace.card, focus: 110 });
      }
      if (as === "late") beats.push({ kind: "say", speaker: "narrator", text: narratorLine(input), hold: 2400 });
      else if (as === "again" || as === "new-id") {
        // The impatient cashier, on a weak signal: tap, tap, and again.
        beats.push({ kind: "pose", pose: "tap" }, { kind: "wait", ms: 220 }, { kind: "pose", pose: "idle" }, { kind: "wait", ms: 220 }, ...tapping(cashierLine(world, "again", taps) ?? ""));
      } else if (as === "typo" || as === "fix") beats.push(...tapping(cashierLine(world, as, taps) ?? ""));
      else beats.push({ kind: "pose", pose: "tap" }, { kind: "wait", ms: 360 }, { kind: "pose", pose: "idle" });
      const turned = entry.outcome === "DUPLICATE_IGNORED" || entry.outcome === "STALE_IGNORED" || entry.outcome === "PAYMENT_ON_HOLD";
      beats.push(as === "late" ? travel("receipt", "receipt", receiptLine.slice(3), pace.late, 250, turned ? "away" : "into") : travel("receipt", "receipt", receiptLine, pace.receipt, 220, turned ? "away" : "into"));
      answer();
    } else if (input.kind === "report") {
      beats.push({ kind: "say", speaker: "narrator", text: narratorLine(input), hold: 2000 }, travel("report", "report", receiptLine.slice(3), pace.late, 250, "into"));
      answer();
    } else if (input.kind === "settle") {
      if (entry.outcome === "NOTHING_TO_SETTLE") {
        // Held money sets off for the bank and is turned back halfway.
        const turn = { x: 360, y: 104 };
        beats.push({ kind: "move", move: { key: `${key}-money`, object: "money-bag", size: 24, frames: [...along([moneyLine[0], turn, moneyLine[0]], 0, pace.money), { ...moneyLine[0], at: pace.money + 300, opacity: 0 }] }, land: pace.money / 2, focus: 360, cue });
        answer();
      } else if (entry.outcome === "BATCH_CREATED") {
        beats.push({ kind: "say", speaker: "server", text: payflowLine(world), entry, hold: 2600 }, travel("money", "money-bag", moneyLine, pace.money, 360, "into", 24), { kind: "show", world });
      } else {
        beats.push(travel("money", "money-bag", moneyLine, pace.money, 360, "into", 24));
        answer();
      }
    } else if (input.kind === "statement") {
      const said = bankLine(input);
      const missing = entry.outcome === "MISSING_CREDIT";
      const object: PixelObjectName = missing ? "cross" : entry.outcome === "UNMATCHED_CREDIT" ? "suspense" : "slip";
      beats.push({ kind: "say", speaker: "bank", text: said, hold: holdFor(said) }, travel("slip", object, [...moneyLine].reverse(), pace.slip, 360, entry.outcome === "ALREADY_IMPORTED" ? "away" : "into"));
      answer();
      // Once it's settled (or known lost), the news goes on to the shop.
      const settled = world.flow.status === "RECONCILED" && previous.flow.status !== "RECONCILED";
      if (settled || missing) {
        const home = [...receiptLine].reverse();
        beats.push({ kind: "move", move: { key: `${key}-home`, object, size: 22, frames: [...along(home, 0, pace.home), ...into(home.at(-1)!, pace.home)] }, land: pace.home, focus: 180 });
        beats.push({ kind: "say", speaker: "cashier", text: cashierLine(world, "settled", taps) ?? "" });
      }
    } else {
      // A release, or a rule changed, happens at the server where it is.
      if (input.kind === "release") beats.push({ kind: "say", speaker: "operator", text: "I've checked it. Releasing.", hold: 1500 });
      beats.push({ kind: "show", world, cue }, { kind: "say", speaker: "server", text: payflowLine(world), entry });
    }
    previous = world;
  }
  return beats;
}

/* -------------------------------------------------------------------- World */

const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const conditionsKey = (conditions: Record<string, string>) => JSON.stringify(Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b)));

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
 * Case 01's toy: a small world from a shop to a bank, played like a story in a language game. The
 * goal and the two readings sit at the top, the world in the middle, and the band at the bottom
 * offers what can happen next, or Continue while a scene plays. Each action plays one line at a
 * time; the visitor can also tap whoever is up next in the world.
 */
export function PayWorld({ conditions, isDefault, onChange, onReset, technical, technicalKey }: PayWorldProps) {
  const [world, setWorld] = useState<World>(emptyWorld);
  const [shown, setShown] = useState<World>(emptyWorld);
  const [used, setUsed] = useState<string[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [line, setLine] = useState<Line | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pose, setPose] = useState<"idle" | "tap">("idle");
  const [walking, setWalking] = useState(false);
  const [watching, setWatching] = useState<{ step: number; total: number } | null>(null);
  const [watched, setWatched] = useState(false);
  const [frame, setFrame] = useState({ width: 0, scale: 2 });
  const [focusX, setFocusX] = useState(110);
  const root = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const queue = useRef<Beat[]>([]);
  const timer = useRef<number | null>(null);
  const taps = useRef(0);
  const lines = useRef(0);
  const auto = useRef(false);
  const latest = useRef<World>(emptyWorld);
  const engaged = useRef(false);
  const seen = useRef({ camera: 0, width: 0, scale: 2 });
  const { play } = useSound();

  const available = actionsFor(world, used, technical);
  const hint = playing ? null : nudge(world, used, technical);
  const hintActor = available.find((action) => action.id === hint?.action)?.actor;

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

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

  // A scene's Continue, and then what can happen next, take the keyboard's place when the button that had it goes.
  useEffect(() => {
    if (!engaged.current) return;
    const active = document.activeElement;
    if (active && active !== document.body && !band.current?.contains(active)) return;
    band.current?.querySelector<HTMLButtonElement>("[data-primary]")?.focus({ preventScroll: true });
  }, [waiting, playing]);

  // When the case's conditions change from outside (Reset, a link), the story on offer starts again.
  const signature = conditionsKey(conditions);
  const [seenSignature, setSeenSignature] = useState(signature);
  const [ownSignature, setOwnSignature] = useState<string | null>(null);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    if (signature !== ownSignature) setWatched(false);
  }

  // Once the world is still, a phone's view turns to whoever is up next.
  const nextUp = playing ? null : `${hint?.action ?? ""}:${hintActor ?? ""}`;
  const [seenNextUp, setSeenNextUp] = useState<string | null>(null);
  if (nextUp !== seenNextUp) {
    setSeenNextUp(nextUp);
    if (nextUp && hintActor && hintActor !== "tech") setFocusX(hintActor === "customer" && !world.flow.lastEvent ? 60 : lookAt[hintActor]);
  }

  const inSight = (x: number) => {
    const { camera: offset, width: across, scale: size } = seen.current;
    const spot = x * size + offset;
    return across > 0 && spot > 48 && spot < across - 48;
  };

  /** Plays the next beat. A line that waits for Continue stops the scene there. */
  const later = (ms: number, effect: () => void) => { timer.current = window.setTimeout(() => { timer.current = null; effect(); }, ms); };
  const advance = () => {
    const beat = queue.current.shift();
    if (!beat) {
      setLine(null);
      setMoves([]);
      setWaiting(false);
      setPlaying(false);
      if (auto.current) { auto.current = false; setWatching(null); setWatched(true); }
      return;
    }
    const still = reducedMotion();
    if (beat.kind === "say") {
      lines.current += 1;
      // The view turns only to someone out of sight, and then the line waits for it, so it never slides in.
      const turn = beat.speaker !== "narrator" && !inSight(speakerAt[beat.speaker].x) && !still;
      if (beat.speaker !== "narrator" && !inSight(speakerAt[beat.speaker].x)) setFocusX(speakerAt[beat.speaker].x);
      setLine({ speaker: beat.speaker, text: beat.text, entry: beat.entry, key: lines.current, turn });
      const hold = beat.hold ?? (auto.current ? watchHold(beat.text) : 0);
      if (hold) later(hold + (turn ? TURN : 0), advance);
      else setWaiting(true);
    } else if (beat.kind === "move") {
      setLine(null);
      setFocusX(beat.focus);
      if (beat.cue) play(beat.cue, still ? 0 : Math.max(0, beat.land / 1000 - LANDING));
      if (still) { advance(); return; }
      setMoves([beat.move]);
      later(beat.move.frames.at(-1)!.at, () => { setMoves([]); advance(); });
    } else if (beat.kind === "show") {
      latest.current = beat.world;
      setShown(beat.world);
      if (beat.cue) play(beat.cue);
      advance();
    } else if (beat.kind === "walk") {
      setLine(null);
      setFocusX(60);
      if (still) { advance(); return; }
      setWalking(true);
      later(pace.walk, () => { setWalking(false); advance(); });
    } else if (beat.kind === "pose") {
      setPose(beat.pose);
      advance();
    } else if (beat.kind === "wait") {
      if (still) advance();
      else later(beat.ms, advance);
    } else {
      setWatching({ step: beat.step, total: beat.total });
      advance();
    }
  };

  const proceed = () => {
    if (!waiting) return;
    engaged.current = true;
    setWaiting(false);
    setLine(null);
    advance();
  };

  /** One action: the rules answer at once; the world plays it as a scene. */
  const run = (action: Action, before: World) => {
    const steps = actSteps(before, action);
    const as = action.as ?? action.id;
    if (as === "again" || as === "new-id") taps.current += 1;
    queue.current.push(...scene(before, action, steps, taps.current));
    if (!action.id.startsWith("story-")) setUsed((current) => (current.includes(action.id) ? current : [...current, action.id]));
    return steps.at(-1) ?? before;
  };
  const start = (action: Action) => {
    if (playing) return;
    engaged.current = true;
    setWorld(run(action, world));
    setPlaying(true);
    advance();
  };

  /* Tapping someone in the world does what is on offer for them; while a scene waits, it continues. */
  const tap = (actor: Actor) => {
    if (waiting) { proceed(); return; }
    const theirs = available.filter((action) => action.actor === actor);
    if (playing || !theirs.length) return;
    start(theirs.find((action) => action.id === hint?.action) ?? theirs[0]);
  };

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    queue.current = [];
    auto.current = false;
    taps.current = 0;
    setLine(null);
    setMoves([]);
    setWaiting(false);
    setPlaying(false);
    setPose("idle");
    setWalking(false);
    setWatching(null);
    setFocusX(110);
  };

  /* Watching: the case's story plays itself through the same world, each line holding to be read. */
  const watchIndex = Math.max(0, storyIndex(conditions));
  const watch = (index: number) => {
    clear();
    const story = worldStories[index];
    setOwnSignature(conditionsKey({ ...conditions, ...story.conditions }));
    for (const [key, value] of Object.entries(story.conditions)) if (conditions[key] !== value) onChange(key, value);
    const steps = storyActions(paymentStory({ ...conditions, ...story.conditions }));
    let current = emptyWorld;
    steps.forEach((action, step) => {
      queue.current.push({ kind: "step", step: step + 1, total: steps.length });
      current = run(action, current);
    });
    play("pay.start-over");
    latest.current = emptyWorld;
    setWorld(current);
    setShown(emptyWorld);
    setWatched(false);
    auto.current = true;
    setPlaying(true);
    advance();
  };
  const stopWatching = () => { clear(); setWorld(latest.current); setShown(latest.current); };
  const startOver = () => { clear(); latest.current = emptyWorld; setWorld(emptyWorld); setShown(emptyWorld); setWatched(false); play("pay.start-over"); };

  /* What the world shows. */
  const { width, scale } = frame;
  const worldWidth = W * scale;
  const camera = worldWidth > width + 1 ? Math.min(0, Math.max(width - worldWidth, width / 2 - focusX * scale)) : 0;
  useLayoutEffect(() => { seen.current = { camera, width, scale }; });
  const at = (box: Box): CSSProperties => ({ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale });
  const atCounter = world.flow.lastEvent !== null || walking;
  const label = (action: Action) => (technical ? action.technical : action.label);
  const started = shown.flow.entries.length > 0 || playing;

  // While the world is still, its one line invites what's next, in the voice of whoever does it.
  const invitation = ((): Line | null => {
    if (playing || !hint) return null;
    if (hintActor === "customer" || hintActor === "cashier" || hintActor === "server" || hintActor === "operator") return { speaker: hintActor, text: hint.text, key: -1, invite: true };
    if (hintActor === "signal") return { speaker: "narrator", text: "The signal is slow today: old messages can turn up late.", key: -2, invite: true };
    return { speaker: "narrator", text: hint.text, key: -3, invite: true };
  })();
  const showing = line ?? invitation;
  const stamp = showing?.entry ? stampFor(showing.entry) : null;

  // A bubble stays inside the view: it centres over its speaker and slides in from the view's edges,
  // its tail still pointing at whoever speaks.
  const bubbleStyle = (() => {
    if (!showing || showing.speaker === "narrator") return undefined;
    const spot = showing.speaker === "customer" && !atCounter ? { x: 20, y: 130 } : speakerAt[showing.speaker];
    const anchor = spot.x * scale;
    if (!width) return { left: anchor, top: spot.y * scale } as CSSProperties;
    const half = Math.min(150, width / 2 - 8);
    const left = Math.min(Math.max(anchor, -camera + half + 8), -camera + width - half - 8);
    return { left, top: spot.y * scale, "--tail": `${anchor - left}px`, "--most": `${half * 2}px` } as CSSProperties;
  })();

  const actor = (who: Actor, box: Box, name: string, sprite: ReactNode, extra?: ReactNode) => {
    const theirs = available.filter((action) => action.actor === who);
    const can = theirs.length > 0 && !playing && who !== "bank";
    return (
      <button aria-label={can ? `${name}: ${theirs.map(label).join(" or ")}` : name} className="pw-actor" data-actor={who} data-can={can || undefined} data-nudged={(can && hintActor === who) || undefined} disabled={!can} key={who} onClick={() => tap(who)} style={at(box)} type="button">
        {sprite}
        {extra}
      </button>
    );
  };

  // The suggested one comes first, next to the world; the hand is on it.
  const suggested = available.find((action) => action.id === hint?.action);
  const options = playing ? [] : suggested ? [suggested, ...available.filter((action) => action !== suggested)] : available;
  const primary = options[0];

  return (
    <div className="pay-world" data-playing={playing || undefined} data-technical={technical || undefined} ref={root}>
      <div className="pw-frame">
        <div className="pw-hud">
          {started ? (
            <>
              <span className="pw-chip" data-chip="charged"><PixelObject name="wallet" size={32} /><span><small>Customer charged</small><b key={charged(shown.flow)}>{charged(shown.flow)}</b></span></span>
              <span className="pw-chip" data-chip="bank"><PixelObject name="slip" size={32} /><span><small>In the shop&rsquo;s bank</small><b key={inTheBank(shown.flow)}>{inTheBank(shown.flow)}</b></span></span>
              {technical ? <span className="pw-chip" data-chip="tech"><span><small>payment · inbox</small><b>{shown.flow.status} · {Object.keys(shown.flow.inbox).join(", ") || "empty"}</b></span></span> : null}
            </>
          ) : <p className="pw-goal"><b>Goal:</b> the customer pays {amount(PAYMENT_AMOUNT)} once, and it reaches the shop&rsquo;s bank.</p>}
        </div>

        <div className="pw-view" onClick={proceed} ref={view} style={{ height: H * scale }}>
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
              <polyline className="pw-line" data-line="money" fill="none" points={moneyLine.map((spot) => `${spot.x},${spot.y}`).join(" ")} />
            </svg>

            <span className="pw-prop" style={at(place.machine)}><PixelSprite name="card-machine" /></span>
            {actor("customer", atCounter ? place.customer : place.customerStart, "The customer", <PixelSprite key={walking ? "walking" : "still"} name={walking ? "customer-walk-b" : "customer-walk-a"} />, walking ? <WalkFrom from={place.customerStart} scale={scale} to={place.customer} /> : null)}
            {actor("cashier", place.cashier, "The cashier", <PixelSprite name={pose === "tap" ? "cashier-tap" : "cashier"} />)}
            {actor("signal", place.antenna, "The signal", <PixelSprite name="antenna" />)}
            {actor("server", place.server, "Payflow's server", <PixelSprite name="server" />)}
            {actor("operator", place.operator, "Payflow's checker", <PixelSprite name="operator" />)}
            {actor("bank", place.bank, "The bank", <PixelSprite name="bank" />)}

            {moves.map((move) => <MoveSprite key={move.key} move={move} scale={scale} />)}

            {showing && showing.speaker !== "narrator" ? (
              <p className="pw-bubble" data-hit={stamp?.tone === "adverse" ? "bad" : undefined} data-invite={showing.invite || undefined} data-speaker={showing.speaker} data-turn={showing.turn || undefined} key={`line-${showing.key}`} style={bubbleStyle}>
                <span className="pw-bubble-head">
                  <b>{speakerName[showing.speaker]}</b>
                  {stamp ? <span className="pw-bubble-stamp" data-tone={stamp.tone}>{technical ? stamp.technical : stamp.word}</span> : null}
                </span>
                <span className="pw-bubble-text">{showing.text}</span>
              </p>
            ) : null}
          </div>
          {showing?.speaker === "narrator" ? <p className="pw-narration" data-invite={showing.invite || undefined} key={`line-${showing.key}`}>{showing.text}</p> : null}
        </div>

        <div className="pw-band" ref={band}>
          {waiting ? (
            <button className="pw-continue" data-primary onClick={proceed} type="button">Continue</button>
          ) : playing ? (
            <p className="pw-band-note">{watching ? `Watching: step ${watching.step} of ${watching.total}` : " "}</p>
          ) : options.length ? (
            <div aria-label="What happens next" className="pw-options" role="group">
              {options.map((action) => (
                <button className="pw-option" data-actor={action.actor} data-new={isNew(action, used) || undefined} data-nudged={hint?.action === action.id || undefined} data-primary={action === primary || undefined} key={action.id} onClick={() => start(action)} type="button">
                  {portrait[action.actor] ? <PixelObject name={portrait[action.actor]!} size={32} /> : null}
                  <span>{label(action)}</span>
                  {hint?.action === action.id ? <PixelObject className="pw-option-hand" name="hand-left" size={32} /> : null}
                </button>
              ))}
            </div>
          ) : <p className="pw-band-note">Start over for a fresh payment.</p>}
        </div>
      </div>

      <div className="pw-actions">
        {watching
          ? <button className="sim-secondary" onClick={stopWatching} type="button"><PlayIcon paused />Stop</button>
          : <button className="sim-secondary" onClick={() => watch(watched ? (watchIndex + 1) % worldStories.length : watchIndex)} type="button"><PlayIcon />{watched ? `Watch next: ${worldStories[(watchIndex + 1) % worldStories.length].label.toLowerCase()}` : `Watch it${world.flow.entries.length ? " from the start" : ""}: ${worldStories[watchIndex].label.toLowerCase()}`}</button>}
        <button className="sim-secondary" data-nudged={hint?.action === "" || undefined} disabled={!world.flow.entries.length && !playing} onClick={startOver} type="button"><StartOverIcon />Start over</button>
        {!isDefault && onReset ? <button className="sim-secondary" onClick={onReset} type="button"><ResetIcon />Reset</button> : null}
        {technicalKey}
      </div>

      {technical ? (
        <ol aria-label="What happened, newest first" className="pw-tape">
          {[...shown.flow.entries].reverse().slice(0, 6).map((entry) => <li key={entry.n}><b>#{entry.n} {stampFor(entry).technical}</b> <code>{entry.hood}</code></li>)}
        </ol>
      ) : null}
      <p aria-live="polite" className="sr-only">{line ? `${line.speaker === "narrator" ? "" : `${speakerName[line.speaker]}: `}${line.text}` : ""}</p>
      <p className="sr-only">{shown.flow.entries.length ? `The customer has been charged ${charged(shown.flow)}; a server with no inbox would have charged ${amount(nextDoorCharged(shown.naive))} IDR.` : ""}</p>
    </div>
  );
}

/** The customer's first walk to the counter, played on the sprite already standing there. */
function WalkFrom({ from, scale, to }: { from: Box; scale: number; to: Box }) {
  const ref = useCallback((element: HTMLSpanElement | null) => {
    const button = element?.parentElement;
    if (!button || typeof button.animate !== "function") return;
    button.animate([{ transform: `translate(${(from.x - to.x) * scale}px, ${(from.y - to.y) * scale}px)` }, { transform: "none" }], { duration: pace.walk, easing: "steps(12, end)" });
  }, [from, scale, to]);
  return <span aria-hidden="true" hidden ref={ref} />;
}
