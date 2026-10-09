export type DeviceMode = "computer" | "tablet" | "phone";

export type DeviceCapabilityInput = {
  coarsePointer?: boolean;
  height: number;
  hover?: boolean;
  width: number;
};

export type TabletPairingStage = {
  height: number;
  paneMinWidth: number;
  width: number;
};

export type DeviceCapabilities = {
  coarsePointer: boolean;
  compactWindows: boolean;
  height: number;
  hover: boolean;
  mode: DeviceMode;
  pairingEligible: boolean;
  stage: TabletPairingStage;
  width: number;
};

export const tabletPairingStage: TabletPairingStage = {
  width: 1040,
  height: 600,
  paneMinWidth: 480,
};

export const initialDeviceCapabilities: DeviceCapabilities = {
  coarsePointer: false,
  compactWindows: false,
  height: 0,
  hover: true,
  mode: "computer",
  pairingEligible: false,
  stage: tabletPairingStage,
  width: 0,
};

/**
 * Classifies the input device by its usable interaction model, not its user agent.
 * Landscape phones stay phones, while large touch-first screens retain the tablet
 * model even when their CSS viewport is wider than the standard tablet cutoff.
 */
export function capabilitiesForViewport({
  coarsePointer = false,
  height,
  hover = true,
  width,
}: DeviceCapabilityInput): DeviceCapabilities {
  const touchFirst = coarsePointer && !hover;
  const compactLandscapePhone = touchFirst
    && width > height
    && width <= 960
    && height <= 500;
  const mode: DeviceMode = width <= 600 || compactLandscapePhone
    ? "phone"
    : width <= 1100 || touchFirst
      ? "tablet"
      : "computer";
  // Subtract the constrained stage margins, status bar, and touch shelf.
  const pairingEligible = mode === "tablet"
    && width - 28 >= tabletPairingStage.width
    && height - 124 >= tabletPairingStage.height
    && (width - 42) / 2 >= tabletPairingStage.paneMinWidth;

  return {
    coarsePointer,
    compactWindows: mode !== "computer",
    height,
    hover,
    mode,
    pairingEligible,
    stage: tabletPairingStage,
    width,
  };
}

export function capabilitiesForWindow(target: Window = window): DeviceCapabilities {
  const canMatchMedia = typeof target.matchMedia === "function";
  return capabilitiesForViewport({
    coarsePointer: canMatchMedia ? target.matchMedia("(pointer: coarse)").matches : false,
    height: target.innerHeight,
    hover: canMatchMedia ? target.matchMedia("(hover: hover)").matches : true,
    width: target.innerWidth,
  });
}
