"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="outcom-error-page">
          <div className="outcom-error-card">
            <img
              src="/outcom-mascot.png"
              className="outcom-error-mascot"
              alt="Outcom mascot"
            />
            <span className="auth-confirm-badge error">OUTCOM RECOVERY</span>
            <h1>
              Outcom needs a reload.
              <br />
              <em>Your data is not being reset.</em>
            </h1>
            <p>
              The application shell encountered an unexpected error. Your
              saved data has not been reset. Try reloading the application.
            </p>
            <div className="outcom-error-actions">
              <button className="auth-submit" type="button" onClick={() => reset()}>
                Reload Outcom ↻
              </button>
              <a className="auth-secondary" href="/auth/login">
                Sign in again
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
