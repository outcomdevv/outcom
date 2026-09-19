import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");

    if (!email || password.length < 8) {
      return NextResponse.redirect(
        new URL("/auth/signup?error=Password%20must%20be%20at%20least%208%20characters", request.url),
        303,
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase public configuration is missing.");

    // Use the implicit browser-confirmation flow for signup. The confirmation
    // page receives access/refresh tokens in the URL hash and can establish the
    // session without requiring a PKCE code verifier from the signup request.
    const supabase = createClient(url, key, {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/confirmed` },
    });

    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/signup?error=${encodeURIComponent(error.message)}`, request.url),
        303,
      );
    }

    if (data.session) return NextResponse.redirect(new URL("/", request.url), 303);
    return NextResponse.redirect(
      new URL(`/auth/check-email?email=${encodeURIComponent(email)}`, request.url),
      303,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create your workspace.";
    return NextResponse.redirect(
      new URL(`/auth/signup?error=${encodeURIComponent(message)}`, request.url),
      303,
    );
  }
}
