import { NextResponse } from "next/server";
import { saveToken } from "@/lib/token-store";

// POST { token } — checks the HubSpot Private App token can read contacts, then stores it encrypted. Read-only use.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Paste your HubSpot Private App token." }, { status: 400 });
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", { headers, cache: "no-store" });
    if (r.status === 401) return NextResponse.json({ error: "HubSpot did not accept this token. Copy the access token of your Private App and paste it again." }, { status: 400 });
    if (r.status === 403) return NextResponse.json({ error: "This token cannot read contacts. Add the crm.objects.contacts.read scope to the Private App." }, { status: 400 });
    if (!r.ok) return NextResponse.json({ error: `HubSpot answered HTTP ${r.status}. Try again.` }, { status: 400 });
    let portalId = "";
    try { const a: any = await (await fetch("https://api.hubapi.com/account-info/v3/details", { headers, cache: "no-store" })).json(); portalId = a?.portalId ? String(a.portalId) : ""; } catch { /* optional */ }
    await saveToken("hubspot", { accountId: portalId || "hubspot", accountName: portalId ? `HubSpot ${portalId}` : "HubSpot", token });
    return NextResponse.json({ connected: true, accountName: portalId ? `HubSpot ${portalId}` : "HubSpot" });
  } catch (e) {
    return NextResponse.json({ connected: false, error: e instanceof Error ? e.message : "HubSpot connection failed." }, { status: 400 });
  }
}
