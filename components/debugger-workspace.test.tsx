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

/** Lets the pay world play on its own until the story ends and the next one is on offer. */
function untilWatched(name: RegExp = /^Watch next:/) {
  for (let turn = 0; turn < 120 && !screen.queryByRole("button", { name }); turn += 1) act(() => vi.advanceTimersByTime(1_000));
  // One act holds every render until it ends, so the last beat's render needs one more.
  act(() => vi.advanceTimersByTime(0));
}

/** Watches the payment world's first story to the end, then the next one, which changes its conditions. */
function watchNext() {
  fireEvent.click(screen.getByRole("button", { name: "Watch it: the cashier taps twice" }));
  untilWatched();
  fireEvent.click(screen.getByRole("button", { name: "Watch next: an old message arrives late" }));
  untilWatched();
}

/** The one line the pay world says now: who says it, the stamp on an answer, and the words. */
function lineNow() {
  const bubble = document.querySelector(".pw-bubble");
  if (!bubble) return document.querySelector(".pw-narration")?.textContent ?? "";
  const stamp = bubble.querySelector(".pw-bubble-stamp")?.textContent;
  return `${bubble.querySelector(".pw-bubble-head b")?.textContent}${stamp ? ` [${stamp}]` : ""}: ${bubble.querySelector(".pw-bubble-text")?.textContent}`;
}

