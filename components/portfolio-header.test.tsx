import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CounterfactualHome } from "./counterfactual-home";
import { PortfolioHeader } from "./portfolio-header";
import { WorkspaceManagerProvider } from "./workspace-manager";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("PortfolioHeader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({ addEventListener: vi.fn(), matches: query.includes("hover: hover") || query.includes("pointer: fine"), media: query, removeEventListener: vi.fn() })),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("names Contact in the address and title when the taskbar brings it forward, as every other app is named", () => {
    render(<WorkspaceManagerProvider><PortfolioHeader /><CounterfactualHome /></WorkspaceManagerProvider>);
    act(() => vi.advanceTimersByTime(20));
    const taskbar = within(screen.getByRole("navigation", { name: "System taskbar" }));

    fireEvent.click(taskbar.getByRole("button", { name: /Open Projects\. Not running/i }));
    expect(`${window.location.pathname}${window.location.hash}`).toBe("/#selected-work");

    fireEvent.click(taskbar.getByRole("button", { name: /Open Contact\. Not running/i }));
    // Frames pass: the focus Projects asked for must not pull it back in front of Contact.
    act(() => vi.advanceTimersByTime(100));
    expect(`${window.location.pathname}${window.location.hash}`).toBe("/#contact");
    expect(document.title).toMatch(/^Contact · /);
    expect(document.querySelector(".contact-window")?.getAttribute("data-active-window")).toBe("true");

    fireEvent.click(taskbar.getByRole("button", { name: /Switch to Projects/i }));
    expect(`${window.location.pathname}${window.location.hash}`).toBe("/#selected-work");

    fireEvent.click(taskbar.getByRole("button", { name: /Switch to Contact/i }));
    act(() => vi.advanceTimersByTime(0));
    expect(`${window.location.pathname}${window.location.hash}`).toBe("/#contact");
  });

  it("adds history for Contact exactly as it does for Experience, so Back lands in the same place", async () => {
    const dance = async (app: "Contact" | "Experience") => {
      // A known entry behind the dance, so Back's landing can be compared across runs.
      window.history.replaceState(null, "", "/before");
      window.history.pushState(null, "", "/");
      const start = window.history.length;
      render(<WorkspaceManagerProvider><PortfolioHeader /><CounterfactualHome /></WorkspaceManagerProvider>);
      act(() => vi.advanceTimersByTime(20));
      const taskbar = within(screen.getByRole("navigation", { name: "System taskbar" }));
      fireEvent.click(taskbar.getByRole("button", { name: /Open Projects\. Not running/i }));
      fireEvent.click(taskbar.getByRole("button", { name: new RegExp(`Open ${app}\\. Not running`, "i") }));
      act(() => vi.advanceTimersByTime(0));
      fireEvent.click(taskbar.getByRole("button", { name: /Switch to Projects/i }));
      fireEvent.click(taskbar.getByRole("button", { name: new RegExp(`Switch to ${app}`, "i") }));
      act(() => vi.advanceTimersByTime(0));
      const added = window.history.length - start;
      window.history.back();
      await act(async () => { await vi.advanceTimersByTimeAsync(20); });
      const afterBack = `${window.location.pathname}${window.location.hash}`;
      cleanup();
      return { added, afterBack };
    };

    const experience = await dance("Experience");
    const contact = await dance("Contact");
    expect(contact).toEqual(experience);
    // Switching apps rewrites the current entry; it never adds one.
    expect(contact.added).toBe(0);
  });
});
