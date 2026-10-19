"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { PlayIcon, ResetIcon, StartOverIcon } from "./icons";
import { PixelObject, type PixelObjectName } from "./pixel-objects";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { PAYMENT_AMOUNT, paymentStory, payoutWord, statusWord, type FlowOutcome } from "../lib/payment-flow";
import {
  bankItems,
  bagItems,
  clerkLine,
  deskStep,
  deskStories,
  emptyDesk,
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

/** How long a thrown envelope flies to the desk; its stamp lands as it arrives. */
export const travelMs = 440;
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

type Arrival = "flight" | "drop" | "still";
const conditionsKey = (conditions: Record<string, string>) => JSON.stringify(Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b)));
type Point = { x: number; y: number };
type Flight = { key: number; object: PixelObjectName; from: Point; to: Point };
type Carry = { item: DeskItem; at: Point; over: boolean };

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
  const [desk, setDesk] = useState<Desk>(emptyDesk);
  const [arrival, setArrival] = useState<Arrival>("still");
  const [flight, setFlight] = useState<Flight | null>(null);
  const [carry, setCarry] = useState<Carry | null>(null);
  const [watching, setWatching] = useState<{ step: number; total: number } | null>(null);
  const [watched, setWatched] = useState(false);
  const room = useRef<HTMLDivElement>(null);
  const deskZone = useRef<HTMLElement>(null);
  const vaultZone = useRef<HTMLDivElement>(null);
  const landing = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const press = useRef<{ item: DeskItem; id: number; start: Point; hold?: number; dragging: boolean; element: HTMLElement } | null>(null);
  const suppressClick = useRef(false);
  const { play } = useSound();

  const { flow, naive } = desk;
  const latest = flow.entries.at(-1);
  const bag = bagItems(desk);
  const tray = trayItem(desk);
  const money = moneyItem(desk);
  const bank = bankItems(desk);
  const rules = ruleItems(desk);
  const hint = watching ? null : nudge(desk);
  const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // When the case's conditions change from outside (Reset, a link), the story on offer starts again;
  // the change a story makes to play itself is the toy's own and keeps "Watch next".
  const signature = conditionsKey(conditions);
  const [seenSignature, setSeenSignature] = useState(signature);
  const [ownSignature, setOwnSignature] = useState<string | null>(null);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    if (signature !== ownSignature) setWatched(false);
  }

  const stopWatching = () => { timers.current.forEach(window.clearTimeout); timers.current = []; setWatching(null); };

  /** Where an element's centre sits inside the room. */
  const centreOf = (element: Element | null): Point | null => {
    if (!element || !room.current) return null;
    const box = element.getBoundingClientRect();
    const frame = room.current.getBoundingClientRect();
    return { x: box.left + box.width / 2 - frame.left, y: box.top + box.height / 2 - frame.top };
  };

  /** Delivers one thing. A thrown one flies to where it lands; its sound lands with it. */
  const deliver = (item: DeskItem, how: Arrival, from?: Element | null) => {
    const target = item.place === "bag" ? landing.current : item.id === "pay-out" ? vaultZone.current : null;
    const flies = how === "flight" && target && !reducedMotion();
    const start = flies ? centreOf(from ?? null) : null;
    const end = flies ? centreOf(target) : null;
    setArrival(flies && start && end ? "flight" : how === "drop" ? "drop" : "still");
    setFlight(flies && start && end ? { key: desk.flow.entries.length + 1, object: item.object as PixelObjectName, from: start, to: end } : null);
    const next = deskStep(desk, item);
    const entry = next.flow.entries.at(-1);
    if (entry && entry !== latest) {
      const cue = entry.outcome === "LANDED" && next.flow.status === "RECONCILED" ? "pay.report-matches" : deskCue[entry.outcome];
      play(cue, flies && start && end ? travelMs / 1000 - LANDING : 0);
    }
    setDesk(next);
  };

  const use = (item: DeskItem, element: HTMLElement | null) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    stopWatching();
    deliver(item, "flight", element);
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
    const element = event.currentTarget;
    press.current = { item, id: event.pointerId, start: { x: event.clientX, y: event.clientY }, dragging: false, element };
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
      if (event.type === "pointerup" && inside(zoneFor(pressed.item), event)) { stopWatching(); deliver(pressed.item, "drop"); }
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

  /* Watching: the courier delivers the case's story, one thing every 2.4 s. */
  const watchIndex = Math.max(0, storyIndex(conditions));
  const watch = (index: number) => {
    stopWatching();
    const story = deskStories[index];
    setOwnSignature(conditionsKey({ ...conditions, ...story.conditions }));
    for (const [key, value] of Object.entries(story.conditions)) if (conditions[key] !== value) onChange(key, value);
    const items = storyItems(paymentStory({ ...conditions, ...story.conditions }));
    let current = emptyDesk;
    setDesk(emptyDesk);
    setArrival("still");
    setFlight(null);
    setWatched(false);
    play("pay.start-over");
    if (reducedMotion()) {
      setDesk(items.reduce(deskStep, emptyDesk));
      setWatched(true);
      return;
    }
    setWatching({ step: 0, total: items.length });
    items.forEach((item, step) => {
      timers.current.push(window.setTimeout(() => {
        const next = deskStep(current, item);
        const entry = next.flow.entries.at(-1);
        if (entry) play(entry.outcome === "LANDED" && next.flow.status === "RECONCILED" ? "pay.report-matches" : deskCue[entry.outcome]);
        current = next;
        setArrival("drop");
        setDesk(next);
        if (step + 1 === items.length) { setWatching(null); setWatched(true); }
        else setWatching({ step: step + 1, total: items.length });
      }, (step + 1) * storyStepMs));
    });
  };
  const startOver = () => { stopWatching(); setDesk(emptyDesk); setArrival("still"); setFlight(null); setWatched(false); play("pay.start-over"); };

  const stamp = latest ? stampFor(latest) : null;
  const deskEntry = [...flow.entries].reverse().find((entry) => entry.input.kind === "webhook" || entry.input.kind === "report");
  const deskStamp = deskEntry ? stampFor(deskEntry) : null;
  const bankEntry = [...flow.entries].reverse().find((entry) => entry.input.kind === "settle" || entry.input.kind === "statement");
  const bankStamp = bankEntry ? stampFor(bankEntry) : null;
  const deskObject: PixelObjectName = deskEntry?.input.kind === "report" ? "report" : deskEntry?.event?.status === "AUTHORIZED" ? "envelope-old" : deskEntry?.event && deskEntry.event.amount !== PAYMENT_AMOUNT ? "envelope-short" : "envelope";
  const inboxIds = Object.keys(flow.inbox);
  const coins = flow.journals.filter((journal) => journal === "CAPTURE").length;
  const flags = nextDoorFlags(naive);
  const nextDoor = nextDoorLine(desk);
  const suspense = flow.breaks.filter((item) => item === "UNMATCHED_CREDIT").length;
  const arrivalStyle = { "--arrive": arrival === "flight" ? `${travelMs}ms` : "0ms" } as CSSProperties;

  const itemButton = (item: DeskItem, className = "mr-item", size: 32 | 48 = 32) => (
    <button
      className={className}
      data-item={item.id}
      data-nudged={hint?.item === item.id || undefined}
      key={item.id}
      onClick={(event) => use(item, event.currentTarget)}
      onPointerDown={item.place === "bag" || item.id === "pay-out" ? onPointerDown(item) : undefined}
      type="button"
    >
      <PixelObject name={item.object as PixelObjectName} size={size} />
      <span><b>{technical ? item.technical : item.label}</b><small>{item.hint}</small></span>
    </button>
  );

  return (
    <div className="mail-room" data-carrying={carry ? true : undefined} data-technical={technical || undefined} ref={room} style={arrivalStyle}>
      <div className="mr-room">
        <section aria-label="Your bag: you are the payment provider's courier" className="mr-bag">
          <p className="mr-place"><PixelObject name="satchel" size={32} /><span><b>You</b><small>the provider&rsquo;s courier</small></span></p>
          <div className="mr-bag-items">{bag.map((item) => itemButton(item))}</div>
        </section>

        <section aria-label="Payflow's desk" className="mr-desk" data-drop-over={(carry && carry.item.id !== "pay-out" && carry.over) || undefined} ref={deskZone}>
          <div className="mr-clerk">
            <PixelObject className="mr-clerk-figure" name={latest?.tone === "adverse" ? "clerk-worried" : latest?.tone === "uncertain" ? "clerk-hand" : "clerk"} size={48} />
            <div aria-live="polite" className="mr-speech">
              <p className="mr-speech-line"><span className="sr-only">The clerk: </span>{clerkLine(desk)}</p>
              {watching ? <p className="mr-speech-try">Watching: step {watching.step + 1} of {watching.total}</p> : hint ? <p className="mr-speech-try"><span>Try:</span> {hint.text}</p> : null}
            </div>
          </div>
          <div className="mr-desk-top">
            <div className="mr-ledger">
              <PixelObject name="ledger" size={32} />
              <span><b>{inboxIds.length}</b><small>{technical ? (inboxIds.length ? `inbox: ${inboxIds.join(", ")}` : "inbox: empty") : inboxIds.length === 1 ? "envelope in the inbox" : "envelopes in the inbox"}</small></span>
            </div>
            <div className="mr-landing" data-hit={deskStamp ? (deskStamp.tone === "adverse" ? "bad" : "land") : undefined} data-place="desk" key={deskEntry?.n ?? 0} ref={landing}>
              <span className="mr-tray-stack">
                {deskEntry ? <PixelObject className="mr-landed" name={deskObject} size={32} /> : null}
                <PixelObject className="mr-in-tray" name="in-tray" size={48} />
              </span>
              {deskEntry && deskStamp ? <span className="mr-stamp" data-tone={deskStamp.tone}>{technical ? deskStamp.technical : deskStamp.word}</span> : <small>Drop envelopes here</small>}
            </div>
          </div>
          {tray ? (
            <div className="mr-tray">
              <PixelObject name="reviewer" size={32} />
              <span><b>On hold for a person</b><small>{technical ? "MANUAL_REVIEW · review case AMOUNT_MISMATCH" : `${(flow.lastEvent?.amount ?? 0).toLocaleString("en-US")} for a ${PAYMENT_AMOUNT.toLocaleString("en-US")} payment`}</small></span>
              {itemButton(tray, "mr-key")}
            </div>
          ) : null}
          {money ? itemButton(money, "mr-item mr-money") : null}
          {rules.length ? <div className="mr-book" role="group" aria-label="The rule book">{rules.map((item) => itemButton(item, "mr-item mr-page"))}</div> : null}
        </section>

        <section aria-label="The payment and the bank" className="mr-bank">
          <div className="mr-card" data-state={flow.status.toLowerCase()} key={`${flow.status}-${coins}`}>
            <span>The payment</span>
            <strong>{technical ? flow.status : statusWord[flow.status]}</strong>
            <div className="mr-card-coins" aria-label={`Money captured: ${coins === 1 ? "once" : `${coins} times`}`}>
              {coins ? Array.from({ length: coins }, (_, index) => <PixelObject key={index} name="coin" size={32} />) : <small>no money yet</small>}
            </div>
            <ul className="mr-card-ticks">
              <li data-done={flow.reportMatched || undefined}>{flow.reportMatched ? <PixelObject name="tick" size={16} /> : <i aria-hidden="true" />}report</li>
              <li data-done={flow.payout === "LANDED" || undefined}>{flow.payout === "LANDED" ? <PixelObject name="tick" size={16} /> : <i aria-hidden="true" />}bank</li>
            </ul>
          </div>
          <div className="mr-vault" data-drop-over={(carry?.item.id === "pay-out" && carry.over) || undefined} data-payout={flow.payout.toLowerCase()} ref={vaultZone}>
            <p className="mr-place"><PixelObject name="vault" size={48} /><span><b>The bank</b><small>{technical ? `payout ${flow.payout}${flow.payout !== "NONE" ? " · PFB7F3A2C914E" : ""}` : flow.payout === "NONE" ? "waiting for a payout" : `payout ${payoutWord[flow.payout]}`}{suspense ? ` · ${suspense} in suspense` : ""}</small></span></p>
            {bankEntry && bankStamp ? (
              <p className="mr-bank-answer" data-hit={bankStamp.tone === "adverse" ? "bad" : "land"} key={bankEntry.n}>
                {flow.payout === "LANDED" ? <PixelObject className="mr-landed" name="slip" size={32} /> : flow.payout === "BROKEN" ? <PixelObject className="mr-landed" name="cross" size={32} /> : suspense ? <PixelObject className="mr-landed" name="suspense" size={32} /> : <PixelObject className="mr-landed" name="money-bag" size={32} />}
                <span className="mr-stamp" data-tone={bankStamp.tone}>{technical ? bankStamp.technical : bankStamp.word}</span>
              </p>
            ) : null}
            {bank.length ? <div className="mr-bank-keys" role="group" aria-label="What the bank does">{bank.map((item) => itemButton(item, "mr-key"))}</div> : null}
          </div>
        </section>
      </div>

      <section aria-label="For comparison, not in the repo: a desk with no inbox" className="mr-next-door">
        <p className="mr-next-door-label"><span>For comparison, not in the repo</span><b>A desk with no inbox, trusting the provider</b></p>
        <div className="mr-next-door-desk">
          <PixelObject ghost name="clerk" size={32} />
          <strong>{nextDoorStatus(naive)}</strong>
          <span className="mr-next-door-coins">{Array.from({ length: Math.min(naive.captures, 5) }, (_, index) => <PixelObject ghost key={index} name="coin" size={32} />)}{naive.captures > 5 ? <small>×{naive.captures}</small> : null}</span>
          {flags.map((flag) => <span className="mr-stamp" data-tone="adverse" key={flag.id}>{flag.word}</span>)}
        </div>
        {nextDoor ? <p className="mr-next-door-now">{nextDoor}</p> : null}
      </section>

      <div className="mr-actions">
        {watching
          ? <button className="sim-secondary" onClick={stopWatching} type="button"><PlayIcon paused />Stop</button>
          : <button className="sim-secondary" onClick={() => watch(watched ? (watchIndex + 1) % deskStories.length : watchIndex)} type="button"><PlayIcon />{watched ? `Watch next: ${deskStories[(watchIndex + 1) % deskStories.length].label.toLowerCase()}` : `Watch it${flow.entries.length ? " on a fresh desk" : ""}: ${deskStories[watchIndex].label.toLowerCase()}`}</button>}
        <button className="sim-secondary" disabled={!flow.entries.length && !watching} onClick={startOver} type="button"><StartOverIcon />Start over</button>
        {!isDefault && onReset ? <button className="sim-secondary" onClick={onReset} type="button"><ResetIcon />Reset</button> : null}
        {technicalKey}
      </div>

      {technical ? (
        <ol aria-label="What happened, newest first" className="mr-tape">
          {[...flow.entries].reverse().slice(0, 6).map((entry) => <li key={entry.n}><b>#{entry.n} {stampFor(entry).technical}</b> <code>{entry.hood}</code></li>)}
        </ol>
      ) : null}
      <p className="sr-only">{stamp ? `${stamp.word}. ${latest?.plain ?? ""}` : ""}</p>

      {flight ? <div aria-hidden="true" className="mr-flight" key={flight.key} onAnimationEnd={() => setFlight(null)} style={{ "--fx": `${flight.from.x}px`, "--fy": `${flight.from.y}px`, "--tx": `${flight.to.x}px`, "--ty": `${flight.to.y}px` } as CSSProperties}><PixelObject name={flight.object} size={32} /></div> : null}
      {carry ? <div aria-hidden="true" className="mr-carry" style={{ "--cx": `${carry.at.x}px`, "--cy": `${carry.at.y}px` } as CSSProperties}><PixelObject name={carry.item.object as PixelObjectName} size={48} /></div> : null}
    </div>
  );
}
