import { describe, expect, it } from "vitest";
import { cues, heardLevel, LANDING, renderCue, SAMPLE_RATE, type CueId } from "./engine";

const ids = Object.keys(cues) as CueId[];
const db = (value: number) => 20 * Math.log10(Math.max(value, 1e-9));
const slice = ({ L, R }: { L: Float32Array; R: Float32Array }, from: number, to: number) => {
  const [a, b] = [Math.round(from * SAMPLE_RATE), Math.round(to * SAMPLE_RATE)];
  return { L: L.slice(a, b), R: R.slice(a, b) };
};

describe("sound engine", () => {
  it("renders every cue at its own heard level, finite, with headroom, and no longer than it needs", () => {
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
      expect(Math.abs(heardLevel(out) - cues[id].level), id).toBeLessThanOrEqual(1.2);
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

  it("keeps outcomes over windows and windows over ticks, in a calm six decibels, with no mistake louder than a success", () => {
    const levels = ids.map((id) => cues[id].level);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(6);
    expect(cues["pay.let-in"].level).toBeGreaterThan(cues["sys.open"].level);
    expect(cues["sys.open"].level).toBeGreaterThan(cues["pol.rule-1"].level);
    // A mistake stands out by its sour pitch and its buzz, not by being louder than good news.
    for (const mistake of ["pay.twice", "pay.overwritten", "svc.down", "svc.alarm", "pol.block"] as const) {
      expect(cues[mistake].level, mistake).toBeLessThanOrEqual(cues["pay.report-matches"].level);
    }
  });

  it("measures what the ear hears: a long hiss counts for more than a click of the same peak", () => {
    const click = { L: new Float32Array(SAMPLE_RATE), R: new Float32Array(SAMPLE_RATE) };
    const hiss = { L: new Float32Array(SAMPLE_RATE), R: new Float32Array(SAMPLE_RATE) };
    for (let i = 0; i < 0.01 * SAMPLE_RATE; i++) click.L[i] = click.R[i] = 0.25 * Math.sin((2 * Math.PI * 3000 * i) / SAMPLE_RATE);
    for (let i = 0; i < 0.3 * SAMPLE_RATE; i++) hiss.L[i] = hiss.R[i] = 0.25 * Math.sin((2 * Math.PI * 3000 * i) / SAMPLE_RATE);
    expect(heardLevel(hiss) - heardLevel(click)).toBeGreaterThan(8);
    // A thump's sub-bass is heard on headphones but not through a laptop speaker.
    const sub = { L: new Float32Array(SAMPLE_RATE), R: new Float32Array(SAMPLE_RATE) };
    for (let i = 0; i < 0.3 * SAMPLE_RATE; i++) sub.L[i] = sub.R[i] = 0.25 * Math.sin((2 * Math.PI * 60 * i) / SAMPLE_RATE);
    expect(heardLevel(sub, 0) - heardLevel(sub)).toBeGreaterThan(12);
  });

  it("lets a window's air lead into its landing, well under it, never over it", () => {
    for (const id of ["sys.minimize", "sys.restore"] as const) {
      for (let variant = 0; variant < 3; variant++) {
        const out = renderCue(id, variant);
        expect(heardLevel(out) - heardLevel(slice(out, 0, 0.36)), id).toBeGreaterThanOrEqual(8);
      }
    }
    // A minimize is heard no louder than a window opening.
    expect(cues["sys.minimize"].level).toBeLessThanOrEqual(cues["sys.open"].level);
  });

  it("sounds about as loud on headphones as through a laptop speaker", () => {
    for (const id of ids) {
      const out = renderCue(id, 0);
      expect(heardLevel(out, 0) - heardLevel(out), id).toBeLessThanOrEqual(5.5);
    }
  });
});
