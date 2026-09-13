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
    if (sourcePlatform !== "n8n") {
      setTestResult(`${sourcePlatform === "make" ? "Make" : "Zapier"} discovery is connected, but protection is not enabled yet. Outcom will not create a fake protected workflow.`);
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

  return (
    <div className="connect-page v19-connect">
      <header className="v19-connect-hero">
        <div>
          <div className="breadcrumb">Workspace <span>/</span> Connect stack</div>
          <div className="v19-eyebrow"><span className="v19-dot"/> BUSINESS OUTCOME VERIFICATION</div>
          <h1>Connect once.<br/><em>We prove the outcome.</em></h1>
          <p>Connect the tools you already use. Outcom stays read-only, observes the automation from outside, and checks whether the downstream business state actually ended up right.</p>
        </div>
        <div className="v19-edge-card">
          <span className="v19-edge-kicker">THE DIFFERENCE</span>
          <div className="v19-fake-success"><b>n8n / Make / Zapier</b><span>Execution: <strong>SUCCESS</strong></span></div>
          <div className="v19-arrow">↓</div>
          <div className="v19-proof"><span>Outcom</span><strong>Was the business result actually correct?</strong><small>Execution → entity → downstream state → proof</small></div>
          <div className="v19-no-node">NO HTTP REQUEST NODE · NO CUSTOM ASSERTION</div>
        </div>
      </header>

      {error && <div className="v19-alert"><strong>Connection setup needed</strong><span>{error === "zapier_oauth_not_configured" ? "Zapier is waiting for the Outcom developer to finish the one-time OAuth app setup. End users will not need a Zapier API key after that." : error.replaceAll("_", " ")}</span></div>}
      {connected && <div className="v19-success">✓ {connected === "ghl" ? "HighLevel" : connected[0].toUpperCase() + connected.slice(1)} connected. Your workspace can now discover data.</div>}

      <section className="v19-section">
        <div className="v19-section-head"><div><span className="v19-index">01</span><h2>Connect your automation</h2><p>Use the easiest supported auth for your environment. After connection, Outcom handles discovery and verification.</p></div><div className="v19-readonly"><b>READ-ONLY</b><span>We do not edit your automations.</span></div></div>

        <div className="v22-auth-map"><span><b>n8n</b> API key + instance URL</span><span><b>HighLevel</b> OAuth 2.0</span><span><b>Make</b> OAuth 2.0</span><span><b>Zapier</b> OAuth 2.0</span></div>

        <div className="v23-connection-strip">{connectionStatuses.map(([label, value]) => <div key={String(label)} className={`v23-connection-status ${value ? "on" : "off"}`}><span>{value ? "✓" : "○"}</span><div><b>{label}</b><small>{value ? `Connected · ${value.accountName}` : "Not connected"}</small></div></div>)}</div>

        <div className="v19-connect-grid">
          <article className={`v19-connector ${n8n ? "is-connected" : ""}`}>
            <div className="v19-connector-top"><div className="v19-logo"><IntegrationLogo name="n8n" size={34}/></div><span className={`v19-status ${n8n ? "on" : ""}`}>{n8n ? "CONNECTED" : "API ACCESS"}</span></div>
            <h3>n8n</h3>
            <p>{n8n ? `Connected to ${n8n.accountName}.` : "n8n does not expose a generic third-party 'log in with n8n' flow for its API. Use a read-only API key for the instance."}</p>
            {!n8n && <div className="v19-form"><input value={n8nBaseUrl} onChange={e => setN8nBaseUrl(e.target.value)} placeholder="Your n8n URL · https://…"/><input type="password" value={n8nApiKey} onChange={e => setN8nApiKey(e.target.value)} placeholder="Paste n8n API key"/></div>}
            <div className="v19-actions">{n8n ? <button className="v19-button" onClick={discoverN8n}>{loadingDiscovery ? "Finding…" : "Find workflows"}</button> : <button className="v19-button dark" disabled={n8nConnecting || !n8nBaseUrl.trim() || !n8nApiKey.trim()} onClick={connectN8n}>{n8nConnecting ? "Checking access…" : "Connect n8n"}</button>}</div>
            {n8nMessage && <small className={`v19-message ${n8nMessage.startsWith("Connected") || n8nMessage.startsWith("Protected") ? "ok" : ""}`}>{n8nMessage}</small>}
            {!n8n && <small className="v19-help">One-time setup: n8n → Settings → API → create a key. Outcom stores it encrypted and only reads workflows/executions.</small>}
          </article>

          <article className={`v19-connector ${zapier ? "is-connected" : ""}`}>
            <div className="v19-connector-top"><div className="v19-logo"><IntegrationLogo name="zapier" size={34}/></div><span className={`v19-status ${zapier ? "on" : ""}`}>{zapier ? "CONNECTED" : oauth.zapier ? "ONE-CLICK" : "SETUP"}</span></div>
            <h3>Zapier</h3>
            <p>{zapier ? zapier.accountName : "The end user should only click 'Continue with Zapier' and approve access. No API key should be copied."}</p>
            <div className="v19-actions">
              {zapier ? <button className="v19-button" onClick={() => discover("zapier")}>{loadingDiscovery ? "Discovering…" : "Discover all Zaps"}</button> : <button className="v19-button dark" onClick={() => oauthConnect("zapier")} disabled={!oauth.zapier}>Continue with Zapier ↗</button>}
            </div>
            {!zapier && <small className={`v19-help ${oauth.zapier ? "v19-help-ok" : ""}`}>{oauth.zapier ? "Ready. Zapier handles the login and consent screen." : "OAuth is the correct user connection. The one-time blocker is Zapier's public-integration approval, which is required before Zapier issues Client ID/Secret and redirect-URI access."}</small>}
          </article>

          <article className={`v19-connector ${make ? "is-connected" : ""}`}>
            <div className="v19-connector-top"><div className="v19-logo"><IntegrationLogo name="make" size={34}/></div><span className={`v19-status ${make ? "on" : ""}`}>{make ? "CONNECTED" : oauth.make ? "ONE-CLICK" : "SETUP"}</span></div>
            <h3>Make</h3>
            <p>{make ? make.accountName : "Connect with Make OAuth for one-click read-only access. Design partners can also use a scoped API token."}</p>
            {!make && !oauth.make && <div className="v19-manual-note">Manual fallback is available for design-partner testing.</div>}
            <div className="v19-actions">{make ? <button className="v19-button" onClick={() => discover("make")}>{loadingDiscovery ? "Discovering…" : "Discover scenarios"}</button> : oauth.make ? <button className="v19-button dark" onClick={() => oauthConnect("make")}>Continue with Make ↗</button> : <button className="v19-button" onClick={() => { setMakeTeamId(""); setMakeToken(""); document.getElementById("make-manual")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Use manual setup</button>}</div>
            {makeMessage && <small className={`v19-message ${makeMessage.startsWith("✓") ? "ok" : ""}`}>{makeMessage}</small>}
            {!make && <small className="v19-help">{oauth.make ? "Ready. Make handles the login and consent screen; no token or Team ID is exposed to the user." : "Manual test mode uses a read-only Make API token with scenarios:read plus the numeric Team ID. We verify actual scenario access before saving the connection."}</small>}
          </article>
        </div>
        {makeMessage && !make && <div className={`v19-message v23-global-make-message ${makeMessage.startsWith("✓") ? "ok" : ""}`}>{makeMessage}</div>}
        {!make && !oauth.make && <div id="make-manual" className="v20-manual-panel"><div><b>Design-partner manual setup</b><span>For this test path, enter the numeric Team ID and a token with <b>scenarios:read</b>. The token is never shown again after saving.</span></div><div className="v19-form v20-manual-grid"><input value={makeTeamId} onChange={e => setMakeTeamId(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Make Team ID · e.g. 123456"/><input type="password" value={makeToken} onChange={e => setMakeToken(e.target.value)} placeholder="Make API token · scenarios:read"/><button className="v19-button dark" disabled={makeConnecting || !makeTeamId.trim() || !makeToken.trim()} onClick={connectMakeDirect}>{makeConnecting ? "Verifying access…" : "Connect & verify"}</button></div></div>}
      </section>

      <section className="v19-section v19-business-system">
        <div className="v19-section-head"><div><span className="v19-index">02</span><h2>Connect the system that holds the truth</h2><p>The automation tells us it ran. Your business system tells us whether the result is actually there.</p></div></div>
        <article className={`v19-connector wide ${ghl ? "is-connected" : ""}`}>
          <div className="v19-business-left"><div className="v19-logo"><IntegrationLogo name="ghl" size={34}/></div><div><h3>HighLevel</h3><p>{ghl ? ghl.accountName : "Read-only downstream verification for contacts, tags and business state."}</p></div></div>
          <div className="v19-business-actions">
            {ghl ? <span className="v19-connected-label">✓ Connected · read-only</span> : oauth.ghl ? <button className="v19-button" onClick={() => oauthConnect("ghl")}>Connect with HighLevel ↗</button> : <><input value={ghlLocationId} onChange={e => setGhlLocationId(e.target.value)} placeholder="Location ID"/><input type="password" value={ghlPit} onChange={e => setGhlPit(e.target.value)} placeholder="Private Integration Token"/><button className="v19-button dark" disabled={ghlConnecting || !ghlLocationId.trim() || !ghlPit.trim()} onClick={connectGhlDirect}>{ghlConnecting ? "Connecting…" : "Connect HighLevel"}</button></>}
          </div>
          {ghlMessage && <small className="v19-message">{ghlMessage}</small>}
        </article>
      </section>

      {discoveryLoaded && <section className="v19-section">
        <div className="v19-section-head"><div><span className="v19-index">03</span><h2>{discoveryTotal === 0 ? "No automations found." : "Your automations are here."}</h2><p>{discoveryTotal === 0 ? "This account currently has no workflows visible to Outcom with the granted read-only access." : `Outcom discovered ${discoveryTotal} workflow${discoveryTotal === 1 ? "" : "s"}${discoveryPages > 1 ? ` across ${discoveryPages} API pages` : ""}. No API key was required.`}</p></div><div className="v19-readonly"><b>{discoveryTotal ?? 0}</b><span>workflows discovered</span></div></div>
        {discovered.length > 0 && <div className="v19-discovery-list">{discovered.map(d => <button key={`${d.platform}:${d.id}`} className="v19-discovery" onClick={() => protectWorkflow(d.id, d.name, d.platform as Platform)}><span className="v19-discovery-icon"><IntegrationLogo name={d.platform === "n8n" ? "n8n" : d.platform === "zapier" ? "zapier" : "make"} size={22}/></span><span><b>{d.name}</b><small>{d.platform} · {d.enabled ? "Active" : "Paused"}{d.steps != null ? ` · ${d.steps} steps` : ""}</small></span><strong>{d.platform === "n8n" ? "Protect →" : "Discovered ✓"}</strong></button>)}</div>}
        {discoveryTotal != null && discoveryTotal > discovered.length && <small className="v19-help">The provider reported {discoveryTotal} workflows, but this UI currently renders the first {discovered.length}. The API sync itself is paginated and fetched all pages.</small>}
      </section>}

      {created && <section className="v19-section v19-protect-section">
        <div className="v19-section-head"><div><span className="v19-index">04</span><h2>Protection is on.</h2><p>{platform === "n8n" ? "Outcom is observing the automation from outside the workflow. No HTTP Request node. No custom assertion." : "This workflow is registered. Observer coverage will depend on the platform adapter available for this workspace."}</p></div><span className="v19-live">● PROTECTED</span></div>
        {platform === "n8n" && <div className="v19-proof-grid"><div><span>01</span><b>Observe</b><small>Native execution history</small></div><div><span>02</span><b>Correlate</b><small>Execution → business entity</small></div><div><span>03</span><b>Verify</b><small>Actual downstream state</small></div><div><span>04</span><b>Prove</b><small>Evidence + impact + action</small></div></div>}
        {platform === "n8n" && <div className="v19-actions"><button className="v19-button" onClick={syncN8n}>Sync native executions</button><a className="v19-button dark" href="/incidents">View proof →</a>{testResult && <span className="v19-message">{testResult}</span>}</div>}
      </section>}

      <section className="v19-edge-strip">
        <div><span className="v19-edge-kicker">WHY OUTCOM</span><h2>Green execution is not proof of a correct business outcome.</h2><p>Native automation logs answer <b>“Did the steps execute?”</b> Outcom answers <b>“Did the business state end up correct?”</b></p></div>
        <div className="v19-edge-list"><div><b>01</b><span>External observer</span><small>Works without changing the workflow.</small></div><div><b>02</b><span>Outcome inference</span><small>Reads topology instead of asking builders to write assertions.</small></div><div><b>03</b><span>State memory</span><small>Catches regressions like a tag silently disappearing later.</small></div><div><b>04</b><span>Evidence graph</span><small>Shows execution → entity → state → impact.</small></div></div>
      </section>

      <div className="v19-footnote"><span>Read-only by design.</span><span>Inference is conservative: if Outcom cannot prove the expected outcome, it reports <b>UNKNOWN</b> instead of inventing one.</span></div>
    </div>
  );
}
