import { cues, renderCue, SAMPLE_RATE, type CueId } from "./engine";

/*
 * Plays the portfolio's cues. Audio starts only after the visitor's first press (browsers require
 * it, and the site never makes a sound on its own). Each cue renders lazily into a few takes and a
 * different take plays each time. Guardrails keep sound from becoming too much:
 *
 * - the same cue within 80 ms plays once;
 * - window sounds (open, close, minimize, snap…) that land within 250 ms of each other are one
 *   action, so only the first plays;
 * - at most four sounds overlap;
 * - nothing plays while the page is hidden, or at "off".
 */

export type SoundLevel = "on" | "quiet" | "off";
export const soundLevels: SoundLevel[] = ["on", "quiet", "off"];

/** Quiet is about a third as loud as On (−10 dB). */
const LEVEL_GAIN: Record<SoundLevel, number> = { on: 1, quiet: Math.pow(10, -10 / 20), off: 0 };
const TAKES = 3;
const REPEAT_MS = 80;
const ACTION_MS = 250;
const MAX_VOICES = 4;

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export type SoundPlayer = ReturnType<typeof createSoundPlayer>;

function defaultContext() {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  // On iPhone, "ambient" follows the ring/silent switch and leaves the visitor's music playing.
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) {
    try {
      session.type = "ambient";
    } catch {
      // Older Safari has no audio session; Web Audio still plays.
    }
  }
  return new Context();
}

export function createSoundPlayer({ level: initial = "quiet", createContext = defaultContext }: { level?: SoundLevel; createContext?: () => AudioContext | null } = {}) {
  let level: SoundLevel = initial;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const takes = new Map<CueId, AudioBuffer[]>();
  const lastTake = new Map<CueId, number>();
  const lastPlayed = new Map<CueId, number>();
  let lastWindowSound = -Infinity;
  let voices = 0;

  const ensureContext = () => {
    if (context) return context;
    context = createContext();
    if (!context) return null;
    master = context.createGain();
    master.gain.value = LEVEL_GAIN[level];
    master.connect(context.destination);
    return context;
  };

  const take = (id: CueId, index: number, ctx: AudioContext) => {
    let list = takes.get(id);
    if (!list) {
      list = [];
      takes.set(id, list);
    }
    if (!list[index]) {
      const rendered = renderCue(id, index);
      const buffer = ctx.createBuffer(2, rendered.L.length, SAMPLE_RATE);
      buffer.copyToChannel(rendered.L, 0);
      buffer.copyToChannel(rendered.R, 1);
      list[index] = buffer;
    }
    return list[index];
  };

  return {
    get level() {
      return level;
    },
    setLevel(next: SoundLevel) {
      level = next;
      // Instant, so the latch that previews the new level already plays at it.
      if (master && context) {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(LEVEL_GAIN[next], context.currentTime);
      }
    },
    /** Call from a press or key handler: browsers only start audio inside one. */
    unlock() {
      const ctx = ensureContext();
      if (ctx?.state === "suspended") void ctx.resume();
    },
    /** True once audio has been started by a press; before that nothing plays. */
    get unlocked() {
      return context !== null;
    },
    play(id: CueId, delaySeconds = 0) {
      if (level === "off" || !(id in cues) || !context || !master) return false;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
      const now = performance.now();
      if (now - (lastPlayed.get(id) ?? -Infinity) < REPEAT_MS) return false;
      const windowSound = id.startsWith("sys.");
      if (windowSound && now - lastWindowSound < ACTION_MS) return false;
      if (voices >= MAX_VOICES) return false;
      if (context.state === "suspended") void context.resume();
      lastPlayed.set(id, now);
      if (windowSound) lastWindowSound = now;
      // The first play uses the prewarmed take; after that, any take but the last one.
      const previous = lastTake.get(id);
      const index = previous === undefined ? 0 : (previous + 1 + Math.floor(Math.random() * (TAKES - 1))) % TAKES;
      lastTake.set(id, index);
      const source = context.createBufferSource();
      source.buffer = take(id, index, context);
      source.connect(master);
      voices++;
      source.onended = () => {
        voices--;
        source.disconnect();
      };
      source.start(context.currentTime + Math.max(0, delaySeconds));
      return true;
    },
    /** Renders one take of each cue ahead of use, one per idle moment, so a first press never waits. */
    prewarm(ids: CueId[] = Object.keys(cues) as CueId[]) {
      const ctx = context;
      if (!ctx) return;
      const queue = [...ids];
      const idle: (fn: () => void) => void = typeof window.requestIdleCallback === "function"
        ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
        : (fn) => window.setTimeout(fn, 40);
      const step = () => {
        const id = queue.shift();
        if (!id) return;
        take(id, 0, ctx);
        idle(step);
      };
      idle(step);
    },
  };
}
