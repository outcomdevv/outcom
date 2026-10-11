"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/app/loading-screen";
import { TableIcon } from "@/app/connect/icons";

export type AirtableTargetState = { baseId: string; tableId: string; tableName: string; keyField: string };
export type HubspotTargetState = { keyProperty: string };

async function getJson(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  return { ok: r.ok, j: await r.json().catch(() => ({})) as any };
}

/** Connect a pasted read-only token. Shared by Airtable and HubSpot. */
function TokenForm({ provider, label, steps, onConnected }: { provider: "airtable" | "hubspot"; label: string; steps: React.ReactNode[]; onConnected: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connect() {
    setBusy(true); setError(null);
    const r = await fetch(`/api/${provider}/connect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error || `${label} did not accept this token.`);
    setToken(""); onConnected();
  }
  return (
    <div className="cx-ghl">
      <ol className="cx-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <div className="cx-row">
        <input name={`outcom-${provider}-token`} type="password" autoComplete="new-password" value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && token.trim()) void connect(); }} placeholder={`${label} token`} />
        <button type="button" className="simple-primary" disabled={busy || !token.trim()} onClick={connect}>{busy ? "Checking…" : "Connect"}</button>
      </div>
      {error && <p className="cx-error">{error}</p>}
    </div>
  );
}

export function AirtablePanel({ connected, onConnected, value, onChange, onHeaders }: {
  connected: boolean; onConnected: () => void; value: AirtableTargetState | null; onChange: (v: AirtableTargetState | null) => void; onHeaders: (h: string[]) => void;
}) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([]);
  const [pending, setPending] = useState<{ baseId: string; tableId: string; tableName: string; fields: string[] } | null>(null);
  const [changing, setChanging] = useState(false);

  async function open(url: string) {
    setBusy("Reading your table"); setError(null);
    const { ok, j } = await getJson(url);
    setBusy(null);
    if (!ok) return setError(j.error || "Could not read this table.");
    if (Array.isArray(j.tables)) { setTables(j.tables); setPending(null); return; }
    setTables([]); setPending({ baseId: j.baseId, tableId: j.tableId, tableName: j.tableName, fields: j.fields || [] });
    onHeaders(j.fields || []);
  }
  const pickKey = (k: string) => { if (pending && k) { onChange({ baseId: pending.baseId, tableId: pending.tableId, tableName: pending.tableName, keyField: k }); setChanging(false); } };

  if (!connected) return (
    <TokenForm provider="airtable" label="Airtable" onConnected={onConnected} steps={[
      <>Airtable → <b>Developer hub</b> → <b>Personal access tokens</b> → Create token</>,
      <>Scopes: <b>data.records:read</b> and <b>schema.bases:read</b>. Add your base.</>,
      <>Copy the token and paste it here.</>,
    ]} />
  );

  return (
    <div className="cx-sheet">
      {value && !changing && <div className="cx-picked"><TableIcon size={30} /><span><b>{value.tableName}</b><small>Matched by {value.keyField}</small></span><button type="button" className="cx-link" onClick={() => setChanging(true)}>Change</button></div>}
      {(!value || changing) && <>
        <div className="cx-row">
          <input name="outcom-airtable-link" autoComplete="off" value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && link.trim()) void open(`/api/airtable/table?link=${encodeURIComponent(link)}`); }} placeholder="Paste the link of your Airtable table" />
          <button type="button" className="simple-primary" disabled={Boolean(busy) || !link.trim()} onClick={() => open(`/api/airtable/table?link=${encodeURIComponent(link)}`)}>Open</button>
        </div>
        {tables.length > 0 && <div className="cx-files">{tables.map(t => <button type="button" key={t.id} onClick={() => open(`/api/airtable/table?link=${encodeURIComponent(link)}&tableId=${encodeURIComponent(t.id)}`)}><TableIcon size={22} /><span>{t.name}</span></button>)}</div>}
        {pending && <div className="cx-pick-grid">
          <label>Table<input value={pending.tableName} readOnly /></label>
          <label>Column that identifies each record<select value={value?.keyField || ""} onChange={e => pickKey(e.target.value)}><option value="">Choose…</option>{pending.fields.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
        </div>}
      </>}
      {busy && <LoadingScreen inline message={busy} />}
      {error && <p className="cx-error">{error}</p>}
    </div>
  );
}

const KEYS = [{ id: "email", text: "Email" }, { id: "phone", text: "Phone" }, { id: "id", text: "HubSpot contact ID" }];

export function HubspotPanel({ connected, onConnected, value, onChange, onHeaders }: {
  connected: boolean; onConnected: () => void; value: HubspotTargetState | null; onChange: (v: HubspotTargetState) => void; onHeaders: (h: string[]) => void;
}) {
  useEffect(() => {
    if (!connected) return;
    if (!value) onChange({ keyProperty: "email" });
    void getJson("/api/hubspot/properties").then(({ j }) => { if (Array.isArray(j.properties)) onHeaders(j.properties); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  if (!connected) return (
    <TokenForm provider="hubspot" label="HubSpot" onConnected={onConnected} steps={[
      <>HubSpot → <b>Settings → Integrations → Private Apps</b> → Create a private app</>,
      <>Scope: <b>crm.objects.contacts.read</b> (read only)</>,
      <>Copy the <b>access token</b> and paste it here.</>,
    ]} />
  );
  return (
    <div className="cx-sheet">
      <div className="cx-picked"><span><b>HubSpot contacts</b><small>Outcom looks up each contact by the value you send</small></span></div>
      <label className="cx-field">Match contacts by
        <select value={value?.keyProperty || "email"} onChange={e => onChange({ keyProperty: e.target.value })}>{KEYS.map(k => <option key={k.id} value={k.id}>{k.text}</option>)}</select>
      </label>
    </div>
  );
}
