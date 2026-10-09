export function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="inline-icon">
      <path d="M5 15 15 5M7 5h8v8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Run: a solid play triangle; while running it becomes two pause bars. */
export function PlayIcon({ paused = false }: { paused?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="inline-icon" shapeRendering="crispEdges">
      {paused ? <path d="M6 5h3v10H6zM11 5h3v10h-3z" fill="currentColor" /> : <path d="M7 4v12l9-6z" fill="currentColor" />}
    </svg>
  );
}

export function RewindIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="inline-icon">
      <path d="M4 6v5h5M5 11a6 6 0 1 0 1-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="system-control-icon">
      <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="1.5" />
    </svg>
  );
}

export function MinimizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="system-control-icon">
      <path d="M5 10h10" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="1.5" />
    </svg>
  );
}

export function MaximizeIcon({ restored = false }: { restored?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="system-control-icon">
      {restored ? (
        <path d="M7 5h8v8M5 7h8v8H5z" fill="none" stroke="currentColor" strokeWidth="1.35" />
      ) : (
        <path d="M5 5h10v10H5z" fill="none" stroke="currentColor" strokeWidth="1.35" />
      )}
    </svg>
  );
}

type IconProps = { className?: string };

const chevronPaths = { left: "M12.5 4.5 7 10l5.5 5.5", right: "M7.5 4.5 13 10l-5.5 5.5", down: "M4.5 7.5 10 13l5.5-5.5", up: "M4.5 12.5 10 7l5.5 5.5" } as const;

export function ChevronIcon({ className = "inline-icon", direction = "left" }: IconProps & { direction?: keyof typeof chevronPaths }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path d={chevronPaths[direction]} fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="1.5" />
    </svg>
  );
}

/** Window management menu: three square cells, matching the square geometry. */
export function MoreIcon({ className = "inline-icon" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path d="M3.75 9h2.5v2.5h-2.5zM8.75 9h2.5v2.5h-2.5zM13.75 9h2.5v2.5h-2.5z" fill="currentColor" />
    </svg>
  );
}

/** Two panes on one stage: the tablet pairing control. */
export function PairIcon({ className = "inline-icon" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path d="M3 4.75h6v10.5H3zM11 4.75h6v10.5h-6z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function DownloadIcon({ className = "inline-icon" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="1.5" />
    </svg>
  );
}
