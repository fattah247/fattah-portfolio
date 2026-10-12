import { describe, expect, it } from "vitest";
import { cues, LANDING, renderCue, SAMPLE_RATE, type CueId } from "./engine";

const ids = Object.keys(cues) as CueId[];
const db = (value: number) => 20 * Math.log10(Math.max(value, 1e-9));

/** The loudest 50 ms, as RMS in dBFS: how loud a short sound is heard. */
function loudness({ L, R }: { L: Float32Array; R: Float32Array }) {
  const w = Math.round(0.05 * SAMPLE_RATE);
  let acc = 0;
  let best = 0;
  for (let i = 0; i < L.length; i++) {
    acc += L[i] * L[i] + R[i] * R[i];
    if (i >= w) acc -= L[i - w] * L[i - w] + R[i - w] * R[i - w];
    best = Math.max(best, acc);
  }
  return db(Math.sqrt(best / (2 * w)));
}

describe("sound engine", () => {
  it("renders every cue at its own level, finite, with headroom, and no longer than it needs", () => {
    for (const id of ids) {
      const out = renderCue(id, 0);
      let peak = 0;
      let finite = true;
      for (let i = 0; i < out.L.length; i++) {
        finite &&= Number.isFinite(out.L[i]) && Number.isFinite(out.R[i]);
        peak = Math.max(peak, Math.abs(out.L[i]), Math.abs(out.R[i]));
      }
      expect(finite, id).toBe(true);
      // Each take keeps up to a decibel of its own drift around the cue's level.
      expect(Math.abs(loudness(out) - cues[id].level), id).toBeLessThanOrEqual(1.2);
      expect(db(peak), `${id} peak`).toBeLessThanOrEqual(-6);
      expect(out.L.length / SAMPLE_RATE, `${id} length`).toBeLessThanOrEqual(cues[id].length + 0.46);
    }
  });

  it("makes takes that differ from each other but repeat exactly, so a page renders the same sound every time", () => {
    const first = renderCue("pay.let-in", 0);
    expect(renderCue("pay.let-in", 0).L).toEqual(first.L);
    const second = renderCue("pay.let-in", 1);
    const same = first.L.length === second.L.length && first.L.every((value, i) => value === second.L[i]);
    expect(same).toBe(false);
  });

  it("puts a message's knock at its landing time, so the drawing can meet it", () => {
    const { L } = renderCue("pay.let-in", 0);
    const step = Math.round(0.005 * SAMPLE_RATE);
    let loudest = 0;
    let at = 0;
    for (let i = 0; i + step < L.length; i += step) {
      let energy = 0;
      for (let j = i; j < i + step; j++) energy += L[j] * L[j];
      if (energy > loudest) {
        loudest = energy;
        at = i / SAMPLE_RATE;
      }
    }
    expect(at).toBeGreaterThanOrEqual(LANDING - 0.01);
    expect(at).toBeLessThan(LANDING + 0.04);
  });

  it("keeps a mistake louder than a window, and a window louder than a tick", () => {
    expect(cues["pay.twice"].level).toBeGreaterThan(cues["sys.open"].level);
    expect(cues["sys.open"].level).toBeGreaterThan(cues["pol.rule-1"].level);
  });
});
