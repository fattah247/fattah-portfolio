import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SplitDivider } from "./split-divider";

describe("SplitDivider", () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 1100 });
    document.body.append(host);
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    host.remove();
  });

  it("rests a cancelled drag where the finger last was, never at the cancel's clientX of 0", () => {
    const keep = vi.fn();
    render(<SplitDivider host={() => host} keep={keep} />);
    const divider = screen.getByRole("separator");

    fireEvent.pointerDown(divider, { button: 0, clientX: 550, isPrimary: true, pointerId: 3, timeStamp: 0 });
    fireEvent.pointerMove(divider, { clientX: 800, pointerId: 3, timeStamp: 100 });
    fireEvent.pointerMove(divider, { clientX: 1060, pointerId: 3, timeStamp: 200 });
    fireEvent.pointerCancel(divider, { clientX: 0, pointerId: 3, timeStamp: 210 });

    // Dragged to the right edge: the right pane (Experience) closes and Projects stays.
    expect(keep).toHaveBeenCalledTimes(1);
    expect(keep).toHaveBeenCalledWith("work");
  });

  it("keeps both panes when a drag is cancelled mid-screen", () => {
    const keep = vi.fn();
    render(<SplitDivider host={() => host} keep={keep} />);
    const divider = screen.getByRole("separator");

    fireEvent.pointerDown(divider, { button: 0, clientX: 550, isPrimary: true, pointerId: 4, timeStamp: 0 });
    fireEvent.pointerMove(divider, { clientX: 700, pointerId: 4, timeStamp: 100 });
    fireEvent.pointerCancel(divider, { clientX: 0, pointerId: 4, timeStamp: 110 });

    expect(keep).not.toHaveBeenCalled();
    expect(Number(host.style.getPropertyValue("--split"))).toBeGreaterThan(0.15);
  });
});
