import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { scenarios } from "../lib/scenarios";
import { CopyEmailButton } from "./copy-email-button";
import { DebuggerWorkspace } from "./debugger-workspace";
import { SoundControl } from "./sound-control";
import { SoundContext, SoundProvider } from "./sound-provider";
import { SystemShell } from "./system-shell";
import { WorkspaceManagerProvider } from "./workspace-manager";

function installBrowserStubs() {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 960 });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({ addEventListener: vi.fn(), matches: false, media: query, removeEventListener: vi.fn() })),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const key = (group: string, option: string) => within(screen.getByRole("group", { name: new RegExp(`^${group.replace(/[?]/g, "\\?")}`) })).getByRole("button", { name: option });

/** Renders with a sound spy: every cue the interface asks for, in order. */
function withSound(ui: ReactNode) {
  const play = vi.fn();
  render(<SoundContext.Provider value={{ level: "quiet", setLevel: vi.fn(), play }}>{ui}</SoundContext.Provider>);
  return { play, cues: () => play.mock.calls.map(([id]) => id) };
}

const caseOf = (index: number) => (
  <WorkspaceManagerProvider>
    <DebuggerWorkspace scenario={scenarios[index]} initialConditions={scenarios[index].defaults} onClose={vi.fn()} />
  </WorkspaceManagerProvider>
);

