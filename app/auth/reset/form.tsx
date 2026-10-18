"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/app/auth/password-input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MIN_PASSWORD, passwordProblem } from "@/lib/password";

type Phase = "checking" | "ready" | "invalid" | "done";
export default function ResetForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // The email link brings a short-lived recovery session. Turn it into a session in this browser first.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const query = new URLSearchParams(window.location.search);
        const problem = hash.get("error_description") || query.get("error_description");
        if (problem) throw new Error(problem.replace(/\+/g, " "));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const code = query.get("code");
        if (accessToken && refreshToken) {
          const { error: e } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (e) throw e;
        } else if (code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) throw e;
        }
        // Remove the secret from the address bar and from history.
        window.history.replaceState({}, document.title, "/auth/reset");
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        setPhase(data.user ? "ready" : "invalid");
      } catch {
        if (active) setPhase("invalid");
      }
    })();
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) return setError(problem);
    setBusy(true); setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      // Anyone else who was signed in with the old password is signed out.
      await supabase.auth.signOut({ scope: "others" }).catch(() => {});
      setPhase("done");
      window.setTimeout(() => router.replace("/"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    }
    setBusy(false);
  }

  if (phase === "checking") return <p>Checking your link…</p>;
  if (phase === "invalid") return <>
    <div className="auth-error">This reset link is invalid or has expired. Links work once and expire after a short time.</div>
    <Link className="auth-submit" href="/auth/forgot" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>Get a new link</Link>
  </>;
  if (phase === "done") return <div className="auth-notice">Password changed. Taking you to your workspace…</div>;

  return <form onSubmit={submit}>
    <PasswordInput label="New password" name="password" required autoComplete="new-password" minLength={MIN_PASSWORD} value={password} onChange={e => setPassword(e.target.value)} />
    <PasswordInput label="Repeat new password" name="confirm" required autoComplete="new-password" minLength={MIN_PASSWORD} value={confirm} onChange={e => setConfirm(e.target.value)} />
    {error && <div className="auth-error">{error}</div>}
    <button className="auth-submit" disabled={busy}>{busy ? "Saving…" : <>Save new password <span>↗</span></>}</button>
  </form>;
}
