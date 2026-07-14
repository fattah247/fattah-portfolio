import { describe, expect, it } from "vitest";
import { resizeFrame, windowResizeEdges, type FrameRect } from "./use-window-frame";

describe("window frame resize contract", () => {
  it("exposes every edge and corner exactly once", () => {
    expect(windowResizeEdges).toEqual([
      "top",
      "right",
      "bottom",
      "left",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ]);
    expect(new Set(windowResizeEdges).size).toBe(8);
  });

  it("resizes from every side while preserving the opposite edge", () => {
    const rect: FrameRect = { x: 100, y: 80, width: 600, height: 420 };

    for (const edge of windowResizeEdges) {
      const resized = resizeFrame(rect, edge, 40, 30);
      if (edge.includes("left")) expect(resized.x + resized.width).toBe(rect.x + rect.width);
      if (edge.includes("right")) expect(resized.x).toBe(rect.x);
      if (edge.includes("top")) expect(resized.y + resized.height).toBe(rect.y + rect.height);
      if (edge.includes("bottom")) expect(resized.y).toBe(rect.y);
    }
  });
});
