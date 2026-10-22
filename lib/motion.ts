/*
 * The environment's motion, copied from nature and from the way Apple's interfaces behave: what
 * moves settles like a spring (a stiffness and a damping, not a duration); a thing thrown carries its
 * speed into the spring that catches it; anything moving can be interrupted and turns around from
 * where it is, at the speed it had; a pull past an edge gives like a rubber band; and a close still
 * says it happened without making anyone wait. The look stays retro; the feel is this.
 *
 * A spring is drawn as a CSS `linear()` curve sampled from the damped oscillator, so the same curve
 * runs in the stylesheet (design-tokens.css holds the generated values; a test keeps them equal) and
 * in the Web Animations API here.
 */

export type Spring = {
  /** How long a full swing would take, in seconds: shorter is snappier. */
  response: number;
  /** 1 settles without overshoot; under 1 overshoots, as a real object would. */
  damping: number;
};

/** Windows and the phone's launches: quick, with a settle you feel more than see (0.6% overshoot). */
export const windowSpring: Spring = { response: 0.38, damping: 0.85 };
/** Sheets: a touch quicker and calmer, so a flick and a release feel direct. */
export const sheetSpring: Spring = { response: 0.32, damping: 0.9 };
/** Small objects that land, stamp or change (a dropped icon, a verdict, a number): a visible bounce. */
export const popSpring: Spring = { response: 0.32, damping: 0.6 };
/** Going away, into an icon or off the screen: fully damped, so it never overshoots where it vanishes. */
export const leaveSpring: Spring = { response: 0.34, damping: 1 };

/** Where a spring from 0 to 1 is after `t` seconds, having set off at `velocity` (progress per second). */
export function springAt({ response, damping }: Spring, t: number, velocity = 0) {
  const omega = (2 * Math.PI) / response;
  if (damping >= 1) return 1 - Math.exp(-omega * t) * (1 + (omega - velocity) * t);
  const decay = damping * omega;
  const swing = omega * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-decay * t) * (Math.cos(swing * t) + ((decay - velocity) / swing) * Math.sin(swing * t));
}

/** How fast that spring is moving after `t` seconds, in progress per second. */
export function springVelocity({ response, damping }: Spring, t: number, velocity = 0) {
  const omega = (2 * Math.PI) / response;
  if (damping >= 1) {
    const lean = omega - velocity;
    return Math.exp(-omega * t) * (omega * (1 + lean * t) - lean);
  }
  const decay = damping * omega;
  const swing = omega * Math.sqrt(1 - damping * damping);
  const lean = (decay - velocity) / swing;
  return Math.exp(-decay * t) * ((decay - lean * swing) * Math.cos(swing * t) + (decay * lean + swing) * Math.sin(swing * t));
}

/** How long the spring takes to come within a thousandth of where it's going for good, in ms. */
export function springDuration(spring: Spring, velocity = 0) {
  let last = 0;
  for (let ms = 1; ms <= 5000; ms += 1) if (Math.abs(1 - springAt(spring, ms / 1000, velocity)) > 0.001) last = ms;
  return last + 1;
}

/** The spring as a CSS `linear()` easing over its own duration, sampled finely enough to stay smooth. */
export function springEasing(spring: Spring, samples = 32, velocity = 0) {
  const duration = springDuration(spring, velocity);
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const value = index === samples ? 1 : springAt(spring, ((duration / 1000) * index) / samples, velocity);
    return Number(value.toFixed(4)).toString();
  });
  return { duration, easing: `linear(${points.join(", ")})` };
}

/**
 * Where a thrown thing would come to rest if it slowed the way a scroll view does (Apple's
 * projection): from `position` in px, moving at `velocity` px per ms.
 */
export function project(position: number, velocity: number, decelerationRate = 0.998) {
  return position + (velocity * decelerationRate) / (1 - decelerationRate);
}

/** A pull `past` an edge, given back the way a rubber band gives: less and less the further it goes. */
export function rubberband(past: number, dimension: number, constant = 0.55) {
  const distance = Math.abs(past);
  return Math.sign(past) * (1 - 1 / ((distance * constant) / dimension + 1)) * dimension;
}

/**
 * Follows a pointer and says how fast it was going as it let go: over its last 80 ms, and nothing at
 * all if it had come to rest first, so a finger that stopped before lifting throws nothing.
 */
export function pointerTrail() {
  const points: { x: number; y: number; t: number }[] = [];
  return {
    add(x: number, y: number, t: number) {
      points.push({ t, x, y });
      while (points.length > 2 && t - points[0].t > 80) points.shift();
    },
    /** px per ms on each axis, as of `now` (an event's timeStamp). */
    velocity(now: number) {
      const first = points[0];
      const last = points.at(-1);
      if (!first || !last || now - last.t > 60 || last.t === first.t) return { x: 0, y: 0 };
      return { x: (last.x - first.x) / (last.t - first.t), y: (last.y - first.y) / (last.t - first.t) };
    },
  };
}

