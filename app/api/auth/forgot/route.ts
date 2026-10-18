import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Same answer whether or not the email has an account, so this cannot be used to find out who is registered.
const SENT = "If an account exists for that email, a reset link is on its way. Check Inbox and Spam.";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ error: "The email service is not configured." }, { status: 500 });

    // Not a browser session, so the link works on any device (the token comes back in the address, not in a saved cookie).
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } });
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/reset` });
    if (error) {
      const limited = error.status === 429 || /rate limit|too many/i.test(error.message);
      if (limited) return NextResponse.json({ error: "Too many requests. Wait a few minutes and try again." }, { status: 429 });
      console.error("Password reset request failed", error.message);
      return NextResponse.json({ error: "We could not send the email right now. Try again later." }, { status: 502 });
    }
    return NextResponse.json({ message: SENT });
  } catch (error) {
    console.error("Password reset request failed", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
