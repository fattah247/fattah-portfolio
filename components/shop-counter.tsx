"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { PlayIcon, ResetIcon, StartOverIcon } from "./icons";
import { PixelObject, type PixelObjectName } from "./pixel-objects";
import { useSound } from "./sound-provider";
import { LANDING, type CueId } from "../lib/sound/engine";
import { PAYMENT_AMOUNT, PAYOUT_NET, paymentStory, statusWord, WRONG_AMOUNT, type FlowEntry, type FlowOutcome } from "../lib/payment-flow";
import {
  bankKeys,
  cashierLine,
  counterStep,
  counterStories,
  customerCharged,
  emptyCounter,
  fateOf,
  flowSteps,
  isNew,
  machineKeys,
  nextDoorCharged,
  nextDoorFlags,
  nextDoorLine,
  nextDoorStatus,
  nudge,
  ruleKeys,
  stampFor,
  storyIndex,
  storyKeys,
  tillKeys,
  type Counter,
  type CounterKey,
} from "../lib/shop-counter";

/**
 * The beats of one key press, so the eye can follow it: what the key sent crosses the counter, the
 * cashier looks at it, the stamp comes down, then it goes where its stamp sends it and the money
 * moves (or doesn't). The counter's readings change on those beats, never before.
 */
export const beats = { travel: 560, near: 160, look: 140, stamp: 200, fate: 480 } as const;
const storyStepMs = 2600;

/** Every outcome has its sound, so a pressed key and the played story sound alike. */
export const counterCue: Record<FlowOutcome, CueId> = {
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

const cueFor = (entry: FlowEntry, counter: Counter) => (entry.outcome === "LANDED" && counter.flow.status === "RECONCILED" ? "pay.report-matches" : counterCue[entry.outcome]);

type Point = { x: number; y: number };
type Frame = Point & { at: number; scale?: number; opacity?: number };
/** A sprite crossing the counter for one press: its path, as points at moments (ms). */
type Move = { key: string; object: PixelObjectName; ghost?: boolean; size: 32 | 48; frames: Frame[] };
type Press = { key: CounterKey; from: Point | null; before: Counter };

const conditionsKey = (conditions: Record<string, string>) => JSON.stringify(Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b)));
const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const captures = (counter: Counter) => counter.flow.journals.filter((journal) => journal === "CAPTURE").length;
const idr = (amount: number) => `${amount.toLocaleString("en-US")} IDR`;

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
    <div aria-hidden="true" className="sc-move" data-ghost={move.ghost || undefined} ref={ref} style={{ transform: `translate(${move.frames[0].x}px, ${move.frames[0].y}px) translate(-50%, -50%)` }}>
      <PixelObject ghost={move.ghost} name={move.object} size={move.size} />
    </div>
  );
}

type ShopCounterProps = {
  conditions: Record<string, string>;
  isDefault: boolean;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  technical: boolean;
  /** The "Technical details" key, kept with the toy's own actions. */
  technicalKey?: ReactNode;
};

/**
 * Case 01's toy: a customer pays 750,000 IDR by card at a shop counter. The visitor presses the card
 * machine's keys (the payment provider); Payflow, the cashier, decides whether any money moves.
 */
