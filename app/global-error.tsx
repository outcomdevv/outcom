"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en"><body>
      <div className="outcom-error-page">
        <div className="outcom-error-card">
          <img src="/outcom-mascot.png" className="outcom-error-mascot" alt="Outcom mascot" />
          <span className="auth-confirm-badge error">OUTCOM RECOVERY</span>
          <h1>Outcom needs a reload.<br /><em>Your data is not being reset.</em></h1>
          <p>The application shell encountered an unexpected error. Reload the app to restore the session and workspace.</p>
          <div className="outcom-error-actions"><button className="auth-submit" onClick={() => reset()}>Reload Outcom ↻</button><Link className="auth-secondary" href="/auth/login">Sign in again</Link></div>
        </div>
      </div>
    </body></html>
  );
}
