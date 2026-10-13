/*
 * The portfolio's sound: the motion campaign's own instruments (ma-fattah-motion-campaign,
 * scripts/generate-audio), ported to run in the browser. Every sound is synthesised from its
 * material, as in the film: a wooden block knocks, the steel gate arm rings, a key clicks, paper
 * slaps, a window seats with a plastic tick. Tonal sounds sit in D major pentatonic, and a mistake
 * lands a semitone sour. Each cue renders a few variants (pitch, decay, click colour and level
 * drift slightly), so a repeated action never plays the identical sound twice in a row.
 *
 * Nothing here touches the DOM or Web Audio: a cue renders to two Float32Arrays, which the player
 * wraps in an AudioBuffer. That keeps the synthesis testable in Node. Every cue answers something
 * the visitor did (see design.md, Sound); nothing here loops or plays on its own.
 */

/**
 * Cues render at 32 kHz and the browser resamples them on playback. Nothing in them sits above
 * 16 kHz, and it keeps every rendered take a third smaller and quicker to make, which matters on a
 * phone that keeps a few takes of each cue in memory.
 */
export const SAMPLE_RATE = 32000;
const SR = SAMPLE_RATE;

export type Stereo = { L: Float32Array<ArrayBuffer>; R: Float32Array<ArrayBuffer> };
type Bus = { dry: Stereo; room: Stereo };

const stereo = (seconds: number): Stereo => {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n) };
};

/* ------------------------------------------------------------------ DSP */

/** Deterministic noise (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function blep(t: number, dt: number) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

type Wave = "sine" | "triangle" | "saw" | "square";

/** A band-limited oscillator with a per-sample frequency. */
function osc(wave: Wave, phase0 = 0) {
  let phase = phase0;
  let tri = 0;
  return (hz: number) => {
    const dt = hz / SR;
    let out: number;
    if (wave === "sine") out = Math.sin(2 * Math.PI * phase);
    else if (wave === "saw") out = 2 * phase - 1 - blep(phase, dt);
    else {
      let sq = phase < 0.5 ? 1 : -1;
      sq += blep(phase, dt);
      sq -= blep((phase + 0.5) % 1, dt);
      if (wave === "square") out = sq;
      else {
        tri = dt * sq * 4 + (1 - dt * 0.5) * tri;
        out = tri;
      }
    }
    phase += dt;
    if (phase >= 1) phase -= 1;
    return out;
  };
}

/** RBJ biquad. */
function biquad(type: "lowpass" | "highpass" | "bandpass" | "highshelf", freq: number, q = 0.707, gainDb = 0) {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (f: number, qq = q) => {
    const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * qq);
    let a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
    if (type === "lowpass") { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
    else if (type === "highpass") { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
    else if (type === "bandpass") { b0 = alpha; b1 = 0; b2 = -alpha; }
    else {
      const A = Math.pow(10, gainDb / 40);
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cos + s); b1 = -2 * A * (A - 1 + (A + 1) * cos); b2 = A * (A + 1 + (A - 1) * cos - s);
      a0 = A + 1 - (A - 1) * cos + s; a1 = 2 * (A - 1 - (A + 1) * cos); a2 = A + 1 - (A - 1) * cos - s;
    }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  set(freq);
  const process = (x: number) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
  return Object.assign(process, { set });
}

const panGains = (pan: number) => {
  const p = (pan + 1) * 0.25 * Math.PI;
  return [Math.cos(p), Math.sin(p)] as const;
};

/** The film's small room: a compact Freeverb (8 combs + 4 allpasses a side). */
function reverb(input: Stereo, room = 0.5, damp = 0.5, wet = 0.9, width = 0.9): Stereo {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((v) => Math.round((v * SR) / 44100));
  const apT = [556, 441, 341, 225].map((v) => Math.round((v * SR) / 44100));
  const spread = Math.round((23 * SR) / 44100);
  const make = (offset: number) => {
    const combs = combT.map((len) => ({ buf: new Float32Array(len + offset), i: 0, store: 0 }));
    const aps = apT.map((len) => ({ buf: new Float32Array(len + offset), i: 0 }));
    return (x: number) => {
      let out = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        out += y;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        const y = -out + b;
        a.buf[a.i] = out + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        out = y;
      }
      return out;
    };
  };
  const left = make(0);
  const right = make(spread);
  const n = input.L.length;
  const out = { L: new Float32Array(n), R: new Float32Array(n) };
  const w1 = wet * (width / 2 + 0.5);
  const w2 = wet * ((1 - width) / 2);
  for (let i = 0; i < n; i++) {
    const x = (input.L[i] + input.R[i]) * 0.015;
    const l = left(x);
    const r = right(x);
    out.L[i] = l * w1 + r * w2;
    out.R[i] = r * w1 + l * w2;
  }
  return out;
}

