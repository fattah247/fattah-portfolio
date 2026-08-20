"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

const analyticsSampleRate = 0.25;
const analyticsSampleKey = "fattah.analytics.sample.v1";
const subscribeToPrivacyState = () => () => {};

type PrivacyNavigator = Navigator & {
  globalPrivacyControl?: boolean;
};

type PrivacyWindow = Window & {
  doNotTrack?: string | null;
};

function privacySignalEnabled() {
  const privacyNavigator = navigator as PrivacyNavigator;
  const privacyWindow = window as PrivacyWindow;
  return privacyNavigator.doNotTrack === "1"
    || privacyNavigator.globalPrivacyControl === true
    || privacyWindow.doNotTrack === "1";
}

function sampledForThisSession() {
  try {
    const storedDecision = window.sessionStorage.getItem(analyticsSampleKey);
    if (storedDecision !== null) return storedDecision === "1";

    const randomValue = new Uint32Array(1);
    window.crypto.getRandomValues(randomValue);
    const sampled = randomValue[0] / 2 ** 32 < analyticsSampleRate;
    window.sessionStorage.setItem(analyticsSampleKey, sampled ? "1" : "0");
    return sampled;
  } catch {
    return false;
  }
}

export function limitAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;

  try {
    const url = new URL(event.url, window.location.origin);
    url.hash = "";
    url.search = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export function LimitedAnalytics({ production }: { production: boolean }) {
  const getClientSnapshot = useCallback(
    () => production && !privacySignalEnabled() && sampledForThisSession(),
    [production],
  );
  const enabled = useSyncExternalStore(subscribeToPrivacyState, getClientSnapshot, () => false);

  if (!enabled) return null;

  return (
    <Analytics
      beforeSend={limitAnalyticsEvent}
      debug={false}
      mode="production"
    />
  );
}
