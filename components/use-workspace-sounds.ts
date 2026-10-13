"use client";

import { useEffect, useRef } from "react";
import { useSound } from "./sound-provider";
import { appForWindow, type WorkspaceManagerValue, type WorkspaceWindowId } from "./workspace-manager";

type Snapshot = { mode: string; open: WorkspaceWindowId[]; minimized: WorkspaceWindowId[]; surface: string };

/** A case, an exhibit, or a detail sheet: a document inside an app, which lands like paper. */
const isDocument = (id: WorkspaceWindowId) => id !== appForWindow(id);

/**
 * Window sounds, read from the workspace's own state rather than from each button, so every way of
 * opening, closing, minimizing or leaving an app (a click, a key, Recents, the phone's Back) sounds
 * the same. A device-mode change (a resize or a rotation) reshapes windows without a sound, and the
 * player keeps one sound per action when several changes land together.
 */
export function useWorkspaceSounds(workspace: WorkspaceManagerValue) {
  const { play } = useSound();
  const previous = useRef<Snapshot | null>(null);
  const minimized = workspace.openWindows.filter((id) => workspace.stateFor(id) === "minimized");
  const openKey = workspace.openWindows.join(" ");
  const minimizedKey = minimized.join(" ");

  useEffect(() => {
    const next: Snapshot = { mode: workspace.mode, open: workspace.openWindows, minimized, surface: workspace.surface };
    const before = previous.current;
    previous.current = next;
    if (!before || !workspace.modeReady || before.mode !== next.mode) return;
    const opened = next.open.filter((id) => !before.open.includes(id));
    const closed = before.open.filter((id) => !next.open.includes(id));
    const newlyMinimized = next.minimized.filter((id) => !before.minimized.includes(id));
    const restored = before.minimized.filter((id) => next.open.includes(id) && !next.minimized.includes(id));
    if (opened.length) play(opened.some((id) => !isDocument(id)) ? "sys.open" : "sys.file-open");
    else if (closed.length) play(closed.some((id) => !isDocument(id)) ? "sys.close" : "sys.file-close");
    else if (newlyMinimized.length) play("sys.minimize");
    else if (restored.length) play("sys.restore");
    // Leaving an app for Home: on a desktop the windows step aside, elsewhere the app seats into its icon.
    else if (before.surface === "application" && next.surface === "home") play(next.mode === "computer" ? "sys.minimize" : "sys.close");
  // The keys stand for the lists; the lists themselves are new arrays on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, minimizedKey, play, workspace.mode, workspace.modeReady, workspace.surface]);
}
