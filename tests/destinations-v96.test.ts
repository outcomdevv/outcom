import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn() }));
vi.mock("@/lib/adapters/registry", () => ({ adapterFor: vi.fn(async () => { throw new Error("not used"); }) }));
import { DESTINATION_APPS, cleanApp, destinationApp } from "@/lib/destination-apps";
import { INTEGRATIONS, isInboundSource, getIntegration } from "@/lib/integrations/registry";
import { HTTP_TOOLS, guideFor } from "@/lib/connect-guide";
import { checkOutcome } from "@/lib/outcome-checker";

describe("destination apps", () => {
  it("has unique ids, a lookup hint each, and only accepts known ids", () => {
    const ids = DESTINATION_APPS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of DESTINATION_APPS) { expect(a.lookup.length).toBeGreaterThan(5); expect(a.label).toBeTruthy(); }
    expect(cleanApp("notion")).toBe("notion");
    expect(cleanApp("<script>")).toBeNull();
    expect(cleanApp(undefined)).toBeNull();
    expect(destinationApp("slack")?.label).toBe("Slack");
  });
  it("covers the common destinations from the market research", () => {
    for (const id of ["salesforce", "notion", "coda", "slack", "teams", "postgres", "mongodb", "google_drive", "dropbox", "stripe"]) expect(destinationApp(id)).not.toBeNull();
  });
  it("every destination app is in the registry as a reported target without an adapter claim", () => {
    for (const a of DESTINATION_APPS.filter(x => x.id !== "other")) {
      const i = getIntegration(a.id);
      expect(i, a.id).not.toBeNull();
      expect(i!.roles).toContain("target");
      expect(i!.status).toBe("reported");
    }
  });
});

describe("automation sources", () => {
  it("every HTTP tool is a registered inbound source with its own guide", () => {
    for (const [id, t] of Object.entries(HTTP_TOOLS)) {
      expect(isInboundSource(id), id).toBe(true);
      const g = guideFor(id);
      expect(g.tool).toBe(t.label);
      expect(g.steps[0]).toBe(t.first);
      expect(g.steps.join(" ")).toMatch(/target_record_id/);
    }
  });
  it("includes the AI agent builders", () => {
    for (const id of ["gumloop", "relevance_ai", "lindy", "stack_ai", "vellum", "uipath", "airtable_automations"]) expect(isInboundSource(id)).toBe(true);
  });
  it("registry ids stay valid", () => {
    for (const i of INTEGRATIONS) expect(i.id).toMatch(/^[a-z][a-z0-9_]{1,31}$/);
  });
});

describe("evidence label names the app", () => {
  const contract = (app?: string): any => ({ id: "c", workflowId: "w", name: "x", type: "record_exists", system: "reported", entity: "evidence", severity: "high", enabled: true, configuration: { target: { step: "crm", ...(app ? { app } : {}) }, lookup: { valueFrom: "event.data.target_record_id" } } });
  const event: any = { id: "e", workflowId: "w", executionId: "r", timestamp: new Date().toISOString(), platform: "n8n", status: "success", metadata: {}, data: { target_record_id: "a@b.com", evidence: { crm: { step: "crm", found: true, fields: {} } } } };
  it("shows the app when chosen and nothing extra otherwise", async () => {
    expect((await checkOutcome(event, contract("notion"))).evidence.join(" ")).toMatch(/reported by the workflow · Notion · step "crm"/);
    expect((await checkOutcome(event, contract())).evidence.join(" ")).toMatch(/reported by the workflow · step "crm"/);
  });
});
