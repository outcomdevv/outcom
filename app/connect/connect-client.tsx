"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IntegrationLogo } from "@/app/integrations";

type Platform = "n8n" | "zapier" | "make";
type Provider = "ghl" | Platform;
type Connection = { provider: Provider; accountName: string; email?: string | null; expiresAt?: string | null };
type Discovered = { id: string; name: string; enabled: boolean; updatedAt: string | null; url: string | null; platform: string; lastSuccessfulRun?: string | null; steps?: number | null };
type OAuthStatus = { ghl: boolean; zapier: boolean; make: boolean };

const platforms = [
  { id: "n8n" as const, name: "n8n", description: "Native observer. No workflow-side node required." },
  { id: "zapier" as const, name: "Zapier", description: "Connect your account, then discover Zaps." },
  { id: "make" as const, name: "Make", description: "Connect your account, then discover scenarios." },
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

  async function protectWorkflow(id: string, workflowName: string, sourcePlatform: Platform) {
    setPlatform(sourcePlatform); setName(workflowName); setWorkflowId(sourcePlatform === "n8n" ? id : `${sourcePlatform}_${id}`);
    if (sourcePlatform === "make") {
      setN8nMessage("Reading scenario topology and inferring the outcome…");
      const r = await fetch("/api/make/protect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: id }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.protected) { setCreated(true); setN8nMessage(`Protected natively · ${j.createdContracts?.length || 0} outcome checks inferred`); router.refresh(); }
      else setN8nMessage(j.error || j.reason || "Outcom could not safely infer a business outcome from this Make scenario.");
      return;
    }
    if (sourcePlatform === "zapier") {
      setTestResult("Zapier is connected and discovered. Outcom will not claim an outcome verdict until native run-history access is available through the selected Zapier API path.");
      return;
    }
    setN8nMessage("Reading workflow topology and inferring the outcome…");
    const r = await fetch("/api/n8n/protect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workflowId: id }) });
    const j = await r.json();
    if (r.ok && j.protected) { setCreated(true); setN8nMessage(`Protected natively · ${j.createdContracts?.length || 0} checks inferred`); router.refresh(); }
    else setN8nMessage(j.error || j.analysis?.recommendation || "Outcom could not infer a safe protection plan.");
  }

  async function createWorkflow() {
    if (!name.trim()) return;
    if (platform === "n8n") {
      if (!workflowId.trim()) { setN8nMessage("Choose a discovered n8n workflow first."); return; }
      await protectWorkflow(workflowId.trim(), name.trim(), "n8n");
      return;
    }
    const id = workflowId.trim() || `workflow_${crypto.randomUUID()}`;
    const r = await fetch("/api/workflows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name: name.trim(), platform, description: `Protected ${selected.name} workflow` }) });
    const j = await r.json();
    if (r.ok) { setWorkflowId(j.workflow.id); setCreated(true); router.refresh(); }
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

  const activeConnection = platform === "n8n" ? n8n : platform === "zapier" ? zapier : make;
  const platformName = platform === "n8n" ? "n8n" : platform === "zapier" ? "Zapier" : "Make";

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

      {error && <div className="simple-alert"><b>Connection notice</b><span>{error === "zapier_oauth_not_configured" ? "Zapier OAuth still needs developer setup." : error.replaceAll("_", " ")}</span></div>}
      {connected && <div className="simple-success">✓ {connected === "ghl" ? "HighLevel" : connected[0].toUpperCase() + connected.slice(1)} connected.</div>}

      <section className="simple-flow-card">
        <div className="simple-stepper">
          <button className={step === 1 ? "active" : "done"} onClick={() => setStep(1)}><span>1</span> Connect automation</button>
          <div className="simple-step-line" />
          <button className={step === 2 ? "active" : ""} onClick={() => setStep(2)}><span>2</span> Define success</button>
        </div>

        {step === 1 && <div className="simple-step-content">
          <div className="simple-section-title"><span>STEP 01</span><h2>Where does your automation run?</h2><p>Choose one platform. You can add another later.</p></div>
          <div className="simple-platform-grid">
            {platforms.map((item) => {
              const connectedHere = item.id === "n8n" ? n8n : item.id === "zapier" ? zapier : make;
              return <button key={item.id} className={`simple-platform ${platform === item.id ? "selected" : ""}`} onClick={() => setPlatform(item.id)}>
                <IntegrationLogo name={item.id} size={34} />
                <span><b>{item.name}</b><small>{connectedHere ? "Connected" : item.id === "n8n" ? "Connect with URL + key" : "One-click OAuth"}</small></span>
                <strong>{platform === item.id ? "✓" : "→"}</strong>
              </button>;
            })}
          </div>

          <div className="simple-selected-panel">
            <div className="simple-selected-heading"><div><span>SELECTED PLATFORM</span><h3>{platformName}</h3></div>{activeConnection && <b className="simple-connected-pill">CONNECTED</b>}</div>
            {platform === "n8n" && !n8n && <div className="connection-setup-block">
              <div className="setup-instructions"><b>What to copy from n8n</b><ol><li>Open n8n and go to <strong>Settings → n8n API</strong>.</li><li>Create an API key and copy it once.</li><li>Copy your workspace URL from the browser address bar, for example <code>https://your-workspace.app.n8n.cloud</code>.</li></ol><a href="https://docs.n8n.io/api/authentication/" target="_blank" rel="noreferrer">Open n8n API instructions ↗</a></div>
              <div className="simple-form-grid"><input value={n8nBaseUrl} onChange={e => setN8nBaseUrl(e.target.value)} placeholder="Instance URL · https://…" /><input type="password" value={n8nApiKey} onChange={e => setN8nApiKey(e.target.value)} placeholder="Read-only API key" /><button className="simple-primary" disabled={n8nConnecting || !n8nBaseUrl.trim() || !n8nApiKey.trim()} onClick={connectN8n}>{n8nConnecting ? "Checking access…" : "Connect n8n"}</button></div>
              <p className="simple-help">Not your n8n email or password. Outcom needs the instance URL and an API key.</p>
            </div>}
            {platform === "n8n" && n8n && <button className="simple-primary" onClick={discoverN8n}>{loadingDiscovery ? "Finding workflows…" : "Find my workflows →"}</button>}
            {platform === "zapier" && !zapier && <div className="connection-setup-block"><div className="setup-instructions"><b>How Zapier connects</b><ol><li>Click Continue with Zapier.</li><li>Sign in to your Zapier account if asked.</li><li>Approve Outcom's requested access, then return here.</li></ol><p>No email, password, API key, or copied token is required in Outcom. This uses OAuth.</p><a href="https://zapier.com/app/connections" target="_blank" rel="noreferrer">Open Zapier App Connections ↗</a></div><button className="simple-primary" disabled={!oauth.zapier} onClick={() => oauthConnect("zapier")}>{oauth.zapier ? "Continue with Zapier ↗" : "Zapier OAuth is not enabled yet"}</button>{!oauth.zapier && <p className="simple-help">This deployment still needs the Outcom Zapier OAuth client ID, secret, redirect URL, and approved scopes. Do not ask users to paste Zapier credentials.</p>}</div>}
            {platform === "zapier" && zapier && <button className="simple-primary" onClick={() => discover("zapier")}>{loadingDiscovery ? "Finding Zaps…" : "Find my Zaps →"}</button>}
            {platform === "make" && !make && <div className="connection-setup-block"><div className="setup-instructions"><b>Recommended: OAuth</b><ol><li>Click Continue with Make.</li><li>Sign in to Make and approve read-only access.</li><li>Return to Outcom to discover your scenarios.</li></ol><a href="https://www.make.com/en/api-documentation" target="_blank" rel="noreferrer">Open Make API documentation ↗</a></div>{oauth.make && <button className="simple-primary" onClick={() => oauthConnect("make")}>Continue with Make ↗</button>} {!oauth.make && <p className="simple-help">Make OAuth is not enabled on this deployment yet. You can use the manual API-token setup below.</p>}<details className="advanced-connection"><summary>Advanced setup · API token</summary><div className="setup-instructions"><b>Copy these values from Make</b><ol><li>Make → profile/avatar → <strong>Profile → API</strong>.</li><li>Create an API token with <strong>scenarios:read</strong>.</li><li>Open your Make team and copy the numeric <strong>Team ID</strong> from the team URL or team settings.</li><li>Choose the API zone used by your Make account, such as <code>https://eu1.make.com/api/v2</code>.</li></ol><a href="https://developers.make.com/api-documentation/authentication/create-authentication-token" target="_blank" rel="noreferrer">How to create a Make API token ↗</a></div><div className="simple-form-grid simple-form-grid-stack"><input value={makeTeamId} onChange={e => setMakeTeamId(e.target.value)} placeholder="Numeric Team ID · e.g. 12345" /><input type="password" value={makeToken} onChange={e => setMakeToken(e.target.value)} placeholder="Make API token" /><input value={makeApiBase} onChange={e => setMakeApiBase(e.target.value)} placeholder="API base URL · optional" /><button className="simple-primary" disabled={makeConnecting || !makeTeamId.trim() || !makeToken.trim()} onClick={connectMakeDirect}>{makeConnecting ? "Checking access…" : "Connect with API token"}</button></div></details></div>}
            {platform === "make" && make && <button className="simple-primary" onClick={() => discover("make")}>{loadingDiscovery ? "Finding scenarios…" : "Find my scenarios →"}</button>}
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

      {discoveryLoaded && <section className="simple-results-card"><div className="simple-section-title"><span>YOUR AUTOMATIONS</span><h2>{discoveryTotal === 0 ? "No automations found" : "Choose a workflow to protect"}</h2><p>{discoveryTotal === 0 ? "No workflows were visible with the current connection." : `${discoveryTotal} workflow${discoveryTotal === 1 ? "" : "s"} found.`}</p></div>{discovered.length > 0 && <div className="simple-discovery-list">{discovered.map(d => <button key={`${d.platform}:${d.id}`} onClick={() => protectWorkflow(d.id, d.name, d.platform as Platform)}><IntegrationLogo name={d.platform === "n8n" ? "n8n" : d.platform === "zapier" ? "zapier" : "make"} size={24}/><span><b>{d.name}</b><small>{d.platform} · {d.enabled ? "Active" : "Paused"}</small></span><strong>Protect →</strong></button>)}</div>}</section>}

      {created && <section className="simple-protected-card"><span className="simple-connected-pill">● PROTECTED</span><h2>Protection is on.</h2><p>{platform === "n8n" ? "Outcom is observing this workflow and checking its downstream result." : "This workflow is registered. Coverage depends on the available platform adapter."}</p><div className="simple-bottom-row"><button className="simple-secondary" onClick={syncN8n}>Sync now</button><a className="simple-primary" href="/incidents">View proof →</a></div></section>}

      <section className="business-system-card">
        <div className="simple-section-title"><span>OPTIONAL · SYSTEM OF TRUTH</span><h2>Where should we verify the result?</h2><p>Connect the system that contains the real business state. For example, Outcom can check whether a lead, tag, opportunity, or appointment actually exists in GoHighLevel.</p></div>
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
