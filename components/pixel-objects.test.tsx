import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PixelObject, pixelMaps, pixelPalette, PixelSprite, type PixelObjectName } from "./pixel-objects";

describe("pixel objects", () => {
  it.each(Object.keys(pixelMaps) as PixelObjectName[])("draws %s on its own grid in the family's colours, outlined in ink", (name) => {
    const rows = pixelMaps[name];
    const width = rows[0].length;
    expect(width % 8).toBe(0);
    expect(rows.length % 8).toBe(0);
    for (const row of rows) {
      expect(row).toHaveLength(width);
      for (const colour of row) if (colour !== ".") expect(pixelPalette).toHaveProperty(colour);
    }
    expect(rows.join("")).toContain("k");
  });

  it("is decorative, crisp, and sketched in graphite ink as a comparison's ghost", () => {
    const { container } = render(<><PixelObject name="clerk" size={48} /><PixelObject ghost name="clerk" /><PixelSprite name="bank" /></>);
    const [solid, ghost, sprite] = Array.from(container.querySelectorAll("svg"));
    expect(solid.getAttribute("aria-hidden")).toBe("true");
    expect(solid.getAttribute("shape-rendering")).toBe("crispEdges");
    expect(solid.getAttribute("width")).toBe("48");
    expect(solid.querySelectorAll("path").length).toBeGreaterThan(3);
    expect(ghost.hasAttribute("data-ghost")).toBe(true);
    expect(ghost.querySelectorAll("path")).toHaveLength(1);
    expect(ghost.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
    // A world's sprite keeps its own proportions and fills the box the world gives it.
    expect(sprite.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(sprite.getAttribute("width")).toBeNull();
  });
});
