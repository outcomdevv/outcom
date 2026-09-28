import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const spreadsheetId = String(body.spreadsheetId || "").trim();
    const spreadsheetName = String(body.spreadsheetName || "").trim();
    const sheetName = String(body.sheetName || "").trim();
    const lookupField = String(body.lookupField || "").trim();
    if (!spreadsheetId || !sheetName || !lookupField) return NextResponse.json({ error: "Spreadsheet, sheet and lookup column are required." }, { status: 400 });
    const store = await getWorkspaceStore();
    const connection = (await store.connections.list()).find((x) => x.provider === "google_sheets");
    if (!connection) return NextResponse.json({ error: "Google Sheets is not connected." }, { status: 400 });
    await store.connections.updateMetadata(connection.id, { ...(connection.metadata || {}), spreadsheetId, spreadsheetName, sheetName, lookupField, headerRow: 1 });
    return NextResponse.json({ ok: true, spreadsheetId, spreadsheetName, sheetName, lookupField });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not configure Google Sheets." }, { status: 400 });
  }
}
