"use client";
import { useState } from "react";
import type { ShareRow } from "@/lib/report-shares";

type Wf = { id: string; name: string };

export default function ShareManager({ workflows, initial }: { workflows: Wf[]; initial: ShareRow[] }) {
  const [shares, setShares] = useState(initial);
  const [title, setTitle] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [days, setDays] = useState(30);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function create() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/reports/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, preparedBy, days, workflowIds: picked }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create the link.");
      setShares((s) => [json.share, ...s]); setTitle("");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not create the link."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!window.confirm("Stop sharing this report? The link will stop working.")) return;
    const res = await fetch("/api/reports/share", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) setShares((s) => s.filter((x) => x.id !== id)); else setMsg("Could not revoke the link.");
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setMsg("Link copied."); } catch { setMsg("Copy failed. Select the link and copy it manually."); }
  }

  return (
    <section className="proof-share">
      <h2>Share with a client</h2>
      <p className="proof-hint">Creates a private link to a live report. It shows counts, workflow names and finding titles only, never record values. Anyone with the link can view it until you revoke it.</p>
      <div className="proof-form">
        <label>Report title<input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Acme Co. — automation results" /></label>
        <label>Prepared by <small>(optional)</small><input value={preparedBy} maxLength={80} onChange={(e) => setPreparedBy(e.target.value)} placeholder="Your agency name" /></label>
        <label>Period<select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
        <fieldset><legend>Workflows <small>(none selected = all)</small></legend>
          {workflows.map((w) => <label key={w.id} className="proof-check"><input type="checkbox" checked={picked.includes(w.id)} onChange={() => toggle(w.id)} /> {w.name}</label>)}
        </fieldset>
        <button type="button" disabled={busy || !title.trim()} onClick={create}>{busy ? "Creating…" : "Create share link"}</button>
      </div>
      {msg && <p className="proof-msg" role="status">{msg}</p>}
      {shares.length > 0 && (
        <ul className="proof-links">
          {shares.map((s) => (
            <li key={s.id}>
              <span><b>{s.title}</b><small>{s.days} days · {s.workflowIds.length ? `${s.workflowIds.length} workflow(s)` : "all workflows"}</small></span>
              <button type="button" onClick={() => copy(s.url)}>Copy link</button>
              <a href={s.url} target="_blank" rel="noreferrer">Open</a>
              <button type="button" className="danger" onClick={() => revoke(s.id)}>Revoke</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
