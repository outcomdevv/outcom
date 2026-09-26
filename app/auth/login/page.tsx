import LoginForm from "@/app/auth/login/form";

export default async function Login({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){
  const p=await searchParams;
  return <div className="auth-page"><div className="auth-card"><img src="/outcom-logo.png" className="auth-logo" alt="Outcom"/><span className="auth-kicker">AUTOMATION ASSURANCE PLATFORM</span><h1>Protect the outcome,<br/><em>not just the run.</em></h1><p>Sign in to your Outcom workspace and verify business state across your automation fleet.</p><LoginForm error={p.error} notice={p.notice}/></div></div>
}
