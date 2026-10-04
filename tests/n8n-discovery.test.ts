import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/n8n", () => ({ getValidN8nApiKey: vi.fn(async () => ({ baseUrl: "https://n8n.test/", apiKey: "k" })) }));
import { listN8nWorkflows } from "@/lib/adapters/n8n";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
const wf = (id: string, active: boolean) => ({ id, name: `WF ${id}`, active });

describe("listN8nWorkflows", () => {
  it("follows nextCursor, includes inactive workflows, sends the API key", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ data: [wf("1", true), wf("2", false)], nextCursor: "c2" }))
      .mockResolvedValueOnce(json({ data: [wf("3", true)], nextCursor: null }));
    const r = await listN8nWorkflows(f as any);
    expect(r.items.map(i => [i.id, i.active])).toEqual([["1", true], ["2", false], ["3", true]]);
    expect(r.partial).toBe(false);
    const u1 = new URL(String((f.mock.calls[0] as any)[0])); const u2 = new URL(String((f.mock.calls[1] as any)[0]));
    expect(u1.searchParams.has("active")).toBe(false);
    expect(u2.searchParams.get("cursor")).toBe("c2");
    expect((f.mock.calls[0] as any)[1].headers["X-N8N-API-KEY"]).toBe("k");
  });
  it("explains a rejected key", async () => {
    await expect(listN8nWorkflows((async () => json({}, 401)) as any)).rejects.toThrow(/rejected the API key/);
  });
  it("returns partial results if a later page fails", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ data: [wf("1", true)], nextCursor: "c" })).mockResolvedValueOnce(json({}, 500));
    const r = await listN8nWorkflows(f as any);
    expect(r.items).toHaveLength(1); expect(r.partial).toBe(true);
  });
});
