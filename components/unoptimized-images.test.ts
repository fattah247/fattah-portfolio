import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Next's image optimisation is metered on Vercel, and the site must cost nothing to run.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
  });
}

describe("next/image", () => {
  it("never routes a picture through /_next/image", () => {
    const tags: Array<{ file: string; tag: string }> = [];
    for (const file of ["app", "components"].flatMap((dir) => sourceFiles(resolve(process.cwd(), dir)))) {
      const source = readFileSync(file, "utf8");
      if (!/from "next\/image"/.test(source)) continue;
      for (const match of source.matchAll(/<Image\b[\s\S]*?\/>/g)) tags.push({ file, tag: match[0] });
    }
    expect(tags.length).toBeGreaterThan(0);
    for (const { file, tag } of tags) expect(tag, file).toMatch(/\bunoptimized\b/);
  });
});
