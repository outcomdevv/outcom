import ResetForm from "@/app/auth/reset/form";

export default function ResetPassword() {
  return <div className="auth-page"><div className="auth-card"><img src="/outcom-logo.png" className="auth-logo" alt="Outcom"/><span className="auth-kicker">ACCOUNT RECOVERY</span><h1>Choose a<br/><em>new password.</em></h1><ResetForm/></div></div>;
}