export function ShopCounter({ conditions, isDefault, onChange, onReset, technical, technicalKey }: ShopCounterProps) {
  /** The counter as the rules have it, and as it is shown on the stamp's and the fate's beats. */
  const [counter, setCounter] = useState<Counter>(emptyCounter);
  const [stamped, setStamped] = useState<Counter>(emptyCounter);
  const [settled, setSettled] = useState<Counter>(emptyCounter);
  const [used, setUsed] = useState<string[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState<{ step: number; total: number } | null>(null);
  const [watched, setWatched] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const wallet = useRef<HTMLSpanElement>(null);
  const machine = useRef<HTMLSpanElement>(null);
  const spike = useRef<HTMLSpanElement>(null);
  const drawer = useRef<HTMLSpanElement>(null);
  const readings = useRef<HTMLUListElement>(null);
  const manager = useRef<HTMLDivElement>(null);
  const bank = useRef<HTMLSpanElement>(null);
  const ghostWallet = useRef<HTMLSpanElement>(null);
  const ghostTill = useRef<HTMLSpanElement>(null);
  const beatTimers = useRef<number[]>([]);
  const storyTimers = useRef<number[]>([]);
  const pending = useRef<Press | null>(null);
  const { play } = useSound();

  const machineSet = machineKeys(counter, used);
  const tillSet = tillKeys(counter, used);
  const bankSet = bankKeys(counter);
  const ruleSet = technical ? ruleKeys(counter) : [];
  const hint = watching || busy ? null : nudge(counter, used, technical);

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

  /** Where an element's centre sits inside the toy. */
  const centreOf = useCallback((element: Element | null | undefined): Point | null => {
    if (!element || !root.current) return null;
    const box = element.getBoundingClientRect();
    const frame = root.current.getBoundingClientRect();
    return { x: box.left + box.width / 2 - frame.left, y: box.top + box.height / 2 - frame.top };
  }, []);

  const showNow = (next: Counter) => { setStamped(next); setSettled(next); };
  const stopWatching = () => { storyTimers.current.forEach(window.clearTimeout); storyTimers.current = []; setWatching(null); };

  /** One key pressed: the rules answer at once, the counter shows it on its beats. */
  const pressKey = (key: CounterKey, from: Point | null) => {
    pending.current = { key, from, before: counter };
    setCounter(counterStep(counter, key));
    if (!key.id.startsWith("story-")) setUsed((current) => (current.includes(key.id) ? current : [...current, key.id]));
  };

  // Once the counter has drawn the new state (so every destination exists), lay out the press's
  // moves and beats, and play its sound so the knock lands with the stamp.
  useLayoutEffect(() => {
    const press = pending.current;
    if (!press) return;
    pending.current = null;
    beatTimers.current.forEach(window.clearTimeout);
    beatTimers.current = [];
    const entry = counter.flow.entries.at(-1);
    if (!entry || entry === press.before.flow.entries.at(-1)) { showNow(counter); return; }
    const still = reducedMotion() || !root.current;
    const input = press.key.input;
    // What the card machine sends, and the day's money, cross the counter; the rest happens in place.
    const crosses = input.kind === "webhook" || input.kind === "report" || input.kind === "settle";
    const arrive = crosses ? beats.travel : beats.near;
    const stampAt = still ? 0 : arrive + beats.look;
    const fateAt = still ? 0 : stampAt + beats.stamp;
    const end = fateAt + beats.fate;
    play(cueFor(entry, counter), still ? 0 : Math.max(0, stampAt / 1000 - LANDING));
    if (still) { showNow(counter); setMoves([]); setBusy(false); return; }

    const fate = fateOf(entry);
    const arc = (a: Point, b: Point, lift = 48): Point => ({ x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - lift });
    const at = (element: Element | null) => centreOf(element);
    const from = at(machine.current) ?? press.from ?? { x: 0, y: 0 };
    const next: Move[] = [];
    const id = `${entry.n}`;

    if (input.kind === "webhook" || input.kind === "report") {
      const to = input.kind === "report" ? at(readings.current) ?? from : at(spike.current) ?? from;
      const leave = fate === "held" ? at(manager.current) ?? to : fate === "bounced" || fate === "returned" ? from : to;
      const keep = fate === "spiked" || fate === "held";
      next.push({
        key: `${id}-paper`, object: input.kind === "report" ? "report" : "receipt", size: 48, frames: [
          { ...from, at: 0, scale: 0.6 },
          { ...arc(from, to), at: arrive / 2 },
          { ...to, at: arrive },
          { ...to, at: fateAt },
          { ...arc(to, leave, keep ? 16 : 48), at: fateAt + beats.fate / 2 },
          { ...leave, at: end, scale: keep ? 0.4 : 0.6, opacity: keep ? 0 : 0.3 },
        ],
      });
      // Next door, the same receipt lands on a till that trusts it.
      const ghost = input.kind === "webhook" ? at(ghostTill.current) : null;
      if (ghost) next.push({ key: `${id}-ghost-paper`, object: "receipt", ghost: true, size: 48, frames: [{ ...from, at: 0, scale: 0.6 }, { ...arc(from, ghost, 16), at: arrive / 2 }, { ...ghost, at: arrive }, { ...ghost, at: end, opacity: 0 }] });
    } else if (input.kind === "settle") {
      const till = at(drawer.current) ?? from;
      const vault = at(bank.current) ?? till;
      const back = fate === "refused" ? till : vault;
      next.push({ key: `${id}-money`, object: "note", size: 48, frames: [{ ...till, at: 0 }, { ...arc(till, vault), at: arrive / 2 }, { ...vault, at: arrive }, { ...vault, at: fateAt }, { ...back, at: end, scale: fate === "refused" ? 1 : 0.4, opacity: fate === "refused" ? 0.3 : 0 }] });
      // The provider keeps its fee: a coin goes back to the card machine.
      if (fate === "banked") next.push({ key: `${id}-fee`, object: "coin", size: 32, frames: [{ ...till, at: 0, opacity: 0 }, { ...till, at: fateAt }, { ...arc(till, from, 32), at: fateAt + beats.fate / 2 }, { ...from, at: end, opacity: 0 }] });
    } else if (input.kind === "statement") {
      const vault = at(bank.current) ?? from;
      const till = at(readings.current) ?? vault;
      if (entry.outcome === "LANDED" || entry.outcome === "ALREADY_IMPORTED" || entry.outcome === "RULE_BROKEN") next.push({ key: `${id}-slip`, object: "slip", size: 32, frames: [{ ...vault, at: 0, scale: 0.5, opacity: 0 }, { ...vault, at: arrive, scale: 1 }, { ...vault, at: fateAt }, { ...arc(vault, till, 32), at: fateAt + beats.fate / 2 }, { ...till, at: end, scale: 0.6, opacity: 0 }] });
    }
    // The customer's money leaves their wallet only when Payflow takes it; next door, on every “paid”.
    const note = captures(counter) > captures(press.before) ? at(drawer.current) : null;
    const purse = at(wallet.current);
    if (note && purse) next.push({ key: `${id}-note`, object: "note", size: 48, frames: [{ ...purse, at: 0, opacity: 0 }, { ...purse, at: fateAt }, { ...arc(purse, note, 64), at: fateAt + beats.fate / 2 }, { ...note, at: end, scale: 0.7 }] });
    const ghostNote = counter.naive.captures > press.before.naive.captures ? at(ghostTill.current) : null;
    const ghostPurse = at(ghostWallet.current);
    if (ghostNote && ghostPurse) next.push({ key: `${id}-ghost-note`, object: "note", ghost: true, size: 48, frames: [{ ...ghostPurse, at: 0, opacity: 0 }, { ...ghostPurse, at: fateAt }, { ...arc(ghostPurse, ghostNote, 24), at: fateAt + beats.fate / 2 }, { ...ghostNote, at: end, scale: 0.7 }] });

    setMoves(next);
    setBusy(true);
    const shown = counter;
    beatTimers.current.push(
      window.setTimeout(() => setStamped(shown), stampAt),
      window.setTimeout(() => setSettled(shown), fateAt),
      window.setTimeout(() => { setMoves([]); setBusy(false); }, end + 40),
    );
  }, [counter, centreOf, play]);

  // Presses are handled once for the whole counter: each key carries its id.
  const keysById = new Map([...machineSet, ...tillSet, ...bankSet, ...ruleSet].map((key) => [key.id, key]));
  const onCounterClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const element = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-key]");
    const key = element ? keysById.get(element.dataset.key ?? "") : undefined;
    if (!element || !key) return;
    stopWatching();
    pressKey(key, centreOf(element));
  };

  /* Watching: the case's story, one press every 2.6 s, through the same counter. */
  const watchIndex = Math.max(0, storyIndex(conditions));
  const watch = (index: number) => {
    stopWatching();
    const story = counterStories[index];
    setOwnSignature(conditionsKey({ ...conditions, ...story.conditions }));
    for (const [key, value] of Object.entries(story.conditions)) if (conditions[key] !== value) onChange(key, value);
    const keys = storyKeys(paymentStory({ ...conditions, ...story.conditions }));
    setCounter(emptyCounter);
    showNow(emptyCounter);
    setWatched(false);
    play("pay.start-over");
    if (reducedMotion()) {
      const end = keys.reduce(counterStep, emptyCounter);
      setCounter(end);
      showNow(end);
      setWatched(true);
      return;
    }
    setWatching({ step: 0, total: keys.length });
    let current = emptyCounter;
    keys.forEach((key, step) => {
      storyTimers.current.push(window.setTimeout(() => {
        pending.current = { key, from: null, before: current };
        current = counterStep(current, key);
        setCounter(current);
        if (step + 1 === keys.length) { setWatching(null); setWatched(true); }
        else setWatching({ step: step + 1, total: keys.length });
      }, step * storyStepMs + 300));
    });
  };
  const startOver = () => {
    stopWatching();
    beatTimers.current.forEach(window.clearTimeout);
    setCounter(emptyCounter);
    showNow(emptyCounter);
    setMoves([]);
    setBusy(false);
    setWatched(false);
    play("pay.start-over");
  };

  /* What the counter shows: the stamp and the cashier's words on the stamp's beat, the money on the fate's. */
  const { flow, naive } = settled;
  const said = stamped.flow.entries.at(-1);
  const tillEntry = [...stamped.flow.entries].reverse().find((entry) => entry.input.kind === "webhook" || entry.input.kind === "report" || entry.input.kind === "release");
  const tillStamp = tillEntry ? stampFor(tillEntry) : null;
  const bankEntry = [...stamped.flow.entries].reverse().find((entry) => entry.input.kind === "settle" || entry.input.kind === "statement");
  const bankStamp = bankEntry ? stampFor(bankEntry) : null;
  const steps = flowSteps(settled);
  const charged = customerCharged(settled);
  const ghostCharged = nextDoorCharged(naive);
  const flags = nextDoorFlags(naive);
  const nextDoor = nextDoorLine(settled);
  const receipts = Object.keys(flow.inbox).length;
  const suspense = flow.breaks.filter((item) => item === "UNMATCHED_CREDIT").length;
  const isHeld = flow.status === "MANUAL_REVIEW";
  const latest = counter.flow.entries.at(-1);
  const inBank = flow.payout === "LANDED" ? PAYOUT_NET : 0;

  const keyButton = (key: CounterKey) => (
    <button className="sc-key" data-key={key.id} data-new={isNew(key, used) || undefined} data-nudged={hint?.key === key.id || undefined} key={key.id} type="button">
      <span><b>{technical ? key.technical : key.label}</b><small>{key.hint}</small></span>
      {isNew(key, used) ? <em className="sc-new">New</em> : null}
      {hint?.key === key.id ? <PixelObject className="sc-point" name="hand-left" size={32} /> : null}
    </button>
  );
  const keyGroup = (name: string, keys: CounterKey[]) => (keys.length ? <div aria-label={`${name}'s keys`} className="sc-keys" role="group"><p className="sc-keys-name">{name}</p>{keys.map(keyButton)}</div> : null);

  return (
    <div className="shop-counter" data-busy={busy || undefined} data-technical={technical || undefined} onClick={onCounterClick} ref={root}>
      <ol aria-label="Where the money is" className="sc-flow">
        {steps.map((step) => (
          <li data-state={step.state} key={step.id}>
            <i aria-hidden="true" />
            <span><b>{step.label}</b><small>{step.note}</small></span>
          </li>
        ))}
      </ol>

      <div className="sc-scene">
        <section aria-label="The customer" className="sc-object" data-object="customer">
          <div className="sc-figure">
            <PixelObject name="customer" size={48} />
            <span className="sc-wallet" ref={wallet}><PixelObject name="wallet" size={32} /></span>
            <p><b>The customer</b><small>{charged ? `paid ${idr(charged)}, once` : isHeld ? "nothing taken: on hold" : `${idr(PAYMENT_AMOUNT)} to pay`}</small></p>
          </div>
        </section>
        <section aria-label="The card machine: the payment provider" className="sc-object" data-object="machine">
          <div className="sc-figure">
            <span ref={machine}><PixelObject name="card-machine" size={48} /></span>
            <p><b>The card machine</b><small>{technical ? "provider webhooks" : "the payment provider: it tells Payflow"}</small></p>
          </div>
          {keyGroup("The card machine", machineSet)}
        </section>
        <section aria-label="Payflow's till" className="sc-object" data-object="till">
          <div className="sc-figure">
            <span className="sc-till">
              <PixelObject className="sc-cashier" key={said?.n ?? 0} name={said?.tone === "adverse" ? "clerk-worried" : said?.tone === "uncertain" ? "clerk-hand" : "clerk"} size={48} />
              <span ref={spike}><PixelObject name="till" size={48} /></span>
            </span>
            <p><b>Payflow&rsquo;s till</b><small>{technical ? `inbox: ${Object.keys(flow.inbox).join(", ") || "empty"}` : receipts === 1 ? "1 receipt on the spike" : `${receipts} receipts on the spike`}</small></p>
            <div className="sc-display" data-state={flow.status.toLowerCase()} key={`${flow.status}-${captures(settled)}`}>
              <strong>{technical ? flow.status : statusWord[flow.status]}</strong>
              <span className="sc-drawer" ref={drawer} aria-label={`Money in the till: ${captures(settled) && flow.payout === "NONE" ? idr(PAYMENT_AMOUNT) : "none"}`}>
                {captures(settled) && flow.payout === "NONE" ? <PixelObject name="note" size={32} /> : null}
              </span>
              <ul className="sc-readings" ref={readings}>
                <li data-done={flow.reportMatched || undefined}>{flow.reportMatched ? <PixelObject name="tick" size={16} /> : <i aria-hidden="true" />}report</li>
                <li data-done={flow.payout === "LANDED" || undefined}>{flow.payout === "LANDED" ? <PixelObject name="tick" size={16} /> : <i aria-hidden="true" />}bank</li>
              </ul>
            </div>
            {tillEntry && tillStamp ? <span className="sc-stamp" data-hit={tillStamp.tone === "adverse" ? "bad" : "land"} data-tone={tillStamp.tone} key={tillEntry.n}>{technical ? tillStamp.technical : tillStamp.word}</span> : null}
            {isHeld ? <div className="sc-manager" ref={manager}><PixelObject name="reviewer" size={32} /><small>{technical ? "MANUAL_REVIEW · AMOUNT_MISMATCH" : `the manager checks ${(counter.flow.lastEvent?.amount ?? WRONG_AMOUNT).toLocaleString("en-US")}`}</small></div> : null}
          </div>
          {keyGroup("Payflow's till", tillSet)}
        </section>
        <section aria-label="The shop's bank" className="sc-object" data-object="bank">
          <div className="sc-figure">
            <span ref={bank}><PixelObject name="bank" size={48} /></span>
            <p><b>The shop&rsquo;s bank</b><small>{technical ? `payout ${flow.payout}${flow.payout !== "NONE" ? " · PFB7F3A2C914E" : ""}` : inBank ? `${idr(inBank)} arrived` : flow.payout === "IN_TRANSIT" ? `${idr(PAYOUT_NET)} on its way` : flow.payout === "BROKEN" ? "the money never arrived" : "nothing yet"}{suspense ? ` · ${suspense} in suspense` : ""}</small></p>
            {bankEntry && bankStamp ? (
              <p className="sc-bank-answer" data-hit={bankStamp.tone === "adverse" ? "bad" : "land"} key={bankEntry.n}>
                {flow.payout === "BROKEN" ? <PixelObject name="cross" size={32} /> : suspense ? <PixelObject name="suspense" size={32} /> : inBank ? <PixelObject name="note" size={32} /> : null}
                <span className="sc-stamp" data-tone={bankStamp.tone}>{technical ? bankStamp.technical : bankStamp.word}</span>
              </p>
            ) : null}
          </div>
          {keyGroup("The shop's bank", bankSet)}
        </section>
      </div>

      <div className="sc-speech" aria-live="polite">
        <p className="sc-speech-line" key={said?.n ?? 0}><span className="sc-speaker">Payflow:</span> {cashierLine(stamped)}</p>
        {watching ? <p className="sc-speech-try">Watching: step {watching.step + 1} of {watching.total}</p> : hint ? <p className="sc-speech-try"><span>Try:</span> {hint.text}</p> : null}
      </div>

      {ruleSet.length ? <div className="sc-rules">{keyGroup("Break a rule, as the repo's tests do", ruleSet)}</div> : null}

      <section aria-label="For comparison, not in the repo: a till that trusts every receipt" className="sc-next-door">
        <p className="sc-next-door-label"><span>For comparison, not in the repo</span><b>Next door: a till that trusts every receipt</b></p>
        <div className="sc-next-door-row">
          <PixelObject ghost name="customer" size={48} />
          <span ref={ghostWallet}><PixelObject ghost name="wallet" size={32} /></span>
          <strong data-bad={ghostCharged > PAYMENT_AMOUNT || undefined}>{ghostCharged ? `charged ${idr(ghostCharged)}` : "nothing charged"}</strong>
          <span ref={ghostTill}><PixelObject ghost name="till" size={48} /></span>
          <small>{nextDoorStatus(naive)}</small>
          {flags.map((flag) => <span className="sc-stamp" data-tone="adverse" key={flag.id}>{flag.word}</span>)}
        </div>
        {nextDoor ? <p className="sc-next-door-now">{nextDoor}</p> : null}
      </section>

      <div className="sc-actions">
        {watching
          ? <button className="sim-secondary" onClick={stopWatching} type="button"><PlayIcon paused />Stop</button>
          : <button className="sim-secondary" onClick={() => watch(watched ? (watchIndex + 1) % counterStories.length : watchIndex)} type="button"><PlayIcon />{watched ? `Watch next: ${counterStories[(watchIndex + 1) % counterStories.length].label.toLowerCase()}` : `Watch it${counter.flow.entries.length ? " from the start" : ""}: ${counterStories[watchIndex].label.toLowerCase()}`}</button>}
        <button className="sim-secondary" data-nudged={hint?.key === "" || undefined} disabled={!counter.flow.entries.length && !watching} onClick={startOver} type="button"><StartOverIcon />Start over{hint?.key === "" ? <PixelObject className="sc-point" name="hand-left" size={32} /> : null}</button>
        {!isDefault && onReset ? <button className="sim-secondary" onClick={onReset} type="button"><ResetIcon />Reset</button> : null}
        {technicalKey}
      </div>

      {technical ? (
        <ol aria-label="What happened, newest first" className="sc-tape">
          {[...settled.flow.entries].reverse().slice(0, 6).map((entry) => <li key={entry.n}><b>#{entry.n} {stampFor(entry).technical}</b> <code>{entry.hood}</code></li>)}
        </ol>
      ) : null}
      <p className="sr-only">{latest ? `${stampFor(latest).word}. ${latest.plain}` : ""}</p>

      {moves.map((move) => <MoveSprite key={move.key} move={move} />)}
    </div>
  );
}
