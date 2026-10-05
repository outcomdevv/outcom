import { NextResponse } from "next/server";
import { resolveGoogleToken, type GoogleAccess } from "@/lib/google-access";
import { getHeaders, getSheetMeta, parseSpreadsheetId } from "@/lib/google-sheets";
import { googleError } from "@/lib/google-http";

// GET /api/google/sheets/<id>            -> tabs
// GET /api/google/sheets/<id>?tab=Leads  -> header row (candidate key columns)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseSpreadsheetId((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid spreadsheet id." }, { status: 400 });
    const sp = new URL(request.url).searchParams;
    const wanted: GoogleAccess | undefined = sp.get("access") === "service_account" ? "service_account" : undefined;
    const resolved = await resolveGoogleToken({ access: wanted });
    if (!resolved) return NextResponse.json({ connected: false }, { status: 400 });
    const token = resolved.token;
    const tab = sp.get("tab");
    if (tab) return NextResponse.json({ headers: await getHeaders(token, id, tab) });
    const meta = await getSheetMeta(token, id);
    return NextResponse.json({ id, title: meta.title, tabs: meta.tabs });
  } catch (e) { return googleError(e); }
}
