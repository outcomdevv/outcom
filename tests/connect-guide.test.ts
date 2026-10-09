import { describe, expect, it } from "vitest";
import { FIELD_NAME, guideFor } from "@/lib/connect-guide";

describe("connect guide", () => {
  it("every platform sends one field named target_record_id and never shows YOUR_VALUE", () => {
    for (const p of ["n8n", "zapier", "make", "custom", "something-else"]) {
      const g = guideFor(p);
      expect(g.steps.length).toBeGreaterThan(2);
      expect(g.steps.join(" ")).toContain(FIELD_NAME === "target_record_id" ? "" : FIELD_NAME);
      expect(g.json("Email")).toContain(FIELD_NAME);
      expect(g.valueHelp("Email")).not.toMatch(/YOUR_VALUE/);
    }
  });
  it("names the user's key column in the hint", () => {
    expect(guideFor("n8n").valueHelp("Email")).toContain("Email");
    expect(guideFor("n8n").json("Email")).toContain("json.Email");
  });
});

import { n8nPasteNode } from "@/lib/connect-guide";
describe("n8n paste node", () => {
  it("is valid n8n clipboard JSON with the url and the key column", () => {
    const j = JSON.parse(n8nPasteNode("https://x.test/api/inbound/abc", "Email"));
    expect(j.connections).toEqual({});
    const n = j.nodes[0];
    expect(n.type).toBe("n8n-nodes-base.httpRequest");
    expect(n.parameters).toMatchObject({ method: "POST", url: "https://x.test/api/inbound/abc", sendBody: true, specifyBody: "json" });
    expect(n.parameters.jsonBody).toContain("target_record_id");
    expect(n.parameters.jsonBody).toContain("$json['Email']");
  });
  it("escapes quotes in a column name", () => {
    expect(JSON.parse(n8nPasteNode("u", "Client's email")).nodes[0].parameters.jsonBody).toContain("$json['Client\\'s email']");
  });
});
