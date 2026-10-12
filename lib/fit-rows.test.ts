import { describe, expect, it } from "vitest";
import { rowsThatFit } from "./fit-rows";

describe("rowsThatFit", () => {
  const bottoms = [60, 120, 180, 240];

  it("keeps every row when the list ends above the limit", () => {
    expect(rowsThatFit(bottoms, 300)).toBe(4);
    expect(rowsThatFit(bottoms, 240)).toBe(4);
  });

  it("drops the rows that would cross the limit, last first", () => {
    expect(rowsThatFit(bottoms, 239)).toBe(3);
    expect(rowsThatFit(bottoms, 125)).toBe(2);
  });

  it("tolerates subpixel layout but not a visible overlap", () => {
    expect(rowsThatFit([60.4, 120.4], 120)).toBe(2);
    expect(rowsThatFit([60, 121], 120)).toBe(1);
  });

  it("shows nothing rather than fewer rows than the minimum", () => {
    expect(rowsThatFit(bottoms, 100, 2)).toBe(0);
    expect(rowsThatFit(bottoms, 130, 2)).toBe(2);
    expect(rowsThatFit([], 500, 2)).toBe(0);
  });
});
