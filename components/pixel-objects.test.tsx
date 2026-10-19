import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PixelObject, pixelMaps, pixelPalette, type PixelObjectName } from "./pixel-objects";

describe("pixel objects", () => {
  it.each(Object.keys(pixelMaps) as PixelObjectName[])("draws %s on a 16 x 16 grid in the family's colours, outlined in ink", (name) => {
    const rows = pixelMaps[name];
    expect(rows).toHaveLength(16);
    for (const row of rows) {
      expect(row).toHaveLength(16);
      for (const colour of row) if (colour !== ".") expect(pixelPalette).toHaveProperty(colour);
    }
    expect(rows.join("")).toContain("k");
  });

  it("is decorative, crisp, and sketched in graphite ink as a comparison's ghost", () => {
    const { container } = render(<><PixelObject name="clerk" size={48} /><PixelObject ghost name="clerk" /></>);
    const [solid, ghost] = Array.from(container.querySelectorAll("svg"));
    expect(solid.getAttribute("aria-hidden")).toBe("true");
    expect(solid.getAttribute("shape-rendering")).toBe("crispEdges");
    expect(solid.getAttribute("width")).toBe("48");
    expect(solid.querySelectorAll("path").length).toBeGreaterThan(3);
    expect(ghost.hasAttribute("data-ghost")).toBe(true);
    expect(ghost.querySelectorAll("path")).toHaveLength(1);
    expect(ghost.querySelector("path")?.getAttribute("fill")).toBe("currentColor");
  });
});
