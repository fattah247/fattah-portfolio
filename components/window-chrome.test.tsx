import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowChrome } from "./window-chrome";

describe("WindowChrome", () => {
  afterEach(cleanup);

  it("keeps the shared title hierarchy and accessible close action", () => {
    const onClose = vi.fn();
    render(
      <WindowChrome
        closeLabel="Close work window"
        label="Work"
        onClose={onClose}
        subtitle="Android POS and merchant payments"
        title="Muhammad A. Fattah"
      />,
    );

    expect(screen.getByText("Work")).toBeTruthy();
    expect(screen.getByText("Muhammad A. Fattah")).toBeTruthy();
    expect(screen.getByText("Android POS and merchant payments")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close work window" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("provides consistently named minimize, maximize, and restore controls", () => {
    const onMinimize = vi.fn();
    const onToggleMaximize = vi.fn();
    const { rerender } = render(
      <WindowChrome
        closeLabel="Close work window"
        label="Work"
        onClose={vi.fn()}
        onMinimize={onMinimize}
        onToggleMaximize={onToggleMaximize}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Minimize Work" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize Work" }));
    expect(onMinimize).toHaveBeenCalledOnce();
    expect(onToggleMaximize).toHaveBeenCalledOnce();

    rerender(
      <WindowChrome
        closeLabel="Close work window"
        label="Work"
        maximized
        onClose={vi.fn()}
        onMinimize={onMinimize}
        onToggleMaximize={onToggleMaximize}
      />,
    );
    expect(screen.getByRole("button", { name: "Restore Work" })).toBeTruthy();
  });

  it("provides a separate compact back action without changing the desktop close contract", () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(
      <WindowChrome
        closeLabel="Close work window"
        compactBackLabel="Return to Home"
        label="Work"
        onClose={onClose}
        onCompactBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Return to Home" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Close work window" })).toBeTruthy();
  });

  it("reads left to right: the app's window menu, the title, then minimize, maximize, and close", () => {
    const management = { begin: vi.fn(), cancel: vi.fn(), commit: vi.fn(), move: vi.fn(), reset: vi.fn(), resize: vi.fn(), snap: vi.fn() };
    const { container } = render(
      <WindowChrome
        app="work"
        closeLabel="Close Projects window"
        label="Projects"
        onClose={vi.fn()}
        onMinimize={vi.fn()}
        onToggleMaximize={vi.fn()}
        title="Payment reliability"
        windowManagement={management}
      />,
    );

    const order = Array.from(container.querySelectorAll(".window-chrome > *")).map((node) => node.className);
    expect(order.indexOf("window-management-menu")).toBeLessThan(order.indexOf("window-location"));
    expect(order.indexOf("window-location")).toBeLessThan(order.indexOf("window-control-cluster"));
    const cluster = container.querySelector(".window-control-cluster")!;
    expect(Array.from(cluster.querySelectorAll("button")).map((button) => button.getAttribute("aria-label"))).toEqual(["Minimize Projects", "Maximize Projects", "Close Projects window"]);
    expect(container.querySelector('.window-management-menu > summary .app-icon[data-app="work"][data-variant="small"]')).toBeTruthy();
  });

  it("offers every window action from the window menu and closes the menu after one", () => {
    const onMinimize = vi.fn();
    const management = { begin: vi.fn(), cancel: vi.fn(), commit: vi.fn(), move: vi.fn(), reset: vi.fn(), resize: vi.fn(), snap: vi.fn() };
    const { container } = render(
      <WindowChrome app="experience" closeLabel="Close experience window" label="Experience" onClose={vi.fn()} onMinimize={onMinimize} onToggleMaximize={vi.fn()} windowManagement={management} />,
    );

    const menu = container.querySelector<HTMLDetailsElement>(".window-management-menu")!;
    fireEvent.click(screen.getByLabelText("Experience window menu"));
    menu.open = true;
    const options = within(screen.getByRole("group", { name: "Experience window" }));
    expect(options.getAllByRole("button").map((button) => button.textContent)).toEqual(["Move with arrow keys", "Resize with arrow keys", "Snap left", "Snap right", "Reset position", "Minimize", "Maximize", "Close"]);
    fireEvent.click(options.getByRole("button", { name: "Snap left" }));
    expect(management.snap).toHaveBeenCalledWith("left");
    expect(menu.open).toBe(false);
    menu.open = true;
    fireEvent.click(options.getByRole("button", { name: "Minimize" }));
    expect(onMinimize).toHaveBeenCalledOnce();
    expect(menu.open).toBe(false);
  });
});
