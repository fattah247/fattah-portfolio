"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { pointerTrail, project, springTo, windowSpring } from "../lib/motion";

/**
 * Where a side-by-side divider rests on a screen `width` px wide, as an iPad's does: a third, half or
 * two thirds of the way across, the outer two moved in as far as it takes to keep both panes at
 * least 480 px wide.
 */
export function splitStops(width: number) {
  const edge = Math.min(0.5, Math.max(1 / 3, 480 / width));
  return [edge, 0.5, 1 - edge];
}

/**
 * Where a divider let go `split` of the way across, moving at `velocity` (of the width per ms), comes
 * to rest: the stop nearest where the throw would carry it, or, carried to an edge, closing the side
 * it was pushed over.
 */
export function splitRest(split: number, velocity: number, width: number): number | "close-left" | "close-right" {
  const landing = project(split, velocity);
  if (landing > 0.85) return "close-right";
  if (landing < 0.15) return "close-left";
  return splitStops(width).reduce((best, stop) => (Math.abs(stop - landing) < Math.abs(best - landing) ? stop : best));
}

/**
 * The divider between two apps side by side on a tablet, as an iPad's: both resize under the finger
 * as it's dragged; let go, it springs to the nearest of its three stops (by where the throw would
 * land); pushed to an edge, it closes that side and the other app has the screen. A tap steps it to
 * the next stop, and the arrow keys (Home and End too) step it between the same stops.
 */
export function SplitDivider({ host, keep }: {
  /** The element whose `--split` (the left app's share of the width) the windows read. */
  host: () => HTMLElement | null;
  /** Closes one side, keeping this app. */
  keep: (app: "work" | "experience") => void;
}) {
  const [split, setSplit] = useState(0.5);
  const drag = useRef<{ id: number; startX: number; trail: ReturnType<typeof pointerTrail> } | null>(null);

  const across = (element: HTMLElement, x: number) => Math.min(0.95, Math.max(0.05, x / element.clientWidth));

  const settle = (element: HTMLElement, to: number, velocity = 0) => {
    springTo(element, { "--split": String(to) }, windowSpring, { velocity });
    element.style.setProperty("--split", String(to));
    setSplit(to);
  };

  const close = (element: HTMLElement, side: "close-left" | "close-right", velocity: number) => {
    // The divider runs on to the edge, then the side it crossed is gone.
    const edge = side === "close-right" ? 1 : 0;
    const run = springTo(element, { "--split": String(edge) }, windowSpring, { fill: "forwards", velocity });
    const done = () => {
      run?.cancel();
      element.style.removeProperty("--split");
      setSplit(0.5);
      keep(side === "close-right" ? "work" : "experience");
    };
    if (run) run.addEventListener("finish", done);
    else done();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = host();
    if (!element || !event.isPrimary || event.button !== 0) return;
    for (const animation of element.getAnimations?.() ?? []) if (animation.id === "spring") animation.cancel();
    const trail = pointerTrail();
    trail.add(event.clientX, event.clientY, event.timeStamp);
    drag.current = { id: event.pointerId, startX: event.clientX, trail };
    event.currentTarget.setPointerCapture(event.pointerId);
    element.dataset.splitting = "true";
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = host();
    if (!element || drag.current?.id !== event.pointerId) return;
    drag.current.trail.add(event.clientX, event.clientY, event.timeStamp);
    element.style.setProperty("--split", String(across(element, event.clientX)));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const element = host();
    const state = drag.current;
    if (!element || state?.id !== event.pointerId) return;
    drag.current = null;
    delete element.dataset.splitting;
    // A tap that didn't drag steps to the next stop, so resizing never needs a drag.
    if (event.type !== "pointercancel" && Math.abs(event.clientX - state.startX) < 6) {
      const stops = splitStops(element.clientWidth);
      const index = stops.findIndex((stop) => Math.abs(stop - split) < 0.01);
      element.style.setProperty("--split", String(split));
      settle(element, stops[(index + 1) % stops.length]);
      return;
    }
    const at = across(element, event.clientX);
    const velocity = event.type === "pointercancel" ? 0 : state.trail.velocity(event.timeStamp).x / element.clientWidth;
    const rest = splitRest(at, velocity, element.clientWidth);
    if (rest === "close-left" || rest === "close-right") close(element, rest, velocity * 1000);
    else settle(element, rest, velocity * 1000);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const element = host();
    if (!element || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const stops = splitStops(element.clientWidth);
    const index = stops.findIndex((stop) => Math.abs(stop - split) < 0.01);
    const step = (index < 0 ? 1 : index) + (event.key === "ArrowRight" ? 1 : -1);
    const next = event.key === "Home" ? stops[0] : event.key === "End" ? stops.at(-1)! : stops[Math.min(stops.length - 1, Math.max(0, step))];
    settle(element, next);
  };

  return (
    <div
      aria-label="Divider between Projects and Experience"
      aria-orientation="vertical"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(split * 100)}
      aria-valuetext={`Projects ${Math.round(split * 100)}%, Experience ${100 - Math.round(split * 100)}%`}
      className="split-divider"
      onKeyDown={onKeyDown}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      tabIndex={0}
    >
      <span aria-hidden="true" className="split-divider-grip" />
    </div>
  );
}
