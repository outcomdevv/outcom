"use client";

import { useState } from "react";

/** Lets the owner replace a workflow's webhook address after the setup screen is gone. The old address stops working at once. */
export default function RotateAddress({ provider, workflowId }: { provider: string; workflowId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/webhooks/rotate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, workflowId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || typeof j.url !== "string") setError(r.status === 404 ? "This workflow has no webhook address to replace." : typeof j.error === "string" ? j.error : "Could not make a new address.");
      else { setUrl(j.url); setConfirm(false); }
    } catch { setError("Could not reach Outcom."); }
    setBusy(false);
  }

  return (
    <section className="section">
      <div className="section-heading"><span>WEBHOOK ADDRESS</span><h2>Where your automation reports</h2></div>
      <div className="surface" style={{ display: "grid", gap: 12, padding: 18 }}>
        <p className="workflow-sub" style={{ margin: 0 }}>The address is a secret key. If it was shared by mistake, make a new one. The old address stops working immediately, so paste the new one into your automation.</p>
        {url && <div className="cx-code"><code>{url}</code><button type="button" className="simple-secondary" onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true)); }}>{copied ? "Copied ✓" : "Copy address"}</button></div>}
        {!confirm && <div><button type="button" className="simple-secondary" onClick={() => { setConfirm(true); setUrl(null); setCopied(false); }}>Make a new address</button></div>}
        {confirm && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="simple-primary" disabled={busy} onClick={rotate}>{busy ? "Working…" : "Yes, replace the address"}</button>
          <button type="button" className="simple-secondary" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
        </div>}
        {error && <p className="cx-error" style={{ margin: 0 }}>{error}</p>}
      </div>
    </section>
  );
}
