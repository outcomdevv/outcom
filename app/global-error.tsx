export default function GlobalError() {
  return (
    <html lang="en"><body>
      <div className="outcom-error-page">
        <div className="outcom-error-card">
          <img src="/outcom-mascot.png" className="outcom-error-mascot" alt="Outcom mascot" />
          <span className="auth-confirm-badge error">OUTCOM RECOVERY</span>
          <h1>Outcom needs a reload.<br /><em>Your data is not being reset.</em></h1>
          <p>The application shell encountered an unexpected error. Use the links below to restart the app or return to sign in.</p>
          <div className="outcom-error-actions">
            <a className="auth-submit" href="/">Reload Outcom ↻</a>
            <a className="auth-secondary" href="/auth/login">Sign in again</a>
          </div>
        </div>
      </div>
    </body></html>
  );
}