/* --------------------------------------------------------------- Voices */

function put(bus: Bus, start: number, seconds: number, gain: number, pan: number, send: number, fn: (t: number) => number) {
  const i0 = Math.max(0, Math.round(start * SR));
  const n = Math.round(seconds * SR);
  const [gl, gr] = panGains(pan);
  for (let i = 0; i < n && i0 + i < bus.dry.L.length; i++) {
    const v = fn(i / SR) * gain;
    bus.dry.L[i0 + i] += v * gl;
    bus.dry.R[i0 + i] += v * gr;
    if (send > 0) {
      bus.room.L[i0 + i] += v * gl * send;
      bus.room.R[i0 + i] += v * gr * send;
    }
  }
}

const decay = (t: number, tau: number) => Math.exp(-t / tau);
const attack = (t: number, a = 0.0004) => Math.min(1, t / a);

let seedCounter = 1000;
const nextSeed = () => seedCounter++;

function transient(bus: Bus, t: number, gain: number, pan: number, centre: number, q: number, tau: number, seed: number, send = 0.15) {
  const noise = rng(seed);
  const bp = biquad("bandpass", centre, q);
  put(bus, t, tau * 9, gain, pan, send, (s) => bp(noise()) * decay(s, tau) * attack(s, 0.0002));
}

function mode(bus: Bus, t: number, gain: number, pan: number, hz: number, tau: number, send = 0.2, bend = 0.04, phase = 0) {
  const o = osc("sine", phase);
  put(bus, t, Math.min(2.5, tau * 7), gain, pan, send, (s) => o(hz * (1 + bend * decay(s, 0.012))) * decay(s, tau) * attack(s));
}

function thump(bus: Bus, t: number, gain: number, pan: number, from: number, to: number, tau: number, harmonic = 0.4) {
  const o = osc("sine");
  const h = osc("sine");
  put(bus, t, tau * 7, gain, pan, 0.08, (s) => {
    const f = to + (from - to) * decay(s, tau * 0.45);
    return (o(f) + harmonic * h(f * 2) * decay(s, tau * 0.5)) * decay(s, tau) * attack(s, 0.0008);
  });
}

function texture(bus: Bus, t: number, gain: number, pan: number, lo: number, hi: number, a: number, tau: number, seed: number, send = 0.2) {
  const noise = rng(seed);
  const hp = biquad("highpass", lo, 0.7);
  const lp = biquad("lowpass", hi, 0.7);
  put(bus, t, a + tau * 7, gain, pan, send, (s) => lp(hp(noise())) * (s < a ? s / a : decay(s - a, tau)));
}

type Material = "block" | "steel" | "plastic" | "paper" | "key" | "pixel";

/** 0–1 from impact speed (px/s): 40 px/s is a touch, 2500 px/s a slam. */
const intensity = (speed: number) => Math.max(0, Math.min(1, Math.log(Math.max(speed, 40) / 40) / Math.log(2500 / 40)));

