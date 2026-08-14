"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { productLinks } from "../lib/product-links";
import { ProductLinksDirectory } from "./product-links-directory";
import { useWindowFrame, windowResizeEdges } from "./use-window-frame";
import { WindowChrome } from "./window-chrome";
import { useWorkspaceManager } from "./workspace-manager";

export function ProductLinksAppContent() {
  return (
    <div className="product-links-app-content">
      <header className="product-links-intro">
        <p>Directory</p>
        <h1>Products I use</h1>
        <span>Browse alphabetically or search by product name and ID.</span>
      </header>
      <ProductLinksDirectory links={productLinks} />
    </div>
  );
}

export function ProductLinksRouteWindow() {
  const router = useRouter();
  const workspace = useWorkspaceManager();
  const openProductWindow = workspace.openWindow;
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const {
    dragging,
    frameRef,
    maximized,
    resizeHandleProps,
    resizing,
    snap,
    style,
    titlebarProps,
    toggleMaximize,
  } = useWindowFrame({ defaultHeight: 820, defaultWidth: 1220, minHeight: 420, minWidth: 620 });

  useEffect(() => {
    openProductWindow("products");
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [openProductWindow]);

  useEffect(() => {
    if (workspace.mode === "computer") return;
    return workspace.registerBackHandler("product-links-root", () => {
      requestClose();
      return true;
    });
  });

  function requestClose() {
    if (isClosing) return;
    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      workspace.closeApp("products");
      router.push("/");
    }, 240);
  }

  return (
    <main
      className="portfolio-window product-links-window product-links-route-window"
      data-active-window={workspace.activeWindow === "products"}
      data-app-id="products"
      data-closing={isClosing}
      data-dragging={dragging}
      data-resizing={resizing}
      data-snap={snap ?? undefined}
      data-window-state={workspace.stateFor("products")}
      id="main-content"
      onFocusCapture={() => workspace.focusWindow("products")}
      onPointerDown={() => workspace.focusWindow("products")}
      ref={frameRef}
      style={{ ...style, "--window-z": workspace.zIndexFor("products") } as CSSProperties}
      suppressHydrationWarning
      tabIndex={-1}
    >
      <WindowChrome
        className="portfolio-window-chrome product-links-window-chrome"
        closeLabel="Close product links"
        closeRef={closeRef}
        label="Product Links"
        maximized={maximized}
        onClose={requestClose}
        onMinimize={() => workspace.minimizeWindow("products")}
        onToggleMaximize={toggleMaximize}
        subtitle="Searchable tools and products directory"
        {...titlebarProps}
      />
      {windowResizeEdges.map((edge) => <span key={edge} {...resizeHandleProps(edge)} />)}
      <ProductLinksAppContent />
    </main>
  );
}
