"use client";

import { useState } from "react";
import LoadingScreen from "@/app/loading-screen";

export type TargetSystem = "google_sheets" | "ghl" | "none";
export type SheetTargetState = { spreadsheetId: string; spreadsheetName: string; sheetName: string; keyColumn: string; access?: "oauth" | "service_account" };
type SheetFile = { id: string; name: string; modifiedTime: string | null };

type Props = {
  value: TargetSystem;
  onChange: (v: TargetSystem) => void;
  googleConnected: boolean;
  googleConfigured: boolean;
  /** Outcom's robot email (service account). When set and Google is not connected, the customer can just share the sheet with it. */
  robotEmail?: string | null;
  ghlConnected: boolean;
  sheet: SheetTargetState | null;
  onSheet: (s: SheetTargetState | null) => void;
  onConnectGoogle: () => void;
};

const options: Array<{ id: TargetSystem; title: string; desc: string; badge?: string }> = [
  { id: "google_sheets", title: "Google Sheets", desc: "Free · works with any Google account · read-only", badge: "Easiest" },
  { id: "ghl", title: "HighLevel", desc: "Needs a HighLevel account + Private Integration Token" },
  { id: "none", title: "No system yet", desc: "Only check that each run succeeded and produced output" },
];

async function api(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

export default function BusinessSystemPicker({ value, onChange, googleConnected, googleConfigured, robotEmail, ghlConnected, sheet, onSheet, onConnectGoogle }: Props) {
  const robot = !googleConnected && Boolean(robotEmail);
  const acc = robot ? "&access=service_account" : "";
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<SheetFile[]>([]);
  const [query, setQuery] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [file, setFile] = useState<SheetFile | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [tab, setTab] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);

  function fail(res: { status: number; j: any }, fallback: string) {
    setReauth(Boolean(res.j?.reauthRequired));
    setError(typeof res.j?.error === "string" ? res.j.error : fallback);
  }

  async function browse(q = query) {
    setBusy("Loading your spreadsheets"); setError(null); setReauth(false);
    const res = await api(`/api/google/sheets?q=${encodeURIComponent(q)}`);
    setBusy(null);
    if (!res.ok) return fail(res, "Could not list your spreadsheets.");
    setFiles(res.j.files || []);
    if (!(res.j.files || []).length) setError("No spreadsheets found. Paste a link instead.");
  }

  async function useLink() {
    setBusy("Opening spreadsheet"); setError(null); setReauth(false);
    const res = await api(`/api/google/sheets?link=${encodeURIComponent(link)}${acc}`);
    setBusy(null);
    if (!res.ok) return fail(res, "Could not open that spreadsheet.");
    if (res.j.files?.[0]) await pickFile(res.j.files[0]);
  }

  async function pickFile(f: SheetFile) {
    setFile(f); setTab(""); setHeaders([]); setTabs([]); onSheet(null); setError(null); setBusy("Reading tabs");
    const res = await api(`/api/google/sheets/${encodeURIComponent(f.id)}${acc ? "?" + acc.slice(1) : ""}`);
    setBusy(null);
    if (!res.ok) return fail(res, "Could not read this spreadsheet.");
    setTabs(res.j.tabs || []);
    if ((res.j.tabs || []).length === 1) await pickTab(f, res.j.tabs[0]);
  }

  async function pickTab(f: SheetFile, t: string) {
    setTab(t); setHeaders([]); onSheet(null); setError(null); setBusy("Reading columns");
    const res = await api(`/api/google/sheets/${encodeURIComponent(f.id)}?tab=${encodeURIComponent(t)}${acc}`);
    setBusy(null);
    if (!res.ok) return fail(res, "Could not read this tab.");
    setHeaders(res.j.headers || []);
    if (!(res.j.headers || []).length) setError("The first row of this tab is empty. Outcom reads column names from row 1.");
  }

  const pickKey = (k: string) => file && onSheet(k ? { spreadsheetId: file.id, spreadsheetName: file.name, sheetName: tab, keyColumn: k, access: robot ? "service_account" : "oauth" } : null);

  return (
    <section id="business-system-picker" className="business-system-card">
      <div className="simple-section-title"><span>BUSINESS SYSTEM · SOURCE OF TRUTH</span><h2>Where does the real result live?</h2><p>Outcom checks this system after each run. You do not need HighLevel — pick whatever you already use.</p></div>
      <div className="simple-discovery-list">
        {options.map(o => (
          <button type="button" key={o.id} className={value === o.id ? "chosen" : ""} onClick={() => onChange(o.id)}>
            <span><b>{o.title}{o.badge ? ` · ${o.badge}` : ""}</b><small>{o.desc}</small></span><strong>{value === o.id ? "✓" : "Choose"}</strong>
          </button>
        ))}
      </div>

      {value === "none" && <p className="simple-help">Without a business system, Outcom can still catch failed runs and runs that produced nothing. Add Google Sheets or HighLevel later to verify the actual result.</p>}
      {value === "ghl" && !ghlConnected && <p className="simple-help">Connect HighLevel in the section below. If you would rather not create a HighLevel account, choose Google Sheets above.</p>}

      {value === "google_sheets" && <div className="connection-setup-block">
        {robot && <div className="setup-instructions">
          <b>Easiest: share your sheet with Outcom</b>
          <ol>
            <li>Open your Google Sheet and click <strong>Share</strong>.</li>
            <li>Add this email as <strong>Viewer</strong>: <code>{robotEmail}</code> <button type="button" className="simple-secondary" onClick={() => { void navigator.clipboard?.writeText(robotEmail || ""); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button></li>
            <li>Paste the sheet link below. No Google sign-in needed, and Outcom can only read.</li>
          </ol>
        </div>}
        {!googleConnected && !robot && <>
          <div className="setup-instructions"><b>Connect Google (read-only)</b><p className="compact-instruction">Outcom only reads spreadsheets. It cannot edit, create or delete anything.</p></div>
          {googleConfigured
            ? <button className="simple-primary" onClick={onConnectGoogle}>Connect Google →</button>
            : <p className="simple-help">Google sign-in is not configured on this deployment yet (missing GOOGLE_SHEETS_CLIENT_ID / SECRET).</p>}
        </>}
        {(googleConnected || robot) && <>
          <p className="simple-help">{robot ? "✓ Using Outcom's read-only robot email." : "✓ Google connected."} {sheet ? <>Checking <b>{sheet.spreadsheetName}</b> → <b>{sheet.sheetName}</b>, matching rows by <b>{sheet.keyColumn}</b>.</> : "Choose the spreadsheet that holds the result."}</p>
          {!robot && <div className="simple-form-grid">
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void browse(); }} placeholder="Search your spreadsheets by name" autoComplete="off" />
            <button className="simple-secondary" onClick={() => browse()} disabled={Boolean(busy)}>Browse spreadsheets</button>
          </div>}
          <div className="simple-form-grid">
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="…or paste a Google Sheets link" autoComplete="off" />
            <button className="simple-secondary" onClick={useLink} disabled={Boolean(busy) || !link.trim()}>Use link</button>
          </div>
          {files.length > 0 && !file && <div className="simple-discovery-list">{files.map(f => <button type="button" key={f.id} onClick={() => pickFile(f)}><span><b>{f.name}</b><small>{f.modifiedTime ? `Edited ${new Date(f.modifiedTime).toLocaleDateString()}` : "Spreadsheet"}</small></span><strong>Select</strong></button>)}</div>}
          {file && <div className="outcome-config-grid">
            <label>Tab<select value={tab} onChange={e => void pickTab(file, e.target.value)}><option value="">Choose a tab…</option>{tabs.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
            <label>Column that identifies the record<select value={sheet?.keyColumn || ""} onChange={e => pickKey(e.target.value)} disabled={!headers.length}><option value="">Choose a column…</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></label>
          </div>}
          {file && <button className="simple-secondary" onClick={() => { setFile(null); setTabs([]); setTab(""); setHeaders([]); onSheet(null); }}>Choose a different spreadsheet</button>}
          <small>Your automation will send the value of that column (for example the lead&apos;s email) as <code>target_record_id</code>. Outcom then looks for that row.</small>
        </>}
        {busy && <LoadingScreen inline message={busy} />}
        {error && <p className="simple-inline-message">{error}</p>}
        {reauth && <button className="simple-primary" onClick={onConnectGoogle}>Reconnect Google →</button>}
      </div>}
    </section>
  );
}