/** One contact, built in layers from its material and impact speed, with its own small variation. */
function contact(bus: Bus, t: number, material: Material, speed: number, pan = 0, gain = 1, opts: { note?: number; bounce?: number } = {}) {
  const I = intensity(speed);
  const seed = nextSeed();
  const v = rng(seed * 7919);
  const j = (amount: number) => 1 + amount * v();
  const bounce = opts.bounce ?? 0;
  const g = gain * (0.22 + 0.78 * Math.pow(I, 1.15)) * j(0.12) * (bounce ? 0.42 : 1);
  const bright = (0.6 + 0.4 * I) * (bounce ? 0.75 : 1);
  const p = pan + 0.06 * v();
  switch (material) {
    case "block": {
      const f1 = opts.note !== undefined ? midiHz(opts.note) : 330 * j(0.05);
      const size = f1 / 330;
      const dk = j(0.15) * (bounce ? 0.6 : 1);
      if (!bounce && I > 0.55) texture(bus, Math.max(0, t - 0.026), 0.07 * g, p, 200, 1200, 0.024, 0.004, seed + 3, 0.05);
      transient(bus, t, 0.34 * g, p, 2600 * size * bright * j(0.1), 1.2, 0.0006, seed, 0.1);
      mode(bus, t, 0.5 * g, p, f1, 0.075 * dk, 0.22, 0.02);
      mode(bus, t, 0.26 * g, p, f1 * 2.756, 0.035 * dk, 0.2, 0.02);
      mode(bus, t, 0.09 * g, p, f1 * 5.404, 0.012 * dk, 0.2, 0.02);
      thump(bus, t, 0.45 * g, p, (f1 / 2.6) * j(0.06), f1 / 4.4, 0.05 * dk, 0.8);
      texture(bus, t, 0.05 * g, p, 500, 2400, 0.001, 0.016, seed + 1);
      if (!bounce) transient(bus, t + 0.014 + 0.004 * v(), 0.1 * g, p, 4600, 2.4, 0.0003, seed + 2, 0.05);
      break;
    }
    case "steel": {
      transient(bus, t, 0.45 * g, p, 5200 * bright * j(0.08), 1.4, 0.0007, seed, 0.2);
      const k = j(0.02);
      const modes: Array<[number, number, number]> = [[618, 0.22, 0.15], [1493, 0.1, 0.1], [2382, 0.055, 0.065], [3541, 0.03, 0.045]];
      for (const [hz, tau, amp] of modes) {
        mode(bus, t, amp * g, p - 0.08, hz * k, tau * (bounce ? 0.5 : 1), 0.35, 0.01);
        mode(bus, t, amp * g * 0.8, p + 0.08, hz * k * 1.003, tau * 0.9 * (bounce ? 0.5 : 1), 0.35, 0.01, 0.25);
      }
      thump(bus, t, 0.62 * g, p, 110 * j(0.05), 58, 0.05, 0.85);
      break;
    }
    case "plastic": {
      transient(bus, t, 0.38 * g, p, 3800 * bright * j(0.1), 1.3, 0.0006, seed, 0.1);
      mode(bus, t, 0.4 * g, p, 420 * j(0.05), 0.024 * j(0.15), 0.15);
      thump(bus, t, 0.46 * g, p, 200 * j(0.05), 120, 0.018, 0.75);
      transient(bus, t + 0.001, 0.12 * g, p, 7000, 2, 0.0003, seed + 1, 0.05);
      break;
    }
    case "key": {
      transient(bus, t, 0.42 * g, p, 4300 * j(0.1), 2.2, 0.0004, seed, 0.06);
      mode(bus, t, 0.22 * g, p, 540 * j(0.05), 0.007, 0.05, 0.08);
      thump(bus, t, 0.22 * g, p, 260 * j(0.05), 180, 0.008, 0.5);
      break;
    }
    case "paper": {
      texture(bus, t, 0.28 * g, p, 900 * j(0.15), 5200 * bright * j(0.1), 0.0015, 0.022 * j(0.2), seed, 0.18);
      thump(bus, t, 0.24 * g, p, 170 * j(0.06), 120, 0.014, 0.5);
      break;
    }
    case "pixel": {
      transient(bus, t, 0.3 * g, p, 3600 * j(0.1), 2, 0.0005, seed, 0.1);
      thump(bus, t, 0.25 * g, p, 240 * j(0.05), 170, 0.01, 0.5);
      break;
    }
  }
}

/** A pitched 8-bit blip through a lowpass, for pixel things. */
function blip(bus: Bus, t: number, midi: number, gain = 1, pan = 0, length = 0.07) {
  const o = osc("square");
  const lp = biquad("lowpass", 3200, 0.8);
  const hz = midiHz(midi);
  put(bus, t, length + 0.05, 0.08 * gain, pan, 0.35, (s) => lp(o(hz)) * (s < length ? 1 - (s / length) * 0.5 : 0.5 * decay(s - length, 0.012)) * attack(s, 0.002));
}

