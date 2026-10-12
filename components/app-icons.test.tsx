import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppIcon, appIconDrawings, appIconPalette, OwnerMark, ownerPortrait } from "./app-icons";

describe("application icon family", () => {
  afterEach(cleanup);

  it("draws every icon on its own pixel grid with the shared palette only", () => {
    for (const [app, { large, small }] of Object.entries(appIconDrawings)) {
      for (const [map, size] of [[large, 32], [small, 16]] as const) {
        expect(map, `${app} ${size}`).toHaveLength(size);
        for (const row of map) {
          expect(row, `${app} ${size}`).toHaveLength(size);
          for (const pixel of row) if (pixel !== ".") expect(appIconPalette[pixel], `${app} uses ${pixel}`).toBeDefined();
        }
        // Every object has an ink outline and leaves its corners clear: no background tile.
        expect(map.join("")).toContain("k");
        expect([map[0][0], map[0][size - 1], map[size - 1][0], map[size - 1][size - 1]].every((pixel) => pixel === ".")).toBe(true);
      }
    }
  });

  it("renders whole-pixel rectangles with crisp edges, one path per colour", () => {
    const { container } = render(<AppIcon app="work" variant="small" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
    const paths = Array.from(svg.querySelectorAll("path"));
    expect(new Set(paths.map((path) => path.getAttribute("fill"))).size).toBe(paths.length);
    for (const path of paths) expect(path.getAttribute("d")).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
  });

  it("draws the owner as a framed pixel portrait with a face, not initials", () => {
    expect(ownerPortrait).toHaveLength(32);
    for (const row of ownerPortrait) {
      expect(row).toHaveLength(32);
      for (const pixel of row) expect(appIconPalette[pixel], `portrait uses ${pixel}`).toBeDefined();
    }
    // A print: ink outline on every edge, around a face (skin, hair, mouth) and a navy shirt.
    expect(ownerPortrait[0]).toBe("k".repeat(32));
    expect(ownerPortrait[31]).toBe("k".repeat(32));
    expect(ownerPortrait.every((row) => row[0] === "k" && row[31] === "k")).toBe(true);
    for (const pixel of ["f", "h", "m", "N"]) expect(ownerPortrait.join("")).toContain(pixel);

    const { container } = render(<OwnerMark />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 32 32");
    expect(svg.querySelector("text")).toBeNull();
    for (const path of svg.querySelectorAll("path")) expect(path.getAttribute("d")).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
  });
});
