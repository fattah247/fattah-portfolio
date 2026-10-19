import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { assessDevice, deviceChecks, deviceProfiles, SCREEN_LOCK } from "../lib/device-risk";
import { scenarios } from "../lib/scenarios";
import { playFlow, type FlowInput } from "../lib/payment-flow";
import { runUptime, type UptimeConditions } from "../lib/uptime";
import { DeviceDiagram, PaymentDiagram, ServiceDiagram } from "./sim-diagrams";

afterEach(cleanup);

/** Characters a note line may hold in each composition before it would leave the drawing. */
const noteMax = { wide: 76, medium: 36, compact: 25 } as const;
const widths = { wide: "640", medium: "320", compact: "200" } as const;
type Layout = keyof typeof widths;

const compositions = (container: HTMLElement) => (["wide", "medium", "compact"] as const).map((layout) => {
  const svg = container.querySelector<SVGSVGElement>(`.sd-${layout}`)!;
  return { layout, svg };
});

function expectNotesFit(container: HTMLElement) {
  for (const { layout, svg } of compositions(container)) {
    const lines = Array.from(svg.querySelectorAll(".sd-note > tspan")).map((line) => line.textContent ?? "");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.length, `${layout}: "${line}"`).toBeLessThanOrEqual(noteMax[layout as Layout]);
  }
}

/** A long, busy run: every webhook outcome, a hold, the money's path, and a broken rule. */
const busyPayment: FlowInput[] = [
  ...Array.from({ length: 6 }, () => ({ kind: "webhook" as const, webhook: "again" as const })),
  { kind: "webhook", webhook: "success" },
  ...Array.from({ length: 8 }, () => ({ kind: "webhook" as const, webhook: "again" as const })),
  { kind: "webhook", webhook: "new-id" },
  { kind: "webhook", webhook: "late-authorized" },
  { kind: "webhook", webhook: "wrong-amount" },
  { kind: "mutate", mutation: "settle-held", removed: true },
  { kind: "settle" },
  { kind: "report", matches: false },
  { kind: "statement", statement: "no-credit" },
];
const monitorRuns: UptimeConditions[] = [
  { page: "slow", scope: "both", agent: "reporting" },
  { page: "error", scope: "both", agent: "reporting" },
  { page: "error", scope: "lab-b", agent: "reporting" },
  { page: "wrong-content", scope: "both", agent: "stopped" },
  { page: "quick", scope: "both", agent: "stopped" },
  { page: "quick", scope: "both", agent: "reporting" },
];

describe("simulator drawings", () => {
  it("draws every case in three compositions, each at its own width", () => {
    const world = playFlow(busyPayment);
    const conditions = scenarios[2].defaults;
    const { container } = render(<>
      <PaymentDiagram technical={false} world={world} />
      <ServiceDiagram technical={false} ticks={runUptime(monitorRuns[0], 4)} window={12} />
      <DeviceDiagram requestKey="a" run={assessDevice(conditions)} technical={false} />
    </>);

    for (const drawing of container.querySelectorAll(".sd")) {
      expect(drawing.getAttribute("aria-hidden")).toBe("true");
      for (const layout of ["wide", "medium", "compact"] as const) {
        expect(drawing.querySelector(`.sd-${layout}`)?.getAttribute("viewBox")?.split(" ")[2]).toBe(widths[layout]);
      }
    }
  });

  it("wraps the longest payment notes inside every composition, in both voices", () => {
    for (const technical of [false, true]) {
      const { container } = render(<PaymentDiagram technical={technical} world={playFlow(busyPayment)} />);
      expectNotesFit(container);
      cleanup();
    }
  });

  it("keeps event ids and raw states out of the everyday labels, and brings them back for engineers", () => {
    const world = playFlow([{ kind: "webhook", webhook: "success" }, { kind: "webhook", webhook: "again" }]);
    const plain = render(<PaymentDiagram technical={false} world={world} />).container.textContent ?? "";
    expect(plain).not.toMatch(/evt\d|SUCCESS|PENDING|MANUAL_REVIEW/);
    expect(plain).toContain("“paid” again");
    cleanup();
    const technical = render(<PaymentDiagram technical world={world} />).container.textContent ?? "";
    expect(technical).toContain("evt1");
    expect(technical).toContain("SUCCESS");
  });

  it("wraps every service and device note inside every composition", () => {
    for (const technical of [false, true]) {
      for (const run of monitorRuns) {
        for (const length of [1, 3, 12]) {
          const { container } = render(<ServiceDiagram technical={technical} ticks={runUptime(run, length)} window={12} />);
          expectNotesFit(container);
          cleanup();
        }
      }
      // The repo's three test phones, every check alone, and every check at once, with and without a screen lock.
      const phones = [
        ...Object.values(deviceProfiles),
        ...deviceChecks.map((check) => [check.id]),
        deviceChecks.map((check) => check.id),
      ];
      for (const found of phones) {
        for (const lock of ["set", "none"]) {
          const conditions = { ...Object.fromEntries(deviceChecks.map((check) => [check.id, found.includes(check.id) ? "found" : "clear"])), [SCREEN_LOCK]: lock };
          const { container } = render(<DeviceDiagram requestKey="a" run={assessDevice(conditions)} technical={technical} />);
          expectNotesFit(container);
          cleanup();
        }
      }
    }
  });

  it("keeps the arrow at the end of a broken device note", () => {
    const { container } = render(<DeviceDiagram requestKey="a" run={assessDevice(scenarios[2].defaults)} technical={false} />);
    const lines = Array.from(container.querySelectorAll(".sd-compact .sd-note > tspan")).map((line) => line.textContent);
    expect(lines).toEqual(["3 points →", "screen lock signs it"]);
    expect(container.querySelector(".sd-wide .sd-note")?.textContent).toBe("3 points → screen lock signs it");
  });

  it("lights only the found checks, fills one track cell per point, and lands the level and the answer", () => {
    const { container } = render(<DeviceDiagram requestKey="a" run={assessDevice(scenarios[2].defaults)} technical={false} />);
    const wide = container.querySelector(".sd-wide")!;
    expect(wide.querySelectorAll(".sd-check")).toHaveLength(8);
    expect(Array.from(wide.querySelectorAll(".sd-check[data-found] text:first-of-type")).map((text) => text.textContent)).toEqual(["+2 test build", "+1 unknown installer"]);
    expect(wide.querySelectorAll(".sd-cell[data-tone]")).toHaveLength(3);
    expect(Array.from(wide.querySelectorAll(".sd-decision text")).map((text) => text.textContent)).toEqual(["medium risk · 3 points", "confirm first"]);
  });
});
