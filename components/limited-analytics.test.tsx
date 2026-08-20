import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeforeSendEvent } from "@vercel/analytics/next";
import { LimitedAnalytics, limitAnalyticsEvent } from "./limited-analytics";

vi.mock("@vercel/analytics/next", () => ({
  Analytics: ({ beforeSend, mode }: { beforeSend: (event: BeforeSendEvent) => BeforeSendEvent | null; mode: string }) => (
    <div data-mode={mode} data-testid="limited-analytics" data-pageview={beforeSend({ type: "pageview", url: "https://example.com/projects/demo?ref=email#readme" })?.url} />
  ),
}));

describe("LimitedAnalytics", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: null });
    Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: false });
    Object.defineProperty(window, "doNotTrack", { configurable: true, value: null });
  });

  afterEach(cleanup);

  it("does not load outside the production deployment", async () => {
    window.sessionStorage.setItem("fattah.analytics.sample.v1", "1");
    render(<LimitedAnalytics production={false} />);
    await act(async () => {});
    expect(screen.queryByTestId("limited-analytics")).toBeNull();
  });

  it("honors browser privacy signals even for a sampled session", async () => {
    window.sessionStorage.setItem("fattah.analytics.sample.v1", "1");
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" });
    render(<LimitedAnalytics production />);
    await act(async () => {});
    expect(screen.queryByTestId("limited-analytics")).toBeNull();
  });

  it("sends only sanitized page views for sampled production sessions", async () => {
    window.sessionStorage.setItem("fattah.analytics.sample.v1", "1");
    render(<LimitedAnalytics production />);
    await act(async () => {});

    const analytics = screen.getByTestId("limited-analytics");
    expect(analytics.getAttribute("data-mode")).toBe("production");
    expect(analytics.getAttribute("data-pageview")).toBe("https://example.com/projects/demo");
    expect(limitAnalyticsEvent({ type: "event", url: "https://example.com/" })).toBeNull();
  });
});

