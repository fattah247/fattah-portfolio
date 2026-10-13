import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ArrowIcon,
  ChevronIcon,
  CloseIcon,
  DownloadIcon,
  glyphMaps,
  glyphPath,
  MarketplaceIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoreIcon,
  PairIcon,
  PlayIcon,
  ResetIcon,
  StartOverIcon,
  SystemIcon,
} from "./icons";
import { SoundControl } from "./sound-control";

const filled = (rows: readonly string[]) => rows.join("").split("").filter((pixel) => pixel === "#").length;

describe("interface glyphs", () => {
  afterEach(cleanup);

  it("draws every glyph as a 16 × 16 map of filled and empty squares", () => {
    for (const [name, rows] of Object.entries(glyphMaps)) {
      expect(rows, name).toHaveLength(16);
      for (const row of rows) expect(row, name).toMatch(/^[#.]{16}$/);
      expect(filled(rows), name).toBeGreaterThan(8);
    }
  });

  it("gives every control its own drawing, so no two meanings share a shape", () => {
    const drawings = Object.entries(glyphMaps).map(([name, rows]) => [rows.join(""), name] as const);
    expect(new Map(drawings).size).toBe(drawings.length);
    // Start over and Reset were once the same arrow; they now mean different things and look it.
    expect(glyphMaps["start-over"]).not.toEqual(glyphMaps.reset);
  });

  it("renders whole-unit runs with crisp edges in the text colour, never a stroke", () => {
    const { container } = render(
      <>
        <ArrowIcon />
        <PlayIcon />
        <PlayIcon paused />
        <StartOverIcon />
        <ResetIcon />
        <CloseIcon />
        <MinimizeIcon />
        <MaximizeIcon />
        <MaximizeIcon restored />
        {(["left", "right", "up", "down"] as const).map((direction) => <ChevronIcon direction={direction} key={direction} />)}
        <MoreIcon />
        <PairIcon />
        <DownloadIcon />
        {(["back", "home", "overview"] as const).map((name) => <SystemIcon key={name} name={name} />)}
        {(["shopee", "amazon", "tokopedia", "tiktok"] as const).map((marketplace) => <MarketplaceIcon key={marketplace} marketplace={marketplace} />)}
        <SoundControl />
      </>,
    );
    const glyphs = Array.from(container.querySelectorAll("svg"));
    expect(glyphs).toHaveLength(24);
    for (const svg of glyphs) {
      expect(svg.classList.contains("pixel-glyph")).toBe(true);
      expect(svg.getAttribute("viewBox")).toBe("0 0 16 16");
      expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.querySelectorAll("circle, line, polyline, polygon, ellipse")).toHaveLength(0);
      for (const path of svg.querySelectorAll("path")) {
        expect(path.getAttribute("d")).toMatch(/^(M\d+ \d+h\d+v\d+h-\d+z)+$/);
        expect(path.getAttribute("stroke") ?? "none").toBe("none");
      }
    }
    expect(glyphPath(["##..#"])).toBe("M0 0h2v1h-2zM4 0h1v1h-1z");
  });

  it("turns the right chevron for the other three, so all four weigh the same", () => {
    const { container } = render(
      <>
        {(["right", "left", "up", "down"] as const).map((direction) => <ChevronIcon direction={direction} key={direction} />)}
      </>,
    );
    const areas = Array.from(container.querySelectorAll("path"), (path) =>
      Array.from(path.getAttribute("d")!.matchAll(/h(\d+)v1/g), ([, width]) => Number(width)).reduce((sum, width) => sum + width, 0),
    );
    expect(new Set(areas)).toEqual(new Set([filled(glyphMaps["chevron-right"])]));
  });

  it("is shown at 16 px, and 32 px on the tablet shelf, with no stroked icon left in the stylesheet", () => {
    const css = readFileSync(resolve(process.cwd(), "app", "environment.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const sizes = Array.from(css.matchAll(/([^{}]*pixel-glyph[^{}]*)\{([^{}]*)\}/g)).flatMap(([, selector, body]) =>
      Array.from(body.matchAll(/(?:block-size|inline-size)\s*:\s*(\d+)px/g), ([, size]) => ({ selector: selector.trim(), size: Number(size) })),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const { selector, size } of sizes) expect([16, 32], selector).toContain(size);
    expect(sizes.find(({ size }) => size === 32)?.selector).toMatch(/tablet-shelf/);
  });
});
