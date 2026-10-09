import { describe, it, expect } from "vitest";
import fixture from "./fixtures/n8n-lead-to-sheet.json";
import { suggestChecks } from "@/lib/suggested-checks";

const clone = () => JSON.parse(JSON.stringify(fixture));
const ok = (r: ReturnType<typeof suggestChecks>) => { if (!r.ok) throw new Error(r.error); return r; };

describe("suggestChecks (n8n)", () => {
  it("proposes a high-confidence Sheets check from the last data-writing step, not the email", () => {
    const r = ok(suggestChecks(fixture));
    expect(r.workflowName).toBe("Lead intake → Sheet → email");
    expect(r.trigger?.name).toBe("Webhook");
    const top = r.suggestions[0];
    expect(top.nodeName).toBe("Save lead");
    expect(top.confidence).toBe("high");
    expect(top.supported).toBe(true);
    expect(top.contract).toMatchObject({ type: "record_exists", system: "google_sheets", target: { spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz", spreadsheetName: "CRM", sheetName: "Leads", keyColumn: "Email" } });
    expect(top.recordId).toMatchObject({ field: "email", expression: expect.stringContaining(".item.json.email") });
    expect(top.question).toContain("Leads");
    expect(r.suggestions[1].nodeName).toBe("Welcome email");
  });

  it("warns about steps that continue on error (silent failures)", () => {
    const r = ok(suggestChecks(fixture));
    expect(r.risks).toEqual([expect.objectContaining({ nodeName: "Save lead", kind: "continues_on_error" })]);
  });

  it("accepts a JSON string, an array export and a {data:[...]} wrapper", () => {
    expect(ok(suggestChecks(JSON.stringify(fixture))).suggestions.length).toBeGreaterThan(0);
    expect(ok(suggestChecks([fixture])).suggestions.length).toBeGreaterThan(0);
    expect(ok(suggestChecks({ data: [fixture] })).suggestions.length).toBeGreaterThan(0);
  });

  it("drops to medium/low and lists what is missing when the sheet is chosen by expression", () => {
    const w = clone();
    w.nodes[2].parameters.documentId = { __rl: true, value: "={{ $json.sheet }}", mode: "id" };
    w.nodes[2].parameters.columns.matchingColumns = [];
    const top = ok(suggestChecks(w)).suggestions[0];
    expect(top.confidence).toBe("low");
    expect(top.contract?.target).toBeUndefined();
    expect(top.missing.join(" ")).toMatch(/Spreadsheet is chosen dynamically/);
  });

  it("falls back to the numeric tab id's cached name, and reports when the name is unreadable", () => {
    const w = clone();
    delete w.nodes[2].parameters.sheetName.cachedResultName;
    const top = ok(suggestChecks(w)).suggestions[0];
    expect(top.missing.join(" ")).toMatch(/Tab name could not be read/);
  });

  it("ignores disabled steps and unreachable steps, and flags a disabled writer", () => {
    const w = clone();
    w.nodes[2].disabled = true;
    const r = ok(suggestChecks(w));
    expect(r.suggestions.map(s => s.nodeName)).toEqual(["Welcome email"]);
    expect(r.risks).toEqual([expect.objectContaining({ nodeName: "Save lead", kind: "disabled_step" })]);
    const w2 = clone();
    delete w2.connections["Clean fields"];
    expect(ok(suggestChecks(w2)).suggestions).toEqual([]);
  });

  it("marks unsupported systems honestly instead of faking a check", () => {
    const w = clone();
    w.nodes[2] = { name: "Save lead", type: "n8n-nodes-base.hubspot", position: [440, 0], parameters: {} };
    const top = ok(suggestChecks(w)).suggestions[0];
    expect(top).toMatchObject({ supported: false, contract: null, confidence: "low" });
    expect(top.missing[0]).toMatch(/HubSpot checks are not built yet/);
  });

  it("does not treat the Outcom report step or reads as business writes", () => {
    const w = clone();
    w.nodes.push({ name: "Report", type: "n8n-nodes-base.httpRequest", position: [900, 0], parameters: { method: "POST", url: "https://outcom-six.vercel.app/api/inbound/abc" } });
    w.nodes.push({ name: "Lookup", type: "n8n-nodes-base.googleSheets", position: [1000, 0], parameters: { operation: "read" } });
    w.connections["Welcome email"] = { main: [[{ node: "Report", type: "main", index: 0 }]] };
    w.connections["Report"] = { main: [[{ node: "Lookup", type: "main", index: 0 }]] };
    expect(ok(suggestChecks(w)).suggestions.map(s => s.nodeName)).toEqual(["Save lead", "Welcome email"]);
  });

  it("survives cycles and rejects junk", () => {
    const w = clone();
    w.connections["Welcome email"] = { main: [[{ node: "Clean fields", type: "main", index: 0 }]] };
    expect(ok(suggestChecks(w)).suggestions[0].nodeName).toBe("Save lead");
    expect(suggestChecks("nope").ok).toBe(false);
    expect(suggestChecks({ nodes: [] }).ok).toBe(false);
    expect(suggestChecks(null).ok).toBe(false);
  });
});
