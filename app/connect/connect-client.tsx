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
                <span><b>{item.name}</b><small>{connectedHere ? "Connected" : "Connect with instance URL + API key"}</small></span>
                <strong>{platform === item.id ? "✓" : "→"}</strong>
              </button>;
            })}
          </div>
          <div className="mvp-scope-note"><strong>Simple setup:</strong> connect one automation source first. n8n uses an instance URL + API key; Zapier and Make should use OAuth when Outcom credentials are configured. HighLevel is the optional system of truth for verifying the final business result.</div>

          <div className="simple-selected-panel">
            <div className="simple-selected-heading"><div><span>SELECTED PLATFORM</span><h3>{platformName}</h3></div>{activeConnection && <b className="simple-connected-pill">CONNECTED</b>}</div>
            {platform === "n8n" && !n8n && <div className="connection-setup-block">
              <div className="setup-instructions"><b>What to copy from n8n (not your login)</b><ol><li>Open n8n and go to <strong>Settings → n8n API</strong>.</li><li>Create an API key and copy it once.</li><li>Copy your workspace URL from the browser address bar, for example <code>https://your-workspace.app.n8n.cloud</code>.</li></ol><a href="https://docs.n8n.io/api/authentication/" target="_blank" rel="noreferrer">Open n8n API instructions ↗</a></div>
              <div className="simple-form-grid"><input value={n8nBaseUrl} onChange={e => setN8nBaseUrl(e.target.value)} placeholder="Instance URL · https://…" /><input type="password" value={n8nApiKey} onChange={e => setN8nApiKey(e.target.value)} placeholder="Read-only API key" /><button className="simple-primary" disabled={n8nConnecting || !n8nBaseUrl.trim() || !n8nApiKey.trim()} onClick={connectN8n}>{n8nConnecting ? "Checking access…" : "Connect n8n"}</button></div>
              <p className="simple-help">Not your n8n email or password. Outcom needs only the n8n instance URL and an API key. n8n documents that API keys are full-access unless scoped keys are available on Enterprise, so use a dedicated key for Outcom.</p>
            </div>}
            {platform === "n8n" && n8n && <button className="simple-primary" onClick={discoverN8n}>{loadingDiscovery ? "Finding workflows…" : "Find my workflows →"}</button>}
            {platform === "zapier" && <div className="connection-setup-block"><div className="setup-instructions"><b>Connect Zapier without copying a password or API key</b><ol><li>Use OAuth if it is enabled for this Outcom deployment.</li><li>If OAuth is unavailable, do not paste your Zapier password into Outcom. Use the webhook setup path supplied by Outcom for the specific workflow.</li><li>Paste the unique Outcom webhook URL into the final Webhooks by Zapier POST step.</li></ol><a href="https://zapier.com/app/assets/connections" target="_blank" rel="noreferrer">Open Zapier connections ↗</a></div>{oauth.zapier ? <button className="simple-primary" onClick={() => oauthConnect("zapier")}>Connect with Zapier ↗</button> : <p className="simple-help">Zapier OAuth is not configured on this deployment yet. Do not use a dead connection button; use the workflow webhook path instead.</p>}</div>}
            {platform === "make" && <div className="connection-setup-block"><div className="setup-instructions"><b>Connect Make without relying on the paid API token</b><ol><li>Open the Make scenario you want Outcom to observe.</li><li>Add a <strong>Webhooks → Custom webhook</strong> module to the scenario.</li><li>Use the Outcom webhook URL from the webhook setup screen.</li><li>Make API access is an advanced path; Make documents API access as plan-gated, so Outcom should not make an API token the default connection method.</li></ol><a href="https://www.make.com/en/help/tools/webhooks" target="_blank" rel="noreferrer">Open Make webhook instructions ↗</a></div>{oauth.make ? <button className="simple-primary" onClick={() => oauthConnect("make")}>Connect with Make ↗</button> : <p className="simple-help">Make OAuth is not configured on this deployment yet. Do not ask the user to buy a plan just to paste an API token; use the workflow webhook path instead.</p>}</div>}
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

      {discoveryLoaded && <section className="simple-results-card"><div className="simple-section-title"><span>YOUR AUTOMATIONS</span><h2>{discoveryTotal === 0 ? "No automations found" : "Choose a workflow to protect"}</h2><p>{discoveryTotal === 0 ? "No workflows were visible with the current connection." : `${discoveryTotal} workflow${discoveryTotal === 1 ? "" : "s"} found.`}</p></div>{discovered.length > 0 && <div className="simple-discovery-list">{discovered.map(d => <button key={`${d.platform}:${d.id}`} onClick={() => protectWorkflow(d.id, d.name, d.platform as Platform)}><IntegrationLogo name={d.platform === "n8n" ? "n8n" : d.platform === "zapier" ? "zapier" : "make"} size={24}/><span><b>{d.name}</b><small>{d.platform} · {d.enabled ? "Active" : "Paused"}</small></span><strong>Protect →</strong></button>)}</div>}</section>}

      {created && <section className="simple-protected-card"><span className="simple-connected-pill">● PROTECTED</span><h2>Protection is on.</h2><p>{platform === "n8n" ? "Outcom is observing this workflow and checking its downstream result." : "This workflow is registered. Coverage depends on the available platform adapter."}</p><div className="simple-bottom-row"><button className="simple-secondary" onClick={syncN8n}>Sync now</button><a className="simple-primary" href="/incidents">View proof →</a></div></section>}

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
