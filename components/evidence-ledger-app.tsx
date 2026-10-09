"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronIcon } from "@/components/icons";
import { PortfolioHeader } from "@/components/portfolio-header";
import { useWindowFrame } from "@/components/use-window-frame";
import { ApplicationFrame } from "@/components/application-frame";
import { WindowChrome } from "@/components/window-chrome";
import { Wallpaper } from "@/components/wallpaper";
import { useWorkspaceManager } from "@/components/workspace-manager";
import { scenarios } from "@/lib/scenarios";

export function EvidenceLedgerApp() {
  const router = useRouter();
  const workspace = useWorkspaceManager();
  const closeEvidenceWindow = workspace.closeWindow;
  const openEvidenceWindow = workspace.openWindow;
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);
  const [isClosing, setIsClosing] = useState(false);
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
  } = useWindowFrame({ defaultHeight: 820, defaultWidth: 1360, minHeight: 460, minWidth: 700 });

  useEffect(() => {
    openEvidenceWindow("evidence");
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeEvidenceWindow("evidence");
    };
  }, [closeEvidenceWindow, openEvidenceWindow]);

  useEffect(() => {
    if (workspace.mode === "computer") return;
    return workspace.registerBackHandler("evidence-ledger", () => {
      if (workspace.activeWindow !== "evidence" || workspace.surface !== "application") return false;
      requestClose();
      return true;
    });
  });

  // This route has no Home host, so a session closed from Recents must leave the address itself.
  useEffect(() => {
    if (workspace.isOpen("evidence")) { wasOpenRef.current = true; return; }
    if (!wasOpenRef.current || isClosing) return;
    wasOpenRef.current = false;
    router.push("/#selected-work");
  }, [isClosing, router, workspace]);

  function requestClose() {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      workspace.closeWindow("evidence");
      router.push("/#selected-work");
    }, 240);
  }

  return (
    <>
      <Wallpaper />
      <PortfolioHeader />
      <ApplicationFrame as="main" windowId="evidence" initialVisible resizeHandleProps={resizeHandleProps}
        className="evidence-page portfolio-window evidence-route-window"
        data-active-window={workspace.activeWindow === "evidence"}
        data-app-id="work"
        data-closing={isClosing}
        data-dragging={dragging}
        data-resizing={resizing}
        data-snap={snap ?? undefined}
        data-window-state={!workspace.modeReady ? "active" : workspace.stateFor("evidence")}
        id="main-content"
        onPointerDown={() => workspace.focusWindow("evidence")}
        frameRef={frameRef}
        style={{ ...style, "--window-z": workspace.zIndexFor("evidence") } as CSSProperties}
        suppressHydrationWarning
        tabIndex={-1}
      >
        <WindowChrome
          app="work"
          className="portfolio-window-chrome evidence-route-chrome"
          closeLabel="Close evidence ledger"
          closeRef={closeRef}
          label="Projects"
          maximized={maximized}
        onClose={requestClose}
        compactBackText="Projects"
        onCompactBack={workspace.mode !== "computer" ? requestClose : undefined}
          onMinimize={() => workspace.minimizeWindow("evidence")}
          onToggleMaximize={toggleMaximize}
          title="Evidence ledger"
          {...titlebarProps}
        />
        <div className="evidence-route-content">
        <section className="evidence-hero">
          <h1>Evidence for the three public labs</h1>
          <p>
            Public labs support the technical claims below. Professional experience is described separately and does not imply access to employer source code.
          </p>
        </section>

        <section className="claim-ledger">
          <div className="claim-header"><span>Claim</span><span>Evidence</span><span>Boundary</span></div>
          {scenarios.map((scenario) => (
            <article className="claim-row" key={scenario.slug}>
              <div><span>{scenario.number}</span><h2>{scenario.shortTitle}</h2><p>{scenario.outcome}</p></div>
              <div className="claim-evidence">
                <div className="claim-thumb"><Image src={scenario.evidence[0].src} alt="" fill sizes="180px" /></div>
                <div><p>{scenario.evidence[0].caption}</p><Link href={`/case/${scenario.slug}`}>Replay case <ChevronIcon direction="right" /></Link></div>
              </div>
              <p>{scenario.limitation}</p>
            </article>
          ))}
        </section>

        </div>
      </ApplicationFrame>
    </>
  );
}
