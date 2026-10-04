import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/oauth";
import { googleError } from "@/lib/google-http";
import { getSheetMeta, listSpreadsheets, parseSpreadsheetId } from "@/lib/google-sheets";

// GET /api/google/sheets?q=name   -> spreadsheets the connected account can see (read-only)
// GET /api/google/sheets?link=... -> resolve a pasted spreadsheet URL/ID without browsing Drive
export async function GET(request: Request) {
  try {
    const token = await getValidAccessToken("google_sheets");
    if (!token) return NextResponse.json({ connected: false, files: [] });
    const params = new URL(request.url).searchParams;
    const link = params.get("link");
    if (link) {
      const id = parseSpreadsheetId(link);
      if (!id) return NextResponse.json({ error: "That does not look like a Google Sheets link." }, { status: 400 });
      const meta = await getSheetMeta(token, id);
      return NextResponse.json({ connected: true, files: [{ id, name: meta.title, modifiedTime: null }] });
    }
    return NextResponse.json({ connected: true, files: await listSpreadsheets(token, { query: params.get("q") || "" }) });
  } catch (e) { return googleError(e); }
}
