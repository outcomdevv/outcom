"use client";

import { useRef, useState } from "react";
import type { FlowNode, Suggestion, Risk } from "@/lib/suggested-checks";

export type ScanResult = { workflowName: string; flow: FlowNode[]; suggestions: Suggestion[]; risks: Risk[] };

type Props = { platform: "n8n" | "make"; onRead: (r: ScanResult) => void };

/** n8n: paste the workflow. Make: choose the exported blueprint file. Outcom fills in the rest. Nothing is stored. */
export default function ScanWorkflow({ platform, onRead }: Props) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(payload: string) {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/integrations/suggest-checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflow: payload }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) setError(j.error || "Could not read this workflow.");
      else { onRead(j as ScanResult); setText(""); setFileName(null); }
    } catch { setError("Could not reach Outcom. Try again."); }
    setBusy(false);
  }

  async function pickFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) return setError("That file is too large (2 MB limit).");
    setFileName(f.name);
    setText(await f.text());
  }

  return (
    <div className="cx-scan">
      <h3>Fastest: let Outcom read your {platform === "make" ? "scenario" : "workflow"}</h3>
      {platform === "make"
        ? <small className="cx-muted">In Make open your scenario, click <b>⋯</b> (More) → <b>Export Blueprint</b>, then choose that file here. Outcom fills in the rest.</small>
        : <small className="cx-muted">In n8n click the canvas, press <b>Ctrl+A</b> then <b>Ctrl+C</b>, and paste here. Outcom fills in the rest.</small>}
      {platform === "make" && <div className="cx-row">
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => void pickFile(e.target.files?.[0])} />
        <button type="button" className="simple-secondary" onClick={() => fileRef.current?.click()}>{fileName ? `Chosen: ${fileName}` : "Choose the blueprint file"}</button>
      </div>}
      {platform === "n8n" && <textarea name="outcom-workflow-paste" autoComplete="off" value={text} onChange={e => setText(e.target.value)} placeholder="Paste here" />}
      <div className="cx-row"><button type="button" className="simple-primary" disabled={busy || !text.trim()} onClick={() => void run(text)}>{busy ? "Reading…" : platform === "make" ? "Read my scenario" : "Read my workflow"}</button></div>
      {error && <p className="cx-error">{error}</p>}
    </div>
  );
}
