"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IntegrationLogo } from "@/app/integrations";
import LoadingScreen from "@/app/loading-screen";
import BusinessSystemPicker, { type SheetTargetState, type TargetSystem } from "@/app/connect/business-system";

type Platform = "n8n" | "zapier" | "make" | "ghl" | "custom";
type Provider = "ghl" | "google_sheets" | Platform;
type Connection = { provider: Provider; accountName: string; email?: string | null; expiresAt?: string | null };
type Discovered = { id: string; name: string; enabled: boolean; updatedAt: string | null; url: string | null; platform: string; lastSuccessfulRun?: string | null; steps?: number | null };
type OAuthStatus = { ghl: boolean; zapier: boolean; make: boolean; google_sheets: boolean };
type WebhookInfo = { provider: string; url: string; workflow: { id: string; name: string }; lastReceivedAt?: string | null; sample: Record<string, unknown> };

type OutcomeType = "record_exists" | "state_invariant" | "output_count";
type OutcomeSelection = { id: string; label: string; description: string; type: OutcomeType };
type OutcomeConfig = { label: string; type: OutcomeType; system: string; entity: string; valueFrom?: string; field?: string; operator?: string; expectedValue?: string; expectedCount?: number };

const DRAFT_KEY = "outcom-protection-draft-v69";

const outcomeOptions: OutcomeSelection[] = [
  { id: "contact-exists", label: "A contact / record exists", description: "Verify the downstream record can actually be found.", type: "record_exists" },
  { id: "tags-preserved", label: "Existing contact tags are preserved", description: "Compare the current tags with Outcom's read-only baseline.", type: "state_invariant" },
  { id: "output-produced", label: "At least one output was produced", description: "Verify the execution reported at least one downstream output.", type: "output_count" },
];

const platforms: Array<{ id: Platform; name: string; description: string }> = [
  { id: "n8n", name: "n8n", description: "Instance URL + API key · not your password" },
  { id: "zapier", name: "Zapier", description: "OAuth when configured · no password or API key" },
  { id: "make", name: "Make", description: "OAuth when configured · API token is advanced" },
  { id: "custom", name: "Other tool", description: "Pipedream, Activepieces, Power Automate, code…" },
];

const iso = () => new Date().toISOString();