/** A soft pitched tick: paper plus a tiny pluck in the key. */
function plateTick(bus: Bus, t: number, midi: number, gain = 1, pan = 0) {
  contact(bus, t, "paper", 900, pan, 0.45 * gain);
  const o = osc("triangle");
  const lp = biquad("lowpass", 4200, 0.7);
  const hz = midiHz(midi);
  put(bus, t, 0.4, 0.07 * gain, pan, 0.4, (s) => lp(o(hz)) * decay(s, 0.07) * attack(s, 0.001));
}

/** The repeat-check switch: the down click, the latch 28 ms later, a tiny spring. */
function latch(bus: Bus, t: number, gain = 1, pan = 0.25) {
  contact(bus, t, "key", 1600, pan, 1.0 * gain);
  contact(bus, t + 0.028, "plastic", 2000, pan, 0.85 * gain);
  mode(bus, t + 0.03, 0.03 * gain, pan, 2630, 0.05, 0.3, 0);
}

/** A mechanical counter rolling one digit: two micro-clicks. */
function counter(bus: Bus, t: number, gain = 1, pan = 0.2) {
  transient(bus, t, 0.22 * gain, pan, 4800, 2.5, 0.0004, nextSeed(), 0.05);
  transient(bus, t + 0.024, 0.16 * gain, pan, 3900, 2.5, 0.0004, nextSeed(), 0.05);
  mode(bus, t, 0.08 * gain, pan, 1250, 0.01, 0.05, 0);
}

/** The error pattern: three short, low, square pulses, like a phone vibrating on a desk. */
function buzz(bus: Bus, t: number, gain = 1, pan = 0) {
  for (let i = 0; i < 3; i++) {
    const a = osc("square");
    const b = osc("square");
    // A little brighter than the film (760 Hz) so a phone speaker still carries it.
    const lp = biquad("lowpass", 1500, 0.9);
    put(bus, t + i * 0.085, 0.08, 0.075 * gain, pan, 0.1, (s) => lp(a(98) + 0.6 * b(146.8)) * (s < 0.05 ? 1 : decay(s - 0.05, 0.008)) * attack(s, 0.002));
    thump(bus, t + i * 0.085, 0.14 * gain, pan, 120, 96, 0.03, 0.6);
  }
}

/** Success: two FM bells a fifth apart (D6 then A6), ringing for about a third of a second. */
function chime(bus: Bus, t: number, gain = 1, pan = 0) {
  const bell = (start: number, midi: number, g: number) => {
    const c = osc("sine");
    const m = osc("sine");
    const hz = midiHz(midi);
    put(bus, start, 0.9, g, pan, 0.35, (s) => c(hz + m(hz * 3.5) * hz * 1.2 * decay(s, 0.07)) * decay(s, 0.2) * attack(s, 0.002));
  };
  bell(t, 86, 0.075 * gain);
  bell(t + 0.07, 93, 0.06 * gain);
}

/**
 * Tape running back, gentler than the film's: a rounder triangle tone through a lowpass instead of
 * a bright band-passed saw, a lower and smaller sweep, a slow soft swell, and fewer, quieter spool
 * ticks. On the site it answers a button press, so it must not nag.
 */
function rewind(bus: Bus, t: number, seconds: number, gain = 1) {
  const o = osc("triangle");
  const lp = biquad("lowpass", 900, 0.6);
  put(bus, t, seconds, 0.09 * gain, 0, 0.2, (s) => {
    const k = s / seconds;
    const hz = 170 + 230 * Math.sin(Math.PI * Math.min(1, k * 1.05)) + 5 * Math.sin(s * 2 * Math.PI * 6);
    lp.set(700 + 600 * Math.sin(Math.PI * k), 0.6);
    return lp(o(hz)) * Math.pow(Math.sin(Math.PI * k), 1.4);
  });
  let at = 0.04;
  let i = 0;
  while (at < seconds - 0.04) {
    const k = at / seconds;
    transient(bus, t + at, (0.04 + 0.04 * Math.sin(Math.PI * k)) * gain, i % 2 ? 0.15 : -0.15, 2400, 1.6, 0.0005, nextSeed(), 0.08);
    at += 0.1 - 0.035 * Math.sin(Math.PI * k);
    i++;
  }
}

/**
 * Air moved by something travelling: soft noise whose level follows speed^1.4 and whose centre rises
 * with speed. The film reads a body's simulated velocity; here the window's own easing stands in for
 * it (`peak` is where it is fastest, 0–1 through the move). A window's air stays dark, under `top`: hiss
 * is heard as loud and harsh, because the ear is most sensitive between 2 and 5 kHz. `glide` bends
 * its pitch over the move, in octaves: down as a window drops into the taskbar, up as it comes back.
 */
