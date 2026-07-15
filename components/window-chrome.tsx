import Link from "next/link";
import type { HTMLAttributes, ReactNode, Ref } from "react";

type WindowChromeProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  closeHref?: string;
  closeLabel: string;
  closeClassName?: string;
  closeRef?: Ref<HTMLButtonElement>;
  label: string;
  locationClassName?: string;
  maximized?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  subtitle?: string;
  title?: string;
  titleId?: string;
};

/**
 * Shared titlebar contract for every portfolio window.
 * The frame hook owns drag behaviour; this component owns hierarchy and close affordance.
 */
export function WindowChrome({
  actions,
  children,
  className = "",
  closeClassName = "window-close-action",
  closeRef,
  closeHref,
  closeLabel,
  label,
  locationClassName = "",
  maximized = false,
  onClose,
  onMinimize,
  onToggleMaximize,
  subtitle,
  title,
  titleId,
  ...titlebarProps
}: WindowChromeProps) {
  const closeControl = onClose ? (
    <button ref={closeRef} className={closeClassName} onClick={onClose} type="button" aria-label={closeLabel}>
      <span aria-hidden="true">×</span>
    </button>
  ) : closeHref ? (
    <Link className={closeClassName} href={closeHref} aria-label={closeLabel}>
      <span aria-hidden="true">×</span>
    </Link>
  ) : null;

  return (
    <div className={`window-chrome ${className}`.trim()} {...titlebarProps}>
      <div className="window-control-cluster">
        {closeControl}
        {onMinimize ? <button className="window-system-control minimize" onClick={onMinimize} type="button" aria-label={`Minimize ${label}`}><span aria-hidden="true">–</span></button> : null}
        {onToggleMaximize ? <button className="window-system-control maximize" onClick={onToggleMaximize} type="button" aria-label={`${maximized ? "Restore" : "Maximize"} ${label}`}><span aria-hidden="true">{maximized ? "❐" : "□"}</span></button> : null}
      </div>
      <div aria-atomic="true" aria-live={title ? "polite" : undefined} className={`window-location ${locationClassName}`.trim()}>
        <p className="micro-label">{label}</p>
        {title ? <strong id={titleId}>{title}</strong> : null}
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {actions}
      {children ?? <span className="window-chrome-grip" aria-hidden="true" />}
    </div>
  );
}
