import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!email || password.length < 8) return NextResponse.redirect(new URL("/auth/signup?error=Password%20must%20be%20at%20least%208%20characters", request.url), 303);
    const supabase = await createSupabaseServerClient();
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirmed` } });
    if (error) return NextResponse.redirect(new URL(`/auth/signup?error=${encodeURIComponent(error.message)}`, request.url), 303);
    if (data.session) return NextResponse.redirect(new URL("/", request.url), 303);
    return NextResponse.redirect(new URL(`/auth/login?notice=${encodeURIComponent("Check your email to confirm your account. After confirmation, Outcom will open a secure success screen and establish your session.")}`, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create your workspace.";
    return NextResponse.redirect(new URL(`/auth/signup?error=${encodeURIComponent(message)}`, request.url), 303);
  }
}
