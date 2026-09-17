"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

export default function PasswordInput({ label, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="auth-password-field">
      <span className="auth-field-label">{label}</span>
      <span className="auth-password-control" style={{ position: "relative", display: "block" }}>
        <input
          {...props}
          type={visible ? "text" : "password"}
          style={{ width: "100%", paddingRight: 82 }}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          style={{
            position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 62, height: 28, padding: "0 9px", border: "1px solid #cfd2d7",
            borderRadius: 7, background: "#f4f5f6", color: "#17181b",
            fontSize: 10, fontWeight: 800, cursor: "pointer", zIndex: 5
          }}
        >
          {visible ? "HIDE" : "SHOW"}
        </button>
      </span>
    </label>
  );
}
