import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/oauth";
import { getHeaders, getSheetMeta, parseSpreadsheetId } from "@/lib/google-sheets";
import { googleError } from "@/lib/google-http";

// GET /api/google/sheets/<id>            -> tabs
// GET /api/google/sheets/<id>?tab=Leads  -> header row (candidate key columns)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseSpreadsheetId((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid spreadsheet id." }, { status: 400 });
    const token = await getValidAccessToken("google_sheets");
    if (!token) return NextResponse.json({ connected: false }, { status: 400 });
    const tab = new URL(request.url).searchParams.get("tab");
    if (tab) return NextResponse.json({ headers: await getHeaders(token, id, tab) });
    const meta = await getSheetMeta(token, id);
    return NextResponse.json({ id, title: meta.title, tabs: meta.tabs });
  } catch (e) { return googleError(e); }
}
