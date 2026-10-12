import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSoundPlayer } from "./player";

/** Just enough of an AudioContext to see what would play, when, and how loud. */
function fakeContext() {
  const started: Array<{ buffer: unknown; when: number; source: { onended: null | (() => void) } }> = [];
  const gain = { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn((value: number) => { gain.value = value; }) };
  const context = {
    state: "running",
    currentTime: 10,
    destination: {},
    started,
    gain,
    resume: vi.fn(() => Promise.resolve()),
    createGain: () => ({ gain, connect: vi.fn() }),
    createBuffer: (_channels: number, length: number, sampleRate: number) => ({ length, sampleRate, copyToChannel: vi.fn() }),
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        onended: null as null | (() => void),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: (when: number) => started.push({ buffer: source.buffer, when, source }),
      };
      return source;
    },
  };
  return context;
}

describe("sound player", () => {
  let now = 0;
  beforeEach(() => {
    now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

  const unlocked = (level: "on" | "quiet" | "off" = "quiet") => {
    const context = fakeContext();
    const player = createSoundPlayer({ level, createContext: () => context as unknown as AudioContext });
    player.unlock();
    return { context, player };
  };

  it("stays silent until the visitor's first press starts audio", () => {
    const context = fakeContext();
    const player = createSoundPlayer({ createContext: () => context as unknown as AudioContext });
    expect(player.play("sys.open")).toBe(false);
    expect(context.started).toHaveLength(0);
    player.unlock();
    expect(player.play("sys.open")).toBe(true);
    expect(context.started).toHaveLength(1);
  });

  it("starts at Quiet, about a third as loud as On, and plays nothing at Off", () => {
    const { context, player } = unlocked();
    expect(context.gain.value).toBeCloseTo(Math.pow(10, -10 / 20));
    player.setLevel("on");
    expect(context.gain.value).toBe(1);
    player.setLevel("off");
    expect(player.play("ui.copied")).toBe(false);
  });

  it("plays one sound per action: a repeat within 80 ms, or window sounds within 250 ms, play once", () => {
    const { context, player } = unlocked();
    expect(player.play("pay.let-in")).toBe(true);
    now += 40;
    expect(player.play("pay.let-in")).toBe(false);
    now += 60;
    expect(player.play("pay.let-in")).toBe(true);

    expect(player.play("sys.file-open")).toBe(true);
    now += 120;
    expect(player.play("sys.open")).toBe(false);
    now += 200;
    expect(player.play("sys.close")).toBe(true);
    expect(context.started).toHaveLength(4);
  });

  it("never lets more than four sounds overlap", () => {
    const { context, player } = unlocked();
    for (const id of ["pol.rule-1", "pol.rule-2", "pol.rule-3", "pol.rule-4"] as const) expect(player.play(id)).toBe(true);
    expect(player.play("pol.block")).toBe(false);
    context.started[0].source.onended?.();
    expect(player.play("pol.block")).toBe(true);
  });

  it("plays a different take each time a cue repeats, starting with the prewarmed one", () => {
    const { context, player } = unlocked();
    for (let i = 0; i < 6; i++) {
      player.play("svc.minute-quick");
      now += 100;
    }
    const takes = context.started.map((entry) => entry.buffer);
    for (let i = 1; i < takes.length; i++) expect(takes[i]).not.toBe(takes[i - 1]);
  });

  it("schedules a delayed cue on the audio clock and stays quiet while the page is hidden", () => {
    const { context, player } = unlocked();
    player.play("pay.let-in", 0.32);
    expect(context.started[0].when).toBeCloseTo(10.32);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    now += 500;
    expect(player.play("pay.twice")).toBe(false);
    visibility.mockRestore();
  });
});
