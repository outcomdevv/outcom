"use client";

import { useState } from "react";
import type { Suggestion, Risk } from "@/lib/suggested-checks";

type Result = { workflowName: string; trigger: { name: string } | null; stepCount: number; suggestions: Suggestion[]; risks: Risk[] };
const label: Record<string, string> = { high: "High confidence", medium: "Check this", low: "Best guess" };

export default function SuggestClient() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function analyse() {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/integrations/suggest-checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflow: text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) setError(j.error || "Could not read this workflow.");
      else setResult(j);
    } catch { setError("Could not reach Outcom. Try again."); }
    setBusy(false);
  }

  return (
    <>
      <div className="page-header-row"><div><span className="section-kicker">PROTOTYPE · SUGGESTED CHECKS</span><h1 className="page-title">What should this workflow prove?</h1><p className="page-intro">Paste an n8n workflow (select all in n8n, copy, paste here). Outcom reads it and proposes what to check after each run. Nothing is stored.</p></div></div>
      <section className="section">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={10} placeholder='Paste your n8n workflow JSON here, starting with {"nodes": …' style={{ width: "100%", fontFamily: "monospace" }} />
        <div className="hero-cta-row"><button className="simple-primary" onClick={analyse} disabled={busy || !text.trim()}>{busy ? "Reading…" : "Suggest checks →"}</button></div>
        {error && <p className="simple-inline-message">{error}</p>}
      </section>
      {result && <section className="section">
        <h2>{result.workflowName}</h2>
        <p className="simple-help">{result.stepCount} steps · starts with {result.trigger?.name ?? "no trigger found"}</p>
        {!result.suggestions.length && <p className="simple-help">No step that writes business data was found. Outcom can still check that each run succeeds and produces output.</p>}
        {result.suggestions.map((s, i) => (
          <div key={s.nodeName + i} className="business-system-card">
            <span className="section-kicker">{i === 0 ? "MAIN CHECK" : "ALSO POSSIBLE"} · {label[s.confidence]}{s.supported ? "" : " · not supported yet"}</span>
            <h3>{s.title}</h3>
            <p><b>{s.question}</b></p>
            <ul>{s.reasons.map(r => <li key={r}>{r}</li>)}</ul>
            {s.missing.length > 0 && <p className="simple-inline-message">Still needed: {s.missing.join(" ")}</p>}
            {s.contract && <p className="simple-help">{s.recordId.explanation}</p>}
          </div>
        ))}
        {result.risks.map(r => <p key={r.nodeName + r.kind} className="simple-inline-message">⚠ {r.message}</p>)}
      </section>}
    </>
  );
}
