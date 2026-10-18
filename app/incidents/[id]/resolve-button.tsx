"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Closes a finding by hand, for example a test run or something already fixed. */
export default function ResolveButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function resolve() {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/incidents/${encodeURIComponent(id)}`, { method: "POST" });
      if (!r.ok) setError("Could not close this finding.");
      else router.refresh();
    } catch { setError("Could not reach Outcom."); }
    setBusy(false);
  }
  return (
    <div className="resolve-box">
      <button type="button" className="simple-primary" disabled={busy} onClick={resolve}>{busy ? "Closing…" : "Mark as resolved"}</button>
      <p>Use this when the problem is fixed, or when it was only a test. If the same check fails again later, a new finding opens.</p>
      {error && <p className="cx-error">{error}</p>}
    </div>
  );
}
