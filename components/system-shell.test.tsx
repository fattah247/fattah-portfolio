import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemShell } from "./system-shell";
import { useWorkspaceManager, WorkspaceManagerProvider } from "./workspace-manager";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
const push = navigation.push;

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push }),
}));

function OpenProductRoute() {
  const workspace = useWorkspaceManager();
  const openWindow = workspace.openWindow;
  useEffect(() => openWindow("products"), [openWindow]);
  return null;
}

describe("SystemShell", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    navigation.pathname = "/";
    push.mockReset();
  });

  afterEach(cleanup);

  it("renders one launcher, taskbar, shelf, and Recents identity for every top-level app", () => {
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);

    for (const label of ["Projects", "Experience", "Contact", "Product Links"]) {
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
    expect(within(statusBar).getByText("Desktop")).toBeTruthy();

    fireEvent.click(taskbar.getByRole("button", { name: /Open Experience\. Not running/i }));
    expect(within(statusBar).getByText("Experience")).toBeTruthy();
  });

  it("suppresses the native page context menu", () => {
    const { container } = render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const surface = document.createElement("section");
    surface.className = "desktop-surface";
    container.appendChild(surface);

    const contextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    surface.dispatchEvent(contextMenu);

    expect(contextMenu.defaultPrevented).toBe(true);
  });

  it("identifies a direct route by its owning app without adding a top launcher", () => {
    navigation.pathname = "/products";
    render(<WorkspaceManagerProvider><SystemShell /><OpenProductRoute /></WorkspaceManagerProvider>);

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
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 768 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1024 });
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const shelf = within(screen.getByRole("navigation", { name: "Tablet application shelf" }));

    const product = shelf.getByRole("button", { name: "Open Product Links. Not running" });
    fireEvent.click(product);

    expect(shelf.getByRole("button", { name: "Switch to Product Links. Active" })).toBeTruthy();
    expect(shelf.getAllByRole("button", { name: /Product Links/i })).toHaveLength(1);
  });

  it("makes the tablet shelf the launcher: labelled groups, Back resting on Home, Recents toggling", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 834 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1194 });
    const { container } = render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const shelfElement = screen.getByRole("navigation", { name: "Tablet application shelf" });
    const shelf = within(shelfElement);

    // Back, Home, the four apps, then Recents, each with a visible name.
    expect(Array.from(shelfElement.querySelectorAll(".tablet-app-label"), (label) => label.textContent)).toEqual(["Back", "Home", "Projects", "Experience", "Contact", "Products", "Recents"]);
    expect(shelfElement.querySelectorAll('[data-group="apps"] button')).toHaveLength(4);
    expect(shelf.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(shelf.getByRole("button", { name: "Open Projects. Not running" }));
    expect(shelf.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(shelf.getByRole("button", { name: "Recents" }));
    expect(document.documentElement.dataset.systemSurface).toBe("recents");
    fireEvent.click(shelf.getByRole("button", { name: "Recents" }));
    expect(document.documentElement.dataset.systemSurface).toBe("application");

    // The tablet Home board carries the role history from the same content as Experience.
    const roles = Array.from(container.querySelectorAll(".home-experience .home-role strong"), (role) => role.textContent);
    expect(roles).toEqual(["Software Engineer / IT Specialist", "iOS Engineer Intern", "iOS Developer"]);
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
    expect(screen.getAllByText("Projects").length).toBeGreaterThan(0);
    expect(phoneNavigation.getByRole("button", { name: "Home" }).getAttribute("data-active")).toBe("true");
    expect(screen.getAllByRole("button", { name: "Open Projects" }).length).toBeGreaterThan(0);

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Recents" }));
    expect(recents?.getAttribute("aria-hidden")).toBe("false");
    expect(phoneNavigation.getByRole("button", { name: "Recents" }).getAttribute("data-active")).toBe("true");
    expect(screen.getByText("No apps open.")).toBeTruthy();
    expect(recents?.querySelector('[data-current="true"]')).toBeNull();
  });

  it("closes a session from the overview without a router navigation; route hosts rewrite their own address", () => {
    navigation.pathname = "/case/payflow";
    render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const taskbar = within(screen.getByRole("navigation", { name: "System taskbar" }));

    fireEvent.click(taskbar.getByRole("button", { name: /Open Projects\. Not running/i }));
    fireEvent.click(taskbar.getByRole("button", { name: "Application overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Projects" }));

    expect(screen.getByText("No apps open.")).toBeTruthy();
    expect(taskbar.getByRole("button", { name: /Open Projects\. Not running/i })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("puts identity, CV, contact, the three cases, and every app on the phone Home", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    const { container } = render(<WorkspaceManagerProvider><SystemShell /></WorkspaceManagerProvider>);
    const home = within(container.querySelector<HTMLElement>(".system-home-screen")!);

    expect(home.getByRole("heading", { level: 1, name: "Muhammad A. Fattah" })).toBeTruthy();
    expect(home.getByRole("link", { name: /CV/ }).hasAttribute("download")).toBe(true);
    expect(home.getByRole("button", { name: "Contact" })).toBeTruthy();
    expect(home.getAllByRole("button").filter((button) => button.classList.contains("home-case"))).toHaveLength(3);
    expect(container.querySelectorAll(".system-launcher-app")).toHaveLength(4);
    // Continue only appears once something is running.
    expect(container.querySelector(".system-resume-app")).toBeNull();
  });

  it("orders Recents oldest to newest so the newest card is reached first from the end", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    const { container } = render(<WorkspaceManagerProvider><SystemShell /><OpenProductRoute /></WorkspaceManagerProvider>);
    const phoneNavigation = within(screen.getByRole("navigation", { name: "Phone system navigation" }));

    fireEvent.click(phoneNavigation.getByRole("button", { name: "Home" }));
    fireEvent.click(container.querySelector<HTMLButtonElement>('.system-launcher-app[data-app="experience"]')!);
    fireEvent.click(phoneNavigation.getByRole("button", { name: "Recents" }));

    const cards = Array.from(container.querySelectorAll<HTMLElement>(".system-recent-card"));
    expect(cards.map((card) => card.querySelector(".system-recent-preview")?.getAttribute("data-app"))).toEqual(["products", "experience"]);
    expect(cards.at(-1)?.getAttribute("data-current")).toBe("true");
    expect(screen.getByRole("heading", { name: "Recents" })).toBeTruthy();
    expect(screen.getByText("2 apps open")).toBeTruthy();
  });
});
