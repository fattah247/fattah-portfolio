import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { assessDevice, deviceChecks, deviceProfiles, SCREEN_LOCK } from "../lib/device-risk";
import { scenarios } from "../lib/scenarios";
import { lateMessage, liveSample, paidMessage, playPayment, type PayInput } from "../lib/simulators";
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

const busyPayment: PayInput[] = [
  { kind: "store", online: false },
  ...Array.from({ length: 15 }, () => ({ kind: "deliver" as const, message: paidMessage })),
  { kind: "deliver", message: lateMessage },
  { kind: "settle", matched: false },
];

describe("simulator drawings", () => {
  it("draws every case in three compositions, each at its own width", () => {
    const world = playPayment(busyPayment, false);
    const conditions = scenarios[2].defaults;
    const samples = [0, 1, 2, 3].map((minute) => ({ ...liveSample(scenarios[1].defaults, "designed", minute, minute), mode: "designed" as const }));
    const { container } = render(<>
      <PaymentDiagram checked={false} technical={false} world={world} />
      <ServiceDiagram samples={samples} statusTitle="Paging on-call" technical={false} window={12} />
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
      for (const checked of [false, true]) {
        const { container } = render(<PaymentDiagram checked={checked} technical={technical} world={playPayment(busyPayment, checked)} />);
        expectNotesFit(container);
        cleanup();
      }
    }
  });

  it("keeps message IDs and raw states out of the everyday labels, and brings them back for engineers", () => {
    const world = playPayment([{ kind: "deliver", message: paidMessage }, { kind: "deliver", message: paidMessage }], true);
    const plain = render(<PaymentDiagram checked technical={false} world={world} />).container.textContent ?? "";
    expect(plain).not.toMatch(/evt-|PAID|PENDING|REVIEW/);
    expect(plain).toContain("“paid” again");
    cleanup();
    const technical = render(<PaymentDiagram checked technical world={world} />).container.textContent ?? "";
    expect(technical).toContain("evt-02");
    expect(technical).toContain("PAID");
  });

  it("wraps every service and device note inside every composition", () => {
    const titles = ["Outage", "Looks fine", "Paging on-call", "Investigate collection", "Breach, nobody paged", "All quiet"];
    for (const technical of [false, true]) {
      for (const title of titles) {
        const samples = [0, 1, 2, 3, 4, 5].map((minute) => ({ ...liveSample({ ...scenarios[1].defaults, latency: "severe" }, "baseline", minute, minute), mode: "baseline" as const }));
        const { container } = render(<ServiceDiagram samples={samples} statusTitle={title} technical={technical} window={12} />);
        expectNotesFit(container);
        cleanup();
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
