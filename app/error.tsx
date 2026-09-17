"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Outcom route error", error); }, [error]);
  return (
    <div className="outcom-error-page">
      <div className="outcom-error-card">
        <img src="/outcom-mascot.png" className="outcom-error-mascot" alt="Outcom mascot" />
        <span className="auth-confirm-badge error">SERVER RECOVERABLE ERROR</span>
        <h1>Something broke.<br /><em>Your workspace is still safe.</em></h1>
        <p>Outcom hit an unexpected server error while loading this page. Your saved workspace data is stored separately in Supabase and this screen does not delete or reset it.</p>
        <div className="outcom-error-actions"><button className="auth-submit" onClick={() => reset()}>Reload workspace ↻</button><Link className="auth-secondary" href="/auth/login">Return to sign in</Link></div>
        <small>Try a hard refresh if this persists. If it keeps happening, the deployment logs will contain the server error digest.</small>
      </div>
    </div>
  );
}
