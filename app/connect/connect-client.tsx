"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IntegrationLogo } from "@/app/integrations";

type Platform = "n8n" | "zapier" | "make" | "ghl";
type Provider = "ghl" | Platform;
type Connection = { provider: Provider; accountName: string; email?: string | null; expiresAt?: string | null };
type Discovered = { id: string; name: string; enabled: boolean; updatedAt: string | null; url: string | null; platform: string; lastSuccessfulRun?: string | null; steps?: number | null };
type OAuthStatus = { ghl: boolean; zapier: boolean; make: boolean };
type WebhookInfo = { provider: "zapier" | "make"; url: string; workflow: { id: string; name: string }; lastReceivedAt?: string | null; sample: Record<string, unknown> };

const platforms: Array<{ id: Platform; name: string; description: string }> = [
  { id: "n8n", name: "n8n", description: "Instance URL + API key · not your password" },
  { id: "zapier", name: "Zapier", description: "OAuth when configured · no password or API key" },
  { id: "make", name: "Make", description: "OAuth when configured · API token is advanced" },
  { id: "ghl", name: "HighLevel", description: "Location ID + scoped private token" },
];

const iso = () => new Date().toISOString();

export default function ConnectClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [oauth, setOauth] = useState<OAuthStatus>({ ghl: false, zapier: false, make: false });
  const [platform, setPlatform] = useState<Platform>("n8n");
  const [step, setStep] = useState<1 | 2>(1);
  const [outcome, setOutcome] = useState("");
  const [name, setName] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [created, setCreated] = useState(false);
  const [discovered, setDiscovered] = useState<Discovered[]>([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [n8nBaseUrl, setN8nBaseUrl] = useState("");
  const [n8nApiKey, setN8nApiKey] = useState("");
  const [n8nConnecting, setN8nConnecting] = useState(false);
  const [n8nMessage, setN8nMessage] = useState<string | null>(null);
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [ghlPit, setGhlPit] = useState("");
  const [ghlConnecting, setGhlConnecting] = useState(false);
  const [ghlMessage, setGhlMessage] = useState<string | null>(null);
  const [makeTeamId, setMakeTeamId] = useState("");
  const [makeToken, setMakeToken] = useState("");
  const [makeApiBase, setMakeApiBase] = useState("");
  const [makeConnecting, setMakeConnecting] = useState(false);
  const [makeMessage, setMakeMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [discoveryTotal, setDiscoveryTotal] = useState<number | null>(null);
  const [discoveryPages, setDiscoveryPages] = useState(0);
  const [discoveryLoaded, setDiscoveryLoaded] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [zapierName, setZapierName] = useState("");
  const [zapierCreating, setZapierCreating] = useState(false);
  const [makeWebhookName, setMakeWebhookName] = useState("");
  const [makeWebhookCreating, setMakeWebhookCreating] = useState(false);

  const ghl = connections.find((x) => x.provider === "ghl");
  const n8n = connections.find((x) => x.provider === "n8n");
  const zapier = connections.find((x) => x.provider === "zapier");
  const make = connections.find((x) => x.provider === "make");
  const selected = useMemo(() => platforms.find((p) => p.id === platform)!, [platform]);
  const connectionStatuses: Array<[string, Connection | undefined]> = [["HighLevel", ghl], ["n8n", n8n], ["Make", make], ["Zapier", zapier]];

  async function loadConnections() {
    const r = await fetch("/api/connections", { cache: "no-store" });
    if (r.ok) setConnections((await r.json()).connections || []);
  }

  async function loadOAuthStatus() {
    const r = await fetch("/api/oauth/status", { cache: "no-store" });
    if (r.ok) setOauth((await r.json()).providers || {});
  }

  useEffect(() => {
    loadConnections();
    loadOAuthStatus();
  }, [params]);

  useEffect(() => {
    const provider = params.get("connected");
    if (provider === "zapier" || provider === "make") void discover(provider);
  }, [params]);

  async function discoverN8n() {
    setLoadingDiscovery(true);
    setDiscoveryLoaded(false);
    const r = await fetch("/api/n8n/discover", { cache: "no-store" });
    const j = await r.json();
    setDiscovered(j.items || []);
    setDiscoveryTotal(typeof j.total === "number" ? j.total : (j.items || []).length);
    setDiscoveryPages(typeof j.pages === "number" ? j.pages : 1);
    setDiscoveryLoaded(true);
    setLoadingDiscovery(false);
    if (!r.ok) setN8nMessage(j.error || "Could not discover n8n workflows.");
  }

  async function discover(provider: "zapier" | "make") {
    setLoadingDiscovery(true);
    setDiscoveryLoaded(false);
    const r = await fetch(`/api/integrations/discover?provider=${provider}`, { cache: "no-store" });
    const j = await r.json();
    setDiscovered(j.items || []);
    setDiscoveryTotal(typeof j.total === "number" ? j.total : (j.items || []).length);
    setDiscoveryPages(typeof j.pages === "number" ? j.pages : 1);
    setDiscoveryLoaded(r.ok);
    setLoadingDiscovery(false);
    if (!r.ok) {
      setDiscoveryTotal(null);
      const detail = typeof j.error === "string" ? j.error : provider === "zapier" ? "Zapier discovery was rejected. Check the OAuth scopes for this app." : "Make discovery failed. Check the Team ID and read scope.";
      setTestResult(detail);
    }
  }

  async function connectGhlDirect() {
    setGhlConnecting(true); setGhlMessage(null);
    try {
      const r = await fetch("/api/ghl/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locationId: ghlLocationId, pit: ghlPit }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "HighLevel connection failed");
      setGhlPit(""); setGhlMessage(`Connected · ${j.accountName || ghlLocationId}`); await loadConnections(); router.refresh();
    } catch (e) { setGhlMessage(e instanceof Error ? e.message : "HighLevel connection failed"); }
    finally { setGhlConnecting(false); }
  }

  async function connectMakeDirect() {
    setMakeConnecting(true); setMakeMessage(null); setTestResult(null);
    try {
      const r = await fetch("/api/make/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId: makeTeamId, token: makeToken, baseUrl: makeApiBase }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Make connection failed");
      setMakeToken(""); setMakeMessage(`✓ Connection verified · ${j.scenarios ?? 0} scenarios visible · Team ${j.teamId}`); await loadConnections(); await discover("make");
    } catch (e) { setMakeMessage(e instanceof Error ? e.message : "Make connection failed"); }
    finally { setMakeConnecting(false); }
  }

  async function connectN8n() {
    setN8nConnecting(true); setN8nMessage(null);
    try {
      const r = await fetch("/api/n8n/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseUrl: n8nBaseUrl, apiKey: n8nApiKey }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "n8n connection failed");
      setN8nApiKey(""); setN8nMessage("Connected. Finding workflows…"); await loadConnections(); await discoverN8n();
    } catch (e) { setN8nMessage(e instanceof Error ? e.message : "n8n connection failed"); }
    finally { setN8nConnecting(false); }
  }

  async function setupWebhook(provider: "zapier" | "make", id: string) {
    setWebhookLoading(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/webhooks/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, workflowId: id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not create webhook endpoint");
      setWebhookInfo(j);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Could not create webhook endpoint");
    } finally {
      setWebhookLoading(false);
    }
  }

  async function protectWorkflow(id: string, workflowName: string, sourcePlatform: Platform) {
    if (!outcome.trim()) {
      setTestResult("Define the expected business outcome first (Step 2), then protect the workflow.");
      setStep(2);
      return;
    }
    setName(workflowName);
    setWorkflowId(id);
    setPlatform(sourcePlatform);
    setWebhookInfo(null);
    if (sourcePlatform === "n8n") {
      setN8nMessage("Reading workflow topology and preparing the first outcome check…");
      const r = await fetch("/api/n8n/protect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflowId: id, expectedOutcome: outcome.trim() }),
      });
      const j = await r.json();
      if (r.ok && j.protected) {
        setCreated(true);
        setN8nMessage(`Protected · ${j.createdContracts?.length || 0} outcome checks created`);
        router.refresh();
      } else {
        setN8nMessage(j.error || j.analysis?.recommendation || "Outcom could not safely infer a business outcome from this workflow.");
      }
      return;
    }

    const r = await fetch("/api/integrations/protect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: sourcePlatform, externalId: id, name: workflowName, expectedOutcome: outcome.trim() }),
    });
    const j = await r.json();
    if (r.ok && j.protected) {
      setCreated(true);
      setTestResult(`Protected · ${j.createdContracts?.length || 0} outcome check${j.createdContracts?.length === 1 ? "" : "s"} created.`);
      await setupWebhook(sourcePlatform as "zapier" | "make", j.workflow.id);
      router.refresh();
    } else {
      setTestResult(j.error || "Outcom could not protect this workflow.");
    }
  }

  async function createZapierWebhookWorkflow() {
    const workflowName = zapierName.trim();
    if (!workflowName) { setTestResult("Give the Zap a name first."); return; }
    setZapierCreating(true);
    try {
      await protectWorkflow(`manual-${crypto.randomUUID()}`, workflowName, "zapier");
    } finally {
      setZapierCreating(false);
    }
  }

  async function createMakeWebhookWorkflow() {
    const workflowName = makeWebhookName.trim();
    if (!workflowName) { setTestResult("Give the Make scenario a name first."); return; }
    setMakeWebhookCreating(true);
    try {
      await protectWorkflow(`manual-${crypto.randomUUID()}`, workflowName, "make");
    } finally {
      setMakeWebhookCreating(false);
    }
  }

  async function createWorkflow() {
    if (!name.trim()) {
      setN8nMessage("Choose an expected outcome first.");
      return;
    }
    if (!workflowId.trim()) {
      setN8nMessage("Choose a discovered n8n workflow first.");
      return;
    }
    await protectWorkflow(workflowId.trim(), name.trim(), "n8n");
  }

  async function syncN8n() {
    if (!workflowId) return;
    const r = await fetch("/api/n8n/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflowId: `n8n:${workflowId}` }) });
    const j = await r.json();
    setTestResult(r.ok ? `Native sync complete · ${j.imported ?? 0} new executions checked` : (j.error || "Native sync failed"));
    router.refresh();
  }

  const oauthConnect = (provider: Provider) => { window.location.href = `/api/oauth/${provider}/start`; };

  const error = params.get("error");
  const connected = params.get("connected");

  const activeConnection = connections.find((x) => x.provider === platform);
  const platformName = platforms.find((x) => x.id === platform)?.name || platform;

  return (
    <div className="connect-page v51-simple-connect">
      <header className="simple-connect-hero">
        <div>
          <div className="breadcrumb">Workspace <span>/</span> Connect</div>
          <div className="simple-eyebrow"><span className="v19-dot" /> OUTCOME VERIFICATION</div>
          <h1>Protect one workflow.<br /><em>Know what actually happened.</em></h1>
          <p>Connect one automation, tell Outcom what success means, and let us verify the business result. No need to connect your entire stack.</p>
        </div>
        <div className="simple-hero-card">
          <span className="simple-card-kicker">THE SIMPLE PATH</span>
          <div><b>1.</b> Connect an automation</div>
          <div><b>2.</b> Choose the outcome</div>
          <div><b>3.</b> Protect the workflow</div>
          <small>Read-only wherever supported.</small>
        </div>
      </header>

      {error && <div className="simple-alert"><b>Connection notice</b><span>{error === "zapier_oauth_not_configured" ? "Zapier OAuth is not configured on this deployment; use the webhook path below." : error.replaceAll("_", " ")}</span></div>}
      {connected && <div className="simple-success">✓ {connected === "ghl" ? "HighLevel" : connected[0].toUpperCase() + connected.slice(1)} connected.</div>}

      <section className="simple-flow-card">
        <div className="simple-stepper">
          <button className={step === 1 ? "active" : "done"} onClick={() => setStep(1)}><span>1</span> Connect automation</button>
          <div className="simple-step-line" />
          <button className={step === 2 ? "active" : ""} onClick={() => setStep(2)}><span>2</span> Define success</button>
        </div>

        {step === 1 && <div className="simple-step-content">
          <div className="simple-section-title"><span>STEP 01</span><h2>Where does your automation run?</h2><p>Choose the platform your workflow uses. Outcom keeps the connection read-only wherever the provider supports it.</p></div>
          <div className="simple-platform-grid">
            {platforms.map((item) => {
              const connectedHere = connections.find((x) => x.provider === item.id);
              return <button key={item.id} className={`simple-platform ${platform === item.id ? "selected" : ""}`} onClick={() => setPlatform(item.id)}>
                <IntegrationLogo name={item.id} size={34} />
                <span><b>{item.name}</b><small>{connectedHere ? "Connected" : item.id === "n8n" ? "API key" : item.id === "ghl" ? "PIT / OAuth" : "OAuth or webhook"}</small></span>
                <strong>{platform === item.id ? "✓" : "→"}</strong>
              </button>;
            })}
          </div>
          <div className="mvp-scope-note"><strong>Real integration paths:</strong> n8n uses its REST API; Zapier uses OAuth or a private outbound webhook; Make uses its API or a private outbound HTTP webhook; HighLevel is the read-only business system of truth.</div>

          <div className="simple-selected-panel">
            <div className="simple-selected-heading"><div><span>SELECTED PLATFORM</span><h3>{platformName}</h3></div>{activeConnection && <b className="simple-connected-pill">CONNECTED</b>}</div>
            {platform === "n8n" && !n8n && <div className="connection-setup-block">
              <div className="setup-instructions"><b>What to copy from n8n (not your login)</b><ol><li>Open n8n and go to <strong>Settings → n8n API</strong>.</li><li>Create an API key and copy it once.</li><li>Copy your workspace URL from the browser address bar, for example <code>https://your-workspace.app.n8n.cloud</code>.</li></ol><a href="https://docs.n8n.io/api/authentication/" target="_blank" rel="noreferrer">Open n8n API instructions ↗</a></div>
              <div className="simple-form-grid"><input value={n8nBaseUrl} onChange={e => setN8nBaseUrl(e.target.value)} placeholder="Instance URL · https://…" /><input type="password" value={n8nApiKey} onChange={e => setN8nApiKey(e.target.value)} placeholder="Read-only API key" /><button className="simple-primary" disabled={n8nConnecting || !n8nBaseUrl.trim() || !n8nApiKey.trim()} onClick={connectN8n}>{n8nConnecting ? "Checking access…" : "Connect n8n"}</button></div>
              <p className="simple-help">Not your n8n email or password. Outcom needs only the n8n instance URL and an API key. n8n documents that API keys are full-access unless scoped keys are available on Enterprise, so use a dedicated key for Outcom.</p>
            </div>}
            {platform === "n8n" && n8n && <button className="simple-primary" onClick={discoverN8n}>{loadingDiscovery ? "Finding workflows…" : "Find my workflows →"}</button>}
            {platform === "zapier" && <div className="connection-setup-block"><div className="setup-instructions"><b>Zapier: two real connection paths</b><ol><li><strong>OAuth:</strong> use it when this Outcom deployment has Zapier app credentials configured.</li><li><strong>Webhook mode:</strong> no Zapier password/API key is ever pasted into Outcom. Outcom gives this Zap a private POST URL.</li><li>In Zapier, add <strong>Webhooks by Zapier → POST</strong> as the final step and paste the Outcom URL.</li></ol><a href="https://help.zapier.com/hc/en-us/articles/8496326446989-How-to-get-started-with-Webhooks-by-Zapier" target="_blank" rel="noreferrer">Open Zapier webhook instructions ↗</a></div>{oauth.zapier && <button className="simple-primary" onClick={() => oauthConnect("zapier")}>Connect with Zapier OAuth ↗</button>}<div className="webhook-register"><input value={zapierName} onChange={e => setZapierName(e.target.value)} placeholder="Zap name · e.g. New lead → HighLevel" /><button className="simple-secondary" disabled={zapierCreating || !zapierName.trim()} onClick={createZapierWebhookWorkflow}>{zapierCreating ? "Creating endpoint…" : "Create Zap webhook →"}</button></div><p className="simple-help">Webhook mode is the fastest path to a real Zapier → Outcom connection. The URL is unique to this protected workflow and acts like a secret.</p></div>}
            {platform === "make" && <div className="connection-setup-block"><div className="setup-instructions"><b>Make: native API or webhook mode</b><ol><li><strong>Native API:</strong> connect a Make API token + Team ID when API access is available, then Outcom can discover scenarios and inspect runs.</li><li><strong>Webhook mode:</strong> Outcom gives the scenario a private POST URL. Add <strong>HTTP → Make a request</strong> near the end of the scenario and send the run result to that URL.</li><li>Do not use Make <strong>Custom webhook</strong> for this direction: that module receives data into Make; Outcom needs the scenario to send data out to Outcom.</li></ol><a href="https://apps.make.com/http" target="_blank" rel="noreferrer">Open Make HTTP instructions ↗</a></div>{oauth.make && <button className="simple-primary" onClick={() => oauthConnect("make")}>Connect with Make OAuth ↗</button>}{!make && <><div className="simple-form-grid make-form-grid"><input value={makeApiBase} onChange={e => setMakeApiBase(e.target.value)} placeholder="API base · e.g. https://eu1.make.com/api/v2" /><input value={makeTeamId} onChange={e => setMakeTeamId(e.target.value)} placeholder="Numeric Team ID" /><input type="password" value={makeToken} onChange={e => setMakeToken(e.target.value)} placeholder="Make API token · scenarios:read" /><button className="simple-primary" disabled={makeConnecting || !makeTeamId.trim() || !makeToken.trim()} onClick={connectMakeDirect}>{makeConnecting ? "Checking access…" : "Connect Make API"}</button></div><div className="webhook-register"><input value={makeWebhookName} onChange={e => setMakeWebhookName(e.target.value)} placeholder="Scenario name · e.g. Lead → HighLevel" /><button className="simple-secondary" disabled={makeWebhookCreating || !makeWebhookName.trim()} onClick={createMakeWebhookWorkflow}>{makeWebhookCreating ? "Creating endpoint…" : "Create Make webhook →"}</button></div><p className="simple-help">Use the API path for native discovery, or skip API access entirely and use webhook mode.</p></>}</div>}
            {platform === "ghl" && <div className="connection-setup-block"><div className="setup-instructions"><b>Connect HighLevel as your source of truth</b><ol><li>Open the relevant HighLevel sub-account.</li><li>Go to <strong>Settings → Private Integrations</strong>.</li><li>Create a read-only integration and copy the token.</li><li>Copy the sub-account's Location ID.</li></ol><a href="https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/" target="_blank" rel="noreferrer">Open HighLevel instructions ↗</a></div><p className="simple-help">HighLevel is used to verify the business result after an automation runs. Connect your automation source first, then connect HighLevel below.</p></div>}
            {(n8nMessage || makeMessage || testResult) && <p className="simple-inline-message">{n8nMessage || makeMessage || testResult}</p>}
          </div>
          <div className="simple-bottom-row"><span>Only one automation source is required.</span><button className="simple-secondary" onClick={() => setStep(2)}>Next: define success →</button></div>
        </div>}

        {step === 2 && <div className="simple-step-content">
          <div className="simple-section-title"><span>STEP 02</span><h2>What should success look like?</h2><p>Pick the business result Outcom should verify after your automation runs.</p></div>
          <div className="simple-outcome-grid">
            {["A contact was created", "A contact was updated", "A tag was added", "A deal moved", "A payment was received", "A record exists"].map(item => <button key={item} className={outcome === item ? "chosen" : ""} onClick={() => setOutcome(item)}>{item}<span>{outcome === item ? "✓" : "＋"}</span></button>)}
          </div>
          <label className="simple-custom-label">Or describe your own expected outcome<input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="e.g. A new lead exists in HighLevel" /></label>
          <div className="simple-bottom-row"><button className="simple-secondary" onClick={() => setStep(1)}>← Back</button><button className="simple-primary" disabled={!outcome.trim()} onClick={() => { setName(outcome.trim()); setStep(1); }}>Save outcome and continue →</button></div>
          {outcome && <div className="simple-outcome-preview"><span>EXPECTED OUTCOME</span><b>{outcome}</b><small>Next, choose a discovered workflow and click Protect.</small></div>}
        </div>}
      </section>

      {webhookInfo && <section className="webhook-live-card"><div><span>LIVE INBOUND ENDPOINT</span><b>{webhookInfo.workflow.name}</b><small>{webhookInfo.provider} → Outcom</small></div><div className="webhook-url-row"><code>{webhookInfo.url}</code><button className="simple-secondary" onClick={() => navigator.clipboard?.writeText(webhookInfo.url)}>Copy URL</button></div><div className="webhook-instructions"><b>Send this JSON as the final step</b><pre>{JSON.stringify(webhookInfo.sample, null, 2)}</pre><small>Map <code>target_record_id</code> to the HighLevel/contact ID created or updated by the automation. Add a unique <code>execution_id</code> when the provider exposes one.</small></div><div className="webhook-test-row"><button className="simple-primary" onClick={async () => { const executionId = `test-${Date.now()}`; const r = await fetch(webhookInfo.url, { method: "POST", headers: { "content-type": "application/json", "x-outcom-execution-id": executionId }, body: JSON.stringify({ test: true, data: { test: true }, execution_id: executionId }) }); const j = await r.json().catch(() => ({})); setTestResult(r.ok ? "Test request reached Outcom successfully." : (j.error || "Webhook test failed")); }}>Send test webhook</button>{webhookLoading && <span>Preparing endpoint…</span>}{webhookInfo.lastReceivedAt && <span>Last received {new Date(webhookInfo.lastReceivedAt).toLocaleString()}</span>}</div></section>}

      {discoveryLoaded && <section className="simple-results-card"><div className="simple-section-title"><span>YOUR AUTOMATIONS</span><h2>{discoveryTotal === 0 ? "No automations found" : "Choose a workflow to protect"}</h2><p>{discoveryTotal === 0 ? "No workflows were visible with the current connection." : `${discoveryTotal} workflow${discoveryTotal === 1 ? "" : "s"} found.`}</p></div>{discovered.length > 0 && <div className="simple-discovery-list">{discovered.map(d => <button key={`${d.platform}:${d.id}`} onClick={() => protectWorkflow(d.id, d.name, d.platform as Platform)}><IntegrationLogo name={d.platform === "n8n" ? "n8n" : d.platform === "zapier" ? "zapier" : "make"} size={24}/><span><b>{d.name}</b><small>{d.platform} · {d.enabled ? "Active" : "Paused"}</small></span><strong>Protect →</strong></button>)}</div>}</section>}

      {created && <section className="simple-protected-card"><span className="simple-connected-pill">● PROTECTED</span><h2>Protection is on.</h2><p>{platform === "n8n" ? "Outcom is observing native n8n executions." : platform === "make" ? "Outcom can observe Make natively when API access is connected, or receive signed-by-URL webhook events from the scenario." : "Outcom receives Zapier run events through the private webhook endpoint for this protected Zap."}</p><div className="simple-bottom-row">{platform === "n8n" && <button className="simple-secondary" onClick={syncN8n}>Sync now</button>}<a className="simple-primary" href="/incidents">View proof →</a></div></section>}

      <section className="business-system-card">
        <div className="simple-section-title"><span>OPTIONAL · ADD LATER</span><h2>Where does the real business result live?</h2><p>Connect the system that contains the real business state. For example, Outcom can check whether a lead, tag, opportunity, or appointment actually exists in GoHighLevel.</p></div>
        <div className="business-system-panel"><div className="business-system-heading"><IntegrationLogo name="ghl" size={42}/><div><h3>GoHighLevel</h3><p>System of truth · read-only verification</p></div>{ghl && <b className="simple-connected-pill">CONNECTED</b>}</div>
          {!ghl && <div className="connection-setup-block"><div className="setup-instructions"><b>Recommended for a quick test: Private Integration Token</b><ol><li>Open your GoHighLevel account.</li><li>Go to <strong>Settings → Private Integrations</strong> at the agency or sub-account level.</li><li>Create an integration with only the read permissions Outcom needs.</li><li>Copy the generated token immediately; it may only be shown once.</li><li>Copy the numeric <strong>Location ID</strong> of the sub-account you want Outcom to inspect.</li></ol><a href="https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/" target="_blank" rel="noreferrer">Open HighLevel Private Integration instructions ↗</a></div><div className="simple-form-grid ghl-form-grid"><input value={ghlLocationId} onChange={e => setGhlLocationId(e.target.value)} placeholder="Location ID · sub-account ID" /><input type="password" value={ghlPit} onChange={e => setGhlPit(e.target.value)} placeholder="Private Integration Token" /><button className="simple-primary" disabled={ghlConnecting || !ghlLocationId.trim() || !ghlPit.trim()} onClick={connectGhlDirect}>{ghlConnecting ? "Checking access…" : "Connect HighLevel"}</button></div><p className="simple-help">For a public multi-client product, use HighLevel OAuth instead of asking every client to paste a token.</p>{oauth.ghl && <button className="simple-secondary" onClick={() => oauthConnect("ghl")}>Connect with HighLevel OAuth ↗</button>}</div>}
          {ghl && <p className="simple-help">Connected. Outcom can use this location as the business system to verify expected outcomes.</p>}
          {ghlMessage && <p className="simple-inline-message">{ghlMessage}</p>}
        </div>
      </section>

      <div className="simple-footer-note"><b>Outcom is not another dashboard.</b><span>Connect one workflow. Define one expected result. Investigate only when reality differs.</span></div>
    </div>
  );
}
