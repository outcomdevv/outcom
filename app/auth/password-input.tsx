"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export default function PasswordInput({ label, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="auth-password-field">
      {label}
      <span className="auth-password-control">
        <input {...props} type={visible ? "text" : "password"} />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
