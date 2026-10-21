import { describe, it, expect, vi, beforeEach } from "vitest";

const { inbound } = vi.hoisted(() => ({ inbound: vi.fn() }));
vi.mock("@/app/api/inbound/[token]/route", () => ({ POST: inbound }));
import { POST, GET } from "@/app/api/mcp/[token]/route";
import { verdictText, validateVerifyArgs } from "@/lib/mcp";
import { normalizeEvidence } from "@/lib/evidence";

const TOKEN = "t".repeat(40);
const rpc = (body: unknown, token = TOKEN) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ token }) });
const call = (args: unknown) => rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "verify_outcome", arguments: args } });
beforeEach(() => inbound.mockReset());

describe("MCP endpoint", () => {
  it("initializes and lists the verify_outcome tool", async () => {
    const init = await (await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })).json();
    expect(init.result.protocolVersion).toBe("2025-06-18");
    expect(init.result.capabilities.tools).toBeDefined();
    const list = await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
    expect(list.result.tools[0].name).toBe("verify_outcome");
  });
  it("answers notifications with 202 and no body", async () => {
    expect((await rpc({ jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
  });
  it("sends evidence through the inbound pipeline and returns PASS", async () => {
    inbound.mockResolvedValueOnce(Response.json({ ok: true, results: [{ state: "passed" }] }, { status: 201 }));
    const j = await (await call({ step: "crm", found: true, key: "a@b.com", fields: { status: "qualified" }, run_id: "r1" })).json();
    expect(j.result.content[0].text).toMatch(/^PASS/);
    expect(j.result.structuredContent).toEqual({ verdict: "PASS", run_id: "r1" });
    const sent = JSON.parse(await (inbound.mock.calls[0][0] as Request).text());
    expect(sent).toMatchObject({ run_id: "r1", target_record_id: "a@b.com", evidence: [{ step: "crm", found: true, key: "a@b.com" }] });
  });
  it("returns FAIL with expected and observed when the record is missing", async () => {
    inbound.mockResolvedValueOnce(Response.json({ ok: true, results: [{ state: "failed", title: "Record missing", expected: "Record exists", observed: "No record" }] }, { status: 201 }));
    const j = await (await call({ step: "crm", found: false })).json();
    expect(j.result.content[0].text).toMatch(/^FAIL.*Record missing/);
  });
  it("tells the agent when the address is invalid and rejects bad arguments", async () => {
    inbound.mockResolvedValueOnce(Response.json({ error: "Webhook not found" }, { status: 404 }));
    expect((await (await call({ step: "crm", found: true })).json()).result.isError).toBe(true);
    const bad = await (await call({ found: true })).json();
    expect(bad.result.isError).toBe(true);
    expect(inbound).toHaveBeenCalledTimes(1);
  });
  it("rejects short tokens, unknown methods and GET", async () => {
    expect((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "short")).status).toBe(404);
    expect((await (await rpc({ jsonrpc: "2.0", id: 1, method: "nope" })).json()).error.code).toBe(-32601);
    expect((await GET()).status).toBe(405);
  });
});

describe("verdictText and args", () => {
  it("never calls a run PASS when nothing was checked or something is unknown", () => {
    expect(verdictText([]).verdict).toBe("NO_CHECKS");
    expect(verdictText([{ state: "passed" }, { state: "verification_error", recommendedAction: "Report the step." }]).verdict).toBe("UNKNOWN");
  });
  it("generates a run_id when none is given", () => {
    const v = validateVerifyArgs({ step: "x", found: false });
    expect(v.ok && typeof v.body.run_id === "string").toBe(true);
  });
});

describe("evidence redaction", () => {
  it("masks secret-looking fields but keeps normal ones", () => {
    const out = normalizeEvidence({ evidence: [{ step: "a", found: true, fields: { status: "ok", api_key: "sk-123", Password: "x" } }] });
    expect(out.a.fields).toEqual({ status: "ok", api_key: "[redacted]", Password: "[redacted]" });
  });
});
