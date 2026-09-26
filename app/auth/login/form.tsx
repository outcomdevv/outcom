"use client";

import Link from "next/link";
import PasswordInput from "@/app/auth/password-input";
import ResendConfirmation from "@/app/auth/resend-confirmation";
import LoadingScreen from "@/app/loading-screen";
import { useState } from "react";

export default function LoginForm({ error, notice }: { error?: string; notice?: string }) {
  const [loading, setLoading] = useState(false);
  return <>
    <form action="/api/auth/login" method="post" onSubmit={() => setLoading(true)}>
      <label>Email<input name="email" type="email" required autoComplete="email"/></label>
      <PasswordInput label="Password" name="password" required autoComplete="current-password" />
      {error&&<div className="auth-error">{error}</div>}
      {notice&&<div className="auth-notice">{notice}</div>}
      <button className="auth-submit" disabled={loading}>{loading ? <LoadingScreen inline message="Signing you in" /> : <>Sign in <span>↗</span></>}</button>
    </form>
    <ResendConfirmation/>
    <div className="auth-divider"><span>New to Outcom?</span></div>
    <Link className="auth-secondary" href="/auth/signup">Create workspace</Link>
  </>;
}
