import { describe, it, expect, vi, beforeEach } from "vitest";

const created: any[] = [];
const store = {
  workspaceId: "ws1",
  workflows: { get: vi.fn(async () => null), create: vi.fn(async (w: any) => w) },
  contracts: { list: vi.fn(async () => []), create: vi.fn(async (c: any) => { created.push(c); return c; }) },
  monitors: { upsert: vi.fn(async () => ({})) },
};
vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn(async () => store) }));
import { POST } from "@/app/api/integrations/protect/route";

const sheet = { spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz", sheetName: "Leads", keyColumn: "Email", spreadsheetName: "CRM" };
const call = (body: unknown) => POST(new Request("http://x/api/integrations/protect", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { created.length = 0; });

describe("POST /api/integrations/protect", () => {
  it("creates Google Sheets contracts with the chosen target (no HighLevel needed)", async () => {
    const r = await call({ provider: "n8n", externalId: "w1", name: "Lead sync", expectedOutcomes: [
      { label: "Row exists", type: "record_exists", system: "google_sheets", target: sheet },
      { label: "Status is Qualified", type: "state_invariant", system: "google_sheets", target: sheet, field: "Status", operator: "equals", expectedValue: "Qualified" },
      { label: "Produced output", type: "output_count", operator: "greater_than", expectedCount: 0 },
    ] });
    const j = await r.json();
    expect(j.protected).toBe(true);
    const [exists, inv, out] = created;
    expect(exists).toMatchObject({ system: "google_sheets", entity: "row", configuration: { target: { spreadsheetId: sheet.spreadsheetId, keyColumn: "Email" } } });
    expect(inv).toMatchObject({ system: "google_sheets", configuration: { mode: "field_condition", field: "Status", expectedValue: "Qualified" } });
    expect(out).toMatchObject({ system: "event", type: "output_count" });
  });
  it("rejects a Sheets outcome with no target", async () => {
    const r = await call({ provider: "zapier", externalId: "w", name: "n", expectedOutcomes: [{ label: "x", type: "record_exists", system: "google_sheets" }] });
    expect(r.status).toBe(400);
    expect(created).toHaveLength(0);
  });
  it("allows output-only protection with no business system", async () => {
    const r = await call({ provider: "custom", externalId: "w", name: "n", expectedOutcomes: [{ label: "Output", type: "output_count" }] });
    expect((await r.json()).protected).toBe(true);
    expect(created[0].system).toBe("event");
  });
  it("still defaults to HighLevel when the client sends no system (backward compatible)", async () => {
    await call({ provider: "zapier", externalId: "w", name: "n", expectedOutcomes: [{ label: "Exists", type: "record_exists" }] });
    expect(created[0]).toMatchObject({ system: "ghl", entity: "contact" });
  });
  it("rejects unknown platforms and unknown systems fall back safely", async () => {
    expect((await call({ provider: "nope", externalId: "w", name: "n" })).status).toBe(400);
    await call({ provider: "zapier", externalId: "w2", name: "n", expectedOutcomes: [{ label: "A", type: "record_exists", system: "evil" }] });
    expect(created[0].system).toBe("ghl");
  });
});

describe("custom value checks from the Connect page", () => {
  it("become enforced field conditions on the chosen sheet", async () => {
    const { toPayload, updateCheck, newCheck } = await import("@/lib/connect-checks");
    const c = updateCheck(newCheck("value", "v1"), { field: "Status", operator: "equals", expectedValue: "Qualified" }, { system: "google_sheets", tab: "Leads" });
    created.length = 0;
    const r = await call({ provider: "n8n", externalId: "manual-1", name: "Lead sync", expectedOutcomes: [toPayload(c, "google_sheets", sheet, "Leads")] });
    expect((await r.json()).protected).toBe(true);
    expect(created[0]).toMatchObject({ name: 'Status is "Qualified"', type: "state_invariant", system: "google_sheets", configuration: { mode: "field_condition", field: "Status", operator: "equals", expectedValue: "Qualified", target: { sheetName: "Leads", keyColumn: "Email" } } });
  });
});
