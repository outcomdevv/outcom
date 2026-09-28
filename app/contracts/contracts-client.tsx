"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./contracts.module.css";

type Workflow = { id: string; name: string; platform: string; description: string };
type Contract = { id: string; workflowId: string; name: string; type: string; system: string; entity: string; configuration: Record<string, unknown>; severity: string; enabled: boolean };
type Connection = { provider: string; accountName: string; email?: string | null; metadata?: Record<string, unknown> };

type Props = { workflows: Workflow[]; contracts: Contract[]; connections: Connection[] };

type Template = { id: string; title: string; description: string; type: "record_exists" | "state_invariant" | "output_count" };

const templates: Template[] = [
  { id: "record", title: "A record should exist", description: "Verify that the business record created by the automation can actually be found.", type: "record_exists" },
  { id: "value", title: "A record should contain a value", description: "Check a business field against an expected value.", type: "state_invariant" },
  { id: "tag", title: "A record should have a tag", description: "Verify a required tag is present after the run.", type: "state_invariant" },
  { id: "output", title: "At least one output should be produced", description: "Use the execution payload when the outcome is the output itself.", type: "output_count" },
];

const systems = [
  { id: "outcom_records", title: "Outcom Records", detail: "Use Outcom as the source of truth when you do not have a CRM yet.", status: "ready" },
  { id: "google_sheets", title: "Google Sheets", detail: "Connect Google and verify rows in a spreadsheet.", status: "google" },
  { id: "ghl", title: "HighLevel", detail: "Read-only downstream verification for HighLevel contacts.", status: "connected" },
  { id: "hubspot", title: "HubSpot", detail: "Adapter planned. Keep the contract ready for later.", status: "soon" },
];

