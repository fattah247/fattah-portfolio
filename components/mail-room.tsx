"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { PlayIcon, ResetIcon, StartOverIcon } from "./icons";
import { PixelObject, type PixelObjectName } from "./pixel-objects";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { PAYMENT_AMOUNT, paymentStory, payoutWord, statusWord, type FlowEntry, type FlowOutcome } from "../lib/payment-flow";
import {
  bankItems,
  bagItems,
  clerkLine,
  deskStep,
  deskStories,
  emptyDesk,
  fateOf,
  isNew,
  moneyItem,
  nextDoorFlags,
  nextDoorLine,
  nextDoorStatus,
  nudge,
  ruleItems,
  stampFor,
  storyIndex,
  storyItems,
  trayItem,
  type Desk,
  type DeskItem,
} from "../lib/mail-room";

/**
 * The beats of one delivery, so the eye can follow it: the envelope flies to the in-tray (or is
 * dropped there), the clerk looks it up, the stamp comes down, then the envelope goes where its
 * stamp sends it. The room's indicators change on those beats, never before.
 */
export const beats = { fly: 560, drop: 160, look: 140, stamp: 200, fate: 440 } as const;
const storyStepMs = 2400;

/** Every outcome has its sound, so a thrown envelope, a dropped one and the story sound alike. */
export const deskCue: Record<FlowOutcome, CueId> = {
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

const cueFor = (entry: FlowEntry, desk: Desk) => (entry.outcome === "LANDED" && desk.flow.status === "RECONCILED" ? "pay.report-matches" : deskCue[entry.outcome]);

type Point = { x: number; y: number };
type Frame = Point & { at: number; scale?: number; opacity?: number };
/** A sprite crossing the room for one delivery: its path, as points at moments (ms). */
type Move = { key: string; object: PixelObjectName; ghost?: boolean; size: 32 | 48; frames: Frame[] };
type Carry = { item: DeskItem; at: Point; over: boolean };
type Delivery = { item: DeskItem; how: "flight" | "drop" | "story"; from: Point | null; before: Desk };
type Coach = { item: string; path: Point[] | null; label: string; at: Point };

const conditionsKey = (conditions: Record<string, string>) => JSON.stringify(Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b)));
const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const captures = (desk: Desk) => desk.flow.journals.filter((journal) => journal === "CAPTURE").length;

/** Plays a move's path with the Web Animations API, in steps, so it reads as pixels moving. */
function MoveSprite({ move }: { move: Move }) {
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
          transform: `translate(${frame.x}px, ${frame.y}px) translate(-50%, -50%) scale(${frame.scale ?? 1})`,
          easing: travels ? `steps(${Math.max(3, Math.round((next.at - frame.at) / 55))}, end)` : "linear",
        };
      }),
      { duration: end, fill: "forwards" },
    );
  }, [move]);
  return (
    <div aria-hidden="true" className="mr-move" data-ghost={move.ghost || undefined} ref={ref} style={{ transform: `translate(${move.frames[0].x}px, ${move.frames[0].y}px) translate(-50%, -50%)` }}>
      <PixelObject ghost={move.ghost} name={move.object} size={move.size} />
    </div>
  );
}

type MailRoomProps = {
  conditions: Record<string, string>;
  isDefault: boolean;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  technical: boolean;
  /** The "Technical details" key, kept with the toy's own actions. */
  technicalKey?: ReactNode;
};

/**
 * Case 01's toy: the visitor is the provider's courier, Payflow the clerk who stamps every envelope.
 * Things are thrown (a press) or carried (a drag) onto the desk; both deliver the same thing.
 */
