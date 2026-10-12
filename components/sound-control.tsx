"use client";

import { useEffect, useId, useRef, useState } from "react";
import { soundLevels, type SoundLevel } from "../lib/sound/player";
import { useSound } from "./sound-provider";

const levelLabel: Record<SoundLevel, string> = { on: "On", quiet: "Quiet", off: "Off" };

/** A speaker on the 16-unit grid: two waves for On, one for Quiet, a cross for Off. */
function SpeakerGlyph({ level }: { level: SoundLevel }) {
  const speaker = [[1, 6, 3, 4], [4, 5, 2, 6], [6, 3, 2, 10]];
  const marks = level === "off"
    ? [[10, 5, 1, 1], [14, 5, 1, 1], [11, 6, 1, 1], [13, 6, 1, 1], [12, 7, 1, 1], [11, 8, 1, 1], [13, 8, 1, 1], [10, 9, 1, 1], [14, 9, 1, 1]]
    : [[10, 5, 1, 1], [11, 6, 1, 4], [10, 10, 1, 1], ...(level === "on" ? [[12, 3, 1, 1], [13, 4, 1, 8], [12, 12, 1, 1]] : [])];
  return (
    <svg aria-hidden="true" className="sound-glyph" focusable="false" shapeRendering="crispEdges" viewBox="0 0 16 16">
      <path d={[...speaker, ...marks].map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h-${w}z`).join("")} />
    </svg>
  );
}

/**
 * The environment's sound level. One speaker in the status bar opens three joined keys; choosing a
 * level plays the repeat-check latch at that level, so the change can be heard. Escape and a press
 * outside close it, and Escape is consumed here before any window reacts.
 */
export function SoundControl({ className = "" }: { className?: string }) {
  const { level, setLevel, play } = useSound();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside, true);
    return () => document.removeEventListener("pointerdown", closeOutside, true);
  }, [open]);

  return (
    <div
      className={`sound-control ${className}`.trim()}
      data-level={level}
      data-open={open || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        toggleRef.current?.focus();
      }}
      ref={rootRef}
    >
      <button aria-expanded={open} aria-label={`Sound: ${levelLabel[level]}`} className="sound-control-toggle" onClick={() => setOpen((value) => !value)} ref={toggleRef} type="button">
        <SpeakerGlyph level={level} />
      </button>
      {open ? (
        <div className="sound-control-panel">
          <p id={titleId}>Sound</p>
          <div aria-labelledby={titleId} className="sound-control-keys" role="group">
            {soundLevels.map((option) => (
              <button
                aria-pressed={level === option}
                key={option}
                onClick={() => {
                  setLevel(option);
                  if (option !== "off") play("pay.check-on");
                }}
                type="button"
              >
                {levelLabel[option]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
