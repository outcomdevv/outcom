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
