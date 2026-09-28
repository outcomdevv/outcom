"use client";
import { useEffect, useState } from "react";
import styles from "./records.module.css";

type RecordItem = { id: string; name?: string; tags?: string[]; status?: string; created_at?: string };

export default function RecordsClient() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("new");
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() { const r = await fetch("/api/records", { cache: "no-store" }); const j = await r.json(); if (r.ok) setRecords(j.records || []); else setMessage(j.error || "Could not load records."); }
  useEffect(() => { void load(); }, []);
  async function create() {
    setSaving(true); setMessage("");
    try {
      const r = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name, status, tags: tags.split(",").map((x) => x.trim()).filter(Boolean) }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not create record.");
      setId(""); setName(""); setTags(""); setMessage("✓ Record saved. Use this ID in an automation payload as target_record_id."); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not create record."); } finally { setSaving(false); }
  }
  return <div className={styles.page}>
    <div className={styles.hero}><div><span>OUTCOM RECORDS</span><h1>A tiny business system<br /><em>when you need one.</em></h1><p>Outcom Records is deliberately not a CRM. It is a minimal source of truth you can use to prove that an automation produced the expected record.</p></div><div className={styles.note}><b>NO CRM?</b><strong>Still verify the outcome.</strong><small>Create a record here, then point your automation at it.</small></div></div>
    <section className={styles.card}><div className={styles.head}><span>CREATE</span><div><h2>Add a business record</h2><p>The ID is the correlation key Outcom can verify after an execution.</p></div></div><div className={styles.form}><label>Record ID<input value={id} onChange={(e) => setId(e.target.value)} placeholder="contact-4821" /></label><label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option>new</option><option>qualified</option><option>customer</option><option>closed</option></select></label><label>Tags<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lead, paid-customer" /></label></div><div className={styles.action}><span className={message.startsWith("✓") ? styles.good : styles.bad}>{message}</span><button onClick={create} disabled={saving || !id.trim()}>{saving ? "Saving…" : "Save record →"}</button></div></section>
    <section className={styles.card}><div className={styles.head}><span>RECORDS</span><div><h2>Current business state</h2><p>These records are workspace-scoped and can be used as read-only evidence.</p></div></div>{records.length ? <div className={styles.table}><div className={styles.trHead}><span>ID</span><span>NAME</span><span>STATUS</span><span>TAGS</span></div>{records.map((r) => <div className={styles.tr} key={r.id}><code>{r.id}</code><span>{r.name || "Unknown"}</span><b>{r.status || "new"}</b><small>{(r.tags || []).join(", ") || "—"}</small></div>)}</div> : <div className={styles.empty}>No records yet.</div>}</section>
    <div className={styles.footer}>V74 · Outcom Records is an evidence source, not a CRM replacement.</div>
  </div>;
}
