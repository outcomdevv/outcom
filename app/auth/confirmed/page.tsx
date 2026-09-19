"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ConfirmedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");
  const [message, setMessage] = useState("Securing your workspace session…");

  useEffect(() => {
    let active = true;
    const finish = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const query = new URLSearchParams(window.location.search);
        const queryError = query.get("error");
        if (queryError) throw new Error(queryError);

        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const errorDescription = hash.get("error_description");
        const code = new URLSearchParams(window.location.search).get("code");

        if (errorDescription) throw new Error(errorDescription.replace(/\+/g, " "));

        // Supabase may return either an implicit-flow token pair in the hash
        // or a PKCE authorization code in the query string. Handle both so
        // email confirmation reliably creates the browser session.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState({}, document.title, "/auth/confirmed");
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          window.history.replaceState({}, document.title, "/auth/confirmed");
        }

        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw error || new Error("Your email was confirmed, but the session could not be created.");
        if (!active) return;
        setStatus("success");
        setMessage("Your email is confirmed. Your Outcom workspace is ready.");
        window.setTimeout(() => {
          if (active) router.replace("/");
        }, 1400);
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Confirmation could not be completed.");
      }
    };
    void finish();
    return () => { active = false; };
  }, []);

  return (
    <div className="auth-page auth-confirm-page">
      <div className="auth-card auth-confirm-card">
        <img src="/outcom-mascot.png" className="auth-confirm-mascot" alt="Outcom mascot" />
        <span className={`auth-confirm-badge ${status}`}>
          {status === "checking" ? "VERIFYING" : status === "success" ? "EMAIL CONFIRMED" : "CONFIRMATION ISSUE"}
        </span>
        <h1>{status === "success" ? <>You're in.<br /><em>Let's prove outcomes.</em></> : status === "error" ? <>Almost there.<br /><em>Let's fix this.</em></> : <>Checking your email…</>}</h1>
        <p>{message}</p>
        {status === "success" ? (
          <button className="auth-submit auth-confirm-button" onClick={() => router.replace("/")}>Enter Outcom <span>↗</span></button>
        ) : status === "error" ? (
          <div className="auth-confirm-actions"><Link className="auth-submit auth-confirm-button" href="/auth/login">Back to sign in <span>↗</span></Link><button className="auth-secondary auth-retry" onClick={() => window.location.reload()}>Try again</button></div>
        ) : (
          <div className="auth-loading"><span className="auth-spinner" /> Establishing your secure session</div>
        )}
      </div>
    </div>
  );
}
