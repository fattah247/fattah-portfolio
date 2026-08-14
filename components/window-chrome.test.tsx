import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
