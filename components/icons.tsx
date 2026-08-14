export function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="inline-icon">
      <path d="M5 15 15 5M7 5h8v8" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
