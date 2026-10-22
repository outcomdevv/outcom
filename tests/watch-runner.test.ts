import { describe, it, expect, vi, beforeEach } from "vitest";

const incidents: any[] = [];
const patch = vi.fn(async () => null);
let contracts: any[] = [];
let events: any[] = [];
const store = {
  workflows: { list: vi.fn(async () => [{ id: "w", name: "Form" }, { id: "o", name: "CRM" }]) },
  contracts: { list: vi.fn(async () => contracts), patchConfiguration: patch },
  events: { since: vi.fn(async (id: string) => (id === "w" ? events : [])) },
  incidents: {
    getFor: vi.fn(async (eventId: string, contractId: string) => incidents.find((i) => i.eventId === eventId && i.contractId === contractId) ?? null),
    create: vi.fn(async (v: any) => { incidents.push({ id: `i${incidents.length}`, status: "open", ...v }); }),
    reopen: vi.fn(async (id: string) => { incidents.find((i) => i.id === id).status = "open"; }),
    resolve: vi.fn(async (id: string) => { incidents.find((i) => i.id === id).status = "resolved"; }),
  },
};
vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn(async () => store) }));
import { runWatches } from "@/lib/watch-runner";

const hb = (over: any = {}) => ({ id: "c1", workflowId: "w", name: "Runs arrive", type: "state_invariant", system: "event", entity: "watch", severity: "high", enabled: true, createdAt: "2026-09-01T00:00:00Z", updatedAt: "", configuration: { mode: "watch_heartbeat", windowHours: 24, minRuns: 1 }, ...over });
beforeEach(() => { incidents.length = 0; patch.mockClear(); events = []; contracts = [hb()]; });

describe("runWatches", () => {
  it("opens one finding for a silent trigger, does not duplicate it, and closes it when runs return", async () => {
    expect((await runWatches("ws"))[0].state).toBe("failed");
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({ eventId: "watch:c1", type: "silent_failure", status: "open" });
    await runWatches("ws");
    expect(incidents).toHaveLength(1);
    events = [{ id: "e", workflowId: "w", executionId: "x", timestamp: new Date().toISOString(), data: {} }];
    expect((await runWatches("ws"))[0].state).toBe("ok");
    expect(incidents[0].status).toBe("resolved");
    events = [];
    await runWatches("ws");
    expect(incidents[0].status).toBe("open");
    expect(incidents).toHaveLength(1);
  });
  it("records when it last checked, ignores paused watches and per-run contracts", async () => {
    contracts = [hb(), hb({ id: "c2", enabled: false }), hb({ id: "c3", configuration: { mode: "field_condition" } })];
    const r = await runWatches("ws");
    expect(r.map((x) => x.contractId)).toEqual(["c1"]);
    expect(patch).toHaveBeenCalledWith("c1", expect.objectContaining({ lastState: "failed" }));
  });
});
