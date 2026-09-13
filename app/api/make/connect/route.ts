import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/oauth";
import { getWorkspaceStore } from "@/lib/db";

const DEFAULT_BASE = "https://eu1.make.com/api/v2";
const COMMON_ZONES = String(process.env.MAKE_API_ZONES || "eu1,eu2,us1,us2").split(",").map((x) => x.trim()).filter(Boolean);

async function json(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    const requestedTeamId = String(body.teamId || "").trim();
    let baseUrl = String(body.baseUrl || process.env.MAKE_API_BASE_URL || "").replace(/\/$/, "");

    if (!token) return NextResponse.json({ connected: false, error: "Make API token is required." }, { status: 400 });
    if (!requestedTeamId) return NextResponse.json({ connected: false, error: "Make Team ID is required for manual token setup. A token with only scenarios:read cannot discover teams; enter the numeric Team ID from Make." }, { status: 400 });
    if (!/^\d+$/.test(requestedTeamId)) return NextResponse.json({ connected: false, error: `"${requestedTeamId}" is not a valid Make Team ID. Enter the numeric Team ID, not the team name.` }, { status: 400 });

    // For a design-partner token, verify the exact resource we need: scenario access.
    // GET /users/me requires organization:read, which is NOT needed for a least-privilege scenarios:read token.
    const candidates = [baseUrl, ...COMMON_ZONES.map((zone) => `https://${zone}.make.com/api/v2`)].filter(Boolean);
    let verifiedBase = "";
    let scenariosPayload: any = {};

    for (const candidate of candidates) {
      try {
        const response = await fetch(`${candidate}/scenarios?teamId=${encodeURIComponent(requestedTeamId)}`, {
          headers: { Authorization: `Token ${token}`, Accept: "application/json" }, cache: "no-store",
        });
        const payload = await json(response);
        if (response.ok) {
          verifiedBase = candidate;
          scenariosPayload = payload;
          break;
        }
        if (response.status === 401 || response.status === 403) {
          // A valid zone can still reject access because the token lacks team access/scenarios:read.
          continue;
        }
      } catch { /* try the next zone */ }
    }

    if (!verifiedBase) {
      return NextResponse.json({
        connected: false,
        error: "Make rejected the token for this Team ID. Check that the token has scenarios:read and that the Team ID belongs to a team you can access in the same Make zone (for example eu1).",
      }, { status: 400 });
    }

    const scenarios = scenariosPayload.scenarios || scenariosPayload.data || [];
    const accountName = `Make team ${requestedTeamId}`;
    const store = await getWorkspaceStore();
    await store.connections.upsert({
      provider: "make", accountId: requestedTeamId, accountName, email: null,
      accessToken: encryptSecret(token), refreshToken: null, expiresAt: null,
      metadata: { teamId: requestedTeamId, baseUrl: verifiedBase, authMode: "api_token" },
    });

    return NextResponse.json({
      connected: true,
      accountName,
      teamId: requestedTeamId,
      baseUrl: verifiedBase,
      scenarios: scenarios.length,
      verification: "scenario_read",
    });
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : "Make connection failed." }, { status: 400 });
  }
}
