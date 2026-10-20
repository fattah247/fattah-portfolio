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

/** Watches the payment desk's first story to the end, then the next one, which changes its conditions. */
function watchNext() {
  fireEvent.click(screen.getByRole("button", { name: "Watch it: the cashier taps twice" }));
  act(() => vi.advanceTimersByTime(3_200 * 7));
  fireEvent.click(screen.getByRole("button", { name: "Watch next: an old message arrives late" }));
  act(() => vi.advanceTimersByTime(3_200 * 6));
  act(() => vi.advanceTimersByTime(3_500));
  act(() => vi.advanceTimersByTime(900));
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

  /** The pay world: tap someone, choose in the dialogue, and read the world back from what it shows. */
  const settleWorld = () => act(() => vi.advanceTimersByTime(3_500));
  const actorKey = (actor: string) => document.querySelector<HTMLButtonElement>(`.pw-actor[data-actor="${actor}"]`)!;
  const tapActor = (actor: string) => { fireEvent.click(actorKey(actor)); settleWorld(); };
  const choose = (label: string) => { fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })); settleWorld(); };
  const reading = (label: string) => document.querySelector(`[data-label="${label}"] b`)?.textContent;
  const stamp = (place: string) => document.querySelector(`.pw-stamp[data-place="${place}"]`)?.textContent;
  const said = (speaker: string) => document.querySelector(`.pw-say[data-speaker="${speaker}"] span`)?.childNodes[1]?.textContent ?? "";

  it.each([
    ["the cashier taps twice", { delivery: "duplicate", amount: "matches", bank: "landed" }, 5, { server: "Reconciled", nextDoor: "Charged 3 times" }],
    ["an old message arrives late", { delivery: "out-of-order", amount: "matches", bank: "landed" }, 4, { server: "Reconciled", nextDoor: "Old news won" }],
    ["the cashier mistypes the amount", { delivery: "once", amount: "differs", bank: "landed" }, 6, { server: "Reconciled", nextDoor: "Took the short amount" }],
    ["the money never arrives", { delivery: "once", amount: "matches", bank: "missing" }, 3, { server: "Paid out", nextDoor: "Reconciled, no money" }],
  ] as const)("plays the story of %s through Payflow's rules, with a server with no inbox for comparison", (story, initialConditions, steps, expected) => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={initialConditions} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: `Watch it: ${story}` }));
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    // One action every 3.2 s, slow enough to follow the receipt and the money and read what is said.
    act(() => vi.advanceTimersByTime(3_200));
    expect(document.querySelector(".pw-try")?.textContent).toBe(`Watching: step 2 of ${steps}`);
    act(() => vi.advanceTimersByTime(3_200 * steps));
    // One act holds every render until it ends, so the last action's beats run after it.
    act(() => vi.advanceTimersByTime(3_500));

    expect(reading("server")).toBe(expected.server);
    expect(document.querySelector(".pw-next-door")?.textContent).toContain(expected.nextDoor);
    expect(document.querySelector('[data-label="customer"] small')?.textContent).toBe("charged 750,000 IDR, once");
    // The Result chapter reports the story's own conditions: the comparison, then Payflow.
    expect(Array.from(document.querySelectorAll(".mobile-outcome-strip strong")).map((item) => item.textContent)).toEqual(["Charged twice", "Captured once, reconciled at the bank"]);
    // There is no switch that turns Payflow's rules off.
    expect(screen.queryByRole("button", { name: "Off" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Watch next:/ })).toBeTruthy();
  });

  it("introduces one actor at a time, charges the customer once however often the cashier taps, and follows the money to the bank and back", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    // A first visit starts with the customer, a hand beside them, and what to do in the dialogue.
    expect(Array.from(document.querySelectorAll(".pw-actor[data-can]"), (actor) => actor.getAttribute("data-actor"))).toEqual(["customer"]);
    expect(actorKey("customer").querySelector(".pw-point")).toBeTruthy();
    expect(document.querySelector(".pw-try")?.textContent).toBe("Try: Tap the customer: they pay 750,000 IDR by card.");

    fireEvent.click(actorKey("customer"));
    // The stamp waits for the receipt to reach the server.
    expect(stamp("server")).toBeUndefined();
    act(() => vi.advanceTimersByTime(3_500));
    expect([stamp("server"), reading("server")]).toEqual(["Paid", "Paid"]);
    expect(document.querySelector('[data-label="customer"] small')?.textContent).toBe("charged 750,000 IDR, once");
    expect(said("payflow")).toMatch(/take the customer's 750,000 once/);
    tapActor("cashier");
    tapActor("cashier");
    expect([stamp("server"), reading("server")]).toEqual(["Seen it", "Paid"]);
    expect(said("cashier")).toBe("Come on… again!");
    expect(document.querySelector('[data-label="customer"] small')?.textContent).toBe("charged 750,000 IDR, once");
    expect(document.querySelector(".pw-next-door b")?.textContent).toBe("2,250,000 IDR");
    tapActor("signal");
    expect(stamp("server")).toBe("Old news");

    // Closing the day sends the money to the bank; the provider's daily report follows on its own.
    tapActor("server");
    expect([stamp("bank"), stamp("server")]).toEqual(["Paid out", "Report agrees"]);
    expect(screen.getByRole("group", { name: "The bank: what happens?" })).toBeTruthy();
    choose("The money arrives");
    expect([stamp("server"), reading("server"), reading("bank")]).toEqual(["Reconciled", "Reconciled", "747,750 IDR"]);
    expect(said("cashier")).toBe("Settled: 747,750 is in our bank.");

    // What the visitor has met stays after Start over, and a mistake at the till has joined.
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    tapActor("cashier");
    expect([stamp("server"), reading("server"), reading("operator")]).toEqual(["On hold", "On hold", "On hold"]);
    tapActor("cashier");
    choose("The cashier types the right amount");
    expect(stamp("server")).toBe("Try later");
    tapActor("operator");
    expect(said("payflow")).toMatch(/Checked and released/);
    tapActor("cashier");
    expect(reading("server")).toBe("Paid");
  });

  it("lets a rule be broken, as the repo's tests do, only with technical details", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={{ delivery: "once", amount: "matches", bank: "landed" }} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    for (const actor of ["customer", "cashier", "signal", "server"]) tapActor(actor);
    choose("It arrives with no reference");
    expect(stamp("bank")).toBe("Suspense");
    expect(document.querySelector(".pw-tech")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Technical details" }));
    choose("mutation: match a bank credit by amount when the reference is missing");
    choose("credit without EndToEndId");
    expect(stamp("bank")).toBe("RULE_BROKEN");
    expect(said("payflow")).toMatch(/a landing needs its reference/);
    choose("revert mutation: match a bank credit by amount when the reference is missing");
    expect(said("payflow")).toMatch(/The rule is back/);
  });

  it("speaks in everyday words until the visitor asks for technical details", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const scene = () => document.querySelector(".pw-world")?.textContent ?? "";
    const toggle = screen.getByRole("button", { name: "Technical details" });
    tapActor("customer");

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(scene()).toContain("Paid");
    expect(scene()).not.toMatch(/evt\d|SUCCESS|APPLIED|\b200\b/);
    expect(document.querySelector(".pw-tape")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(stamp("server")).toBe("APPLIED 200");
    expect(scene()).toContain("inbox: evt1");
    expect(reading("server")).toBe("SUCCESS");
    expect(document.querySelector(".pw-tape code")?.textContent).toMatch(/evt1 new/);
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

    // Watching the next story sets its conditions, and the workspace reports the result.
    fireEvent.click(screen.getByRole("button", { name: "Watch it: the cashier taps twice" }));
    act(() => vi.advanceTimersByTime(3_200 * 7));
    fireEvent.click(screen.getByRole("button", { name: "Watch next: an old message arrives late" }));
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

    watchNext();
    // The late “authorized” story is now the case's setting, so the next one on offer is the short amount.
    expect(screen.getByRole("button", { name: "Watch next: the cashier mistypes the amount" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[1].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Slow (1.2–1.8 s)" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[0].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Watch it: an old message arrives late/ })).toBeTruthy();
  });

  it("persists reset controls when a case is reopened after switching scenarios", () => {
    render(<ScenarioRoundTripHost />);

    watchNext();
    // The late “authorized” story is now the case's setting, so the next one on offer is the short amount.
    expect(screen.getByRole("button", { name: "Watch next: the cashier mistypes the amount" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: /^Watch it( from the start)?: the cashier taps twice/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));

    expect(screen.getByRole("button", { name: /^Watch it: the cashier taps twice/ })).toBeTruthy();
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
