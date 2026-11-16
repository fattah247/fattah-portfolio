import { describe, expect, it } from "vitest";
import { deviceProofFor, TRUSTGATE_REPO, trustgateCodeLink } from "./device-proof";
import { assessDevice } from "./device-risk";
import { codeLink, REPO_AT } from "./pay-rounds";
import { runUptime } from "./uptime";
import { iyupCodeLink, IYUP_REPO, uptimeProofFor } from "./uptime-proof";

describe("repo proofs", () => {
  it("link every case repo at a fixed commit, so the cited lines cannot move", () => {
    for (const base of [REPO_AT, TRUSTGATE_REPO, IYUP_REPO]) expect(base).toMatch(/\/blob\/[0-9a-f]{40}$/);
    expect(codeLink("a.java", 3, 5)).toBe(`${REPO_AT}/a.java#L3-L5`);
    expect(trustgateCodeLink("a.kt", 7)).toBe(`${TRUSTGATE_REPO}/a.kt#L7`);
    expect(iyupCodeLink("a.go", 1, 2)).toBe(`${IYUP_REPO}/a.go#L1-L2`);
  });

  it("quote TrustGate's backend scorer and gate, and the phone's re-check only when a payment is confirmed", () => {
    const files = (proof: ReturnType<typeof deviceProofFor>) => proof.code.map((excerpt) => excerpt.file.split("/").pop());
    expect(files(deviceProofFor(assessDevice({})))).toEqual(["RiskScorer.kt", "SensitiveActionGate.kt"]);
    expect(files(deviceProofFor(assessDevice({ test_keys: "found" })))).toEqual(["RiskScorer.kt", "SensitiveActionGate.kt", "ReferenceBackend.kt", "TrustGateViewModel.kt"]);
  });

  it("quote iYup's slow rule only for the slow page", () => {
    const slow = runUptime({ page: "slow", scope: "both", agent: "reporting" }, 12).at(-1)!;
    const quick = runUptime({ page: "quick", scope: "both", agent: "reporting" }, 12).at(-1)!;
    const lines = (proof: ReturnType<typeof uptimeProofFor>) => proof.code.flatMap((excerpt) => excerpt.lines).join("\n");
    expect(lines(uptimeProofFor({ page: "slow", scope: "both", agent: "reporting" }, slow))).toContain("res.Degraded =");
    expect(lines(uptimeProofFor({ page: "quick", scope: "both", agent: "reporting" }, quick))).not.toContain("res.Degraded =");
  });
});
