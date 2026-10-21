import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REPO_AT, roundEnd, rounds } from "../lib/pay-rounds";
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

/** Lets the pay world play until it reaches a phase: the question ("ask") or the "result". */
function untilPhase(phase: string) {
  for (let turn = 0; turn < 160 && document.querySelector(".pay-world")?.getAttribute("data-phase") !== phase; turn += 1) act(() => vi.advanceTimersByTime(500));
  // One act holds every render until it ends, so the last beat's render needs one more.
  act(() => vi.advanceTimersByTime(0));
}

/** Picks a trick in the pay world, answers its question, and plays on to the result. */
function playTrick(trick: string, answer: string) {
  fireEvent.click(within(screen.getByRole("group", { name: "Pick a trick" })).getByRole("button", { name: new RegExp(`^${trick}`) }));
  untilPhase("ask");
  fireEvent.click(screen.getByRole("button", { name: answer }));
  untilPhase("result");
}

/** The one line the pay world says now: who says it, the stamp on Payflow's answer, and the words. */
function lineNow() {
  const bubble = document.querySelector(".pw-bubble");
  if (!bubble) return document.querySelector(".pw-narration")?.textContent ?? "";
  const stamp = bubble.querySelector(".pw-bubble-stamp")?.textContent;
  return `${bubble.querySelector(".pw-bubble-head b")?.textContent}${stamp ? ` [${stamp}]` : ""}: ${bubble.querySelector(".pw-bubble-text")?.textContent}`;
}