function air(bus: Bus, t: number, seconds: number, opts: { gain?: number; f0?: number; f1?: number; peak?: number; pan?: number; glide?: number; top?: number } = {}) {
  const { gain = 1, f0 = 380, f1 = 2600, peak = 0.5, pan = 0, glide = 0, top } = opts;
  const noise = rng(nextSeed());
  const bp1 = biquad("bandpass", f0, 0.8);
  const bp2 = biquad("bandpass", f0 * 1.6, 1);
  const lp1 = biquad("lowpass", top ?? SR / 2, 0.6);
  const lp2 = biquad("lowpass", top ?? SR / 2, 0.6);
  const dark = (x: number) => (top === undefined ? x : lp2(lp1(x)));
  let smooth = 0;
  let i = 0;
  put(bus, t, seconds, 1, pan, 0.15, (s) => {
    const k = s / seconds;
    const x = k < peak ? k / peak : (1 - k) / (1 - peak);
    const speed = Math.sin((Math.PI / 2) * Math.max(0, x));
    smooth += (speed - smooth) * 0.0025;
    if (i++ % 32 === 0) {
      const centre = (f0 + (f1 - f0) * smooth) * Math.pow(2, glide * (k - 0.5));
      bp1.set(centre, 0.8);
      bp2.set(centre * 1.6, 1);
    }
    const n = noise();
    return dark(bp1(n) + 0.5 * bp2(n)) * Math.pow(smooth, 1.4) * 0.5 * gain;
  });
}

/** An alarm bell: a hammer striking a small bell sixteen times a second for a moment, then ringing out. */
function alarmBell(bus: Bus, t: number, seconds: number, gain = 1, pan = 0.3) {
  const c = osc("sine");
  const m = osc("sine");
  const hz = midiHz(88);
  put(bus, t, seconds + 0.45, 0.07 * gain, pan, 0.3, (s) => {
    const strike = s < seconds ? 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * s * 16)) : Math.exp(-(s - seconds) / 0.12);
    return c(hz + m(hz * 2.76) * hz * 0.9) * strike * Math.min(1, s / 0.004);
  });
  for (let k = 0; k * 0.0625 < seconds; k += 2) transient(bus, t + k * 0.0625, 0.08 * gain, pan, 4200, 3, 0.0004, nextSeed(), 0.1);
}

/** A question, not a verdict: two soft notes rising a tone (A5 → B5). */
function ask(bus: Bus, t: number, gain = 1, pan = 0) {
  const note = (start: number, midi: number) => {
    const o = osc("triangle");
    const lp = biquad("lowpass", 3800, 0.7);
    const hz = midiHz(midi);
    put(bus, start, 0.6, 0.09 * gain, pan, 0.3, (s) => lp(o(hz)) * decay(s, 0.14) * attack(s, 0.003));
  };
  note(t, 81);
  note(t + 0.11, 83);
}

/** A relay: one step of the lights going down. */
function relay(bus: Bus, t: number, gain = 1, pan = 0) {
  transient(bus, t, 0.42 * gain, pan, 2600, 1.8, 0.0008, nextSeed(), 0.25);
  thump(bus, t, 0.28 * gain, pan, 150, 96, 0.03, 0.9);
  mode(bus, t, 0.16 * gain, pan, 520, 0.012, 0.2, 0.05);
  mode(bus, t + 0.006, 0.06 * gain, pan, 1180, 0.03, 0.3, 0.02);
}

/* ----------------------------------------------------------------- Cues */

/**
 * Where a message's landing sits inside its cue, after the short fall. The simulator starts the cue
 * this much before the message reaches the payment in the drawing, so the knock lands with it.
 */
export const LANDING = 0.12;
/** The vibration buzz starts this long after a sour landing; the jolt shakes with it. */
export const BUZZ_AFTER_LANDING = 0.1;

/**
 * Every sound the site plays, named for the moment it answers. `length` covers the cue's own
 * events; the room's tail is added on render. `lead` is how long a cue runs up to its landing, which
 * the player may skip to make up for the speaker's delay. The builds follow the film's own scenes.
 */