describe("sound", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installBrowserStubs();
  });
  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    try { window.localStorage.clear(); } catch { /* storage unavailable */ }
  });

  it("offers On, Quiet and Off from one speaker, starting at Quiet, and plays the latch at the chosen level", () => {
    const player = { level: "quiet", setLevel: vi.fn(), unlock: vi.fn(), unlocked: true, play: vi.fn(() => true), prewarm: vi.fn() };
    render(<SoundProvider createPlayer={() => player as never}><SoundControl /><p>Outside</p></SoundProvider>);
    fireEvent.pointerDown(document.body);
    expect(player.unlock).toHaveBeenCalled();

    const speaker = screen.getByRole("button", { name: "Sound: Quiet" });
    fireEvent.click(speaker);
    const levels = within(screen.getByRole("group", { name: "Sound" }));
    expect(levels.getAllByRole("button").map((button) => `${button.textContent}:${button.getAttribute("aria-pressed")}`)).toEqual(["On:false", "Quiet:true", "Off:false"]);

    fireEvent.click(levels.getByRole("button", { name: "On" }));
    expect(player.setLevel).toHaveBeenLastCalledWith("on");
    expect(player.play).toHaveBeenLastCalledWith("pay.check-on", 0);
    expect(screen.getByRole("button", { name: "Sound: On" })).toBeTruthy();
    expect(window.localStorage.getItem("portfolio-sound-level")).toBe("on");

    // Off is silent, and Escape closes the panel before anything else hears it.
    player.play.mockClear();
    fireEvent.click(levels.getByRole("button", { name: "Off" }));
    expect(player.play).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("group", { name: "Sound" }), { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Sound" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sound: Off" }));

    fireEvent.click(screen.getByRole("button", { name: "Sound: Off" }));
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(screen.queryByRole("group", { name: "Sound" })).toBeNull();
  });

  it("lands each receipt's sound as it reaches Payflow, marks the guess, and jolts the missing money", () => {
    const { play, cues } = withSound(caseOf(0));
    expect(cues()).toEqual(["sys.file-open"]);
    const until = (phase: string) => {
      for (let turn = 0; turn < 160 && document.querySelector(".pay-world")?.getAttribute("data-phase") !== phase; turn += 1) act(() => vi.advanceTimersByTime(500));
      act(() => vi.advanceTimersByTime(0));
    };
    const trick = (name: string) => fireEvent.click(within(screen.getByRole("group", { name: "Pick a trick" })).getByRole("button", { name: new RegExp(`^${name}`) }));

    trick("Tap again");
    expect(cues().at(-1)).toBe("pay.start-over");
    until("ask");
    // Receipt #1 takes 1.8 s to cross to the server: its knock lands as it arrives.
    expect(play).toHaveBeenCalledWith("pay.let-in", expect.closeTo(1.8 - 0.12, 3));
    play.mockClear();
    // The two repeats go out 0.45 s apart, and each is turned away as it lands.
    fireEvent.click(screen.getByRole("button", { name: "750,000" }));
    expect(play.mock.calls).toEqual([["pay.stopped", expect.closeTo(1.8 - 0.12, 3)], ["pay.stopped", expect.closeTo(2.25 - 0.12, 3)]]);
    until("result");
    expect(cues().at(-1)).toBe("pay.check-on");

    // Lost money: the money reaches the bank, the report reaches Payflow, and the missing credit lands sour, with a jolt.
    fireEvent.click(screen.getByRole("button", { name: "All tricks" }));
    trick("Lost money");
    until("ask");
    expect(cues().slice(-2)).toEqual(["pay.book-back", "sys.file-open"]);
    fireEvent.click(screen.getByRole("button", { name: "Yes, the report says it was sent" }));
    until("result");
    expect(cues().slice(-2)).toEqual(["pay.book-down", "pay.check-off"]);
    expect(document.querySelector(".pw-bubble")?.getAttribute("data-hit")).toBe("bad");
  });

  it("keeps the live monitor silent, lands stepped checks, and sounds iYup's verdicts and alerts once", () => {
    const { cues } = withSound(caseOf(1));
    act(() => vi.advanceTimersByTime(3_500));
    expect(cues()).toEqual(["sys.file-open"]);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(cues().at(-1)).toBe("ui.key-off");
    fireEvent.click(screen.getByRole("button", { name: "Next check" }));
    expect(cues().at(-1)).toMatch(/^svc\.minute-/);

    fireEvent.click(key("The page", "Answers 503"));
    expect(cues().at(-1)).toBe("ui.key-on");
    act(() => vi.advanceTimersByTime(400));
    fireEvent.click(screen.getByRole("button", { name: "Next check" }));
    expect(cues()).toContain("svc.down");
    expect(document.querySelector(".svc-status")?.hasAttribute("data-jolt")).toBe(true);
    // TargetDown pages after a minute down: the alarm bell, once.
    fireEvent.click(screen.getByRole("button", { name: "Next check" }));
    expect(cues().filter((cue) => cue === "svc.alarm")).toHaveLength(1);
  });

  it("ticks once for each found check, then lands the server's answer, in time with the drawing", () => {
    const { cues } = withSound(caseOf(2));
    expect(cues()).toEqual(["sys.file-open"]);
    fireEvent.click(within(screen.getByRole("group", { name: /^What the phone/ })).getByRole("button", { name: /^Root app installed/ }));
    // The case settles the change first; the walk starts from the new payment: root app, test build, installer.
    for (let waited = 0; waited < 2_000 && !cues().includes("pol.rule-1"); waited += 10) act(() => vi.advanceTimersByTime(10));
    expect(cues().slice(1)).toEqual(["pol.rule-1"]);
    act(() => vi.advanceTimersByTime(270));
    expect(cues().slice(1)).toEqual(["pol.rule-1"]);
    act(() => vi.advanceTimersByTime(20));
    expect(cues().slice(1)).toEqual(["pol.rule-1", "pol.rule-2"]);
    act(() => vi.advanceTimersByTime(280));
    expect(cues().slice(1)).toEqual(["pol.rule-1", "pol.rule-2", "pol.rule-3"]);
    act(() => vi.advanceTimersByTime(540));
    expect(cues().slice(1)).toEqual(["pol.rule-1", "pol.rule-2", "pol.rule-3"]);
    act(() => vi.advanceTimersByTime(20));
    expect(cues().slice(1)).toEqual(["pol.rule-1", "pol.rule-2", "pol.rule-3", "pol.block"]);
  });

  it("hears every way of opening and closing an app the same, from the workspace's own state", () => {
    const { cues } = withSound(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const taskbar = within(screen.getByRole("navigation", { name: "System taskbar" }));
    fireEvent.click(taskbar.getByRole("button", { name: /Open Experience\. Not running/i }));
    expect(cues()).toEqual(["sys.open"]);
    // Opening the overview is navigation, and silent; closing a card there closes the app.
    fireEvent.click(screen.getByRole("button", { name: "Application overview" }));
    expect(cues()).toEqual(["sys.open"]);
    fireEvent.click(screen.getByRole("button", { name: "Close Experience" }));
    expect(cues()).toEqual(["sys.open", "sys.close"]);
  });

  it("chimes when the email is copied", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(() => Promise.resolve()) } });
    const { cues } = withSound(<CopyEmailButton email="someone@example.com" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy email" }));
      await Promise.resolve();
    });
    expect(cues()).toEqual(["ui.copied"]);
  });
});