const prefersStill = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cssName = (property: string) => (property.startsWith("--") ? property : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
const numberOf = (value: Keyframe[string]) => (typeof value === "number" ? value : parseFloat(String(value)));

/** The spring each element is riding, so whatever interrupts it can take over its speed. */
const riding = new WeakMap<Element, { animation: Animation; from: number; property: string; spring: Spring; to: number; velocity: number }>();

/**
 * Moves an element to `to` on a spring, starting from wherever it is now and at the speed it already
 * has: a launch interrupted by Home swings round instead of stopping dead, and a thrown thing set off
 * with `velocity` (how fast the first property in `to` is already changing, per second) carries on.
 * Only the properties named in `to` are read and animated; `from` applies only when nothing is moving.
 */
export function springTo(element: HTMLElement, to: Keyframe, spring: Spring = windowSpring, options: { fill?: FillMode; from?: Keyframe; velocity?: number } = {}) {
  if (typeof element.animate !== "function") return null;
  const computed = getComputedStyle(element);
  const now: Keyframe = {};
  for (const property of Object.keys(to)) now[property] = computed.getPropertyValue(cssName(property)) || undefined;
  const before = riding.get(element);
  const moving = before && before.animation.playState === "running" ? before : null;
  // Its speed at this instant, read off the spring it was on before that spring is let go.
  const carried = moving ? (moving.to - moving.from) * springVelocity(moving.spring, (Number(moving.animation.currentTime) || 0) / 1000, moving.velocity) : 0;
  for (const animation of element.getAnimations()) if (animation.id === "spring") animation.cancel();
  riding.delete(element);
  if (prefersStill()) return null;
  const start = options.from && !moving ? options.from : now;
  const property = Object.keys(to).find((key) => Number.isFinite(numberOf(start[key])) && Number.isFinite(numberOf(to[key])) && numberOf(start[key]) !== numberOf(to[key]));
  let velocity = 0;
  if (property) {
    const travel = numberOf(to[property]) - numberOf(start[property]);
    const speed = options.velocity ?? (moving?.property === property ? carried : 0);
    velocity = Math.max(-40, Math.min(40, speed / travel));
  }
  const { duration, easing } = springEasing(spring, velocity ? 48 : 32, velocity);
  const animation = element.animate([start, to], { duration, easing, fill: options.fill ?? "none" });
  animation.id = "spring";
  if (property) riding.set(element, { animation, from: numberOf(start[property]), property, spring, to: numberOf(to[property]), velocity });
  return animation;
}

/**
 * A close says it happened without making anyone wait: a still copy of what closed fades out over
 * 90 ms where it stood, while the real thing is already gone and the page answers at once.
 */
export function fadeOutCopy(element: HTMLElement | null) {
  if (!element || prefersStill() || typeof element.animate !== "function") return;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const copy = element.cloneNode(true) as HTMLElement;
  for (const node of [copy, ...copy.querySelectorAll<HTMLElement>("[id]")]) node.removeAttribute("id");
  copy.setAttribute("aria-hidden", "true");
  copy.inert = true;
  Object.assign(copy.style, {
    animation: "none", boxSizing: "border-box", height: `${rect.height}px`, inset: "auto", left: `${rect.left}px`, margin: "0",
    maxHeight: "none", maxWidth: "none", pointerEvents: "none", position: "fixed", top: `${rect.top}px`, transform: "none",
    transition: "none", width: `${rect.width}px`, zIndex: getComputedStyle(element).zIndex || "40",
  });
  copy.dataset.closingCopy = "true";
  // The copy sits inside see-through shells of its original containers, so every style scoped to
  // them still applies for its 90 ms; the shells draw nothing themselves (display: contents).
  let holder: HTMLElement = document.body;
  let outermost: HTMLElement = copy;
  const ancestors: HTMLElement[] = [];
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) ancestors.unshift(node);
  for (const ancestor of ancestors) {
    const shell = ancestor.cloneNode(false) as HTMLElement;
    shell.removeAttribute("id");
    shell.setAttribute("aria-hidden", "true");
    shell.inert = true;
    shell.style.display = "contents";
    shell.dataset.closingCopy = "true";
    holder.append(shell);
    if (holder === document.body) outermost = shell;
    holder = shell;
  }
  holder.append(copy);
  // A window's opacity is pinned in the stylesheet and reads --window-fade, so both are faded.
  const fade = copy.animate([{ "--window-fade": 1, opacity: 1, scale: 1 }, { "--window-fade": 0, opacity: 0, scale: 0.985 }], { duration: 90, easing: "cubic-bezier(.32, .72, 0, 1)", fill: "forwards" });
  const remove = () => outermost.remove();
  fade.addEventListener("finish", remove);
  fade.addEventListener("cancel", remove);
}