export const cues = {
  /* Payment desk: the film's hook, playable. */
  "pay.let-in": { level: -29, lead: LANDING, length: 0.32, build: (b: Bus) => { air(b, 0, LANDING, { gain: 0.35, f0: 300, f1: 1800, peak: 0.85 }); contact(b, LANDING, "block", 1500, 0, 1, { note: 62 }); counter(b, LANDING + 0.03); plateTick(b, LANDING + 0.07, 69, 0.6, -0.2); } },
  "pay.stopped": { level: -29.5, lead: LANDING, length: 0.36, build: (b: Bus) => { air(b, 0, LANDING, { gain: 0.35, f0: 300, f1: 1800, peak: 0.85 }); contact(b, LANDING, "steel", 1500, 0.15, 0.85); contact(b, LANDING, "block", 1300, 0, 0.7, { note: 66 }); contact(b, LANDING + 0.09, "block", 420, 0, 0.7, { note: 66, bounce: 1 }); contact(b, LANDING + 0.14, "paper", 1400, 0.3, 0.7); } },
  "pay.twice": { level: -29, lead: LANDING, length: 0.5, build: (b: Bus) => { air(b, 0, LANDING, { gain: 0.35, f0: 300, f1: 1800, peak: 0.85 }); contact(b, LANDING, "block", 1500, 0, 1, { note: 63 }); counter(b, LANDING + 0.03); buzz(b, LANDING + BUZZ_AFTER_LANDING, 1, 0.15); } },
  "pay.overwritten": { level: -29, lead: LANDING, length: 0.5, build: (b: Bus) => { air(b, 0, LANDING, { gain: 0.35, f0: 300, f1: 1800, peak: 0.85 }); contact(b, LANDING, "block", 1500, 0, 1, { note: 61 }); buzz(b, LANDING + BUZZ_AFTER_LANDING, 1, -0.15); } },
  "pay.check-on": { level: -30, length: 0.12, build: (b: Bus) => latch(b, 0, 1.1, 0.2) },
  "pay.check-off": { level: -31.5, length: 0.1, build: (b: Bus) => { contact(b, 0, "key", 1300, 0.2, 0.9); contact(b, 0.022, "plastic", 1100, 0.2, 0.5); } },
  "pay.report-matches": { level: -29, length: 0.2, build: (b: Bus) => { contact(b, 0, "paper", 1300, 0, 0.8); chime(b, 0.05, 0.7); } },
  "pay.report-differs": { level: -29, length: 0.3, build: (b: Bus) => { contact(b, 0, "paper", 1300, 0, 0.8); ask(b, 0.05, 0.9); } },
  "pay.book-down": { level: -31.5, length: 0.08, build: (b: Bus) => relay(b, 0, 0.9) },
  "pay.book-back": { level: -32, length: 0.3, build: (b: Bus) => { relay(b, 0, 0.6); [0.08, 0.15, 0.22].forEach((at) => counter(b, at, 0.8)); } },
  "pay.start-over": { level: -32, length: 0.48, build: (b: Bus) => { rewind(b, 0, 0.44, 0.9); counter(b, 0.4, 0.4); } },

  /* Website monitor: the film's case 02. */
  "svc.minute-quick": { level: -32, length: 0.1, build: (b: Bus) => contact(b, 0, "block", 1300, -0.2, 0.75, { note: 62 }) },
  "svc.minute-slower": { level: -31.5, length: 0.1, build: (b: Bus) => contact(b, 0, "block", 1300, 0, 0.8, { note: 66 }) },
  "svc.minute-slow": { level: -31, length: 0.1, build: (b: Bus) => contact(b, 0, "block", 1300, 0.2, 0.85, { note: 69 }) },
  "svc.minute-too-slow": { level: -29.5, length: 0.1, build: (b: Bus) => contact(b, 0, "block", 1500, 0.3, 0.9, { note: 75 }) },
  "svc.alarm": { level: -29, length: 0.36, build: (b: Bus) => alarmBell(b, 0, 0.32, 1, 0.3) },
  "svc.down": { level: -29.5, length: 0.3, build: (b: Bus) => buzz(b, 0, 1, 0) },
  "svc.blind": { level: -31.5, length: 0.08, build: (b: Bus) => relay(b, 0, 0.9) },
  "svc.recovered": { level: -29, length: 0.15, build: (b: Bus) => chime(b, 0, 0.55) },

  /* Security checkpoint: the film's case 03. */
  "pol.rule-1": { level: -35, length: 0.1, build: (b: Bus) => { counter(b, 0, 0.45, 0.3); contact(b, 0.05, "block", 900, 0.3, 0.4, { note: 69 }); } },
  "pol.rule-2": { level: -34.5, length: 0.1, build: (b: Bus) => { counter(b, 0, 0.45, 0.3); contact(b, 0.05, "block", 900, 0.3, 0.4, { note: 71 }); } },
  "pol.rule-3": { level: -34, length: 0.1, build: (b: Bus) => { counter(b, 0, 0.45, 0.3); contact(b, 0.05, "block", 900, 0.3, 0.4, { note: 74 }); } },
  "pol.rule-4": { level: -33.5, length: 0.1, build: (b: Bus) => { counter(b, 0, 0.45, 0.3); contact(b, 0.05, "block", 900, 0.3, 0.4, { note: 76 }); } },
  "pol.let-through": { level: -29, length: 0.12, build: (b: Bus) => { counter(b, 0, 0.6, 0); contact(b, 0.03, "block", 1800, 0, 1, { note: 62 }); } },
  "pol.ask-to-confirm": { level: -29, length: 0.35, build: (b: Bus) => { counter(b, 0, 0.6, 0); contact(b, 0.03, "block", 1700, 0, 0.9, { note: 62 }); ask(b, 0.12, 1); } },
  "pol.block": { level: -29, length: 0.16, build: (b: Bus) => { counter(b, 0, 0.6, 0); contact(b, 0.03, "steel", 2000, 0, 0.9); } },

  /* Windows and apps. */
  "sys.open": { level: -32, length: 0.08, build: (b: Bus) => contact(b, 0, "plastic", 1300, 0, 0.9) },
  "sys.snap": { level: -31.5, length: 0.08, build: (b: Bus) => contact(b, 0, "plastic", 2100, 0, 1) },
  "sys.close": { level: -33, length: 0.3, build: (b: Bus) => { contact(b, 0, "key", 1300, 0, 0.8); contact(b, 0.24, "plastic", 800, 0, 0.55); } },
  "sys.minimize": { level: -33, lead: 0.38, length: 0.42, build: (b: Bus) => { air(b, 0, 0.38, { gain: 0.25, f0: 260, f1: 900, peak: 0.85, glide: -0.5, top: 1400 }); contact(b, 0.38, "plastic", 800, 0, 0.7); } },
  "sys.restore": { level: -32.5, lead: 0.38, length: 0.42, build: (b: Bus) => { air(b, 0, 0.38, { gain: 0.3, f0: 260, f1: 900, peak: 0.2, glide: 0.5, top: 1400 }); contact(b, 0.38, "plastic", 1100, 0, 0.7); } },
  "sys.file-open": { level: -32, length: 0.08, build: (b: Bus) => contact(b, 0, "paper", 1400, 0, 0.9) },
  "sys.file-close": { level: -33.5, length: 0.08, build: (b: Bus) => contact(b, 0, "paper", 700, 0, 0.6) },
  "sys.drop-icon": { level: -33, length: 0.14, build: (b: Bus) => { contact(b, 0, "pixel", 1200, 0, 0.8); blip(b, 0.01, 81, 0.5, 0, 0.04); } },
  "sys.drop-file": { level: -32.5, length: 0.08, build: (b: Bus) => contact(b, 0, "paper", 1200, 0, 0.85) },

  /* Small actions. */
  "ui.key-on": { level: -32.5, length: 0.05, build: (b: Bus) => contact(b, 0, "key", 1500, 0, 0.85) },
  "ui.key-off": { level: -34, length: 0.05, build: (b: Bus) => contact(b, 0, "key", 1000, 0, 0.6) },
  "ui.copied": { level: -29.5, length: 0.2, build: (b: Bus) => { contact(b, 0, "key", 1400, 0, 0.7); blip(b, 0.03, 81, 0.6, 0.1); blip(b, 0.06, 86, 0.6, 0.1); chime(b, 0.1, 0.9); } },
  "ui.download": { level: -32, length: 0.08, build: (b: Bus) => { contact(b, 0, "key", 1400, 0, 0.8); contact(b, 0.03, "paper", 900, 0, 0.5); } },
} satisfies Record<string, { level: number; lead?: number; length: number; build: (bus: Bus) => void }>;

