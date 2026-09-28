import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/oauth";

export async function GET() {
  try {
    const token = await getValidAccessToken("google_sheets");
    if (!token) return NextResponse.json({ error: "Google Sheets is not connected." }, { status: 400 });
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("fields", "files(id,name,webViewLink,modifiedTime)");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return NextResponse.json({ error: body?.error?.message || "Google Drive file lookup failed." }, { status: response.status });
    return NextResponse.json({ files: body.files || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not list Google Sheets." }, { status: 400 });
  }
}
