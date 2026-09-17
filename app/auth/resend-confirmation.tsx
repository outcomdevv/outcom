"use client";

import { useState, type FormEvent } from "react";

export default function ResendConfirmation() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not resend the email.");
      setState("success");
      setMessage(data.message || "If the account needs confirmation, a new email has been sent.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not resend the email.");
    }
  }

  return (
    <div className="auth-resend" aria-label="Send confirmation email again">
      <div className="auth-divider"><span>Didn't receive the email?</span></div>
      <form onSubmit={submit}>
        <label>Email to resend confirmation<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" /></label>
        <button className="auth-secondary" type="submit" disabled={state === "loading"}>{state === "loading" ? "Sending…" : "Send confirmation email again"}</button>
      </form>
      {message && <div className={state === "error" ? "auth-error" : "auth-notice"}>{message}</div>}
    </div>
  );
}
