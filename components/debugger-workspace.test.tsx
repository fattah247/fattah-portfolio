import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scenarios } from "../lib/scenarios";
import { caseSections, DebuggerWorkspace } from "./debugger-workspace";
import { WorkspaceManagerProvider } from "./workspace-manager";

function installBrowserStubs() {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 960 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: query.includes("prefers-reduced-motion") ? false : false,
      media: query,
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
}

function ScenarioRoundTripHost() {
  const [slug, setSlug] = useState(scenarios[0].slug);
  const scenario = scenarios.find((item) => item.slug === slug) ?? scenarios[0];
  return (
    <WorkspaceManagerProvider>
      <DebuggerWorkspace
        scenario={scenario}
        initialConditions={scenario.defaults}
        onClose={vi.fn()}
        onSelectScenario={setSlug}
      />
    </WorkspaceManagerProvider>
  );
}

describe("DebuggerWorkspace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installBrowserStubs();
    window.history.replaceState(null, "", "/case/payflow");
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("exposes the complete chapter sequence and preserves smooth in-window navigation", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );

    const chapterNav = screen.getByRole("navigation", { name: "Case chapters" });
    for (const section of caseSections) {
      expect(chapterNav.querySelector(`a[href="#${section.id}"]`)).toBeTruthy();
    }

    fireEvent.click(chapterNav.querySelector('a[href="#replay"]')!);
    expect(window.location.hash).toBe("#replay");
  });

  it("preserves a direct chapter URL while the project workspace settles", () => {
    window.history.replaceState(null, "", "/case/payflow#evidence");

    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );

    act(() => vi.advanceTimersByTime(1_200));

    expect(window.location.hash).toBe("#evidence");
    expect(screen.getByRole("navigation", { name: "Case chapters" }).querySelector('a[href="#evidence"]')?.getAttribute("aria-current")).toBe("step");
  });

  it.each([
    ["one delivery", { delivery: "once", settlement: "matched", persistence: "available" }, ["evt-01"], ["Payment completed", "Payment completed"]],
    ["a duplicate delivery", { delivery: "duplicate", settlement: "matched", persistence: "available" }, ["evt-01", "evt-01"], ["Payment updated again", "Payment stayed completed"]],
    ["out-of-order delivery", { delivery: "out-of-order", settlement: "matched", persistence: "available" }, ["evt-02", "evt-01"], ["Manual review needed", "Payment stayed completed"]],
    ["mismatched settlement", { delivery: "duplicate", settlement: "mismatched", persistence: "available" }, ["evt-01", "evt-01"], ["Manual review needed", "Manual review needed"]],
  ] as const)("keeps the payment instrument and the result consistent for %s", (_name, initialConditions, expectedEvents, expectedOutcomes) => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={initialConditions} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );

    const events = () => Array.from(document.querySelectorAll(".pay-step-event code")).map((item) => item.textContent);
    expect(events()).toEqual(expectedEvents);
    expect(document.querySelector(".inspector-outcome strong")?.textContent).toBe(expectedOutcomes[1]);
    expect(document.querySelector(".inspector-compare b")?.textContent).toBe(expectedOutcomes[0]);
    // The Result chapter reports the story's own conditions, whatever the simulator is set to.
    expect(Array.from(document.querySelectorAll(".mobile-outcome-strip strong")).map((item) => item.textContent)).toEqual(["Payment updated again", "Payment stayed completed"]);

    // The same deliveries, handled without the check, reach the baseline outcome.
    fireEvent.click(screen.getByRole("button", { name: scenarios[0].baselineLabel }));
    expect(events()).toEqual(expectedEvents);
    expect(document.querySelector(".inspector-outcome strong")?.textContent).toBe(expectedOutcomes[0]);
  });

  it("runs and steps the payment sequence, and a condition change shows the new result in full", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const shown = () => document.querySelectorAll(".pay-step[data-shown]").length;
    const status = () => document.querySelector(".pay-run-status")?.getAttribute("data-state");
    const total = document.querySelectorAll(".pay-step").length;
    expect(shown()).toBe(total);
    expect(status()).toBe("completed");
    // Payment state is an indicator panel, never a set of controls.
    const states = screen.getByRole("list", { name: "Payment state" });
    expect(states.querySelectorAll("button")).toHaveLength(0);
    expect(states.querySelector("[data-current]")?.getAttribute("data-state")).toBe("paid");

    fireEvent.click(screen.getByRole("button", { name: "Run sequence" }));
    expect(shown()).toBe(0);
    expect(status()).toBe("running");
    expect(screen.getByRole("button", { name: "Step" }).hasAttribute("disabled")).toBe(true);
    act(() => vi.advanceTimersByTime(700));
    expect(shown()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(status()).toBe("paused");
    act(() => vi.advanceTimersByTime(2_000));
    expect(shown()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    expect(shown()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    // Each step schedules the next after it renders.
    for (let step = 0; step < total; step += 1) act(() => vi.advanceTimersByTime(700));
    expect(shown()).toBe(total);
    expect(status()).toBe("completed");
    expect(screen.getByRole("button", { name: "Run sequence" })).toBeTruthy();

    // Rewind returns the run to Ready; Step then advances from the start.
    fireEvent.click(screen.getByRole("button", { name: "Rewind" }));
    expect(shown()).toBe(0);
    expect(status()).toBe("ready");
    expect(screen.getByRole("button", { name: "Rewind" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    expect(shown()).toBe(1);
    expect(status()).toBe("paused");

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    act(() => vi.advanceTimersByTime(700));
    fireEvent.click(screen.getByRole("button", { name: "One delivery" }));
    // While the new conditions settle, the run controls are disabled.
    expect(document.querySelector(".instrument-run")?.hasAttribute("disabled")).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("button", { name: "Run sequence" }).hasAttribute("disabled")).toBe(false);
    expect(shown()).toBe(document.querySelectorAll(".pay-step").length);
    expect(screen.getByRole("status").textContent).toMatch(/Callback delivery changed\. Result: Payment completed\./);
  });

  it("replays a condition, opens and closes evidence, and switches projects", () => {
    const onSelectScenario = vi.fn();
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace
          scenario={scenarios[0]}
          initialConditions={scenarios[0].defaults}
          onClose={vi.fn()}
          onSelectScenario={onSelectScenario}
        />
      </WorkspaceManagerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "One delivery" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("status").textContent).toMatch(/Result:/);

    const evidenceButton = screen.getAllByText("Open evidence")[0].closest("button");
    expect(evidenceButton).toBeTruthy();
    fireEvent.click(evidenceButton!);
    const evidenceDialog = screen.getByRole("dialog", { name: /Exhibit 01\.1/i });
    expect(evidenceDialog.getAttribute("data-window-state")).toBe("active");
    expect(screen.queryByRole("button", { name: "Close evidence" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close attached evidence" }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("dialog", { name: /Exhibit 01\.1/i })).toBeNull();
    expect(document.activeElement).toBe(evidenceButton);
    expect(document.querySelector(".selected-work-window")?.getAttribute("data-window-state")).toBe("active");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onSelectScenario).toHaveBeenCalledWith("iyup");
  });

  it("folds secondary conditions and per-part state behind labelled toggles that report changes", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[1]} initialConditions={{ ...scenarios[1].defaults, scrape: "missing" }} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );

    // A changed secondary condition starts unfolded and is counted, so it is never hidden silently.
    const more = screen.getByRole("button", { name: /More conditions · 1 changed/ });
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(more.getAttribute("aria-controls")!)?.contains(screen.getByRole("button", { name: "Missing" }))).toBe(true);
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("false");

    const state = screen.getByRole("button", { name: "State of each part" });
    expect(state.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(state);
    expect(state.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(state.getAttribute("aria-controls")!)?.querySelectorAll(".inspector-state li")).toHaveLength(5);
    expect(screen.getByRole("group", { name: "Approach" })).toBeTruthy();
  });

  it("explains the result for the chosen approach and names what the other approach would do", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[1]} initialConditions={scenarios[1].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );

    const inspector = screen.getByRole("complementary", { name: "Result and state" });
    expect(inspector.querySelector(".inspector-outcome strong")?.textContent).toBe("Degradation visible before outage");
    expect(inspector.querySelector(".inspector-compare")?.textContent).toBe(`${scenarios[1].baselineLabel}: Health check misses degradation`);
    expect(inspector.querySelectorAll(".inspector-state li")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Missing" }));
    act(() => vi.advanceTimersByTime(500));
    expect(inspector.querySelector(".inspector-outcome strong")?.textContent).toBe("Telemetry collection needs investigation");
    expect(Array.from(document.querySelectorAll('.sig-row[data-row="latency"] .sig-cell')).map((cell) => cell.textContent)).toEqual(["190 ms", "260 ms", "No sample", "No sample"]);
    expect(screen.getByRole("status").textContent).toMatch(/Scrape target changed\. Result: Telemetry collection needs investigation\./);

    fireEvent.click(screen.getByRole("button", { name: scenarios[1].baselineLabel }));
    expect(screen.getByRole("button", { name: scenarios[1].baselineLabel }).getAttribute("aria-pressed")).toBe("true");
    expect(Array.from(document.querySelectorAll('.sig-row[data-row="alert"] .sig-cell')).every((cell) => cell.textContent === "Not monitored")).toBe(true);
  });

  it("shows the policy's first matching rule for a device signal", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[2]} initialConditions={scenarios[2].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const rules = () => Array.from(document.querySelectorAll<HTMLElement>(".pv-stage[data-stage=\"policy\"] li")).map((rule) => rule.dataset.status);
    expect(rules()).toEqual(["not met", "not met", "matched", "not reached"]);
    expect(document.querySelector(".pv-stage[data-stage=\"decision\"] strong")?.textContent).toBe("Ask for confirmation");

    fireEvent.click(screen.getByRole("button", { name: "Invalid" }));
    act(() => vi.advanceTimersByTime(500));
    expect(rules()).toEqual(["matched", "not reached", "not reached", "not reached"]);
    expect(document.querySelector(".pv-stage[data-stage=\"decision\"] strong")?.textContent).toBe("Block action");
  });

  it("lets evidence switch between fit and actual pixels once the image has loaded", async () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );

    fireEvent.click(screen.getAllByText("Open evidence")[0].closest("button")!);
    const zoom = screen.getByRole("button", { name: "Actual size" }) as HTMLButtonElement;
    expect(zoom.disabled).toBe(true);

    const image = document.querySelector<HTMLImageElement>(".evidence-image")!;
    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 1600 });
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: 900 });
    // next/image reports load after its decode promise settles.
    await act(async () => {
      fireEvent.load(image);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(zoom.disabled).toBe(false);
    fireEvent.click(zoom);
    expect(zoom.getAttribute("aria-pressed")).toBe("true");
    expect(zoom.textContent).toBe("Fit to screen");
    expect(document.querySelector(".evidence-stage")?.hasAttribute("data-zoomed")).toBe(true);
    expect(document.querySelector<HTMLElement>(".evidence-image-wrap")?.style.inlineSize).toBe("1600px");

    fireEvent.click(zoom);
    expect(zoom.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector(".evidence-stage")?.hasAttribute("data-zoomed")).toBe(false);
  });

  it("round-trips non-default controls with their owning scenario only", () => {
    render(<ScenarioRoundTripHost />);

    fireEvent.click(screen.getByRole("button", { name: "Older callback arrives" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "Older callback arrives" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[1].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Getting slower" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[0].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Older callback arrives" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Same callback twice" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("persists reset controls when a case is reopened after switching scenarios", () => {
    render(<ScenarioRoundTripHost />);

    fireEvent.click(screen.getByRole("button", { name: "Older callback arrives" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "Older callback arrives" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Reset conditions" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "Same callback twice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Reset conditions" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("button", { name: "Same callback twice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Older callback arrives" }).getAttribute("aria-pressed")).toBe("false");
  });

  it.each(scenarios)("renders the complete $slug chapter and evidence journey", (scenario) => {
    window.history.replaceState(null, "", `/case/${scenario.slug}`);
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenario} initialConditions={scenario.defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );

    const chapterNav = screen.getByRole("navigation", { name: "Case chapters" });
    for (const section of caseSections) {
      expect(chapterNav.querySelector(`a[href="#${section.id}"]`)).toBeTruthy();
      expect(document.getElementById(section.id)).toBeTruthy();
    }
    expect(caseSections.map((section) => section.label)).toEqual(["Story", "Result", "Try it", "Evidence"]);
    // The document follows the chapter order: a complete account first, then the simulator.
    const placed = caseSections.map((section) => document.getElementById(section.id)!);
    for (let index = 1; index < placed.length; index += 1) {
      expect(placed[index - 1].compareDocumentPosition(placed[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(document.querySelector(".case-position")?.textContent).toBe(`Case ${scenarios.indexOf(scenario) + 1} of ${scenarios.length}`);
    // The story reads in order without eyebrow labels: failure, constraint, situation, decision.
    expect(screen.queryByText("Failure")).toBeNull();
    expect(screen.queryByText("Constraint")).toBeNull();
    expect(screen.getByText("Test the decision")).toBeTruthy();
    const intro = document.querySelector<HTMLElement>(".case-intro")!;
    expect(intro.querySelector("h1")?.textContent).toBe(scenario.title);
    expect(intro.querySelector(".case-consequence")?.textContent).toBe(scenario.consequence);
    expect(intro.querySelector(".case-situation")?.textContent).toBe(scenario.premise);
    expect(intro.querySelector(".case-decision-line")?.textContent).toBe(`Decision${scenario.decision}`);
    // Limits close the result, after the outcome they qualify.
    const result = screen.getByRole("group", { name: "Outcome comparison" });
    expect(result.querySelector(".case-limits")?.textContent).toBe(`Limits${scenario.limitation}`);
    expect(result.querySelector(".case-result-note")?.textContent).toBe(scenario.outcome);
    expect(document.querySelector(".case-index-block")).toBeNull();
    expect(document.querySelector(".case-workspace-chrome")?.textContent).not.toContain(scenario.shortTitle);
    expect(screen.getAllByText(scenario.outcome)).toHaveLength(1);
    expect(screen.getAllByText(scenario.limitation)).toHaveLength(1);
    expect(screen.getAllByText(scenario.technology)).toHaveLength(1);
    expect(document.querySelectorAll(`a[href="${scenario.repo}"]`)).toHaveLength(1);
    expect(screen.getAllByText("Open evidence")).toHaveLength(scenario.evidence.length);
  });

  it.each(scenarios)("opens every $slug exhibit at its original public asset", (scenario) => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenario} initialConditions={scenario.defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );

    for (const [index, exhibit] of scenario.evidence.entries()) {
      fireEvent.click(screen.getAllByText("Open evidence")[index].closest("button")!);
      expect(screen.getByRole("dialog", { name: new RegExp(`Exhibit ${scenario.number}\\.${index + 1}`) })).toBeTruthy();
      expect(screen.getByRole("link", { name: /Open original image/i }).getAttribute("href")).toBe(exhibit.src);
      fireEvent.click(screen.getByRole("button", { name: "Close attached evidence" }));
      act(() => vi.advanceTimersByTime(500));
    }
  });
});
