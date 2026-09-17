import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase email service is not configured." }, { status: 500 });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${origin}/auth/confirmed` },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: "Confirmation email requested. Check Inbox, Spam, and Promotions." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not resend the email." }, { status: 500 });
  }
}
