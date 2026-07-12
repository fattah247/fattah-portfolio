import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WindowChrome } from "./window-chrome";

describe("WindowChrome", () => {
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
});
