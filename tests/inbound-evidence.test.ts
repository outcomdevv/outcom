import { describe, it, expect, vi, beforeEach } from "vitest";

const events = new Map<string, any>();
const store = {
  workflows: { get: vi.fn(async () => ({ id: "n8n:w1" })) },
  events: {
    getByExecution: vi.fn(async (_w: string, exec: string) => [...events.values()].find(e => e.executionId === exec) ?? null),
    create: vi.fn(async (v: any) => { const e = { id: `ev${events.size + 1}`, createdAt: "", ...v }; events.set(e.id, e); return e; }),
    mergeData: vi.fn(async (id: string, patch: any) => { const e = events.get(id); e.data = { ...e.data, ...patch }; return e; }),
  },
};
const { evaluateEvent } = vi.hoisted(() => ({ evaluateEvent: vi.fn(async () => [{ state: "passed" }]) }));
vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn(async () => store) }));
vi.mock("@/lib/webhooks", () => ({ getInboundWebhookByToken: vi.fn(async () => ({ id: "h1", provider: "n8n", workflow_id: "n8n:w1", workspace_id: "ws1" })), touchInboundWebhook: vi.fn(async () => {}) }));
vi.mock("@/lib/outcome-checker", () => ({ evaluateEvent }));
import { POST } from "@/app/api/inbound/[token]/route";

const TOKEN = "t".repeat(40);
const post = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ token: TOKEN }) });
beforeEach(() => { events.clear(); evaluateEvent.mockClear(); });

describe("inbound webhook with evidence", () => {
  it("stores normalized evidence on a new run and counts a found record as output", async () => {
    const r = await post({ run_id: "r1", evidence: [{ step: "CRM", found: true, fields: { a: 1 } }] });
    expect(r.status).toBe(201);
    const e = [...events.values()][0];
    expect(e.data.evidence.crm.found).toBe(true);
    expect(e.data.output_count).toBe(1);
  });
  it("merges a later step into the same run and judges it again", async () => {
    await post({ run_id: "r2", target_record_id: "a@b.com", evidence: [{ step: "crm", found: true }] });
    evaluateEvent.mockClear();
    const r = await post({ run_id: "r2", evidence: [{ step: "invoice", found: false }] });
    const j = await r.json();
    expect(j).toMatchObject({ duplicate: true, merged: true });
    const e = [...events.values()][0];
    expect(Object.keys(e.data.evidence).sort()).toEqual(["crm", "invoice"]);
    expect(events.size).toBe(1);
    expect(evaluateEvent).toHaveBeenCalledTimes(1);
  });
  it("still ignores a plain duplicate with no evidence", async () => {
    await post({ run_id: "r3", target_record_id: "x" });
    evaluateEvent.mockClear();
    const j = await (await post({ run_id: "r3", target_record_id: "x" })).json();
    expect(j).toMatchObject({ duplicate: true });
    expect(j.merged).toBeUndefined();
    expect(evaluateEvent).not.toHaveBeenCalled();
  });
});
