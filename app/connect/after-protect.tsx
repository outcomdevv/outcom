"use client";

import { useEffect, useState } from "react";
import { IntegrationLogo } from "@/app/integrations";
import FlowDiagram from "@/app/connect/flow-diagram";
import type { FlowNode } from "@/lib/suggested-checks";
import { FIELD_NAME, evidenceJson, guideFor, n8nEvidenceNode, n8nPasteNode } from "@/lib/connect-guide";

export type WebhookInfo = { provider: string; url: string; workflow: { id: string; name: string }; lastReceivedAt?: string | null };

type Props = {
  info: WebhookInfo;
  keyColumn: string | null;
  flow?: FlowNode[] | null;
  connectFrom?: string | null;
  /** Where Outcom looks. Only Google Sheets keeps the sheet's own column names after the write step, so only then is the value prefilled. */
  system?: string;
  /** Value the scenario already uses for the key column (for example {{1.email}} in Make). Prefills the message. */
  expression?: string | null;
  /** "Any other app": name of the read-back step. */
  reportedStep?: string;
  onInfo: (next: WebhookInfo) => void;
};

function SheetMini() { return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="18" height="18" rx="4" fill="#1f9d63" /><path d="M3 9.5h18M3 15h18M9.5 9.5V21" stroke="#fff" strokeWidth="1.6" /></svg>; }

type TryResult = { state: string; title: string; observed: string };
const LABEL: Record<string, string> = { passed: "PASS", failed: "FAIL", verification_error: "UNKNOWN" };

