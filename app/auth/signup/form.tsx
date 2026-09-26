"use client";

import Link from "next/link";
import PasswordInput from "@/app/auth/password-input";
import LoadingScreen from "@/app/loading-screen";
import { useState } from "react";

export default function SignupForm({ error }: { error?: string }) {
  const [loading, setLoading] = useState(false);
  return <>
    <form action="/api/auth/signup" method="post" onSubmit={() => setLoading(true)}>
      <label>Email<input name="email" type="email" required autoComplete="email"/></label>
      <PasswordInput label="Password" name="password" minLength={8} required autoComplete="new-password"/>
      <small className="auth-field-hint">Use at least 8 characters.</small>
      {error&&<div className="auth-error">{error}</div>}
      <button className="auth-submit" disabled={loading}>{loading ? <LoadingScreen inline message="Creating your workspace" /> : <>Create workspace <span>↗</span></>}</button>
    </form>
    <div className="auth-divider"><span>Already have an account?</span></div>
    <Link className="auth-secondary" href="/auth/login">Sign in</Link>
  </>;
}
