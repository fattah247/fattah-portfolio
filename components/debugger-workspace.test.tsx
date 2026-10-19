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
    ["the provider sending it twice", { delivery: "duplicate", amount: "matches", bank: "landed" }, { state: "Reconciled", payout: "in the bank", shadow: ["Charged twice", "2"] }],
    ["a late “authorized”", { delivery: "out-of-order", amount: "matches", bank: "landed" }, { state: "Reconciled", payout: "in the bank", shadow: ["Newer news overwritten", "1"] }],
    ["a wrong amount", { delivery: "once", amount: "differs", bank: "landed" }, { state: "Reconciled", payout: "in the bank", shadow: ["Wrong amount taken", "1"] }],
    ["a credit that never arrives", { delivery: "once", amount: "matches", bank: "missing" }, { state: "Paid out", payout: "credit missing", shadow: ["Reconciled with no money in the bank", "1"] }],
  ] as const)("plays the payment story through Payflow's rules, with the comparison beside it, for %s", (_name, initialConditions, expected) => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={initialConditions} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const current = () => screen.getByRole("list", { name: "Payment state" }).querySelector("[data-current]")?.firstChild?.nextSibling?.textContent;
    const count = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
    fireEvent.click(screen.getByRole("button", { name: "Play the example" }));
    expect(screen.getByRole("button", { name: "Playing the example…" }).hasAttribute("disabled")).toBe(true);
    act(() => vi.advanceTimersByTime(8_000));

    expect(current()).toBe(expected.state);
    expect(count("Money captured")).toBe("once");
    expect(count("Payout")).toBe(expected.payout);
    expect(within(document.querySelector<HTMLElement>(".sim-shadow")!).getByText(expected.shadow[0]).nextElementSibling?.textContent).toBe(expected.shadow[1]);
    // The Result chapter reports the story's own conditions: the comparison, then Payflow.
    expect(Array.from(document.querySelectorAll(".mobile-outcome-strip strong")).map((item) => item.textContent)).toEqual(["Charged twice", "Captured once, reconciled at the bank"]);
    // There is no switch that turns Payflow's rules off.
    expect(screen.queryByRole("button", { name: "Off" })).toBeNull();
  });

  it("runs the provider's events through the inbox, holds a wrong amount for a person, and lets a removed rule fail as the repo's tests do", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const current = () => screen.getByRole("list", { name: "Payment state" }).querySelector("[data-current]")?.firstChild?.nextSibling?.textContent;
    const count = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
    const journal = () => document.querySelector(".sim-journal li p")?.textContent ?? "";
    const paid = () => screen.getByRole("button", { name: /^“Paid”the payment/ });
    // Payment state is an indicator panel, never a set of controls.
    expect(screen.getByRole("list", { name: "Payment state" }).querySelectorAll("button")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /The same event again/ }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(paid());
    fireEvent.click(screen.getByRole("button", { name: /The same event again/ }));
    fireEvent.click(screen.getByRole("button", { name: /The same event again/ }));
    expect(current()).toBe("Paid");
    expect([count("Events received"), count("Money captured")]).toEqual(["3", "once"]);
    expect(journal()).toMatch(/already in the inbox/);
    expect(document.querySelector(".sim-journal-contrast")?.textContent).toMatch(/captured again/);
    fireEvent.click(screen.getByRole("button", { name: /^“Paid”, new id/ }));
    expect(journal()).toMatch(/already recorded/);
    expect(within(document.querySelector<HTMLElement>(".sim-shadow")!).getByText("Charged twice").nextElementSibling?.textContent).toBe("3");

    // A wrong amount waits for a person; the corrected event is deferred (409) until release.
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    fireEvent.click(screen.getByRole("button", { name: /^“Paid”, wrong amount/ }));
    expect(current()).toBe("On hold");
    expect(count("Waiting for a person")).toBe("1");
    fireEvent.click(paid());
    expect(document.querySelector(".sim-journal-badge")?.textContent).toMatch(/409/);
    fireEvent.click(screen.getByRole("button", { name: /A person releases it/ }));
    expect(current()).toBe("Waiting");
    fireEvent.click(screen.getByRole("button", { name: /The same event again/ }));
    expect(current()).toBe("Paid");

    // Removing a rule, as the repo's mutation tests do, lets the step through and names what catches it.
    fireEvent.click(screen.getByRole("button", { name: /the day's settlement run/ }));
    fireEvent.click(screen.getByRole("button", { name: "Match a credit by amount alone" }));
    fireEvent.click(screen.getByRole("button", { name: /Credit, no reference/ }));
    expect(journal()).toMatch(/every landed payout carries its reference/);
    expect(count("Rules broken")).toBe("1");
  });

  it("speaks in everyday words until the visitor asks for technical details", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const drawing = () => document.querySelector(".sd-pay .sd-wide")?.textContent ?? "";
    const toggle = screen.getByRole("button", { name: "Technical details" });
    fireEvent.click(screen.getByRole("button", { name: /^“Paid”the payment/ }));

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(drawing()).toContain("“paid”");
    expect(drawing()).toContain("Paid");
    expect(drawing()).not.toMatch(/evt\d|SUCCESS/);
    expect(document.querySelector(".sim-wire")).toBeNull();
    expect(document.querySelector(".sim-journal code")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(drawing()).toContain("evt1");
    expect(drawing()).toContain("SUCCESS");
    expect(document.querySelector(".sim-wire")?.textContent).toMatch(/inbox \[evt1\]/);
    expect(document.querySelector(".sim-journal code")?.textContent).toMatch(/evt1 new/);
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

    fireEvent.click(screen.getByRole("button", { name: "A late “authorized”" }));
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

  it("runs the monitor live with iYup's rules: slow warns after five minutes, one region failing stays up, and a silent agent is unknown", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[1]} initialConditions={scenarios[1].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const headline = () => document.querySelector(".svc-status strong")?.textContent;
    const alerts = () => document.querySelector(".svc-users strong")?.textContent;
    const clock = () => document.querySelector(".svc-clock time")?.textContent;
    // The chart opens on the case's first four checks, 30 seconds apart.
    expect(headline()).toBe("Yup… mostly.");
    expect(clock()).toBe("10:41:30");
    expect(alerts()).toBe("Waiting");
    act(() => vi.advanceTimersByTime(1_000));
    expect(clock()).toBe("10:42:00");
    // TargetSlow fires on the tenth slow check: five minutes.
    act(() => vi.advanceTimersByTime(5_000));
    expect(alerts()).toBe("Warning");
    // There is no old dashboard to switch to.
    expect(screen.queryByRole("button", { name: "Only “is it up?”" })).toBeNull();

    // Failing only in lab-b keeps the page up; the comparison, watching from lab-b alone, pages.
    fireEvent.click(screen.getByRole("button", { name: "Answers 503" }));
    fireEvent.click(screen.getByRole("button", { name: "Only lab-b" }));
    act(() => vi.advanceTimersByTime(500));
    act(() => vi.advanceTimersByTime(1_000));
    expect(headline()).toBe("Yup.");
    expect(document.querySelector(".sim-shadow-now")?.textContent).toMatch(/pages/);

    // lab-b's agent goes quiet: its slot is hatched, and the verdict comes from lab-a.
    fireEvent.click(screen.getByRole("button", { name: "Stopped" }));
    act(() => vi.advanceTimersByTime(500));
    act(() => vi.advanceTimersByTime(1_000));
    expect(document.querySelectorAll(".svc-gap").length).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toMatch(/lab-b's agent changed\. Result:/);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const paused = clock();
    act(() => vi.advanceTimersByTime(5_000));
    expect(clock()).toBe(paused);
    fireEvent.click(screen.getByRole("button", { name: "Next check" }));
    expect(clock()).not.toBe(paused);
  });

  it("scores the story's phone as the repo does, with no old-rules toggle, and returns to the story on request", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[2]} initialConditions={scenarios[2].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const check = (name: RegExp) => within(screen.getByRole("group", { name: /^What the phone/ })).getByRole("button", { name });
    expect(document.querySelector(".pol-decision span")?.textContent).toBe("Payment #1: medium risk, 3 points. The server\u2019s answer");
    expect(document.querySelector(".pol-decision strong")?.textContent).toBe("Confirm with the screen lock");
    expect(screen.queryByRole("group", { name: /^Bank/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

    // A root app is a high-severity check: it blocks on its own.
    fireEvent.click(check(/^Root app installed/));
    act(() => vi.advanceTimersByTime(500));
    expect(document.querySelector(".pol-decision strong")?.textContent).toBe("Blocked");
    expect(document.querySelectorAll(".sim-journal li")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    act(() => vi.advanceTimersByTime(500));
    expect(check(/^Root app installed/).getAttribute("aria-pressed")).toBe("false");
    expect(check(/^Test build of Android/).getAttribute("aria-pressed")).toBe("true");
  });

  it("confirms with a tap without a screen lock, and reaches high risk on points alone", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[2]} initialConditions={scenarios[2].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const check = (name: RegExp) => within(screen.getByRole("group", { name: /^What the phone/ })).getByRole("button", { name });
    fireEvent.click(key("Screen lock", "None"));
    act(() => vi.advanceTimersByTime(500));
    expect(document.querySelector(".pol-decision strong")?.textContent).toBe("Confirm with a tap");

    // Emulator +2, debug build +2, outside the store +1: 5 points, with no high-severity check.
    fireEvent.click(check(/^Test build of Android/));
    fireEvent.click(check(/^Looks like an emulator/));
    fireEvent.click(check(/^App is a debug build/));
    act(() => vi.advanceTimersByTime(500));
    expect(document.querySelector(".pol-decision span")?.textContent).toMatch(/high risk, 5 points/);
    expect(document.querySelector(".pol-decision strong")?.textContent).toBe("Blocked");
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

    fireEvent.click(screen.getByRole("button", { name: "A late “authorized”" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "A late “authorized”" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[1].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Slow (1.2–1.8 s)" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[0].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "A late “authorized”" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "The provider sends it twice" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("persists reset controls when a case is reopened after switching scenarios", () => {
    render(<ScenarioRoundTripHost />);

    fireEvent.click(screen.getByRole("button", { name: "A late “authorized”" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "A late “authorized”" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "The provider sends it twice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("button", { name: "The provider sends it twice" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "A late “authorized”" }).getAttribute("aria-pressed")).toBe("false");
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
