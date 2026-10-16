import { describe, it, expect } from "vitest";
import { ReportedAdapter, evidenceFor, normalizeEvidence, slugStep } from "@/lib/evidence";

describe("slugStep", () => {
  it("makes stable step names", () => {
    expect(slugStep("Create CRM contact")).toBe("create-crm-contact");
    expect(slugStep("  CRM!! ")).toBe("crm");
    expect(slugStep(undefined)).toBe("");
  });
});

describe("normalizeEvidence", () => {
  it("reads an array of steps", () => {
    const e = normalizeEvidence({ evidence: [{ step: "CRM", found: true, key: "a@b.com", fields: { Email: "a@b.com" } }, { step: "invoice", found: false }] });
    expect(e.crm).toMatchObject({ found: true, key: "a@b.com", fields: { Email: "a@b.com" } });
    expect(e.invoice.found).toBe(false);
  });
  it("reads an object keyed by step", () => {
    const e = normalizeEvidence({ evidence: { crm: { found: true }, slack: { count: 0 } } });
    expect(e.crm.found).toBe(true);
    expect(e.slack.found).toBe(false);
  });
  it("reads a single item at the top level, and from data", () => {
    expect(normalizeEvidence({ step: "crm", found: "true" }).crm.found).toBe(true);
    expect(normalizeEvidence({}, { evidence: [{ step: "x", count: 2 }] }).x.found).toBe(true);
  });
  it("infers found from fields when no flag is sent, and treats empty fields as missing", () => {
    expect(normalizeEvidence({ evidence: [{ step: "a", fields: { id: 1 } }] }).a.found).toBe(true);
    expect(normalizeEvidence({ evidence: [{ step: "a", fields: {} }] }).a.found).toBe(false);
  });
  it("ignores junk and caps size", () => {
    expect(normalizeEvidence({ evidence: "nope" })).toEqual({});
    expect(normalizeEvidence({ evidence: [{ found: true }] })).toEqual({});
    const big = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`f${i}`, "x".repeat(900)]));
    const e = normalizeEvidence({ evidence: [{ step: "a", found: true, fields: big }] });
    expect(Object.keys(e.a.fields)).toHaveLength(50);
    expect(String(e.a.fields.f0).length).toBe(500);
    const many = normalizeEvidence({ evidence: Array.from({ length: 40 }, (_, i) => ({ step: `s${i}`, found: true })) });
    expect(Object.keys(many)).toHaveLength(20);
  });
});

describe("ReportedAdapter", () => {
  const ev = { step: "crm", found: true, key: "a@b.com", fields: { Status: "Qualified", tags: ["vip", 3] } } as any;
  it("serves the reported record and fields case-insensitively", async () => {
    const a = new ReportedAdapter(ev);
    expect(await a.getRecord("x")).toMatchObject({ id: "a@b.com", Status: "Qualified" });
    expect(await a.getField("x", "status")).toBe("Qualified");
    expect(await a.getTags("x")).toEqual(["vip"]);
    expect(await a.getStatus("x")).toBe("Qualified");
  });
  it("returns no record when nothing was found", async () => {
    expect(await new ReportedAdapter({ ...ev, found: false }).getRecord("x")).toBeNull();
  });
  it("finds evidence on an event by step name", () => {
    expect(evidenceFor({ evidence: { crm: ev } }, "CRM")).toBe(ev);
    expect(evidenceFor({ evidence: { crm: ev } }, "other")).toBeNull();
    expect(evidenceFor({}, "crm")).toBeNull();
  });
});