/** Plays the pay world's scene through, pressing Continue at each line that waits; returns those lines. */
function playScene() {
  const said: string[] = [];
  for (let turn = 0; turn < 40 && document.querySelector(".pay-world[data-playing]"); turn += 1) {
    act(() => vi.advanceTimersByTime(1_000));
    const next = screen.queryByRole("button", { name: "Continue" });
    if (next) { said.push(lineNow()); fireEvent.click(next); }
  }
  return said;
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

  /** The pay world: tap someone or choose what happens next, play the scene through, and read the world back. */
  const actorKey = (actor: string) => document.querySelector<HTMLButtonElement>(`.pw-actor[data-actor="${actor}"]`)!;
  const tapActor = (actor: string) => { fireEvent.click(actorKey(actor)); return playScene(); };
  const choose = (label: string) => {
    fireEvent.click(within(screen.getByRole("group", { name: "What happens next" })).getByRole("button", { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }));
    return playScene();
  };
  const options = () => Array.from(document.querySelectorAll(".pw-option"), (option) => option.textContent);
  const chip = (name: string) => document.querySelector(`.pw-chip[data-chip="${name}"] b`)?.textContent;
  const textOnScreen = () => document.querySelectorAll(".pw-bubble, .pw-narration").length;

  it.each([
    ["the cashier taps twice", { delivery: "duplicate", amount: "matches", bank: "landed" }, 5, "747,750, settled"],
    ["an old message arrives late", { delivery: "out-of-order", amount: "matches", bank: "landed" }, 4, "747,750, settled"],
    ["the cashier mistypes the amount", { delivery: "once", amount: "differs", bank: "landed" }, 6, "747,750, settled"],
    ["the money never arrives", { delivery: "once", amount: "matches", bank: "missing" }, 3, "never arrived"],
  ] as const)("plays the story of %s through Payflow's rules, one line at a time, with a server with no inbox for comparison", (story, initialConditions, steps, bank) => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={initialConditions} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: `Watch it: ${story}` }));
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    // Watching plays itself: no Continue, every line holds long enough to read, and never two at once.
    const notes = new Set<string>();
    for (let turn = 0; turn < 120 && !screen.queryByRole("button", { name: /^Watch next:/ }); turn += 1) {
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
      expect(textOnScreen()).toBeLessThanOrEqual(1);
      notes.add(document.querySelector(".pw-band-note")?.textContent ?? "");
    }
    act(() => vi.advanceTimersByTime(0));
    expect([...notes].filter((note) => note.startsWith("Watching"))).toEqual(Array.from({ length: steps }, (_, step) => `Watching: step ${step + 1} of ${steps}`));
    expect([chip("charged"), chip("bank")]).toEqual(["750,000, once", bank]);
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
    // A first visit starts with the customer: their bubble invites it, one option waits in the band with the hand on it, and the goal sits at the top.
    expect(Array.from(document.querySelectorAll(".pw-actor[data-can]"), (actor) => actor.getAttribute("data-actor"))).toEqual(["customer"]);
    expect(lineNow()).toBe("Customer: Tap me to pay 750,000.");
    expect(options()).toEqual(["The customer pays by card"]);
    expect(document.querySelector(".pw-option[data-nudged] .pw-option-hand")).toBeTruthy();
    expect(document.querySelector(".pw-goal")?.textContent).toBe("Goal: the customer pays 750,000 once, and it reaches the shop’s bank.");

    // A scene plays one line at a time: the customer walks up and speaks, then the receipt crosses with nothing said.
    fireEvent.click(actorKey("customer"));
    expect(textOnScreen()).toBe(0);
    act(() => vi.advanceTimersByTime(1_200));
    expect(lineNow()).toBe("Customer: Here's my card: 750,000.");
    act(() => vi.advanceTimersByTime(1_500 + 900 + 360 + 900));
    expect([textOnScreen(), document.querySelectorAll(".pw-move").length]).toEqual([0, 1]);
    expect(chip("charged")).toBe("nothing yet");
    expect(playScene()).toEqual(["Payflow [Paid]: Got the receipt. I take the 750,000, once."]);
    expect(chip("charged")).toBe("750,000, once");
    expect(lineNow()).toBe("Cashier: Weak signal… did it go? Tap me to send it again.");

    // However often the cashier taps on a weak signal, the customer pays once; with no inbox they'd pay each time.
    expect(tapActor("cashier")).toEqual(["Payflow [Seen it]: Same receipt. I already have it: no money moves.", "With no inbox, the customer would have paid 1,500,000 IDR by now."]);
    expect(tapActor("cashier")).toEqual(["Payflow [Seen it]: Same receipt. I already have it: no money moves.", "With no inbox, the customer would have paid 2,250,000 IDR by now."]);
    expect(chip("charged")).toBe("750,000, once");
    expect(lineNow()).toBe("The signal is slow today: old messages can turn up late.");
    expect(tapActor("signal")).toEqual(["Payflow [Old news]: That's an old message. It stays paid.", "With no check, the old message would undo “paid”."]);

    // Closing the day sends the money to the bank; the provider's daily report follows on its own.
    expect(tapActor("server")).toEqual(["Payflow [Report agrees]: The card company's report agrees. Now I wait for the bank.", "Trusting the report, it would say “reconciled” already, with no money in the bank."]);
    expect(chip("bank")).toBe("on its way");
    expect(lineNow()).toBe("Did the 747,750 arrive?");
    expect(options()).toEqual(expect.arrayContaining(["The money arrives", "It never arrives", "It arrives with no reference"]));
    expect(choose("The money arrives")).toEqual(["Payflow [Reconciled]: The bank and the report agree. Reconciled!", "Cashier: Settled! 747,750 is in our bank."]);
    expect(chip("bank")).toBe("747,750, settled");

    // What the visitor has met stays after Start over, and a mistake at the till has joined.
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(choose("The cashier types 740,000 by mistake")).toEqual(["Payflow [On hold]: 740,000 for a 750,000 price? I hold it for a person.", "With no check, 740,000 would count as paid in full."]);
    expect(chip("charged")).toBe("nothing: on hold");
    expect(choose("The cashier types the right amount")).toEqual(["Payflow [Try later]: It's on hold: I take nothing until it's checked."]);
    expect(tapActor("operator")).toEqual(["Payflow [Released]: Checked. Now send that receipt again."]);
    tapActor("cashier");
    expect(chip("charged")).toBe("750,000, once");
  });

  it("lets a rule be broken, as the repo's tests do, only with technical details", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={{ delivery: "once", amount: "matches", bank: "landed" }} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    for (const actor of ["customer", "cashier", "signal", "server"]) tapActor(actor);
    expect(choose("It arrives with no reference")[0]).toBe("Payflow [Suspense]: Money with no reference: it waits in suspense.");
    expect(options().some((option) => option?.startsWith("Break"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Technical details" }));
    expect(choose("mutation: match a bank credit by amount when the reference is missing")).toEqual(["Payflow [RULE_REMOVED]: Rule off. Send money with no reference."]);
    expect(choose("credit without EndToEndId")[0]).toBe("Payflow [RULE_BROKEN]: Rule off: a guess landed it. The repo's landing rule catches it.");
    expect(choose("revert mutation: match a bank credit by amount when the reference is missing")).toEqual(["Payflow [RULE_RESTORED]: The rule is back."]);
  });

  it("speaks in everyday words until the visitor asks for technical details", () => {
    render(
      <WorkspaceManagerProvider>
        <DebuggerWorkspace scenario={scenarios[0]} initialConditions={scenarios[0].defaults} onClose={vi.fn()} />
      </WorkspaceManagerProvider>,
    );
    const frame = () => document.querySelector(".pw-frame")?.textContent ?? "";
    const toggle = screen.getByRole("button", { name: "Technical details" });
    const plain = tapActor("customer");

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(plain.join(" ")).toContain("[Paid]");
    expect(`${plain.join(" ")} ${frame()}`).not.toMatch(/evt\d|SUCCESS|APPLIED|\b200\b/);
    expect(document.querySelector(".pw-tape")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(chip("tech")).toBe("SUCCESS · evt1");
    expect(options()).toContain("redeliver evt1");
    expect(tapActor("cashier")[0]).toBe("Payflow [DUPLICATE_IGNORED 200]: Same receipt. I already have it: no money moves.");
    expect(document.querySelector(".pw-tape code")?.textContent).toMatch(/evt1/);
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
    untilWatched();
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
