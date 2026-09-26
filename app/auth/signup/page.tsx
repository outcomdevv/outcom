import SignupForm from "@/app/auth/signup/form";

export default async function Signup({searchParams}:{searchParams:Promise<{error?:string}>}){
  const p=await searchParams;
  return <div className="auth-page"><div className="auth-card"><img src="/outcom-logo.png" className="auth-logo" alt="Outcom"/><span className="auth-kicker">DESIGN PARTNER ACCESS</span><h1>Your automation fleet,<br/><em>under proof.</em></h1><p>Create a workspace. Your workflows, connections, findings and outcome history belong to your account.</p><SignupForm error={p.error}/></div></div>
}
