import type { ReactNode } from "react";

export const LEGAL_CONTACT = "outcom.devv@gmail.com";
export const LEGAL_UPDATED = "October 21, 2026";

/** Plain, public page shell for /privacy and /terms (readable without an account). */
export default function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 80px", lineHeight: 1.65, fontSize: 16 }}>
      <a href="/" style={{ fontWeight: 700, letterSpacing: ".08em", textDecoration: "none", color: "inherit" }}>OUTCOM</a>
      <h1 style={{ fontSize: 34, margin: "28px 0 6px" }}>{title}</h1>
      <p style={{ opacity: 0.65, margin: "0 0 24px" }}>Last updated {LEGAL_UPDATED}</p>
      <p>{intro}</p>
      {children}
      <p style={{ marginTop: 40 }}>Questions? Write to <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.</p>
      <p style={{ marginTop: 24, fontSize: 14, opacity: 0.65 }}><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a></p>
    </div>
  );
}

export const H = ({ children }: { children: ReactNode }) => <h2 style={{ fontSize: 21, margin: "32px 0 8px" }}>{children}</h2>;
