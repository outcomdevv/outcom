import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { INTEGRATIONS } from "@/lib/integrations/registry";
import { oauthConfigured, isOAuthProvider } from "@/lib/oauth";

// Honest catalog: what exists, how it connects, and what is connected in THIS workspace. No secrets.
export async function GET() {
  const store = await getWorkspaceStore();
  const connected = new Set((await store.connections.list()).map(c => c.provider));
  return NextResponse.json({
    integrations: INTEGRATIONS.map(i => ({ ...i, connected: connected.has(i.id), oauthConfigured: isOAuthProvider(i.id) ? oauthConfigured(i.id) : null })),
  });
}
