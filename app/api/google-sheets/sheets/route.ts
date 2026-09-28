import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/oauth";

export async function GET(request: Request) {
  try {
    const spreadsheetId = new URL(request.url).searchParams.get("spreadsheetId")?.trim();
    if (!spreadsheetId) return NextResponse.json({ error: "spreadsheetId is required." }, { status: 400 });
    const token = await getValidAccessToken("google_sheets");
    if (!token) return NextResponse.json({ error: "Google Sheets is not connected." }, { status: 400 });
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties(title),sheets(properties(sheetId,title,index))`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return NextResponse.json({ error: body?.error?.message || "Could not load spreadsheet sheets." }, { status: response.status });
    return NextResponse.json({ spreadsheet: { id: body.spreadsheetId, title: body.properties?.title }, sheets: (body.sheets || []).map((s: any) => s.properties) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load sheets." }, { status: 400 });
  }
}
