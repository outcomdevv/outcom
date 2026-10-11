import { describe, expect, it } from "vitest";
import { AirtableAdapter, AirtableError, listAirtableTables, matchFormula, parseAirtableLink, parseAirtableTarget } from "@/lib/airtable";

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
const target = { baseId: "appABCDEFGHIJK", tableId: "tblABCDEFGHIJK", keyField: "Email" };

describe("airtable", () => {
  it("reads base and table from a link", () => {
    expect(parseAirtableLink("https://airtable.com/appABCDEFGHIJK/tblZYXWVUTSRQP/viwAAAAAAAAAAA?blocks=hide")).toEqual({ baseId: "appABCDEFGHIJK", tableId: "tblZYXWVUTSRQP" });
    expect(parseAirtableLink("https://airtable.com/appABCDEFGHIJK")).toEqual({ baseId: "appABCDEFGHIJK", tableId: null });
    expect(parseAirtableLink("hello")).toBeNull();
  });
  it("keeps only a complete target", () => {
    expect(parseAirtableTarget(target)).toMatchObject(target);
    expect(parseAirtableTarget({ ...target, keyField: "" })).toBeNull();
    expect(parseAirtableTarget({ ...target, baseId: "nope" })).toBeNull();
  });
  it("builds a safe, case-insensitive formula", () => {
    expect(matchFormula("Email", "a@b.com")).toBe(`LOWER({Email}&"")=LOWER('a@b.com')`);
    expect(matchFormula("E}mail", "O'Neil\\")).toBe(`LOWER({E\\}mail}&"")=LOWER('O\\'Neil\\\\')`);
  });
  it("returns the record fields when found and null when not", async () => {
    let seen = "";
    const hit = new AirtableAdapter("t", target, (async (u: any) => { seen = String(u); return new Response(JSON.stringify({ records: [{ id: "rec1", fields: { Email: "a@b.com", Status: "New" } }] })); }) as any);
    expect(await hit.getRecord("a@b.com")).toMatchObject({ id: "rec1", Status: "New" });
    expect(seen).toContain("/v0/appABCDEFGHIJK/tblABCDEFGHIJK");
    expect(seen).toContain("maxRecords=1");
    expect(await new AirtableAdapter("t", target, json(200, { records: [] }) as any).getRecord("x@y.com")).toBeNull();
    expect(await new AirtableAdapter("t", target, json(200, { records: [] }) as any).getRecord("  ")).toBeNull();
  });
  it("turns provider problems into clear errors (never a false 'missing')", async () => {
    for (const [status, kind] of [[401, "reauth_required"], [403, "forbidden"], [404, "not_found"], [422, "bad_field"], [429, "rate_limited"], [500, "upstream"]] as const) {
      await expect(new AirtableAdapter("t", target, json(status, {}) as any).getRecord("a@b.com")).rejects.toMatchObject({ kind });
    }
    await expect(new AirtableAdapter("t", target, (async () => { throw new Error("net"); }) as any).getRecord("a@b.com")).rejects.toBeInstanceOf(AirtableError);
  });
  it("lists tables with column names", async () => {
    const t = await listAirtableTables("t", "appABCDEFGHIJK", { fetchImpl: json(200, { tables: [{ id: "tbl1", name: "Leads", fields: [{ name: "Email" }, { name: "Status" }] }] }) as any });
    expect(t).toEqual([{ id: "tbl1", name: "Leads", fields: ["Email", "Status"] }]);
  });
});