export default function ConnectClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [oauth, setOauth] = useState<OAuthStatus>({ ghl: false, zapier: false, make: false, google_sheets: false });
  const [platform, setPlatform] = useState<Platform>("n8n");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [outcome, setOutcome] = useState("");
  const [selectedOutcomes, setSelectedOutcomes] = useState<OutcomeSelection[]>([]);
  const [outcomeConfigs, setOutcomeConfigs] = useState<Record<string, OutcomeConfig>>({});
  const [customOutcomeText, setCustomOutcomeText] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
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
  const [webhookRotating, setWebhookRotating] = useState(false);
  const [webhookChecking, setWebhookChecking] = useState(false);
  const [zapierName, setZapierName] = useState("");
  const [reauthProvider, setReauthProvider] = useState<"zapier" | "make" | null>(null);
  const [discoveryWarning, setDiscoveryWarning] = useState<string | null>(null);
  const [zapierCreating, setZapierCreating] = useState(false);
  const [targetSystem, setTargetSystem] = useState<TargetSystem>("google_sheets");
  const [robotEmail, setRobotEmail] = useState<string | null>(null);
  const [sheetTarget, setSheetTarget] = useState<SheetTargetState | null>(null);
  const [makeWebhookName, setMakeWebhookName] = useState("");
  const [makeWebhookCreating, setMakeWebhookCreating] = useState(false);

  const ghl = connections.find((x) => x.provider === "ghl");
  const googleConn = connections.find((x) => x.provider === "google_sheets");
  const n8n = connections.find((x) => x.provider === "n8n");
  const zapier = connections.find((x) => x.provider === "zapier");
  const make = connections.find((x) => x.provider === "make");
  const selected = useMemo(() => platforms.find((p) => p.id === platform)!, [platform]);
  const connectionStatuses: Array<[string, Connection | undefined]> = [["Google", googleConn], ["HighLevel", ghl], ["n8n", n8n], ["Make", make], ["Zapier", zapier]];

  async function loadConnections() {
    const r = await fetch("/api/connections", { cache: "no-store" });
    if (r.ok) setConnections((await r.json()).connections || []);
  }

  async function loadOAuthStatus() {
    const r = await fetch("/api/oauth/status", { cache: "no-store" });
    if (r.ok) { const j = await r.json(); setOauth(j.providers || {}); setRobotEmail(j.googleRobot?.email || null); }
  }

  useEffect(() => {
    loadConnections();
    loadOAuthStatus();
  }, [params]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.platform) setPlatform(draft.platform);
        if (draft.step >= 1 && draft.step <= 3) setStep(draft.step);
        if (typeof draft.name === "string") setName(draft.name);
        if (typeof draft.zapierName === "string") setZapierName(draft.zapierName);
        if (typeof draft.makeWebhookName === "string") setMakeWebhookName(draft.makeWebhookName);
        if (typeof draft.workflowId === "string") setWorkflowId(draft.workflowId);
        if (typeof draft.created === "boolean") setCreated(draft.created);
        if (Array.isArray(draft.selectedOutcomes)) setSelectedOutcomes(draft.selectedOutcomes);
        if (draft.outcomeConfigs && typeof draft.outcomeConfigs === "object") setOutcomeConfigs(draft.outcomeConfigs);
        if (typeof draft.customOutcomeText === "string") setCustomOutcomeText(draft.customOutcomeText);
        if (typeof draft.outcome === "string") setOutcome(draft.outcome);
        if (typeof draft.n8nBaseUrl === "string") setN8nBaseUrl(draft.n8nBaseUrl);
        if (typeof draft.ghlLocationId === "string") setGhlLocationId(draft.ghlLocationId);
        if (typeof draft.makeTeamId === "string") setMakeTeamId(draft.makeTeamId);
        if (typeof draft.makeApiBase === "string") setMakeApiBase(draft.makeApiBase);
        if (draft.targetSystem === "google_sheets" || draft.targetSystem === "ghl" || draft.targetSystem === "none") setTargetSystem(draft.targetSystem);
        if (draft.sheetTarget && typeof draft.sheetTarget === "object") setSheetTarget(draft.sheetTarget);
      }
    } catch {
      // Ignore malformed local drafts.
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    const draft = {
      platform, step, name, zapierName, makeWebhookName, workflowId, created,
      selectedOutcomes, outcomeConfigs, customOutcomeText, outcome,
      n8nBaseUrl, ghlLocationId, makeTeamId, makeApiBase, targetSystem, sheetTarget,
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draftHydrated, platform, step, name, zapierName, makeWebhookName, workflowId, created, selectedOutcomes, outcomeConfigs, customOutcomeText, outcome, n8nBaseUrl, ghlLocationId, makeTeamId, makeApiBase, targetSystem, sheetTarget]);

  useEffect(() => {
    if (!draftHydrated || !created || !workflowId || (platform !== "zapier" && platform !== "make")) return;
    void setupWebhook(platform, workflowId);
  }, [draftHydrated, created, workflowId, platform]);

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
    setDiscoveryWarning(null);
    const r = await fetch(`/api/integrations/discover?provider=${provider}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setReauthProvider(j.reauthRequired ? provider : null);
    if (j.partial && typeof j.warning === "string") setDiscoveryWarning(j.warning);
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
    } catch (e) { setGhlMessage(e instanceof Error && /invalid jwt|unauthor|401/i.test(e.message) ? "HighLevel rejected this token. Use a Private Integration Token created for this Location ID — or choose Google Sheets above instead." : e instanceof Error ? e.message : "HighLevel connection failed"); }
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
      if (!j?.url || !j?.workflow?.id) throw new Error("Outcom created the protection but did not return a webhook endpoint. Please retry.");
      setWebhookInfo(j);
      setCreated(true);
      setTestResult(null);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Could not create webhook endpoint");
    } finally {
      setWebhookLoading(false);
    }
  }

  async function refreshWebhookStatus() {
    if (!webhookInfo) return false;
    setWebhookChecking(true);
    try {
      const r = await fetch(
        `/api/webhooks/status?provider=${encodeURIComponent(webhookInfo.provider)}&workflowId=${encodeURIComponent(webhookInfo.workflow.id)}`,
        { cache: "no-store" }
      );
      if (!r.ok) return false;
      const j = await r.json();
      if (j.lastReceivedAt) {
        setWebhookInfo((current) => current ? { ...current, lastReceivedAt: j.lastReceivedAt } : current);
        return true;
      }
      return false;
    } finally {
      setWebhookChecking(false);
    }
  }

  async function waitForWebhookEvent() {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      if (await refreshWebhookStatus()) {
        setTestResult("✓ Outcom received an execution event. Observer is connected.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setTestResult("No execution event yet. Run the automation once, then use “Check for execution”.");
  }

  async function rotateWebhook() {
    if (!webhookInfo) return;
    setWebhookRotating(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/webhooks/rotate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: webhookInfo.provider, workflowId: webhookInfo.workflow.id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not rotate webhook endpoint");
      setWebhookInfo((current) => current ? { ...current, url: j.url, lastReceivedAt: null } : current);
      setTestResult("Webhook URL rotated. Update the provider step with the new URL.");
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Could not rotate webhook endpoint");
    } finally {
      setWebhookRotating(false);
    }
  }

  async function protectWorkflow(id: string, workflowName: string, sourcePlatform: Platform, configs = outcomeConfigs) {
    if (!selectedOutcomes.length) {
      throw new Error("Choose at least one outcome first.");
    }
    setName(workflowName);
    setWorkflowId(id);
    setPlatform(sourcePlatform);
    setWebhookInfo(null);

    const configuredOutcomes = selectedOutcomes.map((item) => ({
      ...item,
      ...(configs[item.id] || {}),
      label: configs[item.id]?.label?.trim() || item.label,
      type: item.type,
      system: item.type === "output_count" ? "event" : targetSystem,
      entity: item.type === "output_count" ? "output" : targetSystem === "google_sheets" ? "row" : "contact",
      target: item.type !== "output_count" && targetSystem === "google_sheets" ? sheetTarget : null,
    }));

    if (sourcePlatform === "n8n" && targetSystem === "ghl") {
      setN8nMessage("Protecting workflow…");
      const r = await fetch("/api/n8n/protect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflowId: id, expectedOutcome: outcome.trim(), expectedOutcomes: configuredOutcomes }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.protected) throw new Error(j.error || j.analysis?.recommendation || "Outcom could not protect this workflow.");
      setCreated(true);
      setN8nMessage(`Protected · ${j.createdContracts?.length || 0} outcome checks created`);
      router.refresh();
      return;
    }

    const r = await fetch("/api/integrations/protect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: sourcePlatform, externalId: id, name: workflowName, expectedOutcome: outcome.trim(), expectedOutcomes: configuredOutcomes }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.protected || !j.workflow?.id) throw new Error(j.error || "Outcom could not protect this workflow.");

    setCreated(true);
    await setupWebhook(sourcePlatform as "zapier" | "make", j.workflow.id);
    router.refresh();
  }

  function addCustomOutcome() {
    const label = customOutcomeText.trim();
    if (!label) return;
    if (selectedOutcomes.length >= 10) {
      setTestResult("You can add up to 10 outcome checks per protection.");
      return;
    }
    const id = `custom-${crypto.randomUUID()}`;
    const item: OutcomeSelection = {
      id,
      label,
      description: "Custom business-state requirement.",
      type: "state_invariant",
    };
    setSelectedOutcomes((current) => [...current, item]);
    setOutcome((current) => [current, label].filter(Boolean).join(" + "));
    setOutcomeConfigs((current) => ({
      ...current,
      [id]: {
        label, type: "state_invariant", system: "ghl", entity: "contact",
        valueFrom: "event.data.target_record_id", field: "status", operator: "equals", expectedValue: "",
      },
    }));
    setCustomOutcomeText("");
  }

  async function finishProtection() {
    const workflowName = (zapierName.trim() || name.trim());
    if (!workflowName) {
      setTestResult("Give this automation a name first.");
      setStep(1);
      return;
    }
    if (!selectedOutcomes.length) {
      setTestResult("Choose at least one outcome first.");
      setStep(2);
      return;
    }

    const needsSystem = selectedOutcomes.some((item) => item.type !== "output_count");
    const scrollToSystem = () => { setStep(2); window.setTimeout(() => document.getElementById(targetSystem === "ghl" ? "business-system" : "business-system-picker")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150); };
    if (needsSystem && targetSystem === "none") {
      setTestResult("Pick a business system below (Google Sheets is free), or keep only the “output produced” check.");
      scrollToSystem();
      return;
    }
    if (needsSystem && targetSystem === "ghl" && !ghl) {
      setTestResult("Connect HighLevel first — or switch the business system to Google Sheets.");
      scrollToSystem();
      return;
    }
    if (needsSystem && targetSystem === "google_sheets" && ((!googleConn && !robotEmail) || !sheetTarget)) {
      setTestResult(googleConn || robotEmail ? "Choose the spreadsheet, tab and key column Outcom should check." : "Connect Google first so Outcom can read your spreadsheet.");
      scrollToSystem();
      return;
    }

    const missing = selectedOutcomes.find((item) => {
      const cfg = outcomeConfigs[item.id];
      if (!cfg?.label?.trim()) return true;
      if (item.type !== "output_count" && !cfg.valueFrom?.trim()) return true;
      if (item.type === "state_invariant" && (!cfg.field?.trim() || !cfg.expectedValue?.trim())) return true;
      return false;
    });
    if (missing) {
      const message = missing.type === "state_invariant"
        ? `Finish the field and expected value for “${missing.label}”.`
        : `Finish the ${missing.label} details first.`;
      setTestResult(message);
      return;
    }

    setZapierCreating(true);
    setTestResult(null);
    try {
      const id = workflowId.trim() || `manual-${crypto.randomUUID()}`;
      await protectWorkflow(id, workflowName, platform, outcomeConfigs);
      window.setTimeout(() => document.getElementById("live-webhook")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Could not create protection.");
      window.setTimeout(() => document.getElementById("protection-action")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    } finally {
      setZapierCreating(false);
    }
  }

  async function createMakeWebhookWorkflow() {
    const workflowName = makeWebhookName.trim();
    if (!workflowName) { setTestResult("Give the scenario a name first."); return; }
    setMakeWebhookCreating(true);
    try { await protectWorkflow(`manual-${crypto.randomUUID()}`, workflowName, "make", outcomeConfigs); }
    finally { setMakeWebhookCreating(false); }
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

  const businessSystemBlock = (
    <>
      <BusinessSystemPicker value={targetSystem} onChange={setTargetSystem} googleConnected={Boolean(googleConn)} googleConfigured={oauth.google_sheets} robotEmail={robotEmail} ghlConnected={Boolean(ghl)} sheet={sheetTarget} onSheet={setSheetTarget} onConnectGoogle={() => oauthConnect("google_sheets")} />

      {targetSystem === "ghl" && <section id="business-system" className="business-system-card">
        <div className="simple-section-title"><span>BUSINESS SYSTEM · SOURCE OF TRUTH</span><h2>Where does the real business result live?</h2><p>Connect the system that contains the real business state. For example, Outcom can check whether a contact, tag, opportunity, or appointment actually exists in HighLevel.</p></div>
        <div className="business-system-panel"><div className="business-system-heading"><IntegrationLogo name="ghl" size={42}/><div><h3>HighLevel</h3><p>Business system · read-only verification</p></div>{ghl && <b className="simple-connected-pill">CONNECTED</b>}</div>
          {!ghl && <div className="connection-setup-block"><div className="setup-instructions"><b>Recommended for a quick test: Private Integration Token</b><ol><li>Open your GoHighLevel account.</li><li>Go to <strong>Settings → Private Integrations</strong> at the agency or sub-account level.</li><li>Create an integration with only the read permissions Outcom needs.</li><li>Copy the generated token immediately; it may only be shown once.</li><li>Copy the <strong>Location ID</strong> (sub-account ID) you want Outcom to inspect.</li></ol><a href="https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/" target="_blank" rel="noreferrer">Open HighLevel Private Integration instructions ↗</a></div><div className="simple-form-grid ghl-form-grid"><input name="ghl-location-id" autoComplete="off" value={ghlLocationId} onChange={e => setGhlLocationId(e.target.value)} placeholder="Location ID · sub-account ID" /><input name="ghl-private-token" type="password" autoComplete="new-password" value={ghlPit} onChange={e => setGhlPit(e.target.value)} placeholder="Private Integration Token" /><button className="simple-primary" disabled={ghlConnecting || !ghlLocationId.trim() || !ghlPit.trim()} onClick={connectGhlDirect}>{ghlConnecting ? <LoadingScreen inline message="Connecting HighLevel" /> : "Connect HighLevel"}</button></div><p className="simple-help">Quick test: use a scoped Private Integration Token. For the public SaaS flow, use HighLevel OAuth so each client can authorize without pasting a token.</p>{oauth.ghl && <button className="simple-secondary" onClick={() => oauthConnect("ghl")}>Connect HighLevel with OAuth ↗</button>}</div>}
          {ghl && <p className="simple-help">✓ Connected and verified. Outcom can now read this HighLevel location when checking the protected workflow.</p>}
          {ghlMessage && <p className="simple-inline-message">{ghlMessage}</p>}
        </div>
      </section>}
    </>
  );

  return (
    <div className="connect-page v51-simple-connect">
      <header className="simple-connect-hero">
        <div>
          <div className="breadcrumb">Workspace <span>/</span> Connect</div>
          <div className="simple-eyebrow"><span className="v19-dot" /> OUTCOME VERIFICATION</div>
          <h1>Protect one workflow.<br /><em>Know what actually happened.</em></h1>
          <p>Connect one automation, tell Outcom which business results matter, and let us verify them after the run. No need to connect your entire stack.</p>
        </div>
        <div className="simple-hero-card">
          <span className="simple-card-kicker">THE SIMPLE PATH</span>
          <div><b>1.</b> Connect an automation</div>
          <div><b>2.</b> Choose the outcomes</div>
          <div><b>3.</b> Protect the workflow</div>
          <small>Read-only wherever supported.</small>
        </div>
      </header>

      {error && <div className="simple-alert"><b>Connection notice</b><span>{error === "zapier_oauth_not_configured" ? "Zapier OAuth is not configured on this deployment; use the webhook path below." : error === "zapier_oauth_state_invalid" ? "The Zapier sign-in link expired or was already used. Start the connection again." : error === "zapier_authorization_denied" ? "Zapier access was not granted. No connection was made." : error.replaceAll("_", " ")}</span></div>}
      {connected && <div className="simple-success">✓ {connected === "ghl" ? "HighLevel" : connected === "google_sheets" ? "Google" : connected[0].toUpperCase() + connected.slice(1)} connected.</div>}

      <section className="simple-flow-card">
        <div className="simple-stepper">
          <button className={step === 1 ? "active" : step > 1 ? "done" : ""} onClick={() => step > 1 && setStep(1)}><span>1</span> Name automation</button>
          <div className="simple-step-line" />
          <button className={step === 2 ? "active" : step > 2 ? "done" : ""} onClick={() => step > 2 && setStep(2)}><span>2</span> Choose outcomes</button>
          <div className="simple-step-line" />
          <button className={step === 3 ? "active" : ""} onClick={() => step === 3 && setStep(3)}><span>3</span> Configure checks</button>
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
          <div className="mvp-scope-note"><strong>How each connects:</strong> n8n — API key (to list workflows) or a webhook; Zapier and Make — a private webhook today, account sign-in where available; any other tool — a webhook. The business system you check results against (Google Sheets, HighLevel…) is chosen in step 2.</div>

          <div className="simple-selected-panel">
            <div className="simple-selected-heading"><div><span>SELECTED PLATFORM</span><h3>{platformName}</h3></div>{activeConnection && <b className="simple-connected-pill">CONNECTED</b>}</div>
            {platform === "n8n" && !n8n && <div className="connection-setup-block">
              <div className="setup-instructions"><b>What to copy from n8n (not your login)</b><ol><li>Open n8n and go to <strong>Settings → n8n API</strong>.</li><li>Create an API key and copy it once.</li><li>Copy your workspace URL from the browser address bar, for example <code>https://your-workspace.app.n8n.cloud</code>.</li></ol><a href="https://docs.n8n.io/api/authentication/" target="_blank" rel="noreferrer">Open n8n API instructions ↗</a></div>
              <div className="simple-form-grid"><input value={n8nBaseUrl} onChange={e => setN8nBaseUrl(e.target.value)} placeholder="Instance URL · https://…" /><input type="password" value={n8nApiKey} onChange={e => setN8nApiKey(e.target.value)} placeholder="Read-only API key" /><button className="simple-primary" disabled={n8nConnecting || !n8nBaseUrl.trim() || !n8nApiKey.trim()} onClick={connectN8n}>{n8nConnecting ? <LoadingScreen inline message="Connecting n8n" /> : "Connect n8n"}</button></div>
              <p className="simple-help">Not your n8n email or password. Outcom needs only the n8n instance URL and an API key. n8n documents that API keys are full-access unless scoped keys are available on Enterprise, so use a dedicated key for Outcom.</p>
            </div>}
            {(platform === "n8n" && !n8n || platform === "custom") && <div className="connection-setup-block"><div className="setup-instructions"><b>{platform === "n8n" ? "Prefer not to share an API key?" : "Works with any tool that can send an HTTP POST"}</b><p className="compact-instruction">Name your automation, finish the next two steps, and Outcom gives you a private URL. Add one final HTTP step that POSTs the result to it. No login or key needed.</p></div><div className="webhook-register"><input value={zapierName} onChange={e => setZapierName(e.target.value)} placeholder="Automation name · e.g. Lead → Sheet" autoComplete="off" /></div></div>}
            {platform === "n8n" && n8n && <button className="simple-primary" onClick={discoverN8n}>{loadingDiscovery ? <LoadingScreen inline message="Finding workflows" /> : "Find my workflows →"}</button>}
            {platform === "zapier" && <div className="connection-setup-block"><div className="setup-instructions"><b>{zapier ? "Zapier connected" : "Connect your Zapier account"}</b><p className="compact-instruction">{zapier ? "Outcom can find your existing Zaps. Pick one, then define what it must accomplish." : "Connect Zapier once. Outcom will then show your existing Zaps so you do not have to type or recreate them here."}</p></div>{oauth.zapier && !zapier && <button className="simple-primary" onClick={() => oauthConnect("zapier")}>Connect Zapier →</button>}{reauthProvider === "zapier" && <button className="simple-primary" onClick={() => oauthConnect("zapier")}>Reconnect Zapier →</button>}{zapier && reauthProvider !== "zapier" && <button className="simple-primary" onClick={() => discover("zapier")} disabled={loadingDiscovery}>{loadingDiscovery ? <LoadingScreen inline message="Finding your Zaps" /> : "Find my Zaps →"}</button>}{!oauth.zapier && <p className="simple-help">Zapier account sign-in is not available yet (Outcom is waiting on Zapier&apos;s public-app approval). You can protect a Zap right now: name it below, finish the next steps, then add one Webhooks by Zapier POST step.</p>}{!zapier && <div className="webhook-register"><input value={zapierName} onChange={e => setZapierName(e.target.value)} placeholder="Automation name · e.g. CRM Lead Sync" /></div>}</div>}
            {platform === "make" && <div className="connection-setup-block"><div className="setup-instructions"><b>Make: native API or webhook mode</b><ol><li><strong>Native API:</strong> connect a Make API token + Team ID when API access is available, then Outcom can discover scenarios and inspect runs.</li><li><strong>Webhook mode:</strong> Outcom gives the scenario a private POST URL. Add <strong>HTTP → Make a request</strong> near the end of the scenario and send the run result to that URL.</li><li>Do not use Make <strong>Custom webhook</strong> for this direction: that module receives data into Make; Outcom needs the scenario to send data out to Outcom.</li></ol><a href="https://apps.make.com/http" target="_blank" rel="noreferrer">Open Make HTTP instructions ↗</a></div>{oauth.make && <button className="simple-primary" onClick={() => oauthConnect("make")}>Connect with Make OAuth ↗</button>}{!make && <><div className="simple-form-grid make-form-grid"><input value={makeApiBase} onChange={e => setMakeApiBase(e.target.value)} placeholder="API base · e.g. https://eu1.make.com/api/v2" /><input value={makeTeamId} onChange={e => setMakeTeamId(e.target.value)} placeholder="Numeric Team ID" /><input type="password" value={makeToken} onChange={e => setMakeToken(e.target.value)} placeholder="Make API token · scenarios:read" /><button className="simple-primary" disabled={makeConnecting || !makeTeamId.trim() || !makeToken.trim()} onClick={connectMakeDirect}>{makeConnecting ? <LoadingScreen inline message="Connecting Make" /> : "Connect Make API"}</button></div><div className="webhook-register"><input value={makeWebhookName} onChange={e => setMakeWebhookName(e.target.value)} placeholder="Scenario name · e.g. Lead → HighLevel" /><button className="simple-secondary" disabled={makeWebhookCreating || !makeWebhookName.trim()} onClick={createMakeWebhookWorkflow}>{makeWebhookCreating ? <LoadingScreen inline message="Preparing Make webhook" /> : "Create Make webhook →"}</button></div><p className="simple-help">Use the API path for native discovery, or skip API access entirely and use webhook mode.</p></>}</div>}
            {platform === "ghl" && <div className="connection-setup-block"><div className="setup-instructions"><b>Connect HighLevel as your source of truth</b><ol><li>Open the relevant HighLevel sub-account.</li><li>Go to <strong>Settings → Private Integrations</strong>.</li><li>Create a read-only integration and copy the token.</li><li>Copy the sub-account's Location ID.</li></ol><a href="https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/" target="_blank" rel="noreferrer">Open HighLevel instructions ↗</a></div><p className="simple-help">HighLevel is used to verify the business result after an automation runs. Connect your automation source first, then connect HighLevel below.</p></div>}
            {(n8nMessage || makeMessage || testResult) && <p className="simple-inline-message">{n8nMessage || makeMessage || testResult}</p>}
          </div>
          <div className="simple-bottom-row"><span>We save your progress automatically.</span><button className="simple-primary" disabled={!(zapierName.trim() || name.trim())} onClick={() => setStep(2)}>Next: choose outcomes →</button></div>
        </div>}

        {step === 2 && <div className="simple-step-content">
          <div className="simple-section-title"><span>STEP 02</span><h2>What should happen after the automation runs?</h2><p>Select one or more business outcomes. You will customize the exact check for each one next.</p></div>
{businessSystemBlock}
          <div className="simple-outcome-grid">
            {outcomeOptions.filter(item => item.id !== "tags-preserved" || targetSystem === "ghl").map(item => {
              const chosen = selectedOutcomes.some(x => x.id === item.id);
              return <button type="button" key={item.id} className={chosen ? "chosen" : ""} onClick={() => {
                const next = chosen ? selectedOutcomes.filter(x => x.id !== item.id) : [...selectedOutcomes, item];
                setSelectedOutcomes(next);
                setOutcome(next.map(x => x.label).join(" + "));
                setOutcomeConfigs((current) => {
                  const copy = { ...current };
                  if (!chosen && !copy[item.id]) copy[item.id] = { label: item.label, type: item.type, system: item.type === "output_count" ? "event" : "ghl", entity: item.type === "output_count" ? "output" : "contact", valueFrom: item.type === "output_count" ? "event.data.output_count" : "event.data.target_record_id", field: "tags", operator: item.type === "output_count" ? "greater_than" : "contains", expectedValue: "", expectedCount: 0 };
                  if (chosen) delete copy[item.id];
                  return copy;
                });
              }}>
                <span><b>{item.label}</b><small>{item.description}</small></span><strong>{chosen ? "✓" : "＋"}</strong>
              </button>;
            })}
          </div>
          <div className="simple-custom-outcome">
            <div><b>Add your own outcome</b><span>Describe the business result you want Outcom to verify.</span></div>
            <div className="simple-custom-row"><input value={customOutcomeText} onChange={e => setCustomOutcomeText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCustomOutcome(); }} placeholder='e.g. Lead status equals "Qualified"' /><button type="button" className="simple-secondary" onClick={addCustomOutcome} disabled={!customOutcomeText.trim() || selectedOutcomes.length >= 10}>＋ Add</button></div>
            <small>{selectedOutcomes.length}/10 checks selected</small>
          </div>
          <div className="simple-outcome-selection"><span>SELECTED CHECKS</span>{selectedOutcomes.length ? selectedOutcomes.map(item => <div key={item.id}>✓ {item.label}</div>) : <small>No outcome selected yet.</small>}</div>
          <div className="simple-outcome-note"><b>These are verification rules, not Zapier actions.</b><span>Outcom uses them after the automation runs to decide whether the downstream business result is actually true.</span></div>
          <div className="simple-bottom-row"><button className="simple-secondary" onClick={() => setStep(1)}>← Back</button><button className="simple-primary" disabled={!selectedOutcomes.length} onClick={() => setStep(3)}>Next: customize checks →</button></div>
        </div>}

        {step === 3 && <div className="simple-step-content">
          <div className="simple-section-title"><span>STEP 03</span><h2>Tell Outcom exactly what to verify.</h2><p>These details define your business requirement. They do not change the automation itself.</p></div>
          {businessSystemBlock}
          <div className="outcome-config-list">
            {selectedOutcomes.map((item) => {
              const cfg = outcomeConfigs[item.id] || { label: item.label, type: item.type, system: item.type === "output_count" ? "event" : "ghl", entity: item.type === "output_count" ? "output" : "contact", valueFrom: item.type === "output_count" ? "event.data.output_count" : "event.data.target_record_id", field: "tags", operator: item.type === "output_count" ? "greater_than" : "contains", expectedValue: "", expectedCount: 0 };
              const update = (patch: Partial<OutcomeConfig>) => setOutcomeConfigs((current) => ({ ...current, [item.id]: { ...cfg, ...patch } }));
              return <div className="outcome-config-card" key={item.id}>
                <div className="outcome-config-head"><span>{item.type.replaceAll("_", " ")}</span><b>{item.label}</b></div>
                <label>What should Outcom call this check?<input value={cfg.label} onChange={e => update({ label: e.target.value })} /></label>
                {item.type !== "output_count" && <>
                  <div className="outcome-config-grid">
                    <label>Business system<input readOnly value={targetSystem === "google_sheets" ? (sheetTarget ? `Google Sheets · ${sheetTarget.spreadsheetName} → ${sheetTarget.sheetName}` : "Google Sheets · choose a spreadsheet below") : targetSystem === "ghl" ? "HighLevel" : "None selected — pick one below"} /></label>
                    <label>Entity<input readOnly value={targetSystem === "google_sheets" ? "Row" : "Contact / record"} /></label>
                  </div>
                  <label>Where is the record ID in your webhook payload?<input value={cfg.valueFrom || ""} onChange={e => update({ valueFrom: e.target.value })} placeholder="event.data.target_record_id" /><small>{targetSystem === "google_sheets" ? `Send the value of your “${sheetTarget?.keyColumn || "key"}” column (e.g. the lead’s email) in this field.` : "Use the field your automation will send to Outcom. Example: event.data.target_record_id"}</small></label>
                </>}
                {item.type === "state_invariant" && <div className="outcome-config-grid">
                  <label>{targetSystem === "google_sheets" ? "Column to check" : "Field to preserve"}<input value={cfg.field || "tags"} onChange={e => update({ field: e.target.value })} placeholder={targetSystem === "google_sheets" ? "e.g. Status" : "tags"} /></label>
                  <label>Condition<select value={cfg.operator || "contains"} onChange={e => update({ operator: e.target.value })}><option value="contains">contains</option><option value="equals">equals</option><option value="not_contains">does not contain</option><option value="not_equals">does not equal</option><option value="exists">exists</option></select></label>
                </div>}
                {item.type === "state_invariant" && <label>Expected value<input value={cfg.expectedValue || ""} onChange={e => update({ expectedValue: e.target.value })} placeholder="e.g. paid-customer" /></label>}
                {item.type === "output_count" && <>
                  <div className="outcome-config-grid">
                    <label>Output count field<input value={cfg.valueFrom || "event.data.output_count"} onChange={e => update({ valueFrom: e.target.value })} placeholder="event.data.output_count" /></label>
                    <label>Operator<select value={cfg.operator || "greater_than"} onChange={e => update({ operator: e.target.value })}><option value="greater_than">greater than</option><option value="equals">equals</option></select></label>
                  </div>
                  <label>Expected count<input type="number" min="0" value={cfg.expectedCount ?? 0} onChange={e => update({ expectedCount: Number(e.target.value) })} /></label>
                </>}
              </div>;
            })}
          </div>
          <div id="protection-action" className="simple-outcome-note"><b>Almost done.</b><span>Outcom will save these checks, create your protection, and take you straight to the webhook setup.</span></div>
          {(testResult) && <p className="simple-inline-message">{testResult}</p>}
          <div className="simple-bottom-row"><button className="simple-secondary" onClick={() => setStep(2)}>← Back</button><button className="simple-primary" disabled={zapierCreating || !selectedOutcomes.length} onClick={finishProtection}>{zapierCreating ? <LoadingScreen inline message="Creating protection" /> : "Protect automation →"}</button></div>
        </div>}
      </section>

      {webhookInfo && <section id="live-webhook" className="webhook-live-card"><div><span>WEBHOOK READY</span><b>{webhookInfo.workflow.name}</b><small>{webhookInfo.provider} → Outcom</small></div><div className="webhook-url-row"><code>{webhookInfo.url}</code><div className="webhook-url-actions"><button className="simple-secondary" onClick={() => navigator.clipboard?.writeText(webhookInfo.url)}>Copy URL</button><a className="simple-secondary" href={({ zapier: "https://zapier.com/app/zaps", make: "https://www.make.com/", n8n: "https://app.n8n.cloud/" } as Record<string, string>)[webhookInfo.provider] || "#live-webhook"} target="_blank" rel="noreferrer">{webhookInfo.provider === "custom" ? "Copy sample below ↓" : `Open ${webhookInfo.provider === "make" ? "Make" : webhookInfo.provider === "n8n" ? "n8n" : "Zapier"} ↗`}</a><button className="simple-secondary" onClick={rotateWebhook} disabled={webhookRotating}>{webhookRotating ? <LoadingScreen inline message="Rotating" /> : "Rotate URL"}</button></div></div><div className="webhook-instructions"><b>One last step in your automation</b><p>{webhookInfo.provider === "zapier" ? <>Add <strong>Webhooks by Zapier → POST</strong> as the final action in this Zap, paste the URL above, choose <strong>JSON</strong>, then run the Zap once.</> : webhookInfo.provider === "make" ? <>Add <strong>HTTP → Make a request</strong> as the last module, method <strong>POST</strong>, body type <strong>JSON</strong>, paste the URL above, then run the scenario once.</> : webhookInfo.provider === "n8n" ? <>Add an <strong>HTTP Request</strong> node at the end of the workflow: method <strong>POST</strong>, send body as <strong>JSON</strong>, paste the URL above, then execute the workflow once.</> : <>At the end of your automation, send an HTTP <strong>POST</strong> with a JSON body (see the payload below) to the URL above, then run it once.</>}</p><details><summary>Show payload</summary><pre>{JSON.stringify(webhookInfo.sample, null, 2)}</pre><small>Map <code>target_record_id</code> to the ID or key of the record your automation created or updated{sheetTarget && targetSystem === "google_sheets" ? <> — for your sheet, the value of the “{sheetTarget.keyColumn}” column</> : null}.</small></details></div><div className="webhook-observer-status"><span className={webhookInfo.lastReceivedAt ? "observer-dot live" : "observer-dot"} />{webhookInfo.lastReceivedAt ? <><b>Observer connected</b><span>Last execution received {new Date(webhookInfo.lastReceivedAt).toLocaleString()}</span></> : <><b>Waiting for first execution</b><span>Add the POST step in Zapier and run the Zap once.</span></>}</div><div className="webhook-test-row"><button className="simple-primary" onClick={async () => { const executionId = `test-${Date.now()}`; setTestResult(null); const r = await fetch(webhookInfo.url, { method: "POST", headers: { "content-type": "application/json", "x-outcom-execution-id": executionId }, body: JSON.stringify({ test: true, data: { test: true }, execution_id: executionId }) }); const j = await r.json().catch(() => ({})); setTestResult(r.ok ? "Test request reached Outcom successfully." : (j.error || "Webhook test failed")); }}>{testResult === null ? "Send test webhook" : "Send test webhook"}</button><button className="simple-secondary" onClick={waitForWebhookEvent} disabled={webhookChecking}>{webhookChecking ? <LoadingScreen inline message="Checking" /> : "Check for execution"}</button>{webhookLoading && <LoadingScreen inline message="Preparing endpoint" />}</div></section>}

      {discoveryLoaded && <section className="simple-results-card"><div className="simple-section-title"><span>YOUR AUTOMATIONS</span><h2>{discoveryTotal === 0 ? "No automations found" : "Choose a workflow to protect"}</h2><p>{discoveryTotal === 0 ? "No workflows were visible with the current connection." : `${discoveryTotal} workflow${discoveryTotal === 1 ? "" : "s"} found.`}</p>{discoveryWarning && <p className="simple-help">⚠ {discoveryWarning}</p>}</div>{discovered.length > 0 && <div className="simple-discovery-list">{discovered.map(d => <button key={`${d.platform}:${d.id}`} onClick={() => { setWorkflowId(d.id); setName(d.name); setZapierName(d.name); setPlatform(d.platform as Platform); if (!selectedOutcomes.length) { setTestResult("Choose at least one business outcome first."); setStep(2); } else { setStep(3); } }}><IntegrationLogo name={d.platform === "n8n" ? "n8n" : d.platform === "zapier" ? "zapier" : "make"} size={24}/><span><b>{d.name}</b><small>{d.platform} · {d.enabled ? "Active" : "Paused"}</small></span><strong>Configure →</strong></button>)}</div>}</section>}

      {created && <section className="simple-protected-card"><span className="simple-connected-pill">● PROTECTED</span><h2>Protection is on.</h2><p>{platform === "n8n" && !webhookInfo ? "Outcom is observing native n8n executions." : platform === "n8n" || platform === "custom" ? "Outcom receives run events through the private webhook endpoint for this automation." : platform === "make" ? "Outcom can observe Make natively when API access is connected, or receive signed-by-URL webhook events from the scenario." : "Outcom receives Zapier run events through the private webhook endpoint for this protected Zap."}</p><div className="simple-bottom-row">{platform === "n8n" && !webhookInfo && <button className="simple-secondary" onClick={syncN8n}>Sync now</button>}<a className="simple-primary" href="/incidents">View proof →</a></div></section>}



      <div className="simple-footer-note"><b>Outcom is not another dashboard.</b><span>Connect one workflow. Define the business results that matter. Investigate only when reality differs.</span></div>
    </div>
  );
}