export function MailRoom({ conditions, isDefault, onChange, onReset, technical, technicalKey }: MailRoomProps) {
  /** The desk as the rules have it, and the desk as the room shows it on the stamp's and the fate's beats. */
  const [desk, setDesk] = useState<Desk>(emptyDesk);
  const [stamped, setStamped] = useState<Desk>(emptyDesk);
  const [settled, setSettled] = useState<Desk>(emptyDesk);
  const [used, setUsed] = useState<string[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [busy, setBusy] = useState(false);
  const [carry, setCarry] = useState<Carry | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [watching, setWatching] = useState<{ step: number; total: number } | null>(null);
  const [watched, setWatched] = useState(false);
  const room = useRef<HTMLDivElement>(null);
  const deskZone = useRef<HTMLElement>(null);
  const bagZone = useRef<HTMLElement>(null);
  const vaultZone = useRef<HTMLDivElement>(null);
  const landing = useRef<HTMLDivElement>(null);
  const ledger = useRef<HTMLDivElement>(null);
  const cardCoins = useRef<HTMLDivElement>(null);
  const cardTicks = useRef<HTMLUListElement>(null);
  const trayZone = useRef<HTMLDivElement>(null);
  const bookZone = useRef<HTMLDivElement>(null);
  const nextDoorDesk = useRef<HTMLDivElement>(null);
  const nextDoorCoins = useRef<HTMLSpanElement>(null);
  const startOverKey = useRef<HTMLButtonElement>(null);
  const beatTimers = useRef<number[]>([]);
  const storyTimers = useRef<number[]>([]);
  const pending = useRef<Delivery | null>(null);
  const press = useRef<{ item: DeskItem; id: number; start: Point; hold?: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const { play } = useSound();

  const bag = bagItems(desk, used);
  const tray = trayItem(desk);
  const money = moneyItem(desk, used);
  const bank = bankItems(desk);
  const rules = ruleItems(desk);
  const hint = watching ? null : nudge(desk, used);

  useEffect(() => () => [...beatTimers.current, ...storyTimers.current].forEach(window.clearTimeout), []);

  // When the case's conditions change from outside (Reset, a link), the story on offer starts again;
  // the change a story makes to play itself is the toy's own and keeps "Watch next".
  const signature = conditionsKey(conditions);
  const [seenSignature, setSeenSignature] = useState(signature);
  const [ownSignature, setOwnSignature] = useState<string | null>(null);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    if (signature !== ownSignature) setWatched(false);
  }

  /** Where an element's centre sits inside the room. */
  const centreOf = useCallback((element: Element | null | undefined): Point | null => {
    if (!element || !room.current) return null;
    const box = element.getBoundingClientRect();
    const frame = room.current.getBoundingClientRect();
    return { x: box.left + box.width / 2 - frame.left, y: box.top + box.height / 2 - frame.top };
  }, []);

  const showNow = (next: Desk) => { setStamped(next); setSettled(next); };
  const stopWatching = () => { storyTimers.current.forEach(window.clearTimeout); storyTimers.current = []; setWatching(null); };

  /** Delivers one thing: the rules answer at once, the room shows it on its beats. */
  const deliver = (item: DeskItem, how: Delivery["how"], from: Point | null) => {
    const next = deskStep(desk, item);
    pending.current = { item, how, from, before: desk };
    setDesk(next);
    if (!item.id.startsWith("story-")) setUsed((current) => (current.includes(item.id) ? current : [...current, item.id]));
  };

  // Once the room has drawn the new desk (so every destination exists), lay out the delivery's moves
  // and its beats, and play its sound so the knock lands with the stamp.
  useLayoutEffect(() => {
    const delivery = pending.current;
    if (!delivery) return;
    pending.current = null;
    beatTimers.current.forEach(window.clearTimeout);
    beatTimers.current = [];
    const entry = desk.flow.entries.at(-1);
    if (!entry || entry === delivery.before.flow.entries.at(-1)) { showNow(desk); return; }
    const still = reducedMotion() || !room.current;
    // Only what is carried flies; a release, a bank's answer or a page of the rule book happens where it is.
    const carried = ["webhook", "report", "settle"].includes(delivery.item.input.kind);
    const arrive = carried && delivery.how !== "drop" ? beats.fly : beats.drop;
    const stampAt = still ? 0 : arrive + beats.look;
    const fateAt = still ? 0 : stampAt + beats.stamp;
    const end = fateAt + beats.fate;
    play(cueFor(entry, desk), still ? 0 : Math.max(0, stampAt / 1000 - LANDING));
    if (still) { showNow(desk); setMoves([]); setBusy(false); return; }

    const fate = fateOf(entry);
    const input = delivery.item.input;
    const from = delivery.from ?? centreOf(bagZone.current) ?? { x: 0, y: 0 };
    const tray = centreOf(landing.current) ?? from;
    const vault = centreOf(vaultZone.current) ?? from;
    const arc = (a: Point, b: Point, lift = 56): Point => ({ x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - lift });
    const next: Move[] = [];
    const key = `${entry.n}`;
    const object = delivery.item.object as PixelObjectName;

    if (input.kind === "webhook" || input.kind === "report") {
      const fatePoint = fate === "held" ? centreOf(trayZone.current) : fate === "bounced" || fate === "returned" ? from : input.kind === "report" ? centreOf(cardTicks.current) : centreOf(ledger.current);
      const leave = fatePoint ?? tray;
      const goesIn = fate === "filed" || fate === "held";
      next.push({
        key: `${key}-envelope`, object, size: 48, frames: [
          { ...from, at: 0, scale: 0.7 },
          { ...arc(from, tray), at: arrive / 2 },
          { ...tray, at: arrive },
          { ...tray, at: fateAt },
          { ...arc(tray, leave, goesIn ? 24 : 64), at: fateAt + beats.fate / 2 },
          { ...leave, at: end, scale: goesIn ? 0.5 : 0.7, opacity: goesIn ? 0 : 0.4 },
        ],
      });
      // Next door, the same envelope lands on a desk with no inbox.
      const ghostDesk = input.kind === "webhook" ? centreOf(nextDoorDesk.current) : null;
      if (ghostDesk) next.push({ key: `${key}-ghost`, object, ghost: true, size: 48, frames: [{ ...from, at: 0, scale: 0.7 }, { ...arc(from, ghostDesk, 24), at: arrive / 2 }, { ...ghostDesk, at: arrive }, { ...ghostDesk, at: end, opacity: 0 }] });
    } else if (input.kind === "settle") {
      const back = fate === "refused" ? from : vault;
      next.push({
        key: `${key}-money`, object: "money-bag", size: 48, frames: [
          { ...from, at: 0, scale: 0.8 },
          { ...arc(from, vault), at: arrive / 2 },
          { ...vault, at: arrive },
          { ...vault, at: fateAt },
          { ...back, at: end, scale: fate === "refused" ? 0.8 : 0.4, opacity: fate === "refused" ? 0.4 : 0 },
        ],
      });
    } else if (input.kind === "statement") {
      const card = centreOf(cardTicks.current) ?? vault;
      if (entry.outcome !== "MISSING_CREDIT") next.push({ key: `${key}-slip`, object: entry.outcome === "UNMATCHED_CREDIT" ? "suspense" : "slip", size: 32, frames: [{ ...vault, at: 0, scale: 0.5, opacity: 0 }, { ...vault, at: arrive / 2, scale: 1 }, { ...vault, at: fateAt }, { ...(entry.outcome === "UNMATCHED_CREDIT" ? vault : card), at: end, scale: 0.6, opacity: 0 }] });
    } else if (input.kind === "mutate") {
      const book = centreOf(bookZone.current) ?? from;
      const lifted = { x: book.x, y: book.y - 64 };
      next.push({ key: `${key}-page`, object: "report", size: 32, frames: input.removed ? [{ ...book, at: 0 }, { ...lifted, at: fateAt }, { ...lifted, at: end, opacity: 0 }] : [{ ...lifted, at: 0, opacity: 0 }, { ...lifted, at: arrive / 2 }, { ...book, at: fateAt, scale: 0.6, opacity: 0 }] });
    }
    // Money captured drops into the payment; next door, every “paid” drops another coin.
    const coin = captures(desk) > captures(delivery.before) ? centreOf(cardCoins.current) : null;
    if (coin) next.push({ key: `${key}-coin`, object: "coin", size: 32, frames: [{ x: coin.x, y: coin.y - 48, at: 0, opacity: 0 }, { x: coin.x, y: coin.y - 48, at: fateAt }, { ...coin, at: fateAt + 280 }, { ...coin, at: end, opacity: 0 }] });
    const ghostCoin = desk.naive.captures > delivery.before.naive.captures ? centreOf(nextDoorCoins.current) : null;
    if (ghostCoin) next.push({ key: `${key}-ghost-coin`, object: "coin", ghost: true, size: 32, frames: [{ x: ghostCoin.x + 20, y: ghostCoin.y - 40, at: 0, opacity: 0 }, { x: ghostCoin.x + 20, y: ghostCoin.y - 40, at: fateAt }, { x: ghostCoin.x + 20, y: ghostCoin.y, at: fateAt + 280 }, { x: ghostCoin.x + 20, y: ghostCoin.y, at: end, opacity: 0 }] });

    setMoves(next);
    setBusy(true);
    const shown = desk;
    beatTimers.current.push(
      window.setTimeout(() => setStamped(shown), stampAt),
      window.setTimeout(() => setSettled(shown), fateAt),
      window.setTimeout(() => { setMoves([]); setBusy(false); }, end + 40),
    );
  }, [desk, centreOf, play]);

  /** A press throws the thing at the desk; a press that ended a drag has already delivered it. */
  const throwItem = (item: DeskItem, element: HTMLElement | null) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    stopWatching();
    deliver(item, "flight", centreOf(element));
  };

  /* Carrying: a press held on an envelope or the money bag picks it up; it follows the pointer 1:1. */
  const zoneFor = (item: DeskItem) => (item.id === "pay-out" ? vaultZone.current : deskZone.current);
  const inside = (zone: Element | null, point: { clientX: number; clientY: number }) => {
    if (!zone) return false;
    const box = zone.getBoundingClientRect();
    return point.clientX >= box.left && point.clientX <= box.right && point.clientY >= box.top && point.clientY <= box.bottom;
  };
  const roomPoint = (event: { clientX: number; clientY: number }): Point => {
    const frame = room.current!.getBoundingClientRect();
    return { x: event.clientX - frame.left, y: event.clientY - frame.top };
  };
  const startCarry = (event: { clientX: number; clientY: number }) => {
    const pressed = press.current;
    if (!pressed || pressed.dragging) return;
    pressed.dragging = true;
    setCarry({ item: pressed.item, at: roomPoint(event), over: inside(zoneFor(pressed.item), event) });
  };
  const onPointerDown = (item: DeskItem) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !room.current) return;
    press.current = { item, id: event.pointerId, start: { x: event.clientX, y: event.clientY }, dragging: false };
    if (event.pointerType === "touch") {
      const point = { clientX: event.clientX, clientY: event.clientY };
      press.current.hold = window.setTimeout(() => startCarry(point), 180);
    }
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const pressed = press.current;
      if (!pressed || event.pointerId !== pressed.id) return;
      if (!pressed.dragging) {
        const far = Math.hypot(event.clientX - pressed.start.x, event.clientY - pressed.start.y) > 6;
        if (event.pointerType === "touch") { if (far) { window.clearTimeout(pressed.hold); press.current = null; } return; }
        if (!far) return;
        startCarry(event);
      }
      setCarry((current) => current && { ...current, at: roomPoint(event), over: inside(zoneFor(current.item), event) });
    };
    const up = (event: PointerEvent) => {
      const pressed = press.current;
      if (!pressed || event.pointerId !== pressed.id) return;
      window.clearTimeout(pressed.hold);
      press.current = null;
      if (!pressed.dragging) return;
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      setCarry(null);
      if (event.type === "pointerup" && inside(zoneFor(pressed.item), event)) { stopWatching(); deliver(pressed.item, "drop", roomPoint(event)); }
    };
    // A carried envelope must not scroll the page under the finger.
    const hold = (event: TouchEvent) => { if (press.current?.dragging) event.preventDefault(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", hold, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", hold);
    };
  });

  /* The guide: a hand on what the clerk suggests, and for something to carry, a path to where it goes. */
  useLayoutEffect(() => {
    const place = () => {
      if (!room.current || busy || carry || watching || !hint) { setCoach(null); return; }
      const target = hint.item === "" ? startOverKey.current : room.current.querySelector<HTMLElement>(`[data-item="${CSS.escape(hint.item)}"]`);
      const at = centreOf(target);
      if (!target || !at) { setCoach(null); return; }
      const box = target.getBoundingClientRect();
      const carried = hint.item === "pay-out" ? vaultZone.current : bag.some((item) => item.id === hint.item) ? landing.current : null;
      const goal = centreOf(carried);
      // The path leaves the key from its side facing the goal and turns once.
      const across = goal && Math.abs(goal.y - at.y) < box.height;
      const start = !goal ? null : across ? { x: goal.x > at.x ? at.x + box.width / 2 : at.x - box.width / 2, y: at.y } : { x: at.x, y: goal.y < at.y ? at.y - box.height / 2 : at.y + box.height / 2 };
      setCoach({
        item: hint.item,
        path: goal && start ? (across ? [start, { x: goal.x, y: start.y }, goal] : [start, { x: start.x, y: goal.y }, goal]) : null,
        label: goal ? (hint.item === "pay-out" ? "Drag it to the bank, or tap it" : "Drag it here, or tap it") : "",
        at: goal ?? at,
      });
    };
    place();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    if (room.current) observer?.observe(room.current);
    return () => observer?.disconnect();
  }, [busy, carry, watching, hint?.item, desk, centreOf]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Watching: the courier delivers the case's story, one thing every 2.4 s, through the same room. */
  const watchIndex = Math.max(0, storyIndex(conditions));
  const watch = (index: number) => {
    stopWatching();
    const story = deskStories[index];
    setOwnSignature(conditionsKey({ ...conditions, ...story.conditions }));
    for (const [key, value] of Object.entries(story.conditions)) if (conditions[key] !== value) onChange(key, value);
    const items = storyItems(paymentStory({ ...conditions, ...story.conditions }));
    setDesk(emptyDesk);
    showNow(emptyDesk);
    setWatched(false);
    play("pay.start-over");
    if (reducedMotion()) {
      const end = items.reduce(deskStep, emptyDesk);
      setDesk(end);
      showNow(end);
      setWatched(true);
      return;
    }
    setWatching({ step: 0, total: items.length });
    let current = emptyDesk;
    items.forEach((item, step) => {
      storyTimers.current.push(window.setTimeout(() => {
        const origin = item.place === "bank" ? centreOf(vaultZone.current) : item.place === "desk" ? centreOf(deskZone.current) : centreOf(bagZone.current);
        pending.current = { item, how: "story", from: origin, before: current };
        current = deskStep(current, item);
        setDesk(current);
        if (step + 1 === items.length) { setWatching(null); setWatched(true); }
        else setWatching({ step: step + 1, total: items.length });
      }, step * storyStepMs + 300));
    });
  };
  const startOver = () => {
    stopWatching();
    beatTimers.current.forEach(window.clearTimeout);
    setDesk(emptyDesk);
    showNow(emptyDesk);
    setMoves([]);
    setBusy(false);
    setWatched(false);
    play("pay.start-over");
  };

  /* What the room shows: the stamp and the clerk's words on the stamp's beat, the rest on the fate's. */
  const { flow, naive } = settled;
  const said = stamped.flow.entries.at(-1);
  const deskEntry = [...stamped.flow.entries].reverse().find((entry) => entry.input.kind === "webhook" || entry.input.kind === "report");
  const deskStamp = deskEntry ? stampFor(deskEntry) : null;
  const bankEntry = [...stamped.flow.entries].reverse().find((entry) => entry.input.kind === "settle" || entry.input.kind === "statement");
  const bankStamp = bankEntry ? stampFor(bankEntry) : null;
  const inboxIds = Object.keys(flow.inbox);
  const coins = captures(settled);
  const flags = nextDoorFlags(naive);
  const nextDoor = nextDoorLine(settled);
  const suspense = flow.breaks.filter((item) => item === "UNMATCHED_CREDIT").length;
  const latest = desk.flow.entries.at(-1);

  // Presses are handled once, for the whole room: each thing's key carries its id.
  const things = new Map([...bag, tray, money, ...bank, ...rules].filter((item): item is DeskItem => item !== null).map((item) => [item.id, item]));
  const onRoomClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const key = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-item]");
    const item = key ? things.get(key.dataset.item ?? "") : undefined;
    if (key && item) throwItem(item, key);
  };

  const itemButton = (item: DeskItem, className = "mr-item", size: 32 | 48 = 32) => (
    <button
      className={className}
      data-item={item.id}
      data-new={isNew(item, used) || undefined}
      data-nudged={hint?.item === item.id || undefined}
      key={item.id}
      onPointerDown={item.place === "bag" || item.id === "pay-out" ? onPointerDown(item) : undefined}
      type="button"
    >
      <PixelObject name={item.object as PixelObjectName} size={size} />
      <span><b>{technical ? item.technical : item.label}</b><small>{item.hint}</small></span>
      {isNew(item, used) ? <em className="mr-new">New</em> : null}
      {coach?.item === item.id ? <PixelObject className="mr-point" name="hand-left" size={32} /> : null}
    </button>
  );

  return (
    <div className="mail-room" data-busy={busy || undefined} data-carrying={carry ? true : undefined} data-technical={technical || undefined} onClick={onRoomClick} ref={room}>
      <div className="mr-room">
        <section aria-label="Your bag: you are the payment provider's courier" className="mr-bag" ref={bagZone}>
          <p className="mr-place"><PixelObject name="satchel" size={32} /><span><b>You, the payment provider</b><small>your envelopes tell Payflow what happened</small></span></p>
          <div className="mr-bag-items">{bag.map((item) => itemButton(item, "mr-item", 48))}</div>
        </section>

        <section aria-label="Payflow's desk" className="mr-desk" data-drop-over={(carry && carry.item.id !== "pay-out" && carry.over) || undefined} ref={deskZone}>
          <div className="mr-clerk">
            <PixelObject className="mr-clerk-figure" key={said?.n ?? 0} name={said?.tone === "adverse" ? "clerk-worried" : said?.tone === "uncertain" ? "clerk-hand" : "clerk"} size={64} />
            <div aria-live="polite" className="mr-speech">
              <p className="mr-speech-line" key={said?.n ?? 0}><span className="sr-only">The clerk: </span>{clerkLine(stamped)}</p>
              {watching ? <p className="mr-speech-try">Watching: step {watching.step + 1} of {watching.total}</p> : hint && !busy ? <p className="mr-speech-try"><span>Try:</span> {hint.text}</p> : null}
            </div>
          </div>
          <div className="mr-desk-top">
            <div className="mr-ledger" ref={ledger}>
              <PixelObject name="ledger" size={48} />
              <span><b key={inboxIds.length}>{inboxIds.length}</b><small>{technical ? (inboxIds.length ? `inbox: ${inboxIds.join(", ")}` : "inbox: empty") : inboxIds.length === 1 ? "envelope in the inbox" : "envelopes in the inbox"}</small></span>
            </div>
            <div className="mr-landing" data-hit={deskStamp ? (deskStamp.tone === "adverse" ? "bad" : "land") : undefined} key={deskEntry?.n ?? 0} ref={landing}>
              <PixelObject className="mr-in-tray" name="in-tray" size={64} />
              {deskEntry && deskStamp ? <span className="mr-stamp" data-tone={deskStamp.tone}>{technical ? deskStamp.technical : deskStamp.word}</span> : <small>Payflow&rsquo;s in-tray</small>}
            </div>
          </div>
          {tray ? (
            <div className="mr-tray" ref={trayZone}>
              <PixelObject name="reviewer" size={48} />
              <span><b>On hold for a person</b><small>{technical ? "MANUAL_REVIEW · review case AMOUNT_MISMATCH" : `${(desk.flow.lastEvent?.amount ?? 0).toLocaleString("en-US")} for a ${PAYMENT_AMOUNT.toLocaleString("en-US")} payment`}</small></span>
              {itemButton(tray, "mr-key")}
            </div>
          ) : null}
          {money ? itemButton(money, "mr-item mr-money", 48) : null}
          {rules.length ? <div className="mr-book" ref={bookZone} role="group" aria-label="The rule book">{rules.map((item) => itemButton(item, "mr-item mr-page"))}</div> : null}
        </section>

        <section aria-label="The payment and the bank" className="mr-bank">
          <div className="mr-card" data-state={flow.status.toLowerCase()} key={`${flow.status}-${coins}`}>
            <span>The payment, 750,000 IDR</span>
            <strong>{technical ? flow.status : statusWord[flow.status]}</strong>
            <div className="mr-card-coins" aria-label={`Money captured: ${coins === 1 ? "once" : `${coins} times`}`} ref={cardCoins}>
              {coins ? Array.from({ length: coins }, (_, index) => <PixelObject key={index} name="coin" size={32} />) : <small>no money yet</small>}
            </div>
            <ul className="mr-card-ticks" ref={cardTicks}>
              <li data-done={flow.reportMatched || undefined}>{flow.reportMatched ? <PixelObject name="tick" size={16} /> : <i aria-hidden="true" />}report</li>
              <li data-done={flow.payout === "LANDED" || undefined}>{flow.payout === "LANDED" ? <PixelObject name="tick" size={16} /> : <i aria-hidden="true" />}bank</li>
            </ul>
          </div>
          <div className="mr-vault" data-drop-over={(carry?.item.id === "pay-out" && carry.over) || undefined} data-payout={flow.payout.toLowerCase()} ref={vaultZone}>
            <p className="mr-place"><PixelObject name="vault" size={48} /><span><b>The bank</b><small>{technical ? `payout ${flow.payout}${flow.payout !== "NONE" ? " · PFB7F3A2C914E" : ""}` : flow.payout === "NONE" ? "waiting for a payout" : `payout ${payoutWord[flow.payout]}`}{suspense ? ` · ${suspense} in suspense` : ""}</small></span></p>
            {bankEntry && bankStamp ? (
              <p className="mr-bank-answer" data-hit={bankStamp.tone === "adverse" ? "bad" : "land"} key={bankEntry.n}>
                {flow.payout === "LANDED" ? <PixelObject name="slip" size={32} /> : flow.payout === "BROKEN" ? <PixelObject name="cross" size={32} /> : suspense ? <PixelObject name="suspense" size={32} /> : <PixelObject name="money-bag" size={32} />}
                <span className="mr-stamp" data-tone={bankStamp.tone}>{technical ? bankStamp.technical : bankStamp.word}</span>
              </p>
            ) : null}
            {bank.length ? <div className="mr-bank-keys" role="group" aria-label="What the bank does">{bank.map((item) => itemButton(item, "mr-key"))}</div> : null}
          </div>
        </section>
      </div>

      <section aria-label="For comparison, not in the repo: a desk with no inbox" className="mr-next-door">
        <p className="mr-next-door-label"><span>For comparison, not in the repo</span><b>Next door: a desk with no inbox, trusting the provider</b></p>
        <div className="mr-next-door-desk" ref={nextDoorDesk}>
          <PixelObject ghost name="clerk" size={48} />
          <strong>{nextDoorStatus(naive)}</strong>
          <span className="mr-next-door-coins" ref={nextDoorCoins}>{Array.from({ length: Math.min(naive.captures, 5) }, (_, index) => <PixelObject ghost key={index} name="coin" size={32} />)}{naive.captures > 5 ? <small>×{naive.captures}</small> : null}</span>
          {flags.map((flag) => <span className="mr-stamp" data-tone="adverse" key={flag.id}>{flag.word}</span>)}
        </div>
        {nextDoor ? <p className="mr-next-door-now">{nextDoor}</p> : null}
      </section>

      <div className="mr-actions">
        {watching
          ? <button className="sim-secondary" onClick={stopWatching} type="button"><PlayIcon paused />Stop</button>
          : <button className="sim-secondary" onClick={() => watch(watched ? (watchIndex + 1) % deskStories.length : watchIndex)} type="button"><PlayIcon />{watched ? `Watch next: ${deskStories[(watchIndex + 1) % deskStories.length].label.toLowerCase()}` : `Watch it${desk.flow.entries.length ? " on a fresh desk" : ""}: ${deskStories[watchIndex].label.toLowerCase()}`}</button>}
        <button className="sim-secondary" data-nudged={coach?.item === "" || undefined} disabled={!desk.flow.entries.length && !watching} onClick={startOver} ref={startOverKey} type="button"><StartOverIcon />Start over{coach?.item === "" ? <PixelObject className="mr-point" name="hand-left" size={32} /> : null}</button>
        {!isDefault && onReset ? <button className="sim-secondary" onClick={onReset} type="button"><ResetIcon />Reset</button> : null}
        {technicalKey}
      </div>

      {technical ? (
        <ol aria-label="What happened, newest first" className="mr-tape">
          {[...settled.flow.entries].reverse().slice(0, 6).map((entry) => <li key={entry.n}><b>#{entry.n} {stampFor(entry).technical}</b> <code>{entry.hood}</code></li>)}
        </ol>
      ) : null}
      <p className="sr-only">{latest ? `${stampFor(latest).word}. ${latest.plain}` : ""}</p>

      {coach ? (
        <div aria-hidden="true" className="mr-coach">
          {coach.path ? (
            <svg className="mr-coach-path" height="100%" width="100%">
              <polyline fill="none" points={coach.path.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(" ")} />
              <rect height="8" width="8" x={Math.round(coach.path.at(-1)!.x) - 4} y={Math.round(coach.path.at(-1)!.y) - 4} />
            </svg>
          ) : null}
          {coach.label ? <span className="mr-coach-label" style={{ transform: `translate(${Math.round(coach.at.x)}px, ${Math.round(coach.at.y)}px) translate(-50%, 18px)` }}>{coach.label}</span> : null}
        </div>
      ) : null}
      {moves.map((move) => <MoveSprite key={move.key} move={move} />)}
      {carry ? <div aria-hidden="true" className="mr-carry" style={{ transform: `translate(${carry.at.x}px, ${carry.at.y}px) translate(-50%, -60%)` }}><PixelObject name={carry.item.object as PixelObjectName} size={48} /></div> : null}
    </div>
  );
}
