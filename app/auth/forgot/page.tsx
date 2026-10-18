import ForgotForm from "@/app/auth/forgot/form";

export default function ForgotPassword() {
  return <div className="auth-page"><div className="auth-card"><img src="/outcom-logo.png" className="auth-logo" alt="Outcom"/><span className="auth-kicker">ACCOUNT RECOVERY</span><h1>Forgot your<br/><em>password?</em></h1><p>Enter your email. We will send you a link to choose a new one.</p><ForgotForm/></div></div>;
}
