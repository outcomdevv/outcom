import { NextResponse } from "next/server";
import { getValidAccessToken, OAuthReauthRequired, providerConfig, type OAuthProvider } from "@/lib/oauth";
import { listZaps, ZapierApiError } from "@/lib/zapier";
import { getWorkspaceStore } from "@/lib/db";

const DISCOVERABLE = new Set<OAuthProvider>(["zapier", "make"]);

async function discoverZapier(initialToken: string) {
  const includeShared = providerConfig.zapier.scopes.split(/\s+/).includes("zap:account:all");
  try {
    let result;
    try {
      result = await listZaps(initialToken, { includeShared });
    } catch (e) {
      // A 401 can mean the access token was revoked/expired early: force one refresh and retry once.
      if (!(e instanceof ZapierApiError) || e.kind !== "reauth_required") throw e;
      const fresh = await getValidAccessToken("zapier", undefined, { forceRefresh: true });
      if (!fresh) throw e;
      result = await listZaps(fresh, { includeShared });
    }
    return NextResponse.json({ connected: true, items: result.items, total: result.total, pages: result.pages, partial: result.partial, warning: result.warning });
  } catch (e) {
    return zapierError(e);
  }
}

function zapierError(e: unknown) {
  if (e instanceof OAuthReauthRequired || (e instanceof ZapierApiError && e.kind === "reauth_required")) {
    return NextResponse.json({ connected: true, reauthRequired: true, code: "reauth_required", items: [], total: 0, error: "Your Zapier connection expired. Reconnect Zapier to continue." }, { status: 401 });
  }
  if (e instanceof ZapierApiError) {
    const message = e.kind === "forbidden" ? e.message : e.kind === "rate_limited" ? e.message : "Zapier could not list your Zaps right now. Try again in a moment.";
    return NextResponse.json({ connected: true, code: e.kind, items: [], total: 0, error: message, retryAfterSeconds: e.retryAfterSeconds }, { status: e.kind === "rate_limited" ? 429 : e.kind === "forbidden" ? 403 : 502 });
  }
  return NextResponse.json({ connected: false, code: "discovery_failed", items: [], total: 0, error: "Discovery failed." }, { status: 502 });
}

export async function GET(request: Request) {
  const provider = new URL(request.url).searchParams.get("provider") as OAuthProvider;
  if (!DISCOVERABLE.has(provider)) {
    return NextResponse.json({ error: "Discovery is available for Zapier and Make in this build." }, { status: 400 });
  }

  try {
    const token = await getValidAccessToken(provider);
    if (!token) return NextResponse.json({ connected: false, items: [], total: 0 });

    if (provider === "zapier") return discoverZapier(token);

    const store = await getWorkspaceStore();
    const connection = await store.connections.latest("make");
    let teamId = connection?.metadata?.teamId || connection?.metadata?.team_id;
    const base = String(connection?.metadata?.baseUrl || process.env.MAKE_API_BASE_URL || "https://eu1.make.com/api/v2").replace(/\/$/, "");
    if (!teamId) return NextResponse.json({ connected: true, items: [], total: 0, needsTeam: true, message: "Make is connected, but no Team ID was stored. Manual connections require a numeric Team ID; OAuth connections can discover it with the broader read scopes." });
    const authHeader = connection?.metadata?.authMode === "oauth" ? `Bearer ${token}` : `Token ${token}`;
    const r = await fetch(`${base}/scenarios?teamId=${encodeURIComponent(String(teamId))}`, { headers: { Authorization: authHeader }, cache: "no-store" });
    const body: any = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ connected: false, items: [], error: body }, { status: r.status });
    const items = (body.scenarios || body.data || []).map((s: any) => ({ id: String(s.id), name: s.name || "Untitled scenario", enabled: Boolean(s.isActive), updatedAt: s.updatedAt || null, url: null, platform: "make" }));
    return NextResponse.json({ connected: true, items, total: Number(body.total ?? items.length) });
  } catch (e) {
    if (provider === "zapier") return zapierError(e);
    if (e instanceof OAuthReauthRequired) return NextResponse.json({ connected: true, reauthRequired: true, code: "reauth_required", items: [], total: 0, error: "Your Make connection expired. Reconnect Make to continue." }, { status: 401 });
    return NextResponse.json({ connected: false, items: [], total: 0, error: e instanceof Error ? e.message : "Discovery failed" }, { status: 502 });
  }
}
