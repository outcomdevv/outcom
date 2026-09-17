"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

export default function ResendConfirmation() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Supabase public configuration is missing.");
      const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
      });
      if (error) throw error;
      setState("success");
      setMessage("Request sent. Check Inbox, Spam, and Promotions. If nothing arrives, the Supabase SMTP/email provider must be configured.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not resend the confirmation email.");
    }
  }

  return (
    <section className="auth-resend" aria-label="Send confirmation email again">
      <div className="auth-divider"><span>Didn't receive the email?</span></div>
      <form onSubmit={submit}>
        <label>Email to resend confirmation
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </label>
        <button className="auth-secondary" type="submit" disabled={state === "loading"}>
          {state === "loading" ? "Sending…" : "Resend confirmation email"}
        </button>
      </form>
      {message && <div role="status" className={state === "error" ? "auth-error" : "auth-notice"}>{message}</div>}
    </section>
  );
}
