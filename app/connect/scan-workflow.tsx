"use client";

import { useState } from "react";
import type { FlowNode, Suggestion, Risk } from "@/lib/suggested-checks";

export type ScanResult = { workflowName: string; flow: FlowNode[]; suggestions: Suggestion[]; risks: Risk[] };

type Props = { onRead: (r: ScanResult) => void };

/** n8n only: paste the whole workflow and Outcom fills the rest. Nothing is stored. */
export default function ScanWorkflow({ onRead }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/integrations/suggest-checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflow: text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) setError(j.error || "Could not read this workflow.");
      else { onRead(j as ScanResult); setText(""); }
    } catch { setError("Could not reach Outcom. Try again."); }
    setBusy(false);
  }

  return (
    <div className="cx-scan">
      <h3>Fastest: let Outcom read your workflow</h3>
      <small className="cx-muted">In n8n click the canvas, press <b>Ctrl+A</b> then <b>Ctrl+C</b>, and paste here. Outcom fills in the rest.</small>
      <textarea name="outcom-workflow-paste" autoComplete="off" value={text} onChange={e => setText(e.target.value)} placeholder='Paste here' />
      <div className="cx-row"><button type="button" className="simple-primary" disabled={busy || !text.trim()} onClick={read}>{busy ? "Reading…" : "Read my workflow"}</button></div>
      {error && <p className="cx-error">{error}</p>}
    </div>
  );
}
