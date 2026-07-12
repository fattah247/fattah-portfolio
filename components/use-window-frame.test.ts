import { describe, expect, it } from "vitest";
import { windowResizeEdges } from "./use-window-frame";

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
});
