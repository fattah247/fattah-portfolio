"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";
import { pointerTrail, project, rubberband, springTo, windowSpring } from "../lib/motion";

/** How much of the screen a full pull up shrinks the app across, and how small it gets there. */
const PULL = 0.55;
const SMALLEST = 0.5;

/** The app's size for a pull of `lift` px on a screen `height` px tall. */
const scaleFor = (lift: number, height: number) => 1 - (1 - SMALLEST) * Math.min(1, Math.max(0, lift) / (height * PULL));

/**
 * Where a pull let go `dy` px from where it started (negative is up), moving at `velocity` px per ms,
 * on a screen `height` px tall, sends the app: thrown up or carried far, Home; held still partway up
 * (as an iPhone waits for before showing its app switcher), Recents; otherwise back where it was.
 */
export function homeGestureOutcome(dy: number, velocity: number, height: number): "home" | "recents" | "back" {
  if (velocity < -0.4 || project(dy, velocity) < -height * 0.4) return "home";
  if (1 - scaleFor(-dy, height) > 0.15 && Math.abs(velocity) < 0.2) return "recents";
  return "back";
}

/**
 * The home gesture of an iPhone or iPad, on the phone's navigation bar or the tablet's shelf: push up
 * from it and the open app comes up under the finger, shrinking as it rises. Throw it (or carry it
 * far) and it goes Home, into its icon, at the speed it was thrown; hold it a moment partway and let
 * go, and it settles into Recents; let it drop and it springs back. A tap on the bar's buttons is
 * still a tap: the gesture only starts once the finger has clearly moved up.
 */
export function useHomeGesture({ app, home, recents }: {
  /** The open app's window, or nothing when no app is open. */
  app: () => HTMLElement | null;
  /** Go Home, with how fast the app's scale was already falling (per second). */
  home: (scaleVelocity: number) => void;
  recents: () => void;
}) {
  const pull = useRef<{ element: HTMLElement | null; id: number; started: boolean; trail: ReturnType<typeof pointerTrail>; x: number; y: number } | null>(null);
  const swallowClick = useRef(false);

  const place = (element: HTMLElement, dx: number, dy: number) => {
    const height = window.innerHeight;
    element.style.translate = `${dx * 0.7}px ${dy < 0 ? dy : rubberband(dy, height)}px`;
    element.style.scale = String(scaleFor(-dy, height));
  };

  const settleBack = (element: HTMLElement, scaleVelocity: number) => {
    springTo(element, { scale: "1", translate: "0px 0px" }, windowSpring, { velocity: scaleVelocity });
    element.style.removeProperty("translate");
    element.style.removeProperty("scale");
    delete element.dataset.held;
  };

  // The pull is followed on the window from the moment the finger lands, since a quick throw leaves
  // the bar before it has clearly started.
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    swallowClick.current = false;
    if (!event.isPrimary || event.button !== 0 || !app()) return;
    const trail = pointerTrail();
    trail.add(event.clientX, event.clientY, event.timeStamp);
    pull.current = { element: null, id: event.pointerId, started: false, trail, x: event.clientX, y: event.clientY };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    const move = (moved: globalThis.PointerEvent) => follow(moved);
    const up = (lifted: globalThis.PointerEvent) => { stop(); release(lifted); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const follow = (event: globalThis.PointerEvent) => {
    const state = pull.current;
    if (!state || state.id !== event.pointerId) return;
    state.trail.add(event.clientX, event.clientY, event.timeStamp);
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.started) {
      if (Math.hypot(dx, dy) < 10) return;
      // Only a push up starts it; anything else leaves the bar's buttons to their tap.
      const element = -dy > Math.abs(dx) ? app() : null;
      if (!element) { pull.current = null; return; }
      for (const animation of element.getAnimations?.() ?? []) if (animation.id === "spring") animation.cancel();
      element.dataset.held = "true";
      element.style.transformOrigin = "50% 100%";
      state.element = element;
      state.started = true;
      swallowClick.current = true;
    }
    if (state.element) place(state.element, dx, dy);
  };

  const release = (event: globalThis.PointerEvent) => {
    const state = pull.current;
    if (!state || state.id !== event.pointerId) return;
    pull.current = null;
    const element = state.element;
    if (!state.started || !element) return;
    // The click a pull's release can produce comes at once; nothing later is swallowed.
    window.setTimeout(() => { swallowClick.current = false; }, 300);
    const height = window.innerHeight;
    const dy = event.clientY - state.y;
    const cancelled = event.type === "pointercancel";
    const velocity = cancelled ? { x: 0, y: 0 } : state.trail.velocity(event.timeStamp);
    // How fast the app's scale was changing as it was let go, per second.
    const scaleVelocity = dy < 0 ? ((1 - SMALLEST) / (height * PULL)) * velocity.y * 1000 : 0;
    const outcome = cancelled ? "back" : homeGestureOutcome(dy, velocity.y, height);
    if (outcome === "home") home(scaleVelocity);
    else if (outcome === "recents") recents();
    else settleBack(element, scaleVelocity);
  };

  // A pull that started on one of the bar's buttons isn't also a press of it.
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return { onClickCapture, onPointerDown };
}
