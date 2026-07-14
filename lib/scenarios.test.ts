import { describe, expect, it } from "vitest";
import { projectScenario, scenarios } from "./scenarios";

describe("selected work scenario contracts", () => {
  it("keeps every project and both evidence entries available", () => {
    expect(scenarios.map((scenario) => scenario.slug)).toEqual(["payflow", "iyup", "trustgate"]);
    for (const scenario of scenarios) {
      expect(scenario.evidence).toHaveLength(2);
      expect(scenario.evidence.every((item) => item.src.startsWith(`/projects/${scenario.slug}/`))).toBe(true);
    }
  });

  it("does not describe a failed health contract as quiet", () => {
    const projection = projectScenario("iyup", {
      health: "fail",
      latency: "normal",
      scrape: "available",
      alert: "absent",
    }, "designed");
    const decision = projection.find((node) => node.id === "decision");

    expect(decision?.value).toBe("INCOMPLETE");
    expect(decision?.detail).toContain("unavailable");
  });

  it("keeps a suspicious device signal visible when a low-risk action is allowed", () => {
    const projection = projectScenario("trustgate", {
      root: "suspected",
      emulator: "clear",
      signature: "valid",
      sensitivity: "low",
    }, "designed");

    expect(projection.find((node) => node.id === "environment")?.value).toBe("SUSPICIOUS");
    expect(projection.find((node) => node.id === "decision")?.value).toBe("ALLOW");
  });
});
