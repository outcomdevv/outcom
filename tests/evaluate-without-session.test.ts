import { describe, expect, it, vi } from "vitest";

// A webhook call has no logged-in user. The checker must use the workspace it is given and never ask for a session.
const calls: Array<string | undefined> = [];
vi.mock("@/lib/db", () => ({
  getWorkspaceStore: async (workspaceId?: string) => {
    calls.push(workspaceId);
    if (!workspaceId) throw new Error("AUTH_REQUIRED");
    return {
      workspaceId,
      contracts: { list: async () => [{ id: "c1", workflowId: "w1", name: "Output", type: "output_count", system: "event", entity: "output", configuration: { valueFrom: "event.data.output_count", expected: { operator: "greater_than", value: 0 } }, severity: "high", enabled: true }] },
      incidents: { getFor: async () => null, create: async () => ({}), resolve: async () => ({}), reopen: async () => ({}) },
    };
  },
}));

import { evaluateEvent } from "@/lib/outcome-checker";

const event: any = { id: "e1", workflowId: "w1", executionId: "x1", timestamp: new Date().toISOString(), platform: "n8n", status: "success", data: { output_count: 1, workspace_id: "ws_1" }, metadata: {} };

describe("evaluateEvent without a session", () => {
  it("uses the workspace passed by the webhook", async () => {
    const results = await evaluateEvent(event, "ws_1");
    expect(results[0].state).toBe("passed");
    expect(calls.every(c => c === "ws_1")).toBe(true);
  });
  it("falls back to the workspace stored on the event (cron monitors)", async () => {
    const results = await evaluateEvent(event);
    expect(results[0].state).toBe("passed");
  });
});
