import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fadeOutCopy, leaveSpring, pointerTrail, popSpring, project, rubberband, sheetSpring, springAt, springDuration, springEasing, springTo, springVelocity, windowSpring } from "./motion";

const tokens = readFileSync(resolve(process.cwd(), "app", "design-tokens.css"), "utf8");
const token = (name: string) => tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

describe("the environment's springs", () => {
  it("start at rest, arrive, and stay put", () => {
    for (const spring of [windowSpring, sheetSpring, leaveSpring]) {
      expect(springAt(spring, 0)).toBe(0);
      expect(Math.abs(springAt(spring, springDuration(spring) / 1000) - 1)).toBeLessThan(0.002);
    }
  });

  it("settle with an overshoot felt more than seen, and a fully damped one never overshoots", () => {
    const peak = (spring: typeof windowSpring) => Math.max(...Array.from({ length: 400 }, (_, index) => springAt(spring, index / 400)));
    expect(peak(windowSpring)).toBeGreaterThan(1);
    expect(peak(windowSpring)).toBeLessThan(1.01);
    expect(peak(sheetSpring)).toBeLessThan(1.005);
    expect(peak(leaveSpring)).toBeLessThanOrEqual(1);
  });

  it("set off at the speed they're given and report their speed truly", () => {
    for (const spring of [windowSpring, popSpring, leaveSpring]) {
      for (const velocity of [0, 6, -4]) {
        const step = 1e-5;
        expect(springAt(spring, step, velocity) / step).toBeCloseTo(velocity, 2);
        for (const t of [0.05, 0.12, 0.3]) {
          const slope = (springAt(spring, t + step, velocity) - springAt(spring, t - step, velocity)) / (2 * step);
          expect(springVelocity(spring, t, velocity)).toBeCloseTo(slope, 3);
        }
        expect(Math.abs(springAt(spring, springDuration(spring, velocity) / 1000, velocity) - 1)).toBeLessThan(0.0011);
      }
    }
  });

  it("are the same curves in the stylesheet as in script", () => {
    for (const [name, spring] of [["window", windowSpring], ["sheet", sheetSpring], ["pop", popSpring]] as const) {
      const { duration, easing } = springEasing(spring);
      expect(token(`--spring-${name}`)).toBe(easing);
      expect(token(`--spring-${name}-duration`)).toBe(`${duration}ms`);
    }
  });

  it("throw, stretch and track the way Apple's interfaces do", () => {
    // A flick at 1 px/ms would coast about half a screen; resting, it goes nowhere.
    expect(project(100, 1)).toBeCloseTo(599, 0);
    expect(project(100, 0)).toBe(100);
    // A rubber band gives less the further it's pulled, and never as far as the pull.
    expect(rubberband(100, 800)).toBeLessThan(100);
    expect(rubberband(200, 800) - rubberband(100, 800)).toBeLessThan(rubberband(100, 800));
    expect(rubberband(-100, 800)).toBeCloseTo(-rubberband(100, 800));
    const trail = pointerTrail();
    for (let t = 0; t <= 100; t += 10) trail.add(0, t * 2, t);
    expect(trail.velocity(100).y).toBeCloseTo(2);
    expect(trail.velocity(300).y).toBe(0);
  });

  it("leave nothing behind where the browser can't animate", () => {
    const element = document.createElement("div");
    document.body.append(element);
    expect(springTo(element, { scale: "1" })).toBeNull();
    fadeOutCopy(element);
    expect(document.querySelectorAll("[data-closing-copy]")).toHaveLength(0);
    element.remove();
  });
});
