import { NextResponse } from "next/server";
import { AirtableError, listAirtableTables, parseAirtableLink } from "@/lib/airtable";
import { getStoredToken } from "@/lib/token-store";

// GET ?link=<airtable url>[&tableId=tbl…] -> the table's name and column names, or the base's tables to choose from.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const parsed = parseAirtableLink(params.get("link") || "");
    if (!parsed) return NextResponse.json({ error: "That does not look like an Airtable link. Open your table in Airtable and copy the address bar." }, { status: 400 });
    const token = await getStoredToken("airtable");
    if (!token) return NextResponse.json({ error: "Connect Airtable first." }, { status: 400 });
    const tables = await listAirtableTables(token, parsed.baseId);
    const wanted = params.get("tableId") || parsed.tableId;
    if (!wanted) return NextResponse.json({ baseId: parsed.baseId, tables: tables.map(t => ({ id: t.id, name: t.name })) });
    const t = tables.find(x => x.id === wanted);
    if (!t) return NextResponse.json({ error: "That table was not found in this base." }, { status: 404 });
    return NextResponse.json({ baseId: parsed.baseId, tableId: t.id, tableName: t.name, fields: t.fields });
  } catch (e) {
    const status = e instanceof AirtableError && e.status >= 400 && e.status < 500 ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read Airtable." }, { status });
  }
}
