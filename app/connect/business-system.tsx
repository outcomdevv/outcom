"use client";

import { useState } from "react";
import LoadingScreen from "@/app/loading-screen";
import { IntegrationLogo } from "@/app/integrations";
import { BlockIcon, SheetIcon } from "@/app/connect/icons";
import type { TargetKind } from "@/lib/connect-checks";

export type TargetSystem = TargetKind;
export type SheetTargetState = { spreadsheetId: string; spreadsheetName: string; sheetName: string; keyColumn: string; access?: "oauth" | "service_account" };
type SheetFile = { id: string; name: string; modifiedTime: string | null };

type Props = {
  value: TargetSystem;
  onChange: (v: TargetSystem) => void;
  googleConnected: boolean;
  googleConfigured: boolean;
  /** Outcom's robot email. When set and Google is not connected, the customer just shares the sheet with it. */
  robotEmail?: string | null;
  ghlConnected: boolean;
  sheet: SheetTargetState | null;
  onSheet: (s: SheetTargetState | null) => void;
  /** Column names of the chosen tab, so the page can catch typos in custom checks. */
  onHeaders?: (headers: string[]) => void;
  onConnectGoogle: () => void;
  /** Rendered under HighLevel when it is chosen (token form). */
  ghlPanel?: React.ReactNode;
};

async function api(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

export default function BusinessSystemPicker({ value, onChange, googleConnected, googleConfigured, robotEmail, ghlConnected, sheet, onSheet, onHeaders, onConnectGoogle, ghlPanel }: Props) {
  const [useOwnGoogle, setUseOwnGoogle] = useState(false);
  const robot = !googleConnected && Boolean(robotEmail) && !useOwnGoogle;
  const acc = robot ? "&access=service_account" : "";
  const canRead = googleConnected || robot;

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
  const [copied, setCopied] = useState(false);
  const [changing, setChanging] = useState(false);

  function fail(res: { status: number; j: any }, fallback: string) {
    setReauth(Boolean(res.j?.reauthRequired));
    if (robot && (res.status === 403 || res.status === 404)) return setError(`Outcom can't open this sheet yet. Share it with ${robotEmail} as Viewer, then try again.`);
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
    setTab(t); setHeaders([]); onHeaders?.([]); onSheet(null); setError(null);
    if (!t) return;
    setBusy("Reading columns");
    const res = await api(`/api/google/sheets/${encodeURIComponent(f.id)}?tab=${encodeURIComponent(t)}${acc}`);
    setBusy(null);
    if (!res.ok) return fail(res, "Could not read this tab.");
    setHeaders(res.j.headers || []);
    onHeaders?.(res.j.headers || []);
    if (!(res.j.headers || []).length) setError("Row 1 of this tab is empty. Outcom reads the column names from row 1.");
  }

  const pickKey = (k: string) => { if (file) { onSheet(k ? { spreadsheetId: file.id, spreadsheetName: file.name, sheetName: tab, keyColumn: k, access: robot ? "service_account" : "oauth" } : null); if (k) setChanging(false); } };
  const showPicker = canRead && (!sheet || changing);

  return (
    <section id="business-system-picker" className="cx-card">
      <h3 className="cx-h">Where should Outcom look?</h3>
      <div className="cx-options">
        <button type="button" className={`cx-option ${value === "google_sheets" ? "on" : ""}`} onClick={() => onChange("google_sheets")}>
          <SheetIcon size={34} /><span><b>Google Sheets</b><small>Free · read-only</small></span><i>{value === "google_sheets" ? "✓" : ""}</i>
        </button>
        <button type="button" className={`cx-option ${value === "ghl" ? "on" : ""}`} onClick={() => onChange("ghl")}>
          <IntegrationLogo name="ghl" size={34} /><span><b>HighLevel</b><small>Needs a token</small></span><i>{value === "ghl" ? "✓" : ""}</i>
        </button>
        <button type="button" className={`cx-option ${value === "none" ? "on" : ""}`} onClick={() => onChange("none")}>
          <BlockIcon size={34} /><span><b>Nowhere yet</b><small>Only check the run</small></span><i>{value === "none" ? "✓" : ""}</i>
        </button>
      </div>

      {value === "none" && <p className="cx-note">Outcom will only catch failed runs and runs with no output. Pick Google Sheets later to check the real result.</p>}

      {value === "ghl" && (ghlConnected ? <p className="cx-ok">✓ HighLevel connected</p> : ghlPanel)}

      {value === "google_sheets" && <div className="cx-sheet">
        {sheet && !changing && <div className="cx-picked">
          <SheetIcon size={30} />
          <span><b>{sheet.spreadsheetName}</b><small>Tab {sheet.sheetName} · matched by {sheet.keyColumn}</small></span>
          <button type="button" className="cx-link" onClick={() => setChanging(true)}>Change</button>
        </div>}

        {!canRead && <p className="cx-note">{googleConfigured ? <>Connect your Google account so Outcom can read the sheet. <button type="button" className="cx-link" onClick={onConnectGoogle}>Connect Google →</button></> : "Google Sheets is not available on this server yet."}</p>}

        {showPicker && <>
          {robot && <ol className="cx-steps">
            <li>Open your sheet → <b>Share</b></li>
            <li>Add <code>{robotEmail}</code> as <b>Viewer</b> <button type="button" className="cx-link" onClick={() => { void navigator.clipboard?.writeText(robotEmail || ""); setCopied(true); }}>{copied ? "Copied ✓" : "Copy"}</button></li>
            <li>Paste the sheet link here</li>
          </ol>}
          {!robot && googleConnected && <div className="cx-row">
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void browse(); }} placeholder="Search your spreadsheets" autoComplete="off" name="outcom-sheet-search" />
            <button type="button" className="simple-secondary" onClick={() => browse()} disabled={Boolean(busy)}>Browse</button>
          </div>}
          <div className="cx-row">
            <input value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && link.trim()) void useLink(); }} placeholder="Paste the Google Sheets link" autoComplete="off" name="outcom-sheet-link" />
            <button type="button" className="simple-primary" onClick={useLink} disabled={Boolean(busy) || !link.trim()}>Open</button>
          </div>
          {files.length > 0 && !file && <div className="cx-files">{files.map(f => <button type="button" key={f.id} onClick={() => pickFile(f)}><SheetIcon size={22} /><span>{f.name}</span></button>)}</div>}
          {file && <div className="cx-pick-grid">
            <label>Tab<select value={tab} onChange={e => void pickTab(file, e.target.value)}><option value="">Choose…</option>{tabs.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
            <label>Column that identifies each row<select value={sheet?.keyColumn || ""} onChange={e => pickKey(e.target.value)} disabled={!headers.length}><option value="">Choose…</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></label>
          </div>}
          {robot && googleConfigured && <button type="button" className="cx-link" onClick={() => setUseOwnGoogle(true)}>Use my Google account instead</button>}
        </>}
        {busy && <LoadingScreen inline message={busy} />}
        {error && <p className="cx-error">{error}</p>}
        {reauth && <button type="button" className="simple-primary" onClick={onConnectGoogle}>Reconnect Google →</button>}
      </div>}
    </section>
  );
}
