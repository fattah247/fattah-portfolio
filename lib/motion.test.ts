import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fadeOutCopy, sheetSpring, springAt, springDuration, springEasing, springTo, windowSpring } from "./motion";

const tokens = readFileSync(resolve(process.cwd(), "app", "design-tokens.css"), "utf8");
const token = (name: string) => tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

describe("the environment's springs", () => {
  it("start at rest, arrive, and stay put", () => {
    for (const spring of [windowSpring, sheetSpring, { response: 0.34, damping: 1 }]) {
      expect(springAt(spring, 0)).toBe(0);
      expect(Math.abs(springAt(spring, springDuration(spring) / 1000) - 1)).toBeLessThan(0.002);
    }
  });

  it("settle with an overshoot felt more than seen, and a fully damped one never overshoots", () => {
    const peak = (spring: typeof windowSpring) => Math.max(...Array.from({ length: 400 }, (_, index) => springAt(spring, index / 400)));
    expect(peak(windowSpring)).toBeGreaterThan(1);
    expect(peak(windowSpring)).toBeLessThan(1.01);
    expect(peak(sheetSpring)).toBeLessThan(1.005);
    expect(peak({ response: 0.34, damping: 1 })).toBeLessThanOrEqual(1);
  });

  it("are the same curves in the stylesheet as in script", () => {
    for (const [name, spring] of [["window", windowSpring], ["sheet", sheetSpring]] as const) {
      const { duration, easing } = springEasing(spring);
      expect(token(`--spring-${name}`)).toBe(easing);
      expect(token(`--spring-${name}-duration`)).toBe(`${duration}ms`);
    }
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
