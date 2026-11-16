import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationFrame } from "./application-frame";
import { WindowChrome } from "./window-chrome";
import { windowResizeEdges, type ResizeEdge } from "./use-window-frame";
import { useWorkspaceManager, WorkspaceManagerProvider } from "./workspace-manager";

const noop = () => {};

function resizeHandleProps(edge: ResizeEdge) {
  return {
    "aria-hidden": true,
    className: `window-resize-handle resize-${edge}`,
    onLostPointerCapture: noop,
    onPointerCancel: noop,
    onPointerDown: noop,
    onPointerMove: noop,
    onPointerUp: noop,
  };
}

function zIndexFor(css: string, selector: string) {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{]*\\{[^}]*?z-index:\\s*(\\d+)`, "g");
  const values = [...css.matchAll(pattern)].map((match) => Number(match[1]));
  return values.length ? Math.max(...values) : undefined;
}

describe("ApplicationFrame resize geometry", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  });

  afterEach(cleanup);

  it("renders every resize handle as a direct frame child after the chrome", () => {
    render(
      <WorkspaceManagerProvider>
        <ApplicationFrame windowId="work" className="portfolio-window" resizeHandleProps={resizeHandleProps} chrome={<WindowChrome className="portfolio-window-chrome" closeLabel="Close" label="Projects" />}>
          <div className="portfolio-window-content">Document</div>
        </ApplicationFrame>
      </WorkspaceManagerProvider>,
    );

    const frame = document.querySelector<HTMLElement>(".portfolio-window")!;
    const children = Array.from(frame.children);
    const chromeIndex = children.findIndex((node) => node.classList.contains("portfolio-window-chrome"));
    const handles = children.filter((node) => node.classList.contains("window-resize-handle"));
    expect(chromeIndex).toBe(0);
    expect(handles.map((node) => node.className)).toEqual(windowResizeEdges.map((edge) => `window-resize-handle resize-${edge}`));
    expect(handles.every((node) => children.indexOf(node) > chromeIndex)).toBe(true);
  });

  it("keeps resize handles stacked above the sticky window chrome so the top edge resizes instead of dragging", () => {
    const windowSystem = readFileSync(resolve(process.cwd(), "app/window-system.css"), "utf8");
    const chromeZ = zIndexFor(windowSystem, ".window-chrome,");
    const handleZ = zIndexFor(windowSystem, ".window-resize-handle");

    expect(chromeZ).toBeGreaterThan(0);
    expect(handleZ).toBeGreaterThan(chromeZ!);
  });

  it("minimizes a desktop window toward its own dock icon", () => {
    let minimize: () => void = noop;
    function Harness() {
      const { minimizeWindow, openWindow } = useWorkspaceManager();
      useEffect(() => openWindow("experience"), [openWindow]);
      minimize = () => minimizeWindow("experience");
      return (
        <>
          <nav className="desktop-taskbar"><button className="taskbar-app" data-app="experience" type="button">Experience</button></nav>
          <ApplicationFrame windowId="experience" className="portfolio-window">Document</ApplicationFrame>
        </>
      );
    }
    render(<WorkspaceManagerProvider><Harness /></WorkspaceManagerProvider>);
    const frame = document.querySelector<HTMLElement>(".portfolio-window")!;
    for (const [key, value] of Object.entries({ offsetHeight: 600, offsetLeft: 100, offsetTop: 60, offsetWidth: 800 })) {
      Object.defineProperty(frame, key, { configurable: true, value });
    }
    const icon = document.querySelector<HTMLElement>('.taskbar-app[data-app="experience"]')!;
    icon.getBoundingClientRect = () => ({ bottom: 880, height: 50, left: 675, right: 725, top: 830, width: 50, x: 675, y: 830, toJSON: noop }) as DOMRect;

    act(() => minimize());

    expect(frame.getAttribute("data-window-state")).toBe("minimized");
    // Window centre (500, 360) to icon centre (700, 855).
    expect(frame.style.getPropertyValue("--minimize-dx")).toBe("200px");
    expect(frame.style.getPropertyValue("--minimize-dy")).toBe("495px");
  });

  it("keeps the paragraph at the top edge in place when a window is resized narrower", () => {
    vi.useFakeTimers();
    let observed: () => void = noop;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { observed = callback; }
      observe() {}
      disconnect() {}
    });
    let width = 800;
    let top = 0;
    const lineHeight = () => (width >= 800 ? 100 : 200);
    render(
      <WorkspaceManagerProvider>
        <ApplicationFrame windowId="work" className="portfolio-window">
          <div className="portfolio-window-content" style={{ overflowY: "auto" }}>
            {[0, 1, 2, 3, 4, 5].map((index) => <p data-index={index} key={index}>Paragraph {index}</p>)}
          </div>
        </ApplicationFrame>
      </WorkspaceManagerProvider>,
    );
    const owner = document.querySelector<HTMLElement>(".portfolio-window-content")!;
    Object.defineProperty(owner, "clientWidth", { configurable: true, get: () => width });
    Object.defineProperty(owner, "scrollTop", { configurable: true, get: () => top, set: (value: number) => { top = value; } });
    owner.getBoundingClientRect = () => ({ bottom: 700, height: 600, left: 0, right: width, top: 100, width, x: 0, y: 100, toJSON: noop }) as DOMRect;
    for (const paragraph of Array.from(owner.querySelectorAll<HTMLElement>("p"))) {
      const index = Number(paragraph.dataset.index);
      paragraph.getBoundingClientRect = () => {
        const y = 100 + index * lineHeight() - top;
        return { bottom: y + lineHeight(), height: lineHeight(), left: 0, right: width, top: y, width, x: 0, y, toJSON: noop } as DOMRect;
      };
    }

    // The observer's first report, as a browser sends one on observe().
    act(() => observed());
    // Paragraph 2 starts 50px above the top edge.
    top = 250;
    act(() => { owner.dispatchEvent(new Event("scroll")); vi.advanceTimersByTime(20); });

    // Narrower, every paragraph is twice as tall; paragraph 2 must still start 50px above the edge.
    width = 400;
    act(() => observed());
    expect(top).toBe(450);
    expect(owner.querySelector<HTMLElement>('[data-index="2"]')!.getBoundingClientRect().top).toBe(50);

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
