"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setNotice(String(j.message || "Check your email."));
      else setError(String(j.error || "Could not send the email."));
    } catch { setError("Could not reach Outcom. Try again."); }
    setBusy(false);
  }

  return <>
    <form onSubmit={submit}>
      <label>Email<input name="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {error && <div className="auth-error">{error}</div>}
      {notice && <div className="auth-notice">{notice}</div>}
      <button className="auth-submit" disabled={busy || !email.trim()}>{busy ? "Sending…" : <>Send reset link <span>↗</span></>}</button>
    </form>
    <div className="auth-divider"><span>Remembered it?</span></div>
    <Link className="auth-secondary" href="/auth/login">Back to sign in</Link>
  </>;
}
