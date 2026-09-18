"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      {!crossed && <circle cx="12" cy="12" r="3" />}
      {crossed && <><path d="m3 3 18 18" /><path d="M9.9 4.9A11.7 11.7 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-3.1 3.9" /><path d="M6.1 6.1C3.5 8.1 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.1-.8" /></>}
    </svg>
  );
}

export default function PasswordInput({ label, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="auth-password-field">
      <span className="auth-field-label">{label}</span>
      <span className="auth-password-control">
        <input {...props} type={visible ? "text" : "password"} />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          <EyeIcon crossed={!visible} />
        </button>
      </span>
    </label>
  );
}
