import { NextResponse } from "next/server";
import { exchangeCode, profileFor, encryptSecret, isOAuthProvider, oauthConfigured } from "@/lib/oauth";
import { getWorkspaceStore } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider;
  if (!isOAuthProvider(provider)) return NextResponse.json({ error: "Unsupported provider" }, { status: 404 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");
  const fail = (reason: string) => NextResponse.redirect(new URL(`/connect?error=${provider}_${reason}`, url.origin));

  if (denied) return fail("authorization_denied");
  if (!oauthConfigured(provider)) return fail("oauth_not_configured");

  try {
    const store = await getWorkspaceStore();
    // State is workspace-bound, provider-bound, expires after 10 minutes and is deleted atomically on first use.
    if (!code || !state || !(await store.oauthStates.consume(state, provider))) return fail("oauth_state_invalid");

    const tokens = await exchangeCode(provider, code);
    if (!tokens.access_token) throw new Error("Provider did not return an access token");
    const profile = await profileFor(provider, tokens.access_token, tokens);
    await store.connections.upsert({
      provider,
      accountId: profile.accountId,
      accountName: profile.accountName,
      email: profile.email,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
      expiresAt: tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null,
      metadata: profile.metadata,
    });
    return NextResponse.redirect(new URL(`/connect?connected=${provider}`, url.origin));
  } catch (e) {
    // Log the error class/message only; never log token payloads.
    console.error(`${provider}_oauth_callback_failed`, e instanceof Error ? e.message : "unknown error");
    return fail("oauth_failed");
  }
}
