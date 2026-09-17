"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

export default function PasswordInput({ label, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="auth-password-field">
      <span className="auth-field-label">{label}</span>
      <span
        className="auth-password-control"
        style={{ display: "flex", alignItems: "stretch", width: "100%", gap: 0 }}
      >
        <input
          {...props}
          type={visible ? "text" : "password"}
          style={{ flex: "1 1 auto", minWidth: 0, width: "auto", paddingRight: 12 }}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          style={{
            flex: "0 0 68px",
            minWidth: 68,
            marginLeft: 6,
            border: "1px solid #cfd2d7",
            borderRadius: 7,
            background: "#f4f5f6",
            color: "#17181b",
            fontSize: 10,
            fontWeight: 800,
            cursor: "pointer",
            minHeight: 42,
          }}
        >
          {visible ? "HIDE" : "SHOW"}
        </button>
      </span>
    </label>
  );
}