const text = (selector: string) => document.querySelector(selector)?.textContent;
const suggestedTrick = () => text(".pw-trick[data-suggested] b");

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

  /** The pay world: pick a trick, answer its question, and read the result back. */
  const notebookLines = () => Array.from(document.querySelectorAll(".pw-note"), (note) => note.textContent);
  const textOnScreen = () => document.querySelectorAll(".pw-bubble, .pw-narration").length;
  const result = () => ({ verdict: text(".pw-verdict"), basic: text('.pw-compare-side[data-side="basic"] b'), payflow: text('.pw-compare-side[data-side="payflow"] b') });
  const renderPayflow = (initialConditions: Record<string, string> = scenarios[0].defaults) => render(
    <WorkspaceManagerProvider>
      <DebuggerWorkspace scenario={scenarios[0]} initialConditions={initialConditions} onClose={vi.fn()} />
    </WorkspaceManagerProvider>,
  );

  it("offers four tricks, sets the scene one line at a time, asks, then shows Payflow next to a basic system", () => {
    renderPayflow();
    expect(Array.from(document.querySelectorAll(".pw-trick b"), (name) => name.textContent)).toEqual(["Tap again", "Old message", "Wrong amount", "Lost money"]);
    expect(suggestedTrick()).toBe("Tap again");
    expect(document.querySelector(".pw-trick[data-suggested] .pw-option-hand")).toBeTruthy();
    expect(text(".pw-goal")).toBe("Try to break the payment. Make the customer pay the wrong amount, or lose the shop’s money.");
    expect(notebookLines()).toEqual(["empty"]);

    // The scene plays one line at a time, each held long enough to read, and Payflow writes receipt #1 down.
    fireEvent.click(within(screen.getByRole("group", { name: "Pick a trick" })).getByRole("button", { name: /^Tap again/ }));
    const heard: string[] = [];
    for (let turn = 0; turn < 120 && document.querySelector(".pay-world")?.getAttribute("data-phase") !== "ask"; turn += 1) {
      act(() => vi.advanceTimersByTime(250));
      expect(textOnScreen()).toBeLessThanOrEqual(1);
      const now = lineNow();
      if (now && heard.at(-1) !== now) heard.push(now);
    }
    act(() => vi.advanceTimersByTime(0));
    expect(heard).toEqual(["Customer: Here's my card: 750,000.", "Payflow [New]: New receipt #1. I note it and take the 750,000.", "The signal is weak. The cashier can't see if it went through.", "Cashier: Did it go? I'll tap again. And again!"]);
    expect(notebookLines()).toEqual(["#1 paid"]);
    expect(textOnScreen()).toBe(0);
    expect(text(".pw-question")).toBe("The same receipt goes out 2 more times. How much will the customer pay?");
    expect(Array.from(document.querySelectorAll(".pw-choice"), (choice) => choice.textContent)).toEqual(["750,000", "1,500,000", "2,250,000"]);

    fireEvent.click(screen.getByRole("button", { name: "1,500,000" }));
    untilPhase("result");
    expect(lineNow()).toBe("Payflow [Already noted]: #1 is already in my notebook. No money moves.");
    expect(result()).toEqual({ verdict: "Not quite: it's “750,000”.", basic: "2,250,000", payflow: "750,000" });
    expect(text('.pw-chip[data-chip="charged"] b')).toBe("750,000");
    expect(screen.getByRole("button", { name: /^Next trick: old message/ })).toBeTruthy();

    // How Payflow decided: the repo's lines that decided it, its answer, and the test that holds it, linked at one commit.
    expect(screen.queryByRole("region", { name: "How Payflow decided" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "How Payflow decided" }));
    const proof = within(screen.getByRole("region", { name: "How Payflow decided" }));
    expect(proof.getByRole("link", { name: /^ProviderWebhookService\.java:93–98/ }).getAttribute("href")).toBe(`${REPO_AT}/src/main/java/id/fatarc/portfolio/payflowreliability/payment/ProviderWebhookService.java#L93-L98`);
    expect(proof.getByText("shouldIgnoreAnExactRedeliveryWithoutOpeningAReviewCaseOrPostingTwice")).toBeTruthy();
    expect(proof.getByText(/^evt1: 200 APPLIED/)).toBeTruthy();
  });

  it.each(rounds.map((round) => [round.trick, round] as const))("says Right! when the guess for “%s” matches what Payflow does", (trick, round) => {
    renderPayflow();
    const end = roundEnd(round);
    playTrick(trick, round.choices.find((choice) => choice.id === round.answer(end))!.label);
    const { basic, payflow } = round.compare(end);
    expect(result()).toEqual({ verdict: "Right!", basic, payflow });
    // The trick's conditions become the case's, so the Result chapter and the address follow it.
    expect(Object.entries(round.conditions).every(([key, value]) => new URLSearchParams(window.location.search).get(key) === value || scenarios[0].defaults[key as keyof typeof scenarios[0]["defaults"]] === value)).toBe(true);
  });

  it("speaks in everyday words until the visitor asks for technical details", () => {
    renderPayflow();
    const toggle = screen.getByRole("button", { name: "Technical details" });
    playTrick("Tap again", "750,000");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(text(".pw-frame")).not.toMatch(/evt\d|SUCCESS|APPLIED|DUPLICATE|\b200\b|inbox/);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect([text(".pw-notebook-title"), ...notebookLines()]).toEqual(["provider_events", "evt1 SUCCESS 750000"]);
    expect(text(".pw-bubble-stamp")).toBe("200 DUPLICATE_IGNORED");
    // With technical details, the proof is open from the start.
    expect(screen.getByRole("region", { name: "How Payflow decided" })).toBeTruthy();
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

    // Picking a trick sets its conditions, and the workspace reports the result.
    fireEvent.click(within(screen.getByRole("group", { name: "Pick a trick" })).getByRole("button", { name: /^Old message/ }));
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

    playTrick("Old message", "Paid");
    // The late “authorized” trick is now the case's setting, so the next one on offer is the wrong amount.
    expect(screen.getByRole("button", { name: /^Next trick: wrong amount/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[1].title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Slow (1.2–1.8 s)" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByRole("heading", { name: scenarios[0].title })).toBeTruthy();
    expect(suggestedTrick()).toBe("Old message");
  });

  it("persists reset controls when a case is reopened after switching scenarios", () => {
    render(<ScenarioRoundTripHost />);

    playTrick("Old message", "Paid");
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();

    // Reset returns the case to its story, and the tricks are offered again from the first.
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    act(() => vi.advanceTimersByTime(900));
    expect(suggestedTrick()).toBe("Tap again");
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next: Detect degradation" }));
    act(() => vi.advanceTimersByTime(0));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => vi.advanceTimersByTime(0));

    expect(suggestedTrick()).toBe("Tap again");
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
