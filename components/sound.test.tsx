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

  it("plays the payment's own outcomes, timed to the message landing, and marks the knock and the jolt", () => {
    const { play, cues } = withSound(caseOf(0));
    expect(cues()).toEqual(["sys.file-open"]);
    const state = () => document.querySelector(".sd-pay .sd-wide .sd-state")?.getAttribute("data-hit");

    fireEvent.click(screen.getByRole("button", { name: /Bank sends “paid”/ }));
    expect(play).toHaveBeenLastCalledWith("pay.let-in", expect.closeTo(0.32, 3));
    expect(state()).toBe("land");
    fireEvent.click(screen.getByRole("button", { name: /Bank sends it again/ }));
    expect(play).toHaveBeenLastCalledWith("pay.stopped", expect.closeTo(0.32, 3));

    fireEvent.click(key("Repeat check", "Off"));
    expect(cues().at(-1)).toBe("pay.check-off");
    fireEvent.click(screen.getByRole("button", { name: /Bank sends it again/ }));
    expect(cues().at(-1)).toBe("pay.twice");
    expect(state()).toBe("bad");
    fireEvent.click(screen.getByRole("button", { name: /Late “pending” update/ }));
    expect(cues().at(-1)).toBe("pay.overwritten");
    fireEvent.click(screen.getByRole("button", { name: /Doesn’t match/ }));
    expect(play).toHaveBeenLastCalledWith("pay.report-differs", 0);
    fireEvent.click(key("Record book", "Unavailable"));
    expect(cues().at(-1)).toBe("pay.book-down");
    fireEvent.click(key("Record book", "Available"));
    expect(cues().at(-1)).toBe("pay.book-back");
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(cues().at(-1)).toBe("pay.start-over");
    fireEvent.click(screen.getByRole("button", { name: "Technical details" }));
    expect(cues().at(-1)).toBe("ui.key-on");
  });

  it("keeps the live monitor silent, lands stepped minutes, and sounds a change of status once", () => {
    const { cues } = withSound(caseOf(1));
    act(() => vi.advanceTimersByTime(3_500));
    expect(cues()).toEqual(["sys.file-open"]);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(cues().at(-1)).toBe("ui.key-off");
    fireEvent.click(screen.getByRole("button", { name: "Next minute" }));
    expect(cues().at(-1)).toMatch(/^svc\.minute-/);

    fireEvent.click(key("Does the site answer?", "No"));
    expect(cues().at(-1)).toBe("ui.key-on");
    act(() => vi.advanceTimersByTime(400));
    fireEvent.click(screen.getByRole("button", { name: "Next minute" }));
    expect(cues()).toContain("svc.down");
    expect(document.querySelector(".svc-status")?.hasAttribute("data-jolt")).toBe(true);
  });

  it("reads the checkpoint's rules in order, then lands the answer, in time with the drawing", () => {
    const { cues } = withSound(caseOf(2));
    expect(cues()).toEqual(["sys.file-open"]);
    fireEvent.click(key("Request tampered with?", "Yes"));
    // The case settles the change first; the walk starts from the new request.
    for (let waited = 0; waited < 2_000 && !cues().includes("pol.rule-1"); waited += 10) act(() => vi.advanceTimersByTime(10));
    expect(cues().slice(1)).toEqual(["pol.rule-1"]);
    act(() => vi.advanceTimersByTime(270));
    expect(cues().slice(1)).toEqual(["pol.rule-1"]);
    act(() => vi.advanceTimersByTime(20));
    expect(cues().slice(1)).toEqual(["pol.rule-1", "pol.block"]);
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
