import { describe, it, expect } from "vitest";
import { buildProofReport } from "@/lib/proof-report";

const now = new Date("2026-10-21T12:00:00Z");
const wf = (id: string) => ({ id, name: `WF ${id}`, platform: "n8n", description: "", createdAt: "", updatedAt: "" });
const ev = (id: string, workflowId: string, daysAgo: number) => ({ id, workflowId, executionId: id, timestamp: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), platform: "n8n", status: "success" as const, data: {}, metadata: {}, createdAt: "" });
const ct = (id: string, workflowId: string, system = "airtable") => ({ id, workflowId, name: id, type: "record_exists" as const, system, entity: "x", configuration: {}, severity: "high" as const, enabled: true, createdAt: "", updatedAt: "" });
const inc = (id: string, eventId: string, workflowId: string, type: any, status: "open" | "resolved" = "open") => ({ id, workflowId, eventId, contractId: "c1", type, severity: "high" as const, status, title: `T ${id}`, summary: "", expected: "", observed: "secret value", evidence: ["secret evidence"], impact: "", recommendedAction: "", detectedAt: now.toISOString(), resolvedAt: status === "resolved" ? now.toISOString() : null, createdAt: "" });

describe("buildProofReport", () => {
  const base = { workflows: [wf("a"), wf("b")], contracts: [ct("c1", "a"), ct("c2", "b", "reported")], now, days: 30 };

  it("counts verified, failed and unknown per check", () => {
    const events = [ev("e1", "a", 1), ev("e2", "a", 2), ev("e3", "a", 3), ev("e4", "b", 1)];
    const incidents = [inc("i1", "e1", "a", "silent_failure"), inc("i2", "e2", "a", "verification_error", "resolved")];
    const r = buildProofReport({ ...base, events, incidents });
    expect(r.totals).toMatchObject({ runs: 4, checks: 4, verified: 2, failed: 1, unknown: 1, fixed: 1, open: 1, reportedChecks: 1, rate: 50 });
    expect(r.workflows.find((w) => w.id === "a")).toMatchObject({ runs: 3, verified: 1, failed: 1, unknown: 1 });
  });

  it("ignores events outside the period and outside the selected workflows", () => {
    const events = [ev("old", "a", 40), ev("in", "a", 5), ev("other", "b", 5)];
    const r = buildProofReport({ ...base, events, incidents: [inc("i", "old", "a", "silent_failure")], workflowIds: ["a"] });
    expect(r.totals.runs).toBe(1);
    expect(r.totals.failed).toBe(0);
    expect(r.workflows).toHaveLength(1);
  });

  it("returns a null rate with no checks and never leaks record values", () => {
    const empty = buildProofReport({ ...base, events: [], incidents: [] });
    expect(empty.totals.rate).toBeNull();
    const withFinding = buildProofReport({ ...base, events: [ev("e1", "a", 1)], incidents: [inc("i1", "e1", "a", "silent_failure")] });
    expect(JSON.stringify(withFinding)).not.toContain("secret");
  });
});
