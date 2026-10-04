import { describe, it, expect, vi } from "vitest";
import { GoogleApiError, GoogleSheetsAdapter, getHeaders, getSheetMeta, listSpreadsheets, parseSheetTarget, parseSpreadsheetId } from "@/lib/google-sheets";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const target = { spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz", sheetName: "Leads", keyColumn: "Email" };
const values = { values: [["Name", "Email", "Status", "tags"], ["Ann", "ann@x.com", "Qualified", "vip, paid"], ["Bob", "BOB@x.com", "New", ""]] };

describe("parseSpreadsheetId", () => {
  it("extracts ids from URLs and bare ids, rejects junk", () => {
    expect(parseSpreadsheetId("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit#gid=0")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
    expect(parseSpreadsheetId("1AbCdEfGhIjKlMnOpQrStUvWxYz")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
    expect(parseSpreadsheetId("hello")).toBeNull();
    expect(parseSpreadsheetId("")).toBeNull();
  });
});

describe("discovery helpers", () => {
  it("lists spreadsheets read-only, escaping the search term", async () => {
    const f = vi.fn(async () => json({ files: [{ id: "a", name: "Leads", modifiedTime: "2026-01-01T00:00:00Z" }, { id: "b" }] }));
    const files = await listSpreadsheets("tok", { query: "o'brien", fetchImpl: f as any });
    expect(files).toEqual([{ id: "a", name: "Leads", modifiedTime: "2026-01-01T00:00:00Z" }, { id: "b", name: "Untitled", modifiedTime: null }]);
    const url = new URL((f.mock.calls[0] as any)[0]);
    expect(url.searchParams.get("q")).toContain("name contains 'o\\'brien'");
    expect(url.searchParams.get("q")).toContain("trashed=false");
    expect((f.mock.calls[0] as any)[1].headers.Authorization).toBe("Bearer tok");
  });
  it("reads tabs and headers", async () => {
    const meta = await getSheetMeta("t", "id12345678901", (async () => json({ properties: { title: "CRM" }, sheets: [{ properties: { title: "Leads" } }, { properties: { title: "Won" } }] })) as any);
    expect(meta).toEqual({ id: "id12345678901", title: "CRM", tabs: ["Leads", "Won"] });
    const f = vi.fn(async () => json({ values: [["Name", " Email ", "", "Status"]] }));
    expect(await getHeaders("t", "id12345678901", "My 'Tab'", f as any)).toEqual(["Name", "Email", "Status"]);
    expect(decodeURIComponent((f.mock.calls[0] as any)[0])).toContain("'My ''Tab'''!A1:AZ1");
  });
  it.each([[401, "reauth_required"], [403, "forbidden"], [404, "not_found"], [429, "rate_limited"], [500, "upstream"]])("maps HTTP %i to %s", async (status, kind) => {
    await expect(listSpreadsheets("t", { fetchImpl: (async () => json({}, status)) as any })).rejects.toMatchObject({ kind });
  });
  it("maps network failure to upstream", async () => {
    await expect(listSpreadsheets("t", { fetchImpl: (async () => { throw new Error("boom"); }) as any })).rejects.toBeInstanceOf(GoogleApiError);
  });
});

describe("GoogleSheetsAdapter", () => {
  const adapter = (v: unknown = values, status = 200, maxRows?: number) => new GoogleSheetsAdapter("tok", target, (async () => json(v, status)) as any, maxRows);

  it("finds a row case-insensitively and returns a header-keyed record", async () => {
    expect(await adapter().getRecord("  BOB@x.com ")).toEqual({ Name: "Bob", Email: "BOB@x.com", Status: "New", tags: "" });
    expect(await adapter().getField("ann@x.com", "Status")).toBe("Qualified");
    expect(await adapter().getTags("ann@x.com")).toEqual(["vip", "paid"]);
    expect(await adapter().getStatus("ann@x.com")).toBe("Qualified");
  });
  it("returns null when the row is definitively absent", async () => {
    expect(await adapter().getRecord("nobody@x.com")).toBeNull();
    expect(await adapter().getRecord("")).toBeNull();
    expect(await adapter().getField("nobody@x.com", "Status")).toBeNull();
  });
  it("throws (-> UNKNOWN, not a false FAIL) when the sheet may be larger than the scan window", async () => {
    await expect(adapter(values, 200, 3).getRecord("nobody@x.com")).rejects.toThrow(/cannot confirm/);
  });
  it("throws a clear error when the key column is missing", async () => {
    await expect(adapter({ values: [["Name"], ["Ann"]] }).getRecord("ann")).rejects.toThrow(/Key column "Email"/);
  });
  it("propagates auth errors", async () => {
    await expect(adapter({}, 401).getRecord("x")).rejects.toMatchObject({ kind: "reauth_required" });
  });
  it("handles an empty sheet", async () => {
    await expect(adapter({}).getRecord("x")).rejects.toThrow(/Key column/);
  });
  it("rejects an incomplete target", () => {
    expect(() => new GoogleSheetsAdapter("t", { spreadsheetId: "", sheetName: "", keyColumn: "" })).toThrow(/incomplete/);
  });
});

describe("parseSheetTarget", () => {
  it("validates and normalizes", () => {
    expect(parseSheetTarget({ spreadsheetId: "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit", sheetName: " Leads ", keyColumn: " Email " })).toMatchObject({ spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz", sheetName: "Leads", keyColumn: "Email" });
    for (const bad of [null, "x", {}, { spreadsheetId: "short", sheetName: "a", keyColumn: "b" }, { spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz", sheetName: "", keyColumn: "b" }]) expect(parseSheetTarget(bad)).toBeNull();
  });
});

import { ciGet } from "@/lib/google-sheets";
describe("ciGet", () => {
  it("matches headers case-insensitively and exact first", () => {
    expect(ciGet({ Status: "A" }, "status")).toBe("A");
    expect(ciGet({ " Status ": "B" }, "STATUS")).toBe("B");
    expect(ciGet({ status: "x", Status: "y" }, "Status")).toBe("y");
    expect(ciGet({ a: 1 }, "b")).toBeUndefined();
  });
  it("is used by getField", async () => {
    const a = new GoogleSheetsAdapter("t", target, (async () => json(values)) as any);
    expect(await a.getField("ann@x.com", "status")).toBe("Qualified");
  });
});
