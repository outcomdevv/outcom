import { NextResponse } from "next/server";
import { saveToken } from "@/lib/token-store";

// POST { token } — checks the Airtable personal access token, then stores it encrypted. Read-only use.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Paste your Airtable token." }, { status: 400 });
    const r = await fetch("https://api.airtable.com/v0/meta/whoami", { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
    const j: any = await r.json().catch(() => ({}));
    if (r.status === 401) return NextResponse.json({ error: "Airtable did not accept this token. Create a personal access token and paste it again." }, { status: 400 });
    if (!r.ok) return NextResponse.json({ error: `Airtable answered HTTP ${r.status}. Try again.` }, { status: 400 });
    const scopes: string[] = Array.isArray(j.scopes) ? j.scopes : [];
    const missing = ["data.records:read", "schema.bases:read"].filter(s => scopes.length && !scopes.includes(s));
    if (missing.length) return NextResponse.json({ error: `This token is missing: ${missing.join(", ")}. Add these scopes and paste it again.` }, { status: 400 });
    const accountName = typeof j.email === "string" && j.email ? j.email : "Airtable";
    await saveToken("airtable", { accountId: String(j.id || "airtable"), accountName, token, metadata: { scopes } });
    return NextResponse.json({ connected: true, accountName });
  } catch (e) {
    return NextResponse.json({ connected: false, error: e instanceof Error ? e.message : "Airtable connection failed." }, { status: 400 });
  }
}
