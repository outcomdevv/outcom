import { describe, it, expect, vi } from "vitest";
import { INTEGRATIONS, getIntegration, inboundSourceIds, isInboundSource, targetIds } from "@/lib/integrations/registry";

vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn() }));
vi.mock("@/lib/adapters/ghl", () => ({ ghlAdapter: vi.fn(async () => ({ tag: "ghl" })) }));
import { adapterFor, hasAdapter, registerAdapter } from "@/lib/adapters/registry";

describe("integration registry", () => {
  it("has unique ids and valid shapes", () => {
    const ids = INTEGRATIONS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of INTEGRATIONS) { expect(i.id).toMatch(/^[a-z][a-z0-9_]{1,31}$/); expect(i.roles.length).toBeGreaterThan(0); }
  });
  it("covers the core platforms", () => {
    for (const id of ["zapier", "make", "n8n", "ghl"]) expect(getIntegration(id)).not.toBeNull();
  });
  it("accepts webhook sources and rejects targets and unknowns", () => {
    for (const id of ["zapier", "make", "pipedream", "custom"]) expect(isInboundSource(id)).toBe(true);
    for (const id of ["ghl", "stripe", "nope", "", "__proto__"]) expect(isInboundSource(id)).toBe(false);
    expect(inboundSourceIds()).toContain("custom");
  });
  it("only claims live/code_complete for targets that have an adapter", () => {
    for (const id of targetIds()) {
      const i = getIntegration(id)!;
      if (i.status === "live" || i.status === "code_complete") expect(hasAdapter(id)).toBe(true);
    }
  });
  it("target verification claims are honest: planned targets have no adapter", () => {
    for (const id of targetIds()) if (getIntegration(id)!.status === "planned") expect(hasAdapter(id)).toBe(false);
  });
});

describe("adapter registry", () => {
  it("resolves ghl and mock_crm, rejects unknown", async () => {
    expect(await adapterFor("ghl", "ws")).toEqual({ tag: "ghl" });
    expect(await adapterFor("mock_crm")).toBeTruthy();
    await expect(adapterFor("hubspot")).rejects.toThrow(/Unsupported downstream/);
  });
  it("registerAdapter makes a new system available", async () => {
    registerAdapter("test_sys", () => ({ tag: "t" }) as any);
    expect(await adapterFor("test_sys")).toEqual({ tag: "t" });
  });
});
