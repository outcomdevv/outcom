import { NextResponse } from "next/server";
import { buildAuthorizationUrl, createState, isOAuthProvider, oauthConfigured } from "@/lib/oauth";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = (await params).provider;
  if (!isOAuthProvider(provider)) return NextResponse.json({ error: "Unsupported provider" }, { status: 404 });
  if (!oauthConfigured(provider)) return NextResponse.redirect(new URL(`/connect?error=${provider}_oauth_not_configured`, request.url));
  const state = await createState(provider);
  return NextResponse.redirect(buildAuthorizationUrl(provider, state));
}