export type CueId = keyof typeof cues;

const TAIL = 0.45;

/**
 * How loud a cue is heard, in LUFS-like dB: the ear's K-weighting from ITU-R BS.1770 (+4 dB above
 * ~1.7 kHz, nothing below ~40 Hz), with its power summed over the ear's ~100 ms, at the loudest
 * moment. Peaks and short windows mislead: the ear adds energy up for about a tenth of a second, so
 * a 350 ms swoosh is heard several decibels louder than a 20 ms click of the same peak, and hiss
 * counts for more than a thump. By default it listens through a laptop speaker (a high-pass at
 * 150 Hz), where most visitors hear the site and where a thump's sub-bass is not heard at all;
 * `speakerHz = 0` listens full-range, as headphones do.
 */
export function heardLevel(buf: Stereo, speakerHz = 150) {
  const ear = () => {
    const speaker = [biquad("highpass", speakerHz || 20, 0.707), biquad("highpass", speakerHz || 20, 0.707)];
    const shelf = biquad("highshelf", 1682, 0.7072, 4);
    const rumble = biquad("highpass", 38, 0.5);
    return (x: number) => rumble(shelf(speakerHz ? speaker[1](speaker[0](x)) : x));
  };
  const left = ear();
  const right = ear();
  const a = Math.exp(-1 / (0.1 * SR));
  let power = 0;
  let loudest = 0;
  for (let i = 0; i < buf.L.length; i++) {
    const l = left(buf.L[i]);
    const r = right(buf.R[i]);
    power = a * power + (1 - a) * (l * l + r * r);
    if (power > loudest) loudest = power;
  }
  return -0.691 + 10 * Math.log10(Math.max(loudest, 1e-12));
}

