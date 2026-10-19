import { describe, expect, it } from "vitest";
import { projectScenario, resolveScenarioConditions, scenarios } from "./scenarios";

describe("selected work scenario contracts", () => {
  it("keeps every project and its exhibits available, two or four so they fill the evidence grid", () => {
    expect(scenarios.map((scenario) => scenario.slug)).toEqual(["payflow", "iyup", "trustgate"]);
    for (const scenario of scenarios) {
      expect([2, 4]).toContain(scenario.evidence.length);
      expect(new Set(scenario.evidence.map((item) => item.src)).size).toBe(scenario.evidence.length);
      expect(scenario.evidence.every((item) => item.src.startsWith(`/projects/${scenario.slug}/`))).toBe(true);
    }
  });

  it("never calls missing data down: a silent region leaves the verdict to the one that reports", () => {
    const projection = projectScenario("iyup", { page: "quick", scope: "both", agent: "stopped" }, "designed");
    expect(projection.find((node) => node.id === "verdict")?.value).toBe("UP");
    expect(projection.find((node) => node.id === "alert")?.value).toBe("PingAgentDown · NOTIFY");
    // The comparison counts the silence as an outage and pages.
    expect(projectScenario("iyup", { page: "quick", scope: "both", agent: "stopped" }, "baseline").find((node) => node.id === "alert")?.value).toBe("FALSE PAGE");
  });

  it("names the repo's system and a labelled comparison for every case, never an old mode of the repo", () => {
    for (const scenario of scenarios) {
      expect(scenario.designedLabel, scenario.slug).toBeTruthy();
      expect(scenario.baselineLabel, scenario.slug).toMatch(/comparison/);
    }
  });

  it.each(scenarios)("falls back to $slug defaults for missing or invalid condition values", (scenario) => {
    const incomplete = Object.fromEntries(
      scenario.controls.map((control) => [control.key, undefined]),
    ) as unknown as Record<string, string>;
    const invalid = Object.fromEntries(
      scenario.controls.map((control) => [control.key, "stale-session-value"]),
    );

    expect(resolveScenarioConditions(scenario, incomplete)).toEqual(scenario.defaults);
    expect(resolveScenarioConditions(scenario, invalid)).toEqual(scenario.defaults);
    expect(() => projectScenario(scenario.slug, incomplete, "designed")).not.toThrow();
  });

  it("keeps a weak device check visible when the payment is allowed", () => {
    const onlyInstaller = Object.fromEntries(scenarios[2].controls.map((control) => [control.key, control.key === "installer_source_unknown" ? "found" : control.options[0].value]));
    const projection = projectScenario("trustgate", onlyInstaller, "designed");

    expect(projection.find((node) => node.id === "checks")?.value).toBe("1 OF 8 FOUND");
    expect(projection.find((node) => node.id === "level")?.value).toBe("LOW");
    expect(projection.find((node) => node.id === "decision")?.value).toBe("ALLOW");
  });

  it("starts case 03 on the repo's medium-risk test phone, confirmed rather than blocked", () => {
    const projection = projectScenario("trustgate", scenarios[2].defaults, "designed");

    expect(projection.find((node) => node.id === "score")?.value).toBe("3 POINTS");
    expect(projection.find((node) => node.id === "decision")?.value).toBe("REQUIRE CONFIRMATION");
    expect(projection.find((node) => node.id === "signing")?.value).toBe("STEP-UP KEY");
    // The comparison, a gate that blocks on any signal, blocks the same phone outright.
    expect(projectScenario("trustgate", scenarios[2].defaults, "baseline").find((node) => node.id === "decision")?.value).toBe("BLOCK");
  });
});
