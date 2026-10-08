import { describe, it, expect } from "vitest";
import { autoLabel, needsBusinessSystem, newCheck, outcomeTypeOf, toPayload, updateCheck, validateCheck } from "@/lib/connect-checks";

const ctx = { system: "google_sheets" as const, tab: "Leads" };
const sheet = { spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz", sheetName: "Leads", keyColumn: "Email", spreadsheetName: "CRM" };

describe("connect checks", () => {
  it("names a check from its rule, so custom checks are never free text", () => {
    const c = updateCheck(newCheck("value", "a"), { field: "Status", operator: "equals", expectedValue: "Qualified" }, ctx);
    expect(c.label).toBe('Status is "Qualified"');
    expect(updateCheck(c, { operator: "exists" }, ctx).label).toBe("Status is filled in");
    expect(autoLabel(newCheck("exists", "b"), ctx)).toBe("A row exists in Leads");
    expect(autoLabel(newCheck("exists", "b"), { system: "ghl" })).toBe("The contact exists");
  });

  it("keeps a name the user typed even when the rule changes", () => {
    let c = updateCheck(newCheck("value", "a"), { field: "Status", expectedValue: "New" }, ctx);
    c = updateCheck(c, { label: "Lead is new" }, ctx);
    c = updateCheck(c, { expectedValue: "Won" }, ctx);
    expect(c.label).toBe("Lead is new");
  });

  it("refuses checks that Outcom could not evaluate", () => {
    const v = (patch: object) => ({ ...newCheck("value", "a"), ...patch });
    expect(validateCheck(v({}), { system: "google_sheets" })).toMatch(/column/i);
    expect(validateCheck(v({ field: "Status" }), { system: "google_sheets" })).toMatch(/Type the value/);
    expect(validateCheck(v({ field: "Status", expectedValue: "x" }), { system: "google_sheets" })).toBeNull();
    expect(validateCheck(v({ field: "Status", operator: "exists" }), { system: "google_sheets" })).toBeNull();
    expect(validateCheck(v({ field: "Status", expectedValue: "x" }), { system: "none" })).toMatch(/Choose where/);
    expect(validateCheck(newCheck("output", "o"), { system: "none" })).toBeNull();
    expect(validateCheck({ ...newCheck("exists", "e"), valueFrom: " " }, { system: "google_sheets" })).toMatch(/record id/);
  });

  it("maps every check kind to a contract type the checker evaluates", () => {
    expect(outcomeTypeOf("exists")).toBe("record_exists");
    expect(outcomeTypeOf("value")).toBe("state_invariant");
    expect(outcomeTypeOf("tags")).toBe("state_invariant");
    expect(outcomeTypeOf("output")).toBe("output_count");
  });

  it("builds the exact payload the protect route turns into contracts", () => {
    const value = updateCheck(newCheck("value", "v"), { field: "Status", operator: "equals", expectedValue: "Qualified" }, ctx);
    expect(toPayload(value, "google_sheets", sheet, "Leads")).toMatchObject({ type: "state_invariant", system: "google_sheets", entity: "row", field: "Status", operator: "equals", expectedValue: "Qualified", valueFrom: "event.data.target_record_id", target: sheet });
    const out = toPayload(newCheck("output", "o"), "google_sheets", sheet);
    expect(out).toMatchObject({ type: "output_count", system: "event", entity: "output", operator: "greater_than", target: null, valueFrom: "event.data.output_count" });
    expect(toPayload(newCheck("exists", "e"), "ghl", null)).toMatchObject({ type: "record_exists", system: "ghl", entity: "contact", target: null });
    expect(toPayload({ ...value, operator: "exists" }, "google_sheets", sheet).expectedValue).toBe("");
  });

  it("only asks for a business system when a check needs one", () => {
    expect(needsBusinessSystem([newCheck("output", "o")])).toBe(false);
    expect(needsBusinessSystem([newCheck("output", "o"), newCheck("exists", "e")])).toBe(true);
  });
});
