"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IntegrationLogo } from "@/app/integrations";

type Platform = "n8n" | "zapier" | "make" | "ghl";
type Provider = "ghl" | Platform;
type Connection = { provider: Provider; accountName: string; email?: string | null; expiresAt?: string | null };
type Discovered = { id: string; name: string; enabled: boolean; updatedAt: string | null; url: string | null; platform: string; lastSuccessfulRun?: string | null; steps?: number | null };
type OAuthStatus = { ghl: boolean; zapier: boolean; make: boolean };

const platforms: Array<{ id: Platform; name: string; description: string }> = [
  { id: "n8n", name: "n8n", description: "URL + API key · ready now" },
  { id: "zapier", name: "Zapier", description: "OAuth connection · deployment setup" },
  { id: "make", name: "Make", description: "OAuth or paid API token" },
  { id: "ghl", name: "HighLevel", description: "Location ID + private token" },
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
    setPlatform("n8n");
    setName(workflowName);
    setWorkflowId(id);
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

      {error && <div className="simple-alert"><b>Connection notice</b><span>{error === "zapier_oauth_not_configured" ? "That connection is not part of the current MVP." : error.replaceAll("_", " ")}</span></div>}
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
                <span><b>{item.name}</b><small>{connectedHere ? "Connected" : item.description}</small></span>
                <strong>{platform === item.id ? "✓" : "→"}</strong>
              </button>;
            })}
          </div>
          <div className="mvp-scope-note"><strong>Start here:</strong> Connect one automation source first. n8n is ready for direct connection. Zapier and Make require provider OAuth to be configured for this Outcom deployment. HighLevel is optional and is only needed when it holds the business result you want to verify.</div>

          <div className="simple-selected-panel">
            <div className="simple-selected-heading"><div><span>SELECTED PLATFORM</span><h3>{platformName}</h3></div>{activeConnection && <b className="simple-connected-pill">CONNECTED</b>}</div>
            {platform === "n8n" && !n8n && <div className="connection-setup-block">
              <div className="setup-instructions"><b>What to copy from n8n</b><ol><li>Open n8n and go to <strong>Settings → n8n API</strong>.</li><li>Create an API key and copy it once.</li><li>Copy your workspace URL from the browser address bar, for example <code>https://your-workspace.app.n8n.cloud</code>.</li></ol><a href="https://docs.n8n.io/api/authentication/" target="_blank" rel="noreferrer">Open n8n API instructions ↗</a></div>
              <div className="simple-form-grid"><input value={n8nBaseUrl} onChange={e => setN8nBaseUrl(e.target.value)} placeholder="Instance URL · https://…" /><input type="password" value={n8nApiKey} onChange={e => setN8nApiKey(e.target.value)} placeholder="Read-only API key" /><button className="simple-primary" disabled={n8nConnecting || !n8nBaseUrl.trim() || !n8nApiKey.trim()} onClick={connectN8n}>{n8nConnecting ? "Checking access…" : "Connect n8n"}</button></div>
              <p className="simple-help">Not your n8n email or password. Outcom needs the instance URL and an API key.</p>
            </div>}
            {platform === "n8n" && n8n && <button className="simple-primary" onClick={discoverN8n}>{loadingDiscovery ? "Finding workflows…" : "Find my workflows →"}</button>}
            {platform === "zapier" && <div className="connection-setup-block"><div className="setup-instructions"><b>How Zapier connection works</b><ol><li>Outcom must first have a Zapier OAuth app configured by the product owner.</li><li>When enabled, click <strong>Connect with Zapier</strong> and approve read-only access in the Zapier window.</li><li>After approval, Outcom can discover the Zaps available to the connected account.</li></ol><a href="https://zapier.com/app/assets/connections" target="_blank" rel="noreferrer">Open your Zapier account ↗</a></div>{oauth.zapier ? <button className="simple-primary" onClick={() => oauthConnect("zapier")}>Connect with Zapier ↗</button> : <div className="simple-unavailable"><strong>Not enabled on this deployment yet.</strong><span>This is not an input problem. The Outcom server needs Zapier OAuth credentials before a real connection button can work.</span></div>}</div>}
            {platform === "make" && <div className="connection-setup-block"><div className="setup-instructions"><b>How Make connection works</b><ol><li>The simplest production route is Make OAuth, which requires Outcom's Make client credentials to be configured.</li><li>When enabled, click <strong>Connect with Make</strong> and approve access.</li><li>The advanced API route requires a Make API token with <strong>scenarios:read</strong> plus the numeric <strong>Team ID</strong>. API access may require a paid Make plan.</li></ol><a href="https://developers.make.com/api-documentation/authentication" target="_blank" rel="noreferrer">Open Make authentication docs ↗</a></div>{oauth.make ? <button className="simple-primary" onClick={() => oauthConnect("make")}>Connect with Make ↗</button> : <div className="simple-unavailable"><strong>OAuth is not enabled on this deployment yet.</strong><span>Do not paste your Make email or password here. A real connection needs Make OAuth credentials or the advanced API-token route.</span></div>}</div>}
            {platform === "ghl" && <div className="connection-setup-block"><div className="setup-instructions"><b>Connect HighLevel as the system of truth</b><ol><li>Open the HighLevel sub-account you want Outcom to inspect.</li><li>Go to <strong>Settings → Private Integrations</strong>.</li><li>Create a read-only integration and copy the token.</li><li>Copy the sub-account's <strong>Location ID</strong>.</li></ol><a href="https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/" target="_blank" rel="noreferrer">Open HighLevel instructions ↗</a></div><div className="simple-form-grid ghl-form-grid"><input value={ghlLocationId} onChange={e => setGhlLocationId(e.target.value)} placeholder="Location ID · e.g. abc123…" /><input type="password" value={ghlPit} onChange={e => setGhlPit(e.target.value)} placeholder="Private Integration Token" /><button className="simple-primary" disabled={ghlConnecting || !ghlLocationId.trim() || !ghlPit.trim()} onClick={connectGhlDirect}>{ghlConnecting ? "Checking access…" : "Connect HighLevel"}</button></div><p className="simple-help">This is not your HighLevel login password. For a public multi-client product, OAuth should replace manual tokens.</p></div>}
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

      <div className="simple-footer-note"><b>Outcom is not another dashboard.</b><span>Connect one workflow. Define one expected result. Investigate only when reality differs.</span></div>
    </div>
  );
}
