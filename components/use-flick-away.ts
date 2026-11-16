"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";
import { leaveSpring, pointerTrail, project, rubberband, springTo, windowSpring } from "../lib/motion";

/** Whether a card let go `dy` px from where it started (negative is up), moving at `velocity` px per ms, flies away. */
export function flicksAway(dy: number, velocity: number, height: number) {
  return velocity < -0.5 || project(dy, velocity) < -height * 0.6;
}

/**
 * A Recents card flicked up closes its app, as on an iPhone or iPad: it follows the finger up (down
 * it gives like a rubber band), and let go fast enough or far enough it flies off the top at the speed
 * it was thrown; otherwise it springs back. A sideways drag is left to the row's own scrolling, and a
 * tap is still a tap. The element needs `data-app`, which is what `onAway` is told.
 */
export function useFlickAway(onAway: (app: string) => void) {
  const swallowClick = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    swallowClick.current = false;
    if (!event.isPrimary || event.button !== 0) return;
    const card = event.currentTarget;
    const app = card.dataset.app;
    if (!app) return;
    const id = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    const trail = pointerTrail();
    trail.add(start.x, start.y, event.timeStamp);
    let started = false;
    const offset = (dy: number) => (dy < 0 ? dy : rubberband(dy, card.offsetHeight));

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    const move = (moved: globalThis.PointerEvent) => {
      if (moved.pointerId !== id) return;
      trail.add(moved.clientX, moved.clientY, moved.timeStamp);
      const dx = moved.clientX - start.x;
      const dy = moved.clientY - start.y;
      if (!started) {
        if (Math.hypot(dx, dy) < 8) return;
        if (-dy <= Math.abs(dx)) { stop(); return; }
        started = true;
        swallowClick.current = true;
        for (const animation of card.getAnimations?.() ?? []) if (animation.id === "spring") animation.cancel();
      }
      card.style.translate = `0px ${offset(dy)}px`;
    };
    const up = (lifted: globalThis.PointerEvent) => {
      if (lifted.pointerId !== id) return;
      stop();
      if (!started) return;
      window.setTimeout(() => { swallowClick.current = false; }, 300);
      const dy = lifted.clientY - start.y;
      const velocity = lifted.type === "pointercancel" ? 0 : trail.velocity(lifted.timeStamp).y;
      if (lifted.type !== "pointercancel" && flicksAway(dy, velocity, card.offsetHeight)) {
        // Off the top of the screen from wherever it is, at the speed it was thrown.
        const top = card.getBoundingClientRect().top - offset(dy);
        const away = springTo(card, { translate: `0px ${-(top + card.offsetHeight + 24)}px` }, leaveSpring, { fill: "forwards", velocity: velocity * 1000 });
        card.style.removeProperty("translate");
        if (away) away.addEventListener("finish", () => onAway(app));
        else onAway(app);
        return;
      }
      springTo(card, { translate: "0px 0px" }, windowSpring, { velocity: velocity * 1000 });
      card.style.removeProperty("translate");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // A flick that started on the card's button isn't also a press of it.
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return { onClickCapture, onPointerDown };
}