export default function ContractsClient({ workflows, contracts: initialContracts, connections }: Props) {
  const [contracts, setContracts] = useState(initialContracts);
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id || "");
  const [system, setSystem] = useState("outcom_records");
  const [template, setTemplate] = useState<Template["id"]>("record");
  const [name, setName] = useState("A business record should exist");
  const [lookupField, setLookupField] = useState("id");
  const [field, setField] = useState("status");
  const [operator, setOperator] = useState("equals");
  const [expectedValue, setExpectedValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetFiles, setSheetFiles] = useState<Array<{ id: string; name: string; webViewLink?: string }>>([]);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [spreadsheetName, setSpreadsheetName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [sheetLookupField, setSheetLookupField] = useState("id");
  const google = connections.find((c) => c.provider === "google_sheets");
  const ghl = connections.find((c) => c.provider === "ghl");
  const selectedTemplate = templates.find((x) => x.id === template)!;
  const selectedWorkflow = useMemo(() => workflows.find((w) => w.id === workflowId), [workflowId, workflows]);

  async function loadGoogleFiles() {
    setSheetsLoading(true);
    try {
      const r = await fetch("/api/google-sheets/files", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not list Google Sheets.");
      setSheetFiles(j.files || []);
      if (!j.files?.length) setMessage("Google is connected, but no spreadsheet is currently available to Outcom. With the V74 drive.file flow, use a file you have explicitly opened/shared with the app, or add Google Picker in the next iteration.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not list Google Sheets."); } finally { setSheetsLoading(false); }
  }

  async function selectSpreadsheet(id: string, title: string) {
    setSpreadsheetId(id); setSpreadsheetName(title); setSheetName(""); setSheetNames([]);
    const r = await fetch(`/api/google-sheets/sheets?spreadsheetId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) { setMessage(j.error || "Could not load sheet tabs."); return; }
    const names = (j.sheets || []).map((x: { title: string }) => x.title).filter(Boolean);
    setSheetNames(names); if (names[0]) setSheetName(names[0]);
  }

  async function configureGoogleSheet() {
    if (!spreadsheetId || !sheetName || !sheetLookupField.trim()) { setMessage("Choose a spreadsheet, a sheet and the lookup column first."); return; }
    const r = await fetch("/api/google-sheets/configure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spreadsheetId, spreadsheetName, sheetName, lookupField: sheetLookupField.trim() }) });
    const j = await r.json();
    if (!r.ok) { setMessage(j.error || "Could not configure Google Sheets."); return; }
    setMessage(`✓ Google Sheets configured · ${spreadsheetName} / ${sheetName} · lookup: ${sheetLookupField.trim()}`);
  }

  function chooseTemplate(id: Template["id"]) {
    setTemplate(id);
    const t = templates.find((x) => x.id === id)!;
    setName(t.title);
    if (id === "tag") { setField("tags"); setOperator("contains"); }
    else if (id === "value") { setField("status"); setOperator("equals"); }
  }

  async function createContract() {
    setMessage("");
    if (!workflowId) { setMessage("Protect a workflow first — there is no workflow to attach this contract to."); return; }
    if (system === "google_sheets" && !google) { setMessage("Connect Google Sheets first, then configure the spreadsheet on this page."); return; }
    if (system === "ghl" && !ghl) { setMessage("Connect HighLevel first, or use Outcom Records for this test."); return; }
    if (selectedTemplate.type === "state_invariant" && !expectedValue.trim()) { setMessage("Give Outcom the value that must be present after the run."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workflowId,
          name: name.trim() || selectedTemplate.title,
          type: selectedTemplate.type,
          system,
          entity: "record",
          severity: "high",
          configuration: {
            mode: system === "outcom_records" ? "native_records" : system === "google_sheets" ? "sheet_lookup" : "downstream",
            expectedOutcome: name.trim() || selectedTemplate.title,
            field: selectedTemplate.type === "state_invariant" ? field : undefined,
            operator: selectedTemplate.type === "state_invariant" ? operator : undefined,
            expectedValue: selectedTemplate.type === "state_invariant" ? expectedValue.trim() : undefined,
            lookup: { field: lookupField, valueFrom: "event.data.target_record_id" },
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create outcome contract.");
      setContracts((current) => [data.contract, ...current]);
      setMessage("✓ Outcome Contract protected. Outcom will verify the downstream business state after execution.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create outcome contract.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.page}>
    <div className={styles.hero}>
      <div>
        <span className={styles.kicker}>OUTCOME CONTRACTS</span>
        <h1>Tell Outcom what<br /><em>should actually happen.</em></h1>
        <p>Choose the business system that holds the truth, describe the expected result in plain language, and let the existing verification engine turn it into an evidence-backed check.</p>
      </div>
      <div className={styles.proof}><span>THE CONTRACT</span><b>Automation ran</b><i>↓</i><b>Business state changed</b><i>↓</i><strong>Outcom verifies the result</strong></div>
    </div>

    <section className={styles.card}>
      <div className={styles.sectionHead}><span>01</span><div><h2>Which workflow should this protect?</h2><p>One contract attaches to one protected workflow.</p></div></div>
      {workflows.length ? <div className={styles.workflowGrid}>{workflows.map((w) => <button key={w.id} onClick={() => setWorkflowId(w.id)} className={`${styles.workflow} ${workflowId === w.id ? styles.selected : ""}`}><span>{w.platform}</span><b>{w.name}</b><small>{w.description || "Protected automation"}</small></button>)}</div> : <div className={styles.empty}>No workflows yet. <Link href="/connect">Connect an automation →</Link></div>}
      {selectedWorkflow && <div className={styles.selectedNote}>Selected: <b>{selectedWorkflow.name}</b> · {selectedWorkflow.platform}</div>}
    </section>

    <section className={styles.card}>
      <div className={styles.sectionHead}><span>02</span><div><h2>Where does the business truth live?</h2><p>Outcom can verify a real system or provide a minimal native record store.</p></div></div>
      <div className={styles.systemGrid}>{systems.map((s) => {
        const connected = s.id === "google_sheets" ? Boolean(google) : s.id === "ghl" ? Boolean(ghl) : s.status === "ready";
        const disabled = s.status === "soon";
        return <button key={s.id} disabled={disabled} onClick={() => !disabled && setSystem(s.id)} className={`${styles.system} ${system === s.id ? styles.selected : ""} ${disabled ? styles.disabled : ""}`}><div className={styles.systemTop}><strong>{s.title}</strong><span>{disabled ? "SOON" : connected ? "CONNECTED" : s.id === "outcom_records" ? "READY" : "CONNECT"}</span></div><p>{s.detail}</p>{s.id === "google_sheets" && google && <small>{google.accountName}{google.email ? ` · ${google.email}` : ""}</small>}{s.id === "ghl" && ghl && <small>{ghl.accountName}</small>}</button>;
      })}</div>
      {system === "google_sheets" && google && <div className={styles.googleConfig}>
        <div className={styles.googleConfigHead}><div><b>Configure the spreadsheet Outcom should verify</b><span>Outcom only reads the configured sheet during verification.</span></div><button className={styles.secondary} onClick={loadGoogleFiles} disabled={sheetsLoading}>{sheetsLoading ? "Loading…" : "Load my spreadsheets"}</button></div>
        {sheetFiles.length > 0 && <div className={styles.googleFiles}>{sheetFiles.map((file) => <button key={file.id} onClick={() => void selectSpreadsheet(file.id, file.name)} className={spreadsheetId === file.id ? styles.selected : ""}><b>{file.name}</b><small>{file.id}</small></button>)}</div>}
        {spreadsheetId && <div className={styles.googleFields}><label>Sheet tab<select value={sheetName} onChange={(e) => setSheetName(e.target.value)}><option value="">Choose a sheet…</option>{sheetNames.map((x) => <option key={x} value={x}>{x}</option>)}</select></label><label>Lookup column<input value={sheetLookupField} onChange={(e) => setSheetLookupField(e.target.value)} placeholder="email or id" /><small>The first row of the sheet is treated as the header row.</small></label><button className={styles.primary} onClick={() => void configureGoogleSheet()}>Save Google Sheet configuration →</button></div>}
      </div>}
      <div className={styles.systemActions}>
        <div><b>Need a system?</b><span>Use Outcom Records. It is deliberately minimal — evidence storage, not another CRM.</span></div>
        <div className={styles.actions}>{!google && <a className={styles.secondary} href="/api/oauth/google_sheets/start">Connect Google</a>}<Link className={styles.secondary} href="/records">Open Outcom Records →</Link></div>
      </div>
    </section>

    <section className={styles.card}>
      <div className={styles.sectionHead}><span>03</span><div><h2>What should happen?</h2><p>Start with business language. Technical lookup details stay underneath.</p></div></div>
      <div className={styles.templateGrid}>{templates.map((t) => <button key={t.id} onClick={() => chooseTemplate(t.id)} className={`${styles.template} ${template === t.id ? styles.selected : ""}`}><b>{t.title}</b><span>{t.description}</span></button>)}</div>
      <div className={styles.formGrid}>
        <label>Contract name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New lead should reach the CRM" /></label>
        <label>Record identifier<input value={lookupField} onChange={(e) => setLookupField(e.target.value)} placeholder="id" /><small>Outcom currently correlates the execution with <code>event.data.target_record_id</code>.</small></label>
        {selectedTemplate.type === "state_invariant" && <>
          <label>Business field<select value={field} onChange={(e) => setField(e.target.value)}><option value="status">status</option><option value="tags">tags</option><option value="stage">stage</option></select></label>
          <label>Operator<select value={operator} onChange={(e) => setOperator(e.target.value)}><option value="equals">equals</option><option value="contains">contains</option><option value="not_equals">does not equal</option></select></label>
          <label className={styles.full}>Expected value<input value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} placeholder={field === "tags" ? "paid-customer" : "qualified"} /></label>
        </>}
      </div>
      <div className={styles.advanced}><span>ADVANCED CONFIGURATION</span><p>System, entity, lookup path, operator and value are generated from this contract. Advanced controls will be exposed only when the simple template cannot express the outcome.</p></div>
      <div className={styles.footerAction}><div>{message && <span className={message.startsWith("✓") ? styles.success : styles.error}>{message}</span>}</div><button className={styles.primary} disabled={saving || !workflowId} onClick={createContract}>{saving ? "Protecting…" : "Protect this outcome →"}</button></div>
    </section>

    <section className={styles.existing}>
      <div className={styles.sectionHead}><span>04</span><div><h2>Protected contracts</h2><p>{contracts.length} outcome check{contracts.length === 1 ? "" : "s"} currently stored in this workspace.</p></div></div>
      {contracts.length ? <div className={styles.contractList}>{contracts.slice(0, 10).map((c) => <div className={styles.contractRow} key={c.id}><div><b>{c.name}</b><small>{c.system} · {c.type} · {c.severity}</small></div><span className={c.enabled ? styles.on : styles.off}>{c.enabled ? "PROTECTED" : "DISABLED"}</span></div>)}</div> : <div className={styles.empty}>No contracts yet. Create the first one above.</div>}
    </section>

    <div className={styles.bottom}><span>V74 · Outcome Contract foundation</span><span>EXECUTION → EXPECTATION → EVIDENCE → VERIFICATION</span></div>
  </div>;
}
