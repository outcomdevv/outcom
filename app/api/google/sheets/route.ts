import { NextResponse } from "next/server";
import { googleError } from "@/lib/google-http";
import { resolveGoogleToken, type GoogleAccess } from "@/lib/google-access";
import { getSheetMeta, listSpreadsheets, parseSpreadsheetId } from "@/lib/google-sheets";
import { serviceAccountEmail } from "@/lib/google-service-account";

// GET /api/google/sheets?q=name                       -> spreadsheets the connected account can see (read-only)
// GET /api/google/sheets?link=...                     -> resolve a pasted spreadsheet URL/ID
// add &access=service_account                         -> use Outcom's robot email (sheet must be shared with it)
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const wanted: GoogleAccess | undefined = params.get("access") === "service_account" ? "service_account" : undefined;
    const resolved = await resolveGoogleToken({ access: wanted });
    if (!resolved) return NextResponse.json({ connected: false, files: [] });
    const link = params.get("link");
    if (link) {
      const id = parseSpreadsheetId(link);
      if (!id) return NextResponse.json({ error: "That does not look like a Google Sheets link." }, { status: 400 });
      const meta = await getSheetMeta(resolved.token, id);
      return NextResponse.json({ connected: true, access: resolved.access, files: [{ id, name: meta.title, modifiedTime: null }] });
    }
    if (resolved.access === "service_account") return NextResponse.json({ connected: true, access: "service_account", robotEmail: serviceAccountEmail(), files: [], note: "Paste a link to a sheet you shared with the robot email; browsing is only available with a connected Google account." });
    return NextResponse.json({ connected: true, access: resolved.access, files: await listSpreadsheets(resolved.token, { query: params.get("q") || "" }) });
  } catch (e) { return googleError(e); }
}
