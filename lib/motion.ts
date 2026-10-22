/*
 * The environment's motion, copied from nature: what moves on the site settles like a spring (a
 * stiffness and a damping, not a duration), can be interrupted and retargeted midway, and a close
 * still says it happened without making anyone wait. Small objects (a knock, a jolt, a stamp, the
 * case toys) keep their retro steps; windows, launches and sheets move on these springs.
 *
 * A spring is drawn as a CSS `linear()` curve sampled from the damped oscillator, so the same curve
 * runs in the stylesheet (design-tokens.css holds the generated values; a test keeps them equal) and
 * in the Web Animations API here.
 */

export type Spring = {
  /** How long a full swing would take, in seconds: shorter is snappier. */
  response: number;
  /** 1 settles without overshoot; just under 1 overshoots by a hair, as a real object would. */
  damping: number;
};

/** Windows and the phone's launches: quick, with a settle you feel more than see (0.6% overshoot). */
export const windowSpring: Spring = { response: 0.38, damping: 0.85 };
/** Sheets: a touch quicker and calmer, so a flick and a release feel direct. */
export const sheetSpring: Spring = { response: 0.32, damping: 0.9 };

/** Where an undamped-to-damped spring from 0 to 1 is after `t` seconds. */
export function springAt({ response, damping }: Spring, t: number) {
  const omega = (2 * Math.PI) / response;
  if (damping >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t);
  const decay = damping * omega;
  const swing = omega * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-decay * t) * (Math.cos(swing * t) + (decay / swing) * Math.sin(swing * t));
}

/** How long the spring takes to come within a thousandth of where it's going for good, in ms. */
export function springDuration(spring: Spring) {
  let last = 0;
  for (let ms = 1; ms <= 5000; ms += 1) if (Math.abs(1 - springAt(spring, ms / 1000)) > 0.001) last = ms;
  return last + 1;
}

/** The spring as a CSS `linear()` easing over its own duration, sampled finely enough to stay smooth. */
export function springEasing(spring: Spring, samples = 32) {
  const duration = springDuration(spring);
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const value = index === samples ? 1 : springAt(spring, ((duration / 1000) * index) / samples);
    return Number(value.toFixed(4)).toString();
  });
  return { duration, easing: `linear(${points.join(", ")})` };
}

const prefersStill = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Moves an element to `to` on a spring, starting from wherever it is now: if it was already moving
 * (a launch interrupted by Home, a sheet grabbed as it opened), it carries on from there instead of
 * jumping. Only the properties named in `to` are read and animated.
 */
export function springTo(element: HTMLElement, to: Keyframe, spring: Spring = windowSpring, options: { from?: Keyframe; fill?: FillMode } = {}) {
  if (typeof element.animate !== "function") return null;
  const computed = getComputedStyle(element);
  const now: Keyframe = {};
  for (const property of Object.keys(to)) now[property] = computed.getPropertyValue(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)) || undefined;
  const springs = element.getAnimations().filter((animation) => animation.id === "spring");
  const interrupted = springs.some((animation) => animation.playState === "running");
  for (const animation of springs) animation.cancel();
  if (prefersStill()) return null;
  const { duration, easing } = springEasing(spring);
  const animation = element.animate([options.from && !interrupted ? options.from : now, to], { duration, easing, fill: options.fill ?? "none" });
  animation.id = "spring";
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
