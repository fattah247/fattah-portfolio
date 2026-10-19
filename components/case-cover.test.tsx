import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseCover } from "./case-cover";

/** IBM Plex Mono advances every glyph by 0.6 em. */
const MONO_ADVANCE = 0.6;
const css = readFileSync(resolve(process.cwd(), "app", "environment.css"), "utf8");

/** The cover text's font size, read from its rule in environment.css. */
function fontSize(className: string) {
  const rule = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*font:\\s*\\d+\\s+([\\d.]+)px`));
  if (!rule) throw new Error(`no font size for .${className}`);
  return Number(rule[1]);
}

const number = (tag: string, name: string) => Number(tag.match(new RegExp(`\\s${name}="([\\d.]+)"`))?.[1] ?? 0);

/** How many words each cover draws on a box: ids and the state, none, the checks and the decision. */
const boxedWords = { payflow: 3, iyup: 0, trustgate: 5 } as const;

describe("case covers", () => {
  // Each word drawn on a box (an event id, a state, a check, a decision) stays inside that box.
  it.each(["payflow", "iyup", "trustgate"] as const)("keeps every boxed word inside its box on the %s cover", (slug) => {
    const markup = renderToStaticMarkup(<CaseCover slug={slug} />);
    const pairs = [...markup.matchAll(/(<rect [^>]*>)(?:<\/rect>)?(<text [^>]*>)([^<]+)<\/text>/g)];
    for (const [, rect, text, word] of pairs) {
      const className = text.match(/class="([^" ]+)/)![1];
      const width = word.length * MONO_ADVANCE * fontSize(className);
      const x = number(text, "x");
      const left = /text-anchor="middle"/.test(text) ? x - width / 2 : x;
      const boxLeft = number(rect, "x");
      const boxRight = boxLeft + number(rect, "width");
      expect({ word, left: left >= boxLeft + 2, right: left + width <= boxRight - 2 }).toEqual({ word, left: true, right: true });
    }
    expect(pairs.length).toBe(boxedWords[slug]);
  });
});
