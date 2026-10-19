import { describe, expect, it } from "vitest";
import { alertFor, DEGRADED_AFTER_MS, firing, naiveTally, naiveView, runUptime, verdictOf, type RegionView } from "./uptime";
import { projectScenario } from "./scenarios";

const view = (state: RegionView["state"], slow = false): RegionView => ({ region: "lab-a", state, slow, reason: "ok", latencyMs: 200, stale: false, reporting: true });

describe("uptime (iYup's agents, verdict and alert rules)", () => {
  it("decides the verdict by majority of fresh regions, with a tie counting as up (snapshot.py target_status)", () => {
    expect(verdictOf([view("down"), view("down")])).toBe("down");
    expect(verdictOf([view("up"), view("down")])).toBe("up");
    expect(verdictOf([view("up", true), view("up", true)])).toBe("slow");
    expect(verdictOf([view("up", true), view("up")])).toBe("up");
    expect(verdictOf([view("unknown"), view("unknown")])).toBe("unknown");
    expect(verdictOf([view("unknown"), view("down")])).toBe("down");
  });

  it("marks a check slow against the page's own limit and fires TargetSlow only after five minutes of it", () => {
    const ticks = runUptime({ page: "slow", scope: "both", agent: "reporting" }, 12);
    expect(ticks[0].views.every((item) => item.slow && (item.latencyMs ?? 0) > DEGRADED_AFTER_MS)).toBe(true);
    expect(ticks[0].headline).toBe("Yup… mostly.");
    expect(ticks.findIndex((tick) => firing(tick).some((alert) => alert.name === "TargetSlow"))).toBe(alertFor.TargetSlow - 1);
  });

  it("pages TargetDown after a minute down in both regions, and mutes the slow and regional alerts while it fires", () => {
    const ticks = runUptime({ page: "error", scope: "both", agent: "reporting" }, 12);
    expect(ticks.at(-1)!).toMatchObject({ verdict: "down", headline: "Nope." });
    expect(ticks.findIndex((tick) => firing(tick).some((alert) => alert.name === "TargetDown"))).toBe(alertFor.TargetDown - 1);
    expect(firing(ticks.at(-1)!).map((alert) => alert.name)).toEqual(["TargetDown"]);
  });

  it("keeps a failure seen from one region a warning, not an outage", () => {
    const last = runUptime({ page: "error", scope: "lab-b", agent: "reporting" }, 12).at(-1)!;
    expect(last.verdict).toBe("up");
    expect(firing(last).map((alert) => alert.name)).toEqual(["TargetRegionalFailure"]);
    expect(last.views.find((item) => item.region === "lab-b")).toMatchObject({ state: "down", reason: "http_5xx" });
  });

  it("treats a silent agent's region as unknown, never down, and decides from the region that reports", () => {
    const ticks = runUptime({ page: "quick", scope: "both", agent: "stopped" }, 6);
    const last = ticks.at(-1)!;
    expect(last.views.find((item) => item.region === "lab-b")!.state).toBe("unknown");
    expect(last.verdict).toBe("up");
    expect(ticks.findIndex((tick) => firing(tick).some((alert) => alert.name === "PingAgentDown"))).toBe(alertFor.PingAgentDown - 1);
  });

  it("shows, beside it, what a health-only monitor in one region would have said", () => {
    expect(naiveView(runUptime({ page: "slow", scope: "both", agent: "reporting" }, 1)[0])).toMatchObject({ says: "up", pages: false });
    expect(naiveTally(runUptime({ page: "error", scope: "lab-b", agent: "reporting" }, 4)).falsePages).toBe(4);
    expect(naiveTally(runUptime({ page: "quick", scope: "both", agent: "stopped" }, 3)).missingAsDown).toBe(3);
    expect(projectScenario("iyup", {}, "designed").find((node) => node.id === "alert")?.value).toBe("TargetSlow · NOTIFY");
    expect(projectScenario("iyup", {}, "baseline").find((node) => node.id === "alert")?.value).toBe("SAYS UP WHILE SLOW");
    expect(projectScenario("iyup", { page: "error", scope: "lab-b" }, "baseline").find((node) => node.id === "alert")?.value).toBe("FALSE PAGE");
  });
});
