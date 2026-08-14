import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemShell } from "./system-shell";
import { WorkspaceManagerProvider } from "./workspace-manager";

const push = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

describe("SystemShell", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    pathname = "/";
    push.mockReset();
  });

  afterEach(cleanup);

  it("renders one launcher, taskbar, shelf, and Recents identity for every top-level app", () => {
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);

    for (const label of ["Work", "Experience", "Contact", "Product Links"]) {
      expect(screen.getAllByRole("button", { name: new RegExp(`Open ${label}|Switch to ${label}`) }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Product Links").length).toBeGreaterThan(1);
  });

  it("keeps the top system bar status-only and identifies the active app", () => {
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const statusBar = screen.getByRole("banner");
    const taskbar = within(screen.getByRole("navigation", { name: "System taskbar" }));

    expect(screen.queryByRole("navigation", { name: "Desktop application menu" })).toBeNull();
    expect(within(statusBar).queryByRole("button")).toBeNull();
    expect(within(statusBar).getByText("Work")).toBeTruthy();

    fireEvent.click(taskbar.getByRole("button", { name: /Open Experience\. Not running/i }));
    expect(within(statusBar).getByText("Experience")).toBeTruthy();
  });

  it("identifies a direct route by its owning app without adding a top launcher", () => {
    pathname = "/products";
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);

    const statusBar = screen.getByRole("banner");
    expect(within(statusBar).getByText("Product Links")).toBeTruthy();
    expect(within(statusBar).queryByRole("button")).toBeNull();
  });

  it("opens, minimizes, and restores Product Links through one taskbar item", () => {
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const taskbar = within(screen.getByRole("navigation", { name: "System taskbar" }));

    const open = taskbar.getByRole("button", { name: /Open Product Links\. Not running/i });
    fireEvent.click(open);
    const active = taskbar.getByRole("button", { name: /Switch to Product Links\. Active/i });
    expect(active.getAttribute("data-running")).toBe("true");

    fireEvent.click(active);
    const minimized = taskbar.getByRole("button", { name: /Switch to Product Links\. Minimized/i });
    expect(minimized.getAttribute("data-minimized")).toBe("true");

    fireEvent.click(minimized);
    expect(taskbar.getByRole("button", { name: /Switch to Product Links\. Active/i })).toBeTruthy();
  });

  it("reports running state through the tablet shelf without creating another app identity", () => {
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const shelf = within(screen.getByRole("navigation", { name: "Tablet application shelf" }));

    const product = shelf.getByRole("button", { name: "Open Product Links. Not running" });
    fireEvent.click(product);

    expect(shelf.getByRole("button", { name: "Switch to Product Links. Active" })).toBeTruthy();
    expect(shelf.getAllByRole("button", { name: /Product Links/i })).toHaveLength(1);
  });

  it("keeps phone Home and Recents as system surfaces without closing running apps", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    const { container } = render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const phoneNavigation = within(screen.getByRole("navigation", { name: "Phone system navigation" }));
    const home = container.querySelector<HTMLElement>(".system-home-screen");
    const recents = container.querySelector<HTMLElement>(".system-recents");

    expect(home).toBeTruthy();
    expect(recents).toBeTruthy();

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Home" }));
    expect(home?.getAttribute("aria-hidden")).toBe("false");
    expect(screen.getAllByText("Work").length).toBeGreaterThan(0);
    expect(phoneNavigation.getByRole("button", { name: "Home" }).getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("button", { name: "Continue Work" })).toBeTruthy();

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Recents" }));
    expect(recents?.getAttribute("aria-hidden")).toBe("false");
    expect(phoneNavigation.getByRole("button", { name: "Recents" }).getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("button", { name: "Switch to Work" })).toBeTruthy();
    expect(recents?.querySelector('[data-current="true"]')).toBeTruthy();
  });

  it("returns to the workspace when closing the application that owns a direct route", () => {
    pathname = "/case/payflow";
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const taskbar = within(screen.getByRole("navigation", { name: "System taskbar" }));

    fireEvent.click(taskbar.getByRole("button", { name: "Application overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Work" }));

    expect(push).toHaveBeenCalledWith("/");
  });
});
