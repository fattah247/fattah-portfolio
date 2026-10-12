import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

/** A key inside one control group; several groups share "Yes" and "No". */
const key = (group: string, option: string) => within(screen.getByRole("group", { name: new RegExp(`^${group.replace(/[?]/g, "\\?")}`) })).getByRole("button", { name: option });

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
    ["one delivery", { delivery: "once", settlement: "matched", persistence: "available" }, { designed: ["paid", "0"], baseline: ["paid", "0"] }],
    ["a duplicate delivery", { delivery: "duplicate", settlement: "matched", persistence: "available" }, { designed: ["paid", "0"], baseline: ["paid", "1"] }],
    ["out-of-order delivery", { delivery: "out-of-order", settlement: "matched", persistence: "available" }, { designed: ["paid", "0"], baseline: ["review", "0"] }],
    ["mismatched settlement", { delivery: "duplicate", settlement: "mismatched", persistence: "available" }, { designed: ["review", "0"], baseline: ["review", "1"] }],
  ] as const)("plays the payment story to the case model's end, with and without the check, for %s", (_name, initialConditions, expected) => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={initialConditions} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const state = () => screen.getByRole("list", { name: "Payment state" }).querySelector("[data-current]")?.getAttribute("data-state");
    const repeats = () => screen.getByText("Handled twice").nextElementSibling?.textContent;
    const play = () => {
      fireEvent.click(screen.getByRole("button", { name: "Play the example" }));
      expect(screen.getByRole("button", { name: "Playing the example…" }).hasAttribute("disabled")).toBe(true);
      act(() => vi.advanceTimersByTime(5_000));
    };

    play();
    expect([state(), repeats()]).toEqual(expected.designed);
    // The Result chapter reports the story's own conditions, whatever the simulator is set to.
    expect(Array.from(document.querySelectorAll(".mobile-outcome-strip strong")).map((item) => item.textContent)).toEqual(["Payment updated again", "Payment stayed completed"]);

    // The same story, handled without the check, reaches the baseline outcome.
    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    play();
    expect([state(), repeats()]).toEqual(expected.baseline);
  });

  it("lets the visitor send the bank's messages, stopping repeats at the id check until the check is off", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const state = () => screen.getByRole("list", { name: "Payment state" }).querySelector("[data-current]")?.getAttribute("data-state");
    const count = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
    // Payment state is an indicator panel, never a set of controls.
    expect(screen.getByRole("list", { name: "Payment state" }).querySelectorAll("button")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Bank sends it again/ }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Bank sends “paid”/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bank sends it again/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bank sends it again/ }));
    expect(state()).toBe("paid");
    expect([count("Messages received"), count("Times the payment changed"), count("Handled twice")]).toEqual(["3", "1", "0"]);
    expect(screen.getByRole("list", { name: "Processed IDs" }).querySelectorAll("li")).toHaveLength(1);
    expect(document.querySelector(".sim-journal li p")?.textContent).toMatch(/Already handled/);

    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    fireEvent.click(screen.getByRole("button", { name: /Bank sends it again/ }));
    expect(count("Handled twice")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: /Late “pending” update/ }));
    expect(state()).toBe("review");

    // Audit records wait while the record book is unavailable and are all written when it returns.
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(state()).toBe("pending");
    fireEvent.click(screen.getByRole("button", { name: "Unavailable" }));
    fireEvent.click(screen.getByRole("button", { name: /Bank sends “paid”/ }));
    expect(screen.getByRole("list", { name: "Audit records" }).textContent).toMatch(/pending/);
    fireEvent.click(screen.getByRole("button", { name: "Available" }));
    expect(screen.getByRole("list", { name: "Audit records" }).textContent).not.toMatch(/pending/);
  });

  it("speaks in everyday words until the visitor asks for technical details", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const drawing = () => document.querySelector(".sd-pay .sd-wide")?.textContent ?? "";
    const toggle = screen.getByRole("button", { name: "Technical details" });
    fireEvent.click(screen.getByRole("button", { name: /Bank sends “paid”/ }));

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(drawing()).toContain("“paid”");
    expect(drawing()).toContain("Paid");
    expect(drawing()).not.toMatch(/evt-|PAID/);
    expect(document.querySelector(".sim-wire")).toBeNull();
    expect(document.querySelector(".sim-journal code")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(drawing()).toContain("evt-02");
    expect(drawing()).toContain("PAID");
    expect(document.querySelector(".sim-wire")?.textContent).toMatch(/processed IDs \[evt-02\]/);
    expect(document.querySelector(".sim-journal code")?.textContent).toMatch(/evt-02 new/);
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

    fireEvent.click(screen.getByRole("button", { name: "The bank sends it once" }));
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

  it("runs the service live: it pages past the line, goes blind without metrics, and the health-only dashboard stays green", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[1]} initialConditions={scenarios[1].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const status = () => document.querySelector(".svc-status strong")?.textContent;
    const clock = () => document.querySelector(".svc-clock time")?.textContent;
    // The chart opens on the case's own four minutes: by 10:43 the slowing service pages on-call.
    expect(status()).toBe("Alarm: engineers alerted");
    expect(clock()).toBe("10:43");
    act(() => vi.advanceTimersByTime(1_100));
    expect(clock()).toBe("10:44");

    fireEvent.click(screen.getByRole("button", { name: "Stopped" }));
    // Let the lever settle and render, then let a minute pass.
    act(() => vi.advanceTimersByTime(500));
    act(() => vi.advanceTimersByTime(1_100));
    expect(status()).toBe("Can't tell: measurements stopped");
    expect(document.querySelectorAll(".svc-gap").length).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toMatch(/Scrape target changed\. Result: Telemetry collection needs investigation\./);

    fireEvent.click(screen.getByRole("button", { name: "Only “is it up?”" }));
    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(1_100));
    expect(status()).toBe("Looks fine");
    // Visitors still wait over half a second; the dashboard just doesn't measure it.
    expect(Number.parseFloat(document.querySelector(".svc-users strong")?.textContent ?? "0")).toBeGreaterThan(.5);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const paused = clock();
    act(() => vi.advanceTimersByTime(5_000));
    expect(clock()).toBe(paused);
    fireEvent.click(screen.getByRole("button", { name: "Next minute" }));
    expect(clock()).not.toBe(paused);
  });

  it("names what the other policy would decide, and returns to the story on request", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[2]} initialConditions={scenarios[2].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    expect(document.querySelector(".sim-compare")?.textContent).toBe("With the old rules (block anything odd): Block (different)");
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

    fireEvent.click(key("Phone's security removed?", "No"));
    act(() => vi.advanceTimersByTime(500));
    expect(document.querySelector(".sim-compare")?.textContent).toBe("With the old rules (block anything odd): Let through (the same)");
    expect(document.querySelectorAll(".sim-journal li")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    act(() => vi.advanceTimersByTime(500));
    expect(key("Phone's security removed?", "Maybe").getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the policy's first matching rule for a device signal", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[2]} initialConditions={scenarios[2].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const rules = () => Array.from(document.querySelectorAll<HTMLElement>(".pol-rules li")).map((rule) => rule.dataset.status);
    expect(rules()).toEqual(["not met", "not met", "matched", "not reached"]);
    expect(document.querySelector(".pol-decision strong")?.textContent).toBe("Ask to confirm");

    fireEvent.click(key("Request tampered with?", "Yes"));
    act(() => vi.advanceTimersByTime(500));
    expect(rules()).toEqual(["matched", "not reached", "not reached", "not reached"]);
    expect(document.querySelector(".pol-decision strong")?.textContent).toBe("Block");
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

    fireEvent.click(screen.getByRole("button", { name: "An old message arrives late" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "An old message arrives late" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[1].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Getting slower" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[0].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "An old message arrives late" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "The bank sends it twice" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("persists reset controls when a case is reopened after switching scenarios", () => {
    render(<ScenarioRoundTripHost />);

    fireEvent.click(screen.getByRole("button", { name: "An old message arrives late" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "An old message arrives late" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "The bank sends it twice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("button", { name: "The bank sends it twice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "An old message arrives late" }).getAttribute("aria-pressed")).toBe("false");
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
