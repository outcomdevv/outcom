import { NextResponse } from "next/server";
import { getValidAccessToken, type OAuthProvider } from "@/lib/oauth";
import { getWorkspaceStore } from "@/lib/db";

const DISCOVERABLE = new Set<OAuthProvider>(["zapier", "make"]);

function safeNext(base: string, next: unknown) {
  if (typeof next !== "string" || !next) return null;
  try {
    const url = new URL(next, base);
    if (url.origin !== new URL(base).origin) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function discoverZapier(token: string) {
  const items: any[] = [];
  let nextUrl: string | null = "https://api.zapier.com/v2/zaps?limit=100&offset=0";
  let pages = 0;
  let total: number | null = null;

  while (nextUrl && pages < 100) {
    const r = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" },
      cache: "no-store",
    });
    const body: any = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false as const, status: r.status, error: body };

    const data = Array.isArray(body.data) ? body.data : [];
    items.push(...data.map((z: any) => ({
      id: String(z.id),
      name: z.title || "Untitled Zap",
      enabled: Boolean(z.is_enabled),
      updatedAt: z.updated_at || null,
      url: z.links?.html_editor || z.url || null,
      platform: "zapier",
      lastSuccessfulRun: z.last_successful_run_date || null,
      steps: Array.isArray(z.steps) ? z.steps.length : null,
    })));

    if (body.meta?.count != null) total = Number(body.meta.count);
    nextUrl = safeNext("https://api.zapier.com", body.links?.next);
    pages += 1;

    // Protect against a provider returning the same link forever.
    if (nextUrl === r.url) break;
  }

  return { ok: true as const, items, total: total ?? items.length, pages };
}

export async function GET(request: Request) {
  const provider = new URL(request.url).searchParams.get("provider") as OAuthProvider;
  if (!DISCOVERABLE.has(provider)) {
    return NextResponse.json({ error: "Discovery is available for Zapier and Make in this build." }, { status: 400 });
  }

  try {
    const token = await getValidAccessToken(provider);
    if (!token) return NextResponse.json({ connected: false, items: [], total: 0 });

    if (provider === "zapier") {
      const result = await discoverZapier(token);
      if (!result.ok) return NextResponse.json({ connected: false, items: [], error: result.error }, { status: result.status });
      return NextResponse.json({ connected: true, items: result.items, total: result.total, pages: result.pages });
    }

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
    return NextResponse.json({ connected: false, items: [], total: 0, error: e instanceof Error ? e.message : "Discovery failed" }, { status: 502 });
  }
}
