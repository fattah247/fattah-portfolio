import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppIcon, appIconDrawings, appIconPalette } from "./app-icons";

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
});
