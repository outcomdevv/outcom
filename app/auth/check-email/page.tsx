"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

function GmailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none">
      <path fill="#EA4335" d="M3 5.5A3.5 3.5 0 0 1 6.5 2H8l4 3.2L16 2h1.5A3.5 3.5 0 0 1 21 5.5V19a3 3 0 0 1-3 3h-2V9.2l-6 4.6-6-4.6V22H3a3 3 0 0 1-3-3V5.5Z" transform="translate(1 -1) scale(.92)" />
      <path fill="#4285F4" d="M3 6.5 12 13l9-6.5V5a3 3 0 0 0-4.8-2.4L12 5.7 7.8 2.6A3 3 0 0 0 3 5v1.5Z" />
      <path fill="#34A853" d="M3 6.5V19a3 3 0 0 0 3 3h2V9.2L3 6.5Z" />
      <path fill="#FBBC04" d="M21 6.5V19a3 3 0 0 1-3 3h-2V9.2l5-2.7Z" />
    </svg>
  );
}

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
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
      setMessage("Request sent. Check Inbox, Spam, and Promotions.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not resend the email.");
    }
  }

  return (
    <main className="auth-page auth-check-page">
      <section className="auth-card auth-check-card" aria-labelledby="check-email-title">
        <img src="/outcom-logo.png" className="auth-logo" alt="Outcom" />
        <div className="mail-illustration" aria-hidden="true">
          <div className="mail-illustration-paper" />
          <div className="mail-illustration-check">✓</div>
        </div>
        <span className="auth-kicker">WORKSPACE CREATED</span>
        <h1 id="check-email-title">Check your email<br /><em>to activate Outcom.</em></h1>
        <p className="auth-check-intro">
          We created your workspace request. Open the confirmation email, click the button,
          and we&apos;ll bring you straight into your Outcom dashboard.
        </p>

        <a className="gmail-button" href="https://mail.google.com/" target="_blank" rel="noreferrer">
          <GmailIcon />
          <span><strong>Open Gmail</strong><small>Check your inbox for Outcom</small></span>
          <b>↗</b>
        </a>

        <div className="auth-check-steps">
          <div><span>1</span><p>Open the email from Outcom.</p></div>
          <div><span>2</span><p>Click the confirmation button.</p></div>
          <div><span>3</span><p>Return to Outcom and enter your dashboard.</p></div>
        </div>

        <Link className="auth-secondary auth-check-login" href="/auth/login">I have confirmed — Sign in</Link>

        <div className="auth-divider"><span>Still haven&apos;t received it?</span></div>
        <div className="auth-check-resend-copy">Confirm the email address below, then request a new message.</div>
        <label>
          Email used for signup
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
        </label>
        <button className="auth-secondary auth-resend-button" type="button" onClick={resend} disabled={!email.trim() || status === "loading"}>
          {status === "loading" ? "Requesting email…" : "Resend confirmation email"}
        </button>
        {message && <div className={status === "error" ? "auth-error" : "auth-notice"} role="status">{message}</div>}
        <p className="auth-delivery-note">
          If no message arrives after checking Spam and Promotions, the issue is in the Supabase email provider/SMTP configuration—not this page.
        </p>
      </section>
    </main>
  );
}
