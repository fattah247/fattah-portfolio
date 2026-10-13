"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { CueId } from "../lib/sound/engine";
import { createSoundPlayer, soundLevels, type SoundLevel, type SoundPlayer } from "../lib/sound/player";

/*
 * Sound for the whole environment. The level (On, Quiet, Off) starts at Quiet and is remembered on
 * this device. Audio starts on the visitor's first press anywhere, never before, so a page load is
 * always silent; from then on any component can play a cue with `useSound().play(id)`.
 */

export type SoundApi = {
  level: SoundLevel;
  setLevel: (level: SoundLevel) => void;
  play: (id: CueId, delaySeconds?: number) => void;
};

const storageKey = "portfolio-sound-level";
const defaultLevel: SoundLevel = "quiet";
const silent: SoundApi = { level: defaultLevel, setLevel: () => {}, play: () => {} };

/** Without a provider (tests, isolated renders) every cue is a no-op. */
export const SoundContext = createContext<SoundApi>(silent);

export function useSound() {
  return useContext(SoundContext);
}

/*
 * The level is an external store: saved on this device, shared by every tab, and read after
 * hydration so the server and the first client render agree. When storage is blocked the level
 * still holds for this visit, in memory.
 */
const listeners = new Set<() => void>();
let chosen: SoundLevel | null = null;

function savedLevel(): SoundLevel | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return soundLevels.includes(value as SoundLevel) ? (value as SoundLevel) : null;
  } catch {
    return null;
  }
}

const levelStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const fromOtherTab = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      chosen = null;
      listener();
    };
    window.addEventListener("storage", fromOtherTab);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", fromOtherTab);
    };
  },
  snapshot: (): SoundLevel => chosen ?? savedLevel() ?? defaultLevel,
  serverSnapshot: (): SoundLevel => defaultLevel,
  set(level: SoundLevel) {
    chosen = level;
    try {
      window.localStorage.setItem(storageKey, level);
    } catch {
      // Storage can be blocked; the level still applies for this visit.
    }
    listeners.forEach((listener) => listener());
  },
};

export function SoundProvider({ children, createPlayer = createSoundPlayer }: { children: ReactNode; createPlayer?: typeof createSoundPlayer }) {
  const level = useSyncExternalStore(levelStore.subscribe, levelStore.snapshot, levelStore.serverSnapshot);
  const levelRef = useRef(level);
  const playerRef = useRef<SoundPlayer | null>(null);

  useEffect(() => {
    levelRef.current = level;
    playerRef.current?.setLevel(level);
  }, [level]);

  useEffect(() => {
    let warmed = false;
    const unlock = () => {
      playerRef.current ??= createPlayer({ level: levelRef.current });
      playerRef.current.unlock();
      if (!warmed && playerRef.current.unlocked) {
        warmed = true;
        playerRef.current.prewarm();
      }
    };
    const events = ["pointerdown", "keydown", "touchend"] as const;
    for (const type of events) window.addEventListener(type, unlock, { capture: true, passive: true });
    return () => {
      for (const type of events) window.removeEventListener(type, unlock, { capture: true });
    };
  }, [createPlayer]);

  const setLevel = useCallback((next: SoundLevel) => {
    // Applied to the player at once, so a cue played right after already uses the new level.
    levelRef.current = next;
    playerRef.current?.setLevel(next);
    levelStore.set(next);
  }, []);

  const play = useCallback((id: CueId, delaySeconds = 0) => {
    playerRef.current?.play(id, delaySeconds);
  }, []);

  const value = useMemo(() => ({ level, setLevel, play }), [level, play, setLevel]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
