import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { suggestChecks } from "@/lib/suggested-checks";
import { guideFor } from "@/lib/connect-guide";

const raw = readFileSync(new URL("./fixtures/make-webhook-airtable.blueprint.json", import.meta.url), "utf8");
const mapped = () => {
  const bp = JSON.parse(raw);
  bp.flow[1].mapper.record.fldb000BF7Jca96ay = "{{1.name}}";
  bp.flow[1].mapper.record.fldGgzAlTj5giSOuL = "{{1.email}}";
  return bp;
};

describe("Make blueprint reader", () => {
  it("reads the real export: webhook then Airtable create record, flags the unmapped key", () => {
    const r = suggestChecks(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.workflowName).toBe("Webhook to Airtable");
    expect(r.flow.map(f => f.kind)).toEqual(["trigger", "data"]);
    expect(r.flow[1].name).toBe("Create Airtable Record");
    const s = r.suggestions[0];
    expect(s.supported).toBe(true);
    expect(s.contract).toMatchObject({ system: "airtable", type: "record_exists", airtable: { baseId: "appAAZ6ip8r2KslnC", tableId: "tblRus8vhkHkAx33d", tableName: "Table 1", keyField: "" } });
    expect(s.missing.join(" ")).toMatch(/No column is filled/);
    expect(s.confidence).toBe("medium");
  });

  it("uses the Email column filled from the webhook as the key, and keeps the same expression", () => {
    const r = suggestChecks(mapped());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.suggestions[0];
    expect(s.contract?.airtable?.keyField).toBe("Email");
    expect(s.recordId).toMatchObject({ field: "Email", expression: "{{1.email}}" });
    expect(s.confidence).toBe("high");
    expect(s.missing).toEqual([]);
  });

  it("prefills the Make message with that expression", () => {
    expect(guideFor("make").json("Email", "{{1.email}}")).toBe('{"target_record_id": "{{1.email}}"}');
    expect(guideFor("make").json("Email")).toBe('{"target_record_id": ""}');
  });

  it("shows other apps honestly as not read yet instead of guessing", () => {
    const bp = mapped();
    bp.flow.push({ id: 3, module: "slack:ActionPostMessage", version: 1, parameters: {}, mapper: {}, metadata: { designer: { name: "Post a message" } } });
    const r = suggestChecks(bp);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const slack = r.suggestions.find(x => x.nodeType.startsWith("slack:"));
    expect(slack).toMatchObject({ supported: false, contract: null });
    expect(r.suggestions[0].supported).toBe(true);
  });

  it("rejects things that are neither n8n nor Make", () => {
    expect(suggestChecks("{}").ok).toBe(false);
    expect(suggestChecks({ flow: [{ foo: 1 }] }).ok).toBe(false);
  });
});
