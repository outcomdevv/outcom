import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Optional server-side confirmation endpoint for a Supabase email template
// using {{ .TokenHash }}. This also supports confirmation links opened on a
// different browser or device.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next") || "/";
  // Only a path on this site. "//evil.com" or "https://evil.com" would turn this endpoint into an open redirect.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL(`/auth/confirmed?error=${encodeURIComponent("This confirmation link is invalid or expired. Please request a new email.")}`, request.url),
  );
}
