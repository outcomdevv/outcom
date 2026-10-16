import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn() }));
vi.mock("@/lib/adapters/registry", () => ({ adapterFor: vi.fn(async () => { throw new Error("must not be called for reported evidence"); }) }));
import { checkOutcome } from "@/lib/outcome-checker";

const contract = (over: any = {}): any => ({ id: "c1", workflowId: "w", name: "Found in CRM", type: "record_exists", system: "reported", entity: "evidence", severity: "high", enabled: true, configuration: { target: { step: "crm" }, lookup: { valueFrom: "event.data.target_record_id" } }, ...over });
const event = (evidence: any, extra: any = {}): any => ({ id: "e1", workflowId: "w", executionId: "run-1", timestamp: new Date().toISOString(), platform: "n8n", status: "success", metadata: {}, data: { target_record_id: "a@b.com", evidence, ...extra } });

describe("checkOutcome with reported evidence", () => {
  it("PASS when the step reported the record, and labels the evidence as reported", async () => {
    const r = await checkOutcome(event({ crm: { step: "crm", found: true, key: "a@b.com", fields: {} } }), contract());
    expect(r.state).toBe("passed");
    expect(r.evidence.join(" ")).toMatch(/reported by the workflow/i);
    expect(r.evidence.join(" ")).toMatch(/not independently verified/i);
  });
  it("FAIL when the step reported that the record is missing", async () => {
    const r = await checkOutcome(event({ crm: { step: "crm", found: false, fields: {} } }), contract());
    expect(r.state).toBe("failed");
  });
  it("UNKNOWN (verification_error) when the step never reported", async () => {
    const r = await checkOutcome(event({}), contract());
    expect(r.state).toBe("verification_error");
    expect(r.evidence.join(" ")).toMatch(/No evidence has been reported for step "crm"/);
    expect(r.recommendedAction).toMatch(/Always Output Data/);
  });
  it("checks a reported value", async () => {
    const cfg = { target: { step: "crm" }, mode: "field_condition", field: "Status", operator: "equals", expectedValue: "Qualified", lookup: { valueFrom: "event.data.target_record_id" } };
    const ok = await checkOutcome(event({ crm: { step: "crm", found: true, fields: { Status: "Qualified" } } }), contract({ type: "state_invariant", configuration: cfg }));
    const bad = await checkOutcome(event({ crm: { step: "crm", found: true, fields: { Status: "Lost" } } }), contract({ type: "state_invariant", configuration: cfg }));
    expect(ok.state).toBe("passed");
    expect(bad.state).toBe("failed");
  });
  it("judges each step on its own, so the broken link is named", async () => {
    const ev = { crm: { step: "crm", found: true, fields: {} }, invoice: { step: "invoice", found: false, fields: {} } };
    const crm = await checkOutcome(event(ev), contract());
    const invoice = await checkOutcome(event(ev), contract({ id: "c2", name: "Invoice created", configuration: { target: { step: "invoice" } } }));
    expect(crm.state).toBe("passed");
    expect(invoice.state).toBe("failed");
    expect(invoice.evidence.join(" ")).toMatch(/step "invoice"/);
  });
});
