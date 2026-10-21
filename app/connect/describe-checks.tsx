"use client";
import { useState } from "react";
import type { CheckSuggestion } from "@/lib/check-suggestions";

const OP_TEXT: Record<string, string> = { equals: "is", not_equals: "is not", contains: "contains", not_contains: "does not contain", exists: "is filled in" };

export default function DescribeChecks({ onAdd, disabled }: { onAdd: (s: CheckSuggestion) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<CheckSuggestion[] | null>(null);
  const [added, setAdded] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);

  async function suggest() {
    setBusy(true); setNote(null); setAdded([]);
    try {
      const res = await fetch("/api/assistant/suggest-checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: text }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not suggest checks.");
      setItems(json.suggestions);
      setNote(json.mode === "local" ? (json.note ?? "Basic suggestions. Add an AI key in Settings → Operator for checks tailored to your description.") : null);
    } catch (e) { setNote(e instanceof Error ? e.message : "Could not suggest checks."); }
    finally { setBusy(false); }
  }

  return (
    <div className="cx-card cx-build">
      <h3>Not sure what to check?</h3>
      <p className="cx-muted">Describe what this workflow does and what should be true afterwards. Operator suggests checks. You choose which to keep.</p>
      <textarea rows={3} maxLength={800} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. When a lead fills the form we create a HubSpot contact and set Status to Qualified, then email the sales team." style={{ width: "100%" }} />
      <button type="button" className="simple-secondary" onClick={suggest} disabled={busy || text.trim().length < 8}>{busy ? "Thinking…" : "Suggest checks"}</button>
      {note && <p className="cx-muted" role="status">{note}</p>}
      {items && <ul className="cx-chips">{items.map((s, i) => (
        <li key={i}>
          <span><b>{s.kind === "value" ? `${s.field} ${OP_TEXT[s.operator]}${s.operator === "exists" ? "" : ` “${s.expectedValue}”`}` : s.label}</b>{s.why && <small style={{ display: "block", opacity: 0.7 }}>{s.why}</small>}</span>
          <button type="button" className="simple-secondary" disabled={disabled || added.includes(i)} onClick={() => { onAdd(s); setAdded(a => [...a, i]); }}>{added.includes(i) ? "Added ✓" : "Add"}</button>
        </li>
      ))}</ul>}
    </div>
  );
}
