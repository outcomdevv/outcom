import { NextResponse } from "next/server";
import { OAuthReauthRequired } from "@/lib/oauth";
import { GoogleApiError } from "@/lib/google-sheets";
import { ServiceAccountError } from "@/lib/google-service-account";

export function googleError(e: unknown) {
  if (e instanceof ServiceAccountError) return NextResponse.json({ error: e.message, code: e.kind === "not_configured" ? "service_account_not_configured" : e.kind }, { status: e.kind === "not_configured" ? 400 : 502 });
  if (e instanceof OAuthReauthRequired || (e instanceof GoogleApiError && e.kind === "reauth_required")) return NextResponse.json({ reauthRequired: true, error: "Your Google connection expired. Reconnect Google." }, { status: 401 });
  if (e instanceof GoogleApiError) return NextResponse.json({ error: e.message, code: e.kind }, { status: e.kind === "not_found" ? 404 : e.kind === "forbidden" ? 403 : e.kind === "rate_limited" ? 429 : 502 });
  return NextResponse.json({ error: "Google Sheets request failed." }, { status: 502 });
}