/**
 * Renders one variant of a cue: dry plus the film's small room, rumble below 80 Hz taken out (no
 * small speaker plays it, and on headphones it only adds boom), a touch of saturation, clean edges,
 * then set to the cue's own heard level at full volume. In the film the score and the master
 * balanced the sounds; on the site each one plays alone, so each carries a level for its role:
 * problems loudest, outcomes next, windows quieter, the ticks of a sequence quietest. A variant
 * keeps up to a decibel of its own drift, as in the film.
 */
export function renderCue(id: CueId, variant = 0): Stereo {
  seedCounter = 1000 + variant * 211 + Object.keys(cues).indexOf(id) * 7;
  const cue = cues[id];
  const seconds = cue.length + TAIL;
  const bus: Bus = { dry: stereo(seconds), room: stereo(seconds) };
  cue.build(bus);
  const room = reverb(bus.room);
  const out = stereo(seconds);
  const drive = 1.4;
  const mix = 0.25;
  const norm = Math.tanh(drive);
  const fadeIn = Math.round(0.002 * SR);
  const fadeOut = Math.round(0.03 * SR);
  const n = out.L.length;
  const rumbleL = biquad("highpass", 80, 0.6);
  const rumbleR = biquad("highpass", 80, 0.6);
  for (let i = 0; i < n; i++) {
    let l = rumbleL(bus.dry.L[i] + room.L[i]);
    let r = rumbleR(bus.dry.R[i] + room.R[i]);
    l = l * (1 - mix) + (Math.tanh(l * drive) / norm) * mix;
    r = r * (1 - mix) + (Math.tanh(r * drive) / norm) * mix;
    const edge = Math.min(1, i / fadeIn, (n - 1 - i) / fadeOut);
    out.L[i] = l * edge;
    out.R[i] = r * edge;
  }
  const drift = rng(variant * 977 + 13)() * 1;
  const gain = Math.pow(10, (cue.level + drift - heardLevel(out)) / 20);
  // The room's tail is long for safety; keep only what can be heard (above −80 dBFS), plus 10 ms.
  let last = 0;
  for (let i = 0; i < n; i++) {
    out.L[i] *= gain;
    out.R[i] *= gain;
    if (Math.abs(out.L[i]) > 1e-4 || Math.abs(out.R[i]) > 1e-4) last = i;
  }
  const keep = Math.min(n, last + Math.round(0.01 * SR));
  return { L: out.L.slice(0, keep), R: out.R.slice(0, keep) };
}
