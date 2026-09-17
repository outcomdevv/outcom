"use client";

import { useEffect } from "react";

export default function ErrorPage({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Outcom route error", error); }, [error]);
  return (
    <div className="outcom-error-page">
      <div className="outcom-error-card">
        <img src="/outcom-mascot.png" className="outcom-error-mascot" alt="Outcom mascot" />
        <span className="auth-confirm-badge error">SERVER RECOVERABLE ERROR</span>
        <h1>Something broke.<br /><em>Your workspace is still safe.</em></h1>
        <p>Outcom hit an unexpected server error while loading this page. Your saved workspace data is stored separately and this screen does not delete or reset it.</p>
        <div className="outcom-error-actions">
          <a className="auth-submit" href="/">Reload workspace ↻</a>
          <a className="auth-secondary" href="/auth/login">Return to sign in</a>
        </div>
        <small>If this persists, check the Vercel deployment logs and environment variables.</small>
      </div>
    </div>
  );
}
