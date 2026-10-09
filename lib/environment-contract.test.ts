import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The environment's visual and geometry contract, checked against the stylesheets themselves.
 * Layout cannot be measured in jsdom, so these guard the rules that make Home a fixed screen
 * and keep the retro material system solid; the browser audits measure the result.
 */
const names = ["globals.css", "design-tokens.css", "window-system.css", "environment.css"] as const;
const read = (name: string) => readFileSync(resolve(process.cwd(), "app", name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const sheets = names.map((name) => ({ css: read(name), name }));
const environment = read("environment.css");

/** Innermost rules as selector and declaration text; at-rule wrappers are skipped. */
function rules(css: string) {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({ body: match[2], selector: match[1].trim() }));
}

describe("environment stylesheet contract", () => {
  it("keeps every surface solid: no gradients, glass, or blur", () => {
    for (const { css, name } of sheets) {
      expect(css, name).not.toMatch(/(?<!repeating-)(linear|radial|conic)-gradient\(/);
      expect(css, name).not.toMatch(/backdrop-filter\s*:\s*(?!none)/);
      expect(css, name).not.toMatch(/filter\s*:[^;}]*blur\(/);
    }
  });

  it("keeps corners square or within two pixels", () => {
    for (const { css, name } of sheets) {
      for (const [, value] of css.matchAll(/border-radius\s*:\s*([^;}!]+)/g)) {
        for (const part of value.trim().split(/\s+/)) {
          if (part === "0" || part.startsWith("var(--radius-")) continue;
          expect(part, `${name}: border-radius ${value}`).toMatch(/^(0|[0-3](\.\d+)?px)$/);
        }
      }
    }
    for (const [, value] of environment.matchAll(/--radius-[a-z]+\s*:\s*([^;]+);/g)) expect(value.trim()).toMatch(/^(0|[0-2]px)$/);
  });

  it("makes Home a fixed screen and composes it by the screen's real size", () => {
    const home = rules(environment).filter(({ selector }) => /^html\[data-system-mode\] \.system-home-screen$/.test(selector));
    expect(home.some(({ body }) => /overflow:\s*clip/.test(body) && /container:\s*home\s*\/\s*size/.test(body))).toBe(true);
    const root = rules(environment).filter(({ selector }) => selector.includes("html[data-system-mode] body"));
    expect(root.some(({ body }) => /overflow:\s*clip/.test(body))).toBe(true);
    expect(environment).toMatch(/html\[data-system-mode\]\s*\{\s*overscroll-behavior:\s*none/);
    // Breakpoints follow the text size, so a larger text setting reaches a compact composition
    // instead of overflowing.
    const queries = Array.from(environment.matchAll(/@container home ([^{]+)\{/g), (match) => match[1]);
    expect(queries.length).toBeGreaterThan(4);
    for (const query of queries) expect(query, query).not.toMatch(/\d+px/);
  });

  it("never lets the taskbar, shelf, launcher, or phone bar scroll", () => {
    const bars = /\.(desktop-taskbar|taskbar-apps|tablet-shelf|phone-system-navigation|system-launcher)\b(?![-\w])/;
    for (const { css, name } of sheets) {
      for (const { body, selector } of rules(css)) {
        if (!bars.test(selector) || /\b(button|strong|span|svg|i)\b|::/.test(selector.split(",").map((part) => part.trim().split(/\s+/).pop()).join(" "))) continue;
        expect(body, `${name}: ${selector}`).not.toMatch(/overflow(-x|-y)?\s*:\s*(auto|scroll)/);
      }
    }
  });

  it("leaves the case's reading order to the document: no stylesheet reorders its sections", () => {
    // A legacy flex `order` once put the simulator above the case's own title on phones.
    const caseParts = /\.(case-page|case-intro|case-interaction|instrument|mobile-outcome-strip|case-result|case-evidence|case-handoff|case-progress)\b/;
    for (const { css, name } of sheets) {
      for (const { body, selector } of rules(css)) {
        if (!caseParts.test(selector)) continue;
        expect(body, `${name}: ${selector}`).not.toMatch(/(^|[;\s])order\s*:/);
      }
    }
  });

  it("keeps the wallpaper static", () => {
    for (const { body, selector } of rules(environment)) {
      if (!/wallpaper|terrace/.test(selector)) continue;
      expect(body, selector).not.toMatch(/\b(animation|transition|transform)\s*:/);
    }
    expect(environment).not.toMatch(/--parallax/);
  });

  it("marks meaning with lamps and markers, never with coloured side stripes", () => {
    for (const { body, selector } of rules(environment)) {
      expect(body, selector).not.toMatch(/border-(inline-start|left)(-width)?\s*:\s*[2-9]px/);
    }
  });

  it("shows pixel icons at whole multiples of their grid", () => {
    for (const { body, selector } of rules(environment)) {
      if (!/app-icon|system-app-mark/.test(selector)) continue;
      for (const [, size] of body.matchAll(/(?:block-size|inline-size|height|width)\s*:\s*(\d+)px/g)) {
        expect([16, 32, 48, 64, 96], `${selector}: ${size}px`).toContain(Number(size));
      }
    }
  });
});
