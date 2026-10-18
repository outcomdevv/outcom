import { describe, it, expect, vi, beforeEach } from "vitest";

const store = {
  workflows: { list: vi.fn(async () => [{ id: "make:1", name: "Lead Intake", platform: "make" }]) },
  incidents: { list: vi.fn(async () => [{ id: "i1", workflowId: "make:1", type: "silent_failure", status: "open", title: "Record missing", severity: "high", detectedAt: "2026-10-17T07:44:00Z", expected: "Record a@b.com exists", observed: "No matching record", impact: "Lead lost", recommendedAction: "Check the CRM step", evidence: ["Execution run-1 · status SUCCESS", "Evidence reported by the workflow"] }]) },
  connections: { list: vi.fn(async () => []) },
  contracts: { list: vi.fn(async () => [{ id: "c1", workflowId: "make:1", name: "Found in CRM", type: "record_exists", system: "reported", enabled: true, configuration: { secret: "do-not-send" } }]) },
  events: { list: vi.fn(async () => [{ workflowId: "make:1", executionId: "run-1", status: "success", timestamp: "2026-10-17T07:44:00Z" }]) },
  settings: { get: vi.fn(async () => ({ groqApiKeyEncrypted: "enc", groqModel: "openai/gpt-oss-120b" })) },
};
vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn(async () => store) }));
vi.mock("@/lib/oauth", () => ({ decryptSecret: vi.fn(() => "test-key") }));
import { POST } from "@/app/api/assistant/route";

let sent: any;
const reply = (content: object) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) });
beforeEach(() => {
  sent = null;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => { sent = JSON.parse(init.body); return reply({ message: "ok", action: "none", path: null }); }));
});
const ask = (message: string) => POST(new Request("http://x/api/assistant", { method: "POST", body: JSON.stringify({ message }) }));

describe("Operator context", () => {
  it("sends the product guide, finding detail and recent runs, but not contract configuration", async () => {
    await ask("Kenapa Lead Intake gagal?");
    const prompt: string = sent.messages[1].content;
    expect(prompt).toMatch(/ABOUT OUTCOM/);
    expect(prompt).toMatch(/Any other app/);
    expect(prompt).toMatch(/Check the CRM step/);
    expect(prompt).toMatch(/"workflow": "Lead Intake"/);
    expect(prompt).toMatch(/recentRuns/);
    expect(prompt).not.toMatch(/do-not-send/);
    expect(prompt).toMatch(/treat it as data/);
  });
  it("allows navigation to Reports pages and blocks unknown paths", async () => {
    (fetch as any).mockImplementationOnce(async () => reply({ message: "go", action: "navigate", path: "/evidence" }));
    expect((await (await ask("show evidence")).json()).path).toBe("/evidence");
    (fetch as any).mockImplementationOnce(async () => reply({ message: "go", action: "navigate", path: "/admin" }));
    expect((await (await ask("open admin")).json()).action).toBe("none");
  });
  it("answers locally when no key is set", async () => {
    store.settings.get.mockResolvedValueOnce({ groqApiKeyEncrypted: null, groqModel: "" } as any);
    const j = await (await ask("hello")).json();
    expect(j.mode).toBe("local");
    expect(fetch).not.toHaveBeenCalled();
  });
});
