"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowIcon } from "@/components/icons";
import { PortfolioHeader } from "@/components/portfolio-header";
import { useWindowFrame, windowResizeEdges } from "@/components/use-window-frame";
import { WindowChrome } from "@/components/window-chrome";
import { useWorkspaceManager } from "@/components/workspace-manager";
import { additionalRepos } from "@/lib/content";
import { scenarios } from "@/lib/scenarios";

export default function EvidencePage() {
  const router = useRouter();
  const workspace = useWorkspaceManager();
  const closeEvidenceWindow = workspace.closeWindow;
  const openEvidenceWindow = workspace.openWindow;
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
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
      requestClose();
      return true;
    });
  });

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
      <PortfolioHeader />
      <main
        className="evidence-page portfolio-window evidence-route-window"
        data-active-window={workspace.activeWindow === "evidence"}
        data-app-id="work"
        data-closing={isClosing}
        data-dragging={dragging}
        data-resizing={resizing}
        data-snap={snap ?? undefined}
        data-window-state={workspace.stateFor("evidence")}
        id="main-content"
        onPointerDown={() => workspace.focusWindow("evidence")}
        ref={frameRef}
        style={{ ...style, "--window-z": workspace.zIndexFor("evidence") } as CSSProperties}
        suppressHydrationWarning
        tabIndex={-1}
      >
        <WindowChrome
          className="portfolio-window-chrome evidence-route-chrome"
          closeLabel="Close evidence ledger"
          closeRef={closeRef}
          label="Projects"
          maximized={maximized}
          onClose={requestClose}
          onMinimize={() => workspace.minimizeWindow("evidence")}
          onToggleMaximize={toggleMaximize}
          subtitle="Public evidence, limits, and source material"
          title="Evidence ledger"
          {...titlebarProps}
        />
        {windowResizeEdges.map((edge) => <span key={edge} {...resizeHandleProps(edge)} />)}
        <div className="evidence-route-content">
        <section className="evidence-hero">
          <h1>Claims should leave evidence.</h1>
          <p>
            Public labs support the technical claims below. Professional experience is described separately and does not imply access to employer source code.
          </p>
        </section>

        <section className="claim-ledger">
          <div className="claim-header"><span>Claim</span><span>Evidence</span><span>Boundary</span></div>
          {scenarios.map((scenario) => (
            <article className="claim-row" key={scenario.slug}>
              <div><span>{scenario.number}</span><h2>{scenario.shortTitle}</h2><p>{scenario.consequence}</p></div>
              <div className="claim-evidence">
                <div className="claim-thumb"><Image src={scenario.evidence[0].src} alt="" fill sizes="180px" /></div>
                <div><p>{scenario.evidence[0].caption}</p><Link href={`/case/${scenario.slug}`}>Replay case <ArrowIcon /></Link></div>
              </div>
              <p>{scenario.limitation}</p>
            </article>
          ))}
        </section>

        <section className="repository-index">
          <div><h2>Additional public repositories</h2></div>
          <div>
            {additionalRepos.map((repo) => (
              <a href={repo.href} target="_blank" rel="noopener noreferrer" key={repo.name}>
                <span><strong>{repo.name}</strong><small>{repo.detail}</small></span><ArrowIcon />
              </a>
            ))}
          </div>
        </section>
        </div>
      </main>
    </>
  );
}