export default function AfterProtect({ info, keyColumn, flow, connectFrom, system = "google_sheets", expression = null, reportedStep = "", onInfo }: Props) {
  const guide = guideFor(info.provider);
  const [copied, setCopied] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tryValue, setTryValue] = useState("");
  const [tryBusy, setTryBusy] = useState(false);
  const [tryResults, setTryResults] = useState<TryResult[] | null>(null);
  const [tryError, setTryError] = useState<string | null>(null);
  const received = Boolean(info.lastReceivedAt);

  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  }

  // Look for the first real run by itself, so nobody has to press "check".
  useEffect(() => {
    if (received) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/webhooks/status?provider=${encodeURIComponent(info.provider)}&workflowId=${encodeURIComponent(info.workflow.id)}`, { cache: "no-store" }).catch(() => null);
      const j = r && r.ok ? await r.json().catch(() => ({})) : {};
      if (!stop && j.lastReceivedAt) onInfo({ ...info, lastReceivedAt: j.lastReceivedAt });
    };
    const timer = window.setInterval(tick, 4000);
    return () => { stop = true; window.clearInterval(timer); };
  }, [received, info, onInfo]);

  // Does exactly what the automation's last step would do, so the result can be seen without n8n, Make or Zapier.
  async function tryCheck() {
    setTryBusy(true); setTryError(null); setTryResults(null);
    try {
      const r = await fetch(info.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ target_record_id: tryValue.trim(), status: "success", execution_id: `try-${Date.now()}`, metadata: { source: "outcom-try-it" } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(j.results)) setTryError(typeof j.error === "string" ? j.error : "Outcom could not run the check.");
      else setTryResults(j.results as TryResult[]);
    } catch { setTryError("Could not reach Outcom."); }
    setTryBusy(false);
  }

  // Sends what the read-back step would send, once with "found" and once with "missing", so PASS and FAIL can be seen.
  async function tryReported(found: boolean) {
    setTryBusy(true); setTryError(null); setTryResults(null);
    try {
      const r = await fetch(info.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ run_id: `try-${Date.now()}`, status: "success", evidence: [{ step: reportedStep || "crm", found, fields: found ? { Email: "demo@example.com" } : {} }], metadata: { source: "outcom-try-it" } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !Array.isArray(j.results)) setTryError(typeof j.error === "string" ? j.error : "Outcom could not run the check.");
      else setTryResults(j.results as TryResult[]);
    } catch { setTryError("Could not reach Outcom."); }
    setTryBusy(false);
  }

  async function rotate() {
    const r = await fetch("/api/webhooks/rotate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: info.provider, workflowId: info.workflow.id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error || "Could not make a new address.");
    onInfo({ ...info, url: j.url, lastReceivedAt: null });
  }

  const label = keyColumn || "the id";

  return (
    <section id="live-webhook" className="cx-flow cx-done">
      <div className="cx-done-head">
        <span className="cx-pill">● Protected</span>
        <h2>{info.workflow.name}</h2>
        <p>Last step: tell Outcom when your automation finishes. It takes about two minutes.</p>
      </div>

      <ol className="cx-guide">
        {system === "reported" ? (<>
        <li>
          <div className="cx-g-head"><span className="cx-g-n">1</span><b>Add a read-back step after the step that writes</b><IntegrationLogo name={(info.provider === "n8n" || info.provider === "zapier" || info.provider === "make" ? info.provider : "custom") as any} size={22} /></div>
          <ol className="cx-clicks">
            <li>After the step that saves the record, add a step that <b>looks that record up</b> in the same app (a Search or Get step).</li>
            {info.provider === "n8n" && <li>On that search step open <b>Settings</b> and turn on <b>Always Output Data</b>. Without it, an empty result sends nothing and Outcom can only say UNKNOWN.</li>}
            <li>Then add the step that sends the result to Outcom (below).</li>
          </ol>
        </li>
        <li>
          <div className="cx-g-head"><span className="cx-g-n">2</span><b>{info.provider === "n8n" ? "Copy and paste the sending step" : "Send what the search found to Outcom"}</b></div>
          {info.provider === "n8n"
            ? <>
              <div className="cx-code"><code>Tell Outcom what was found · HTTP Request · already filled in</code><button type="button" className="simple-primary" onClick={() => copy("node", n8nEvidenceNode(info.url, reportedStep))}>{copied === "node" ? "Copied ✓" : "Copy step"}</button></div>
              <ol className="cx-clicks">
                <li>Click an empty spot on the canvas and press <b>Ctrl+V</b> (Mac: <b>⌘V</b>).</li>
                <li>Connect it <b>from the search step</b>, then Publish and run the workflow once.</li>
              </ol>
            </>
            : <>
              <div className="cx-code"><code>{info.url}</code><button type="button" className="simple-secondary" onClick={() => copy("url", info.url)}>{copied === "url" ? "Copied ✓" : "Copy address"}</button></div>
              <ol className="cx-clicks">
                <li>Add a step that sends an <b>HTTP POST</b> with JSON to that address.</li>
                <li>Send the message below. Set <b>found</b> to true when the search returned a record, and false when it did not.</li>
              </ol>
              <div className="cx-code"><code>{evidenceJson(reportedStep)}</code><button type="button" className="simple-secondary" onClick={() => copy("json", evidenceJson(reportedStep))}>{copied === "json" ? "Copied ✓" : "Copy"}</button></div>
            </>}
          <p className="cx-hint">Outcom will show “Evidence reported by your workflow”. It judges what your automation saw. It does not read {reportedStep ? `“${reportedStep}”` : "the app"} itself.</p>
        </li>
        </>) : info.provider === "n8n" ? (<>
        <li>
          <div className="cx-g-head"><span className="cx-g-n">1</span><b>Copy the ready-made step</b></div>
          <div className="cx-code"><code>Tell Outcom · HTTP Request · already filled in</code><button type="button" className="simple-primary" onClick={() => copy("node", n8nPasteNode(info.url, keyColumn, system === "google_sheets"))}>{copied === "node" ? "Copied ✓" : "Copy step"}</button></div>
        </li>
        <li>
          <div className="cx-g-head"><span className="cx-g-n">2</span><b>Paste it into n8n</b><IntegrationLogo name="n8n" size={22} /></div>
          <ol className="cx-clicks">
            <li>Open your workflow and click an empty spot on the canvas.</li>
            <li>Press <b>Ctrl+V</b> (Mac: <b>⌘V</b>). A step called “Tell Outcom” appears.</li>
            <li>Connect it <b>from {connectFrom ? `“${connectFrom}”` : "the green Google Sheets step"}</b> (the step that saves the data). Not from the last step.</li>
            {system !== "google_sheets" && <li>Open “Tell Outcom”, click between the quotes next to <b>target_record_id</b>, and drag <b>{label}</b> from the left panel into it.</li>}
            <li>Click <b>Publish</b> and run the workflow once.</li>
          </ol>
          {flow && flow.length > 0 && connectFrom
            ? <FlowDiagram flow={flow} connectFrom={connectFrom} />
            : <div className="cx-diagram" aria-label="Connect Tell Outcom from the Google Sheets step">
                <span>Trigger</span><i>→</i><span>…</span><i>→</i><span className="hot"><SheetMini /> Google Sheets</span><i>→</i><span className="new">Tell Outcom</span>
              </div>}
          <details className="cx-adv"><summary>Prefer to set it up by hand?</summary>
            <ol className="cx-clicks">{guide.steps.map(s => <li key={s}>{s}</li>)}</ol>
            <div className="cx-field-card"><div><small>Field name</small><code>{FIELD_NAME}</code></div><button type="button" className="simple-secondary" onClick={() => copy("field", FIELD_NAME)}>{copied === "field" ? "Copied ✓" : "Copy"}</button></div>
            <div className="cx-code"><code>{info.url}</code><button type="button" className="simple-secondary" onClick={() => copy("url", info.url)}>{copied === "url" ? "Copied ✓" : "Copy address"}</button></div>
            <p className="cx-hint">{guide.valueHelp(keyColumn, expression)}</p>
          </details>
        </li>
        </>) : (<>
        <li>
          <div className="cx-g-head"><span className="cx-g-n">1</span><b>Copy Outcom’s address</b></div>
          <div className="cx-code"><code>{info.url}</code><button type="button" className="simple-secondary" onClick={() => copy("url", info.url)}>{copied === "url" ? "Copied ✓" : "Copy"}</button></div>
          <small className="cx-muted">You paste it into {guide.tool}. Do not open it in the browser.</small>
        </li>

        <li>
          <div className="cx-g-head"><span className="cx-g-n">2</span><b>In {guide.tool}, add one last step</b><IntegrationLogo name={(info.provider === "n8n" || info.provider === "zapier" || info.provider === "make" ? info.provider : "custom") as any} size={22} /></div>
          {flow && flow.length > 0 && connectFrom && <FlowDiagram flow={flow} connectFrom={connectFrom} />}
          <ol className="cx-clicks">{guide.steps.map(s => <li key={s}>{s}</li>)}</ol>
          <div className="cx-field-card">
            <div><small>Field name</small><code>{FIELD_NAME}</code></div>
            <button type="button" className="simple-secondary" onClick={() => copy("field", FIELD_NAME)}>{copied === "field" ? "Copied ✓" : "Copy"}</button>
          </div>
          <p className="cx-hint">{guide.valueHelp(keyColumn, expression)}</p>
          <button type="button" className="cx-link" onClick={() => setShowJson(v => !v)}>{expression ? "" : showJson ? "Hide the raw message" : "My tool asks for a raw message"}</button>
          {(showJson || Boolean(expression)) && <div className="cx-code"><code>{guide.json(keyColumn, expression)}</code><button type="button" className="simple-secondary" onClick={() => copy("json", guide.json(keyColumn, expression))}>{copied === "json" ? "Copied ✓" : "Copy"}</button></div>}
        </li>

        </>)}

        <li>
          <div className="cx-g-head"><span className="cx-g-n">3</span><b>Check that it works</b></div>
          <div className="cx-status"><span className={`cx-dot ${received ? "on" : "wait"}`} />
            {received ? `Got your first run · ${new Date(info.lastReceivedAt as string).toLocaleString()}` : `Waiting for a run. Run your automation once, this updates by itself.`}</div>
          {received && <p className="cx-hint">Open your workflows to see PASS, FAIL or UNKNOWN for this run.</p>}
        </li>
      </ol>

      {system === "reported" ? <div className="cx-try">
        <h3>No automation to run? Try it now</h3>
        <p className="cx-muted">Outcom sends what your read-back step would send. “Record found” should give PASS. “Record missing” should give FAIL.</p>
        <div className="cx-row">
          <button type="button" className="simple-primary" disabled={tryBusy} onClick={() => void tryReported(true)}>{tryBusy ? "Checking…" : "Record found"}</button>
          <button type="button" className="simple-secondary" disabled={tryBusy} onClick={() => void tryReported(false)}>Record missing</button>
        </div>
        {tryError && <p className="cx-error">{tryError}</p>}
        {tryResults && <ul className="cx-results">{tryResults.map((r, i) => (
          <li key={i} className={r.state}><b>{LABEL[r.state] ?? r.state}</b><span>{r.title}<small>{r.observed}</small></span></li>
        ))}</ul>}
        {tryResults && <a className="cx-link" href="/workflows">See it in Protected workflows →</a>}
      </div> : <div className="cx-try">
        <h3>No automation to run? Try it now</h3>
        <p className="cx-muted">{system === "hubspot" ? <>Type the {label} of a contact that exists in HubSpot to see PASS. Type one that does not exist to see FAIL.</> : <>Type a value from the “{label}” column that is in your {system === "airtable" ? "table" : "sheet"} to see PASS. Type one that is not to see FAIL.</>} Outcom does what your automation’s last step does.</p>
        <div className="cx-row">
          <input name="outcom-try-value" autoComplete="off" value={tryValue} onChange={e => setTryValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && tryValue.trim()) void tryCheck(); }} placeholder={keyColumn ? `${keyColumn} value` : "A value"} />
          <button type="button" className="simple-primary" disabled={tryBusy || !tryValue.trim()} onClick={tryCheck}>{tryBusy ? "Checking…" : "Run a check"}</button>
        </div>
        {tryError && <p className="cx-error">{tryError}</p>}
        {tryResults && <ul className="cx-results">{tryResults.map((r, i) => (
          <li key={i} className={r.state}><b>{LABEL[r.state] ?? r.state}</b><span>{r.title}<small>{r.observed}</small></span></li>
        ))}</ul>}
        {tryResults && <a className="cx-link" href="/workflows">See it in Protected workflows →</a>}
      </div>}

      {error && <p className="cx-error">{error}</p>}
      <div className="cx-nav"><button type="button" className="cx-link" onClick={rotate}>Make a new address</button><a className="simple-primary" href="/workflows">{received ? "See the result" : "See my workflows"}</a></div>
    </section>
  );
}
