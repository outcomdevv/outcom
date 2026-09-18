"use client";

import Link from "next/link";
import { useState } from "react";

export default function CheckEmailPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function resend() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not resend the email.");
      setStatus("success");
      setMessage("Confirmation email requested. Check Inbox, Spam, and Promotions.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not resend the email.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/outcom-logo.png" className="auth-logo" alt="Outcom" />
        <span className="auth-kicker">ONE MORE STEP</span>
        <h1>Check your email<br /><em>before signing in.</em></h1>
        <p>
          Your workspace request was received. Open the confirmation email from Outcom,
          click the confirmation button, and we will take you straight into your dashboard.
        </p>
        <div className="auth-notice" style={{ marginTop: 18 }}>
          <strong>Why am I seeing this?</strong> Supabase is currently configured to require
          email confirmation. If you want users to enter Outcom immediately after signup,
          turn off <strong>Confirm email</strong> in Supabase → Authentication → Providers → Email.
        </div>
        <a className="auth-submit" href="https://mail.google.com/" target="_blank" rel="noreferrer">
          Open Gmail <span>↗</span>
        </a>
        <Link className="auth-secondary" href="/auth/login">I have confirmed — Sign in</Link>
        <div className="auth-divider"><span>Didn't receive the email?</span></div>
        <label>
          Email used for signup
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>
        <button className="auth-secondary" type="button" onClick={resend} disabled={!email || status === "loading"}>
          {status === "loading" ? "Sending…" : "Resend confirmation email"}
        </button>
        {message && <div className={status === "error" ? "auth-error" : "auth-notice"} role="status">{message}</div>}
      </div>
    </div>
  );
}
