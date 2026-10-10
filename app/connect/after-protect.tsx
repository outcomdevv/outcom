"use client";

import { useEffect, useState } from "react";
import { IntegrationLogo } from "@/app/integrations";
import { FIELD_NAME, guideFor, n8nPasteNode } from "@/lib/connect-guide";

export type WebhookInfo = { provider: string; url: string; workflow: { id: string; name: string }; lastReceivedAt?: string | null };

type Props = {
  info: WebhookInfo;
  keyColumn: string | null;
  onInfo: (next: WebhookInfo) => void;
};

function SheetMini() { return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="18" height="18" rx="4" fill="#1f9d63" /><path d="M3 9.5h18M3 15h18M9.5 9.5V21" stroke="#fff" strokeWidth="1.6" /></svg>; }

type Test = "idle" | "busy" | "ok" | "fail";

export default function AfterProtect({ info, keyColumn, onInfo }: Props) {
  const guide = guideFor(info.provider);
  const [copied, setCopied] = useState<string | null>(null);
  const [test, setTest] = useState<Test>("idle");
  const [showJson, setShowJson] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function sendTest() {
    setTest("busy"); setError(null);
    try {
      const r = await fetch(info.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ test: true }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setTest("ok"); else { setTest("fail"); setError(typeof j.error === "string" ? j.error : "Outcom did not answer. Make a new address and try again."); }
    } catch { setTest("fail"); setError("Could not reach this address from here."); }
  }

  async function rotate() {
    const r = await fetch("/api/webhooks/rotate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: info.provider, workflowId: info.workflow.id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error || "Could not make a new address.");
    setTest("idle"); onInfo({ ...info, url: j.url, lastReceivedAt: null });
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
        {info.provider === "n8n" ? (<>
        <li>
          <div className="cx-g-head"><span className="cx-g-n">1</span><b>Copy the ready-made step</b></div>
          <div className="cx-code"><code>Tell Outcom · HTTP Request · already filled in</code><button type="button" className="simple-primary" onClick={() => copy("node", n8nPasteNode(info.url, keyColumn))}>{copied === "node" ? "Copied ✓" : "Copy step"}</button></div>
        </li>
        <li>
          <div className="cx-g-head"><span className="cx-g-n">2</span><b>Paste it into n8n</b><IntegrationLogo name="n8n" size={22} /></div>
          <ol className="cx-clicks">
            <li>Open your workflow and click an empty spot on the canvas.</li>
            <li>Press <b>Ctrl+V</b> (Mac: <b>⌘V</b>). A step called “Tell Outcom” appears.</li>
            <li>Connect it <b>from the green Google Sheets step</b> (the one that saves the row). Not from the last step.</li>
            <li>Click <b>Publish</b> and run the workflow once.</li>
          </ol>
          <div className="cx-diagram" aria-label="Connect Tell Outcom from the Google Sheets step">
            <span>Trigger</span><i>→</i><span>…</span><i>→</i><span className="hot"><SheetMini /> Google Sheets</span><i>→</i><span className="new">Tell Outcom</span>
          </div>
          <details className="cx-adv"><summary>Prefer to set it up by hand?</summary>
            <ol className="cx-clicks">{guide.steps.map(s => <li key={s}>{s}</li>)}</ol>
            <div className="cx-field-card"><div><small>Field name</small><code>{FIELD_NAME}</code></div><button type="button" className="simple-secondary" onClick={() => copy("field", FIELD_NAME)}>{copied === "field" ? "Copied ✓" : "Copy"}</button></div>
            <div className="cx-code"><code>{info.url}</code><button type="button" className="simple-secondary" onClick={() => copy("url", info.url)}>{copied === "url" ? "Copied ✓" : "Copy address"}</button></div>
            <p className="cx-hint">{guide.valueHelp(keyColumn)}</p>
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
          <ol className="cx-clicks">{guide.steps.map(s => <li key={s}>{s}</li>)}</ol>
          <div className="cx-field-card">
            <div><small>Field name</small><code>{FIELD_NAME}</code></div>
            <button type="button" className="simple-secondary" onClick={() => copy("field", FIELD_NAME)}>{copied === "field" ? "Copied ✓" : "Copy"}</button>
          </div>
          <p className="cx-hint">{guide.valueHelp(keyColumn)}</p>
          <button type="button" className="cx-link" onClick={() => setShowJson(v => !v)}>{showJson ? "Hide the raw message" : "My tool asks for a raw message"}</button>
          {showJson && <div className="cx-code"><code>{guide.json(keyColumn)}</code><button type="button" className="simple-secondary" onClick={() => copy("json", guide.json(keyColumn))}>{copied === "json" ? "Copied ✓" : "Copy"}</button></div>}
        </li>

        </>)}

        <li>
          <div className="cx-g-head"><span className="cx-g-n">3</span><b>Check that it works</b></div>
          <div className="cx-status"><span className={`cx-dot ${received ? "on" : "wait"}`} />
            {received ? `Got your first run · ${new Date(info.lastReceivedAt as string).toLocaleString()}` : `Waiting for a run. Run your automation once, this updates by itself.`}</div>
          {!received && <div className="cx-test">
            <button type="button" className="simple-secondary" disabled={test === "busy"} onClick={sendTest}>{test === "busy" ? "Sending…" : "Send a test"}</button>
            {test === "ok" && <span className="cx-ok-text">✓ Outcom is ready and listening for “{label}”.</span>}
            {test === "fail" && <span className="cx-error-text">{error}</span>}
          </div>}
          {received && <p className="cx-hint">Open your workflows to see PASS, FAIL or UNKNOWN for this run.</p>}
        </li>
      </ol>

      {error && test !== "fail" && <p className="cx-error">{error}</p>}
      <div className="cx-nav"><button type="button" className="cx-link" onClick={rotate}>Make a new address</button><a className="simple-primary" href="/workflows">{received ? "See the result" : "See my workflows"}</a></div>
    </section>
  );
}
