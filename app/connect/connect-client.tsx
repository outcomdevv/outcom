"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IntegrationLogo } from "@/app/integrations";
import LoadingScreen from "@/app/loading-screen";
import BusinessSystemPicker, { type SheetTargetState, type TargetSystem } from "@/app/connect/business-system";
import { OutputIcon, RecordIcon, SheetIcon, TagIcon } from "@/app/connect/icons";
import {
  MAX_CHECKS, OPERATORS, autoLabel, needsBusinessSystem, newCheck, toPayload, updateCheck, validateCheck,
  type CheckDraft, type CheckKind, type Operator,
} from "@/lib/connect-checks";

type Platform = "n8n" | "zapier" | "make" | "custom";
type Provider = "ghl" | "google_sheets" | Platform;
type Connection = { provider: Provider; accountName: string; email?: string | null; expiresAt?: string | null };
type Discovered = { id: string; name: string; enabled: boolean; platform: string };
type OAuthStatus = { ghl: boolean; zapier: boolean; make: boolean; google_sheets: boolean };
type WebhookInfo = { provider: string; url: string; workflow: { id: string; name: string }; lastReceivedAt?: string | null };

const DRAFT_KEY = "outcom-connect-draft-v79";

const platforms: Array<{ id: Platform; name: string; hint: string }> = [
  { id: "n8n", name: "n8n", hint: "Webhook or API key" },
  { id: "zapier", name: "Zapier", hint: "Webhook" },
  { id: "make", name: "Make", hint: "Webhook or API token" },
  { id: "custom", name: "Other tool", hint: "Anything that can POST" },
];

const platformLabel = (p: string) => (p === "custom" ? "your tool" : p === "n8n" ? "n8n" : p === "make" ? "Make" : p === "zapier" ? "Zapier" : p);
const stepFor = (p: string) => p === "make" ? "HTTP → Make a request" : p === "zapier" ? "Webhooks by Zapier → POST" : p === "n8n" ? "an HTTP Request node" : "an HTTP POST step";

const KIND_INFO: Record<Exclude<CheckKind, "value">, { title: string; text: string; icon: (s: number) => React.ReactNode }> = {
  exists: { title: "The record was created", text: "The row or contact is really there.", icon: s => <RecordIcon size={s} /> },
  output: { title: "The run produced something", text: "At least one output came out.", icon: s => <OutputIcon size={s} /> },
  tags: { title: "Tags are kept", text: "Existing tags did not disappear.", icon: s => <TagIcon size={s} /> },
};

const checkIcon = (c: CheckDraft, system: TargetSystem, size: number) =>
  c.kind === "value" ? (system === "google_sheets" ? <SheetIcon size={size} /> : <RecordIcon size={size} />) : KIND_INFO[c.kind].icon(size);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function ConnectClient() {
  const router = useRouter();
  const params = useSearchParams();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [oauth, setOauth] = useState<OAuthStatus>({ ghl: false, zapier: false, make: false, google_sheets: false });
  const [robotEmail, setRobotEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [platform, setPlatform] = useState<Platform>("n8n");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [workflowId, setWorkflowId] = useState("");

  const [checks, setChecks] = useState<CheckDraft[]>([]);
  const [valueDraft, setValueDraft] = useState<{ field: string; operator: Operator; expectedValue: string }>({ field: "", operator: "equals", expectedValue: "" });
  const [targetSystem, setTargetSystem] = useState<TargetSystem>("google_sheets");
  const [sheetTarget, setSheetTarget] = useState<SheetTargetState | null>(null);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);

  const [discovered, setDiscovered] = useState<Discovered[]>([]);
  const [discoveryLoaded, setDiscoveryLoaded] = useState(false);
  const [discoveryWarning, setDiscoveryWarning] = useState<string | null>(null);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [reauthProvider, setReauthProvider] = useState<"zapier" | "make" | null>(null);

  const [n8nBaseUrl, setN8nBaseUrl] = useState("");
  const [n8nApiKey, setN8nApiKey] = useState("");
  const [makeBase, setMakeBase] = useState("");
  const [makeTeam, setMakeTeam] = useState("");
  const [makeToken, setMakeToken] = useState("");
  const [ghlLocation, setGhlLocation] = useState("");
  const [ghlToken, setGhlToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [native, setNative] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const conn = (p: Provider) => connections.find(x => x.provider === p);
  const ghl = conn("ghl");
  const googleConn = conn("google_sheets");
  const n8n = conn("n8n");
  const zapier = conn("zapier");
  const make = conn("make");
  const tab = sheetTarget?.sheetName ?? null;
  const ctx = useMemo(() => ({ system: targetSystem, tab }), [targetSystem, tab]);

  const loadConnections = async () => {
    const r = await fetch("/api/connections", { cache: "no-store" });
    if (r.ok) setConnections((await r.json()).connections || []);
  };
  const loadStatus = async () => {
    const r = await fetch("/api/oauth/status", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    setOauth(j.providers || {});
    setRobotEmail(j.googleRobot?.email || null);
  };

  useEffect(() => { void loadConnections(); void loadStatus(); }, [params]);

  // Draft: restore once, then save on every change.
  useEffect(() => {
    try {
      const d = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
      if (d && typeof d === "object") {
        if (["n8n", "zapier", "make", "custom"].includes(d.platform)) setPlatform(d.platform);
        if (d.step >= 1 && d.step <= 3) setStep(d.step);
        if (typeof d.name === "string") setName(d.name);
        if (typeof d.workflowId === "string") setWorkflowId(d.workflowId);
        if (Array.isArray(d.checks)) setChecks(d.checks.filter((c: any) => c && typeof c.id === "string" && typeof c.kind === "string"));
        if (["google_sheets", "ghl", "none"].includes(d.targetSystem)) setTargetSystem(d.targetSystem);
        if (d.sheetTarget && typeof d.sheetTarget === "object") setSheetTarget(d.sheetTarget);
        if (typeof d.n8nBaseUrl === "string") setN8nBaseUrl(d.n8nBaseUrl);
      }
    } catch { /* ignore a broken draft */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ platform, step, name, workflowId, checks, targetSystem, sheetTarget, n8nBaseUrl })); } catch { /* storage unavailable */ }
  }, [hydrated, platform, step, name, workflowId, checks, targetSystem, sheetTarget, n8nBaseUrl]);

  // A saved sheet from an earlier visit has no column list yet; fetch it once so typos can be caught.
  useEffect(() => {
    if (!hydrated || !sheetTarget || sheetHeaders.length) return;
    const access = sheetTarget.access === "service_account" ? "&access=service_account" : "";
    void fetch(`/api/google/sheets/${encodeURIComponent(sheetTarget.spreadsheetId)}?tab=${encodeURIComponent(sheetTarget.sheetName)}${access}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && Array.isArray(j.headers)) setSheetHeaders(j.headers); })
      .catch(() => undefined);
  }, [hydrated, sheetTarget, sheetHeaders.length]);

  // After a browser refresh, show the webhook again instead of leaving the user stranded.
  useEffect(() => {
    if (!hydrated || !created || native || webhookInfo || !workflowId) return;
    void setupWebhook(`${platform}:${workflowId}`);
  }, [hydrated, created, native, webhookInfo, workflowId, platform]);

  useEffect(() => {
    const p = params.get("connected");
    if (p === "zapier" || p === "make") void discover(p);
  }, [params]);

  /* ---------- connecting platforms ---------- */

  async function discover(provider: "n8n" | "zapier" | "make") {
    setLoadingDiscovery(true); setDiscoveryLoaded(false); setDiscoveryWarning(null); setMessage(null);
    const r = await fetch(provider === "n8n" ? "/api/n8n/discover" : `/api/integrations/discover?provider=${provider}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setReauthProvider(j.reauthRequired ? (provider as "zapier" | "make") : null);
    if (j.partial && typeof j.warning === "string") setDiscoveryWarning(j.warning);
    setDiscovered(Array.isArray(j.items) ? j.items : []);
    setDiscoveryLoaded(r.ok);
    setLoadingDiscovery(false);
    if (!r.ok) setMessage(typeof j.error === "string" ? j.error : `Could not list your ${platformLabel(provider)} workflows.`);
  }

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, j };
  }

  async function connectN8n() {
    setBusy("Connecting n8n"); setMessage(null);
    const { ok, j } = await post("/api/n8n/connect", { baseUrl: n8nBaseUrl, apiKey: n8nApiKey });
    setBusy(null);
    if (!ok) return setMessage(j.error || "n8n did not accept that URL and key.");
    setN8nApiKey(""); await loadConnections(); await discover("n8n");
  }
  async function connectMake() {
    setBusy("Connecting Make"); setMessage(null);
    const { ok, j } = await post("/api/make/connect", { teamId: makeTeam, token: makeToken, baseUrl: makeBase });
    setBusy(null);
    if (!ok) return setMessage(j.error || "Make did not accept those details.");
    setMakeToken(""); await loadConnections(); await discover("make");
  }
  async function connectGhl() {
    setBusy("Connecting HighLevel"); setMessage(null);
    const { ok, j } = await post("/api/ghl/connect", { locationId: ghlLocation, pit: ghlToken });
    setBusy(null);
    if (!ok) return setMessage(/invalid jwt|unauthor|401/i.test(String(j.error)) ? "HighLevel rejected this token. Use a Private Integration Token made for this Location ID." : j.error || "HighLevel connection failed.");
    setGhlToken(""); await loadConnections(); router.refresh();
  }

  /* ---------- checks ---------- */

  const hasKind = (k: CheckKind) => checks.some(c => c.kind === k);
  const nextId = () => `check-${crypto.randomUUID()}`;

  function toggleKind(kind: Exclude<CheckKind, "value">) {
    setMessage(null);
    if (kind === "tags") setTargetSystem("ghl"); // tags only exist in HighLevel
    setChecks(cur => cur.some(c => c.kind === kind)
      ? cur.filter(c => c.kind !== kind)
      : cur.length >= MAX_CHECKS ? cur : [...cur, updateCheck(newCheck(kind, nextId()), {}, ctx)]);
  }

  function addValueCheck() {
    if (checks.length >= MAX_CHECKS) return setMessage(`You can add up to ${MAX_CHECKS} checks.`);
    const problem = validateCheck({ ...newCheck("value", "x"), ...valueDraft }, { system: "google_sheets" });
    if (problem) return setMessage(problem);
    setMessage(null);
    setChecks(cur => [...cur, updateCheck(newCheck("value", nextId()), valueDraft, ctx)]);
    setValueDraft({ field: "", operator: "equals", expectedValue: "" });
  }

  const patchCheck = (id: string, patch: Partial<CheckDraft>) => setChecks(cur => cur.map(c => (c.id === id ? updateCheck(c, patch, ctx) : c)));
  const removeCheck = (id: string) => setChecks(cur => cur.filter(c => c.id !== id));

  // Names follow the rule, so keep them in step when the sheet or system changes.
  useEffect(() => { setChecks(cur => cur.map(c => (c.customLabel ? c : { ...c, label: autoLabel(c, ctx) }))); }, [ctx]);

  // Tags only exist in HighLevel.
  useEffect(() => { if (targetSystem !== "ghl") setChecks(cur => (cur.some(c => c.kind === "tags") ? cur.filter(c => c.kind !== "tags") : cur)); }, [targetSystem]);

  function problemFor(c: CheckDraft): string | null {
    const basic = validateCheck(c, { system: targetSystem });
    if (basic) return basic;
    if (c.kind === "value" && targetSystem === "google_sheets" && sheetHeaders.length && !sheetHeaders.some(h => sameName(h, c.field)))
      return `There is no column called “${c.field.trim()}” in this sheet. Pick one from the list.`;
    return null;
  }

  /* ---------- protect ---------- */

  async function setupWebhook(localWorkflowId: string) {
    const provider = localWorkflowId.split(":")[0];
    const { ok, j } = await post("/api/webhooks/setup", { provider, workflowId: localWorkflowId });
    if (!ok || !j?.url) { setMessage(j?.error || "Could not create the webhook address."); return false; }
    setWebhookInfo(j);
    return true;
  }

  async function protect() {
    const workflowName = name.trim();
    if (!workflowName) { setMessage("Name this automation first."); setStep(1); return; }
    if (!checks.length) { setMessage("Choose at least one check first."); setStep(2); return; }

    if (needsBusinessSystem(checks)) {
      if (targetSystem === "none") return setMessage("Choose where Outcom should look, or keep only “The run produced something”.");
      if (targetSystem === "ghl" && !ghl) return setMessage("Connect HighLevel first, or switch to Google Sheets.");
      if (targetSystem === "google_sheets" && !sheetTarget) return setMessage("Choose the sheet, the tab and the column that identifies each row.");
    }
    for (const c of checks) {
      const problem = problemFor(c);
      if (problem) return setMessage(problem);
    }

    setCreating(true); setMessage(null);
    try {
      const id = workflowId.trim() || `manual-${crypto.randomUUID()}`;
      const payload = checks.map(c => toPayload(c, targetSystem, sheetTarget, tab));
      const useNative = platform === "n8n" && targetSystem === "ghl" && Boolean(n8n) && !id.startsWith("manual-");
      setNative(useNative);
      const r = await fetch(useNative ? "/api/n8n/protect" : "/api/integrations/protect", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(useNative
          ? { workflowId: id, expectedOutcome: payload.map(p => p.label).join(" + "), expectedOutcomes: payload }
          : { provider: platform, externalId: id, name: workflowName, expectedOutcome: payload.map(p => p.label).join(" + "), expectedOutcomes: payload }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.protected) throw new Error(j.error || j.analysis?.recommendation || "Outcom could not save these checks.");
      setWorkflowId(id); setCreated(true);
      if (!useNative && !(await setupWebhook(j.workflow?.id || `${platform}:${id}`))) throw new Error("The checks were saved, but the webhook address could not be created. Press Protect again.");
      router.refresh();
      window.setTimeout(() => document.getElementById("live-webhook")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not protect this automation.");
    } finally { setCreating(false); }
  }

  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  }

  async function checkForRun() {
    if (!webhookInfo) return;
    setBusy("Waiting for your first run");
    for (let i = 0; i < 12; i++) {
      const r = await fetch(`/api/webhooks/status?provider=${encodeURIComponent(webhookInfo.provider)}&workflowId=${encodeURIComponent(webhookInfo.workflow.id)}`, { cache: "no-store" });
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      if (j.lastReceivedAt) { setWebhookInfo(cur => (cur ? { ...cur, lastReceivedAt: j.lastReceivedAt } : cur)); setBusy(null); return; }
      await new Promise(res => setTimeout(res, 2500));
    }
    setBusy(null); setMessage("No run received yet. Run your automation once, then try again.");
  }

  async function rotate() {
    if (!webhookInfo) return;
    const { ok, j } = await post("/api/webhooks/rotate", { provider: webhookInfo.provider, workflowId: webhookInfo.workflow.id });
    if (!ok) return setMessage(j.error || "Could not make a new address.");
    setWebhookInfo(cur => (cur ? { ...cur, url: j.url, lastReceivedAt: null } : cur));
  }

  /* ---------- pieces of UI ---------- */

  const ghlPanel = (
    <div className="cx-ghl">
      <div className="cx-row cx-pair">
        <input name="outcom-ghl-location" autoComplete="off" value={ghlLocation} onChange={e => setGhlLocation(e.target.value)} placeholder="Location ID" />
        <input name="outcom-ghl-token" type="password" autoComplete="new-password" value={ghlToken} onChange={e => setGhlToken(e.target.value)} placeholder="Private Integration Token" />
        <button type="button" className="simple-primary" disabled={Boolean(busy) || !ghlLocation.trim() || !ghlToken.trim()} onClick={connectGhl}>Connect</button>
      </div>
      <small className="cx-muted">HighLevel → Settings → Private Integrations. Read-only access is enough.</small>
    </div>
  );

  const selectedPlatform = platforms.find(p => p.id === platform)!;
  const connectedHere = platform === "n8n" ? n8n : platform === "zapier" ? zapier : platform === "make" ? make : undefined;
  const sheetOk = targetSystem !== "google_sheets" || Boolean(sheetTarget);
  const valueChecks = checks.filter(c => c.kind === "value");
  const ready = checks.length > 0;
  const keyHint = sheetTarget?.keyColumn ? `the “${sheetTarget.keyColumn}” of the row` : "the id of the record";
  const bodySample = `{"data":{"target_record_id":"YOUR_VALUE"}}`;

  return (
    <div className="connect-page cx-page">
      <header className="cx-hero">
        <h1>Protect a workflow</h1>
        <p>Tell Outcom what success looks like. It checks after every run.</p>
      </header>

      {params.get("error") && <div className="cx-alert">{String(params.get("error")).replaceAll("_", " ")}</div>}

      <section className="cx-flow">
        <ol className="cx-steps-bar">
          {([["Automation", 1], ["Outcomes", 2], ["Checks", 3]] as const).map(([label, n]) => (
            <li key={n} className={step === n ? "active" : step > n ? "done" : ""}>
              <button type="button" disabled={n > step} onClick={() => setStep(n)}><span>{step > n ? "✓" : n}</span>{label}</button>
            </li>
          ))}
        </ol>

        {/* STEP 1 */}
        {step === 1 && <div className="cx-step">
          <h2>Where does it run?</h2>
          <div className="cx-options cx-four">
            {platforms.map(p => (
              <button type="button" key={p.id} className={`cx-option ${platform === p.id ? "on" : ""}`} onClick={() => { setPlatform(p.id); setMessage(null); setDiscoveryLoaded(false); }}>
                <IntegrationLogo name={p.id} size={34} /><span><b>{p.name}</b><small>{p.hint}</small></span><i>{platform === p.id ? "✓" : ""}</i>
              </button>
            ))}
          </div>

          <label className="cx-field">Name this automation
            <input name="outcom-automation-name" autoComplete="off" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lead intake → Sheet" />
          </label>

          {platform === "n8n" && !n8n && <details className="cx-optional">
            <summary>Pick it from my n8n instead (optional)</summary>
            <div className="cx-row cx-pair">
              <input name="outcom-n8n-url" type="text" autoComplete="off" value={n8nBaseUrl} onChange={e => setN8nBaseUrl(e.target.value)} placeholder="n8n address · https://you.app.n8n.cloud" />
              <input name="outcom-n8n-key" type="password" autoComplete="new-password" value={n8nApiKey} onChange={e => setN8nApiKey(e.target.value)} placeholder="n8n API key" />
              <button type="button" className="simple-primary" disabled={Boolean(busy) || !n8nBaseUrl.trim() || !n8nApiKey.trim()} onClick={connectN8n}>Connect</button>
            </div>
            <small className="cx-muted">n8n → Settings → n8n API. This is not your n8n login.</small>
          </details>}

          {platform === "make" && !make && <details className="cx-optional">
            <summary>Pick it from my Make instead (optional)</summary>
            <div className="cx-row cx-three">
              <input name="outcom-make-base" autoComplete="off" value={makeBase} onChange={e => setMakeBase(e.target.value)} placeholder="https://eu1.make.com/api/v2" />
              <input name="outcom-make-team" autoComplete="off" value={makeTeam} onChange={e => setMakeTeam(e.target.value)} placeholder="Team ID" />
              <input name="outcom-make-token" type="password" autoComplete="new-password" value={makeToken} onChange={e => setMakeToken(e.target.value)} placeholder="API token" />
            </div>
            <button type="button" className="simple-primary" disabled={Boolean(busy) || !makeTeam.trim() || !makeToken.trim()} onClick={connectMake}>Connect</button>
          </details>}

          {platform === "zapier" && oauth.zapier && !zapier && <button type="button" className="simple-secondary" onClick={() => { window.location.href = "/api/oauth/zapier/start"; }}>Connect Zapier to pick a Zap</button>}
          {platform === "make" && oauth.make && !make && <button type="button" className="simple-secondary" onClick={() => { window.location.href = "/api/oauth/make/start"; }}>Connect Make to pick a scenario</button>}

          {connectedHere && platform !== "custom" && <div className="cx-picked">
            <IntegrationLogo name={platform} size={28} /><span><b>{selectedPlatform.name} connected</b><small>{reauthProvider === platform ? "Reconnect to continue" : "Pick a workflow, or just name it above"}</small></span>
            <button type="button" className="cx-link" onClick={() => discover(platform as "n8n" | "zapier" | "make")}>{loadingDiscovery ? "Loading…" : "Show my workflows"}</button>
          </div>}

          {discoveryLoaded && <div className="cx-list">
            {discovered.length === 0 && <p className="cx-muted">No workflows found. Type a name above instead.</p>}
            {discoveryWarning && <p className="cx-muted">{discoveryWarning}</p>}
            {discovered.map(d => (
              <button type="button" key={`${d.platform}:${d.id}`} onClick={() => { setWorkflowId(d.id); setName(d.name); setPlatform(d.platform as Platform); setStep(2); }}>
                <IntegrationLogo name={(d.platform === "n8n" || d.platform === "zapier" || d.platform === "make" ? d.platform : "custom") as Platform} size={24} />
                <span>{d.name}<small>{d.enabled ? "Active" : "Paused"}</small></span><em>Use</em>
              </button>
            ))}
          </div>}

          {busy && <LoadingScreen inline message={busy} />}
          {message && <p className="cx-error">{message}</p>}
          <div className="cx-nav"><span /><button type="button" className="simple-primary" disabled={!name.trim()} onClick={() => setStep(2)}>Next</button></div>
        </div>}

        {/* STEP 2 */}
        {step === 2 && <div className="cx-step">
          <h2>What must be true after every run?</h2>
          <p className="cx-sub">Pick as many as you need.</p>

          <div className="cx-options">
            {(["exists", "output"] as const).map(k => (
              <button type="button" key={k} className={`cx-option ${hasKind(k) ? "on" : ""}`} onClick={() => toggleKind(k)}>
                {KIND_INFO[k].icon(34)}<span><b>{KIND_INFO[k].title}</b><small>{KIND_INFO[k].text}</small></span><i>{hasKind(k) ? "✓" : "+"}</i>
              </button>
            ))}
            {(targetSystem === "ghl" || Boolean(ghl)) && <button type="button" className={`cx-option ${hasKind("tags") ? "on" : ""}`} onClick={() => toggleKind("tags")}>
              {KIND_INFO.tags.icon(34)}<span><b>{KIND_INFO.tags.title}</b><small>{KIND_INFO.tags.text}</small></span><i>{hasKind("tags") ? "✓" : "+"}</i>
            </button>}
          </div>

          <div className="cx-card cx-build">
            <h3>Check a value</h3>
            <p className="cx-muted">For example: Status is “Qualified”. Outcom reads that column after each run.</p>
            <div className="cx-row cx-three">
              <input name="outcom-check-field" autoComplete="off" value={valueDraft.field} onChange={e => setValueDraft(v => ({ ...v, field: e.target.value }))} placeholder="Column · e.g. Status" />
              <select value={valueDraft.operator} onChange={e => setValueDraft(v => ({ ...v, operator: e.target.value as Operator }))}>{OPERATORS.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}</select>
              {valueDraft.operator !== "exists"
                ? <input name="outcom-check-value" autoComplete="off" value={valueDraft.expectedValue} onChange={e => setValueDraft(v => ({ ...v, expectedValue: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") addValueCheck(); }} placeholder="Value · e.g. Qualified" />
                : <span className="cx-muted cx-pad">no value needed</span>}
            </div>
            <button type="button" className="simple-secondary" onClick={addValueCheck} disabled={!valueDraft.field.trim() || checks.length >= MAX_CHECKS}>Add this check</button>
          </div>

          {valueChecks.length > 0 && <ul className="cx-chips">{valueChecks.map(c => (
            <li key={c.id}>{checkIcon(c, targetSystem, 22)}<span>{c.label}</span><button type="button" aria-label={`Remove ${c.label}`} onClick={() => removeCheck(c.id)}>✕</button></li>
          ))}</ul>}

          {message && <p className="cx-error">{message}</p>}
          <div className="cx-nav">
            <button type="button" className="simple-secondary" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="simple-primary" disabled={!ready} onClick={() => { setMessage(null); setStep(3); }}>{ready ? `Next · ${checks.length} check${checks.length === 1 ? "" : "s"}` : "Choose a check"}</button>
          </div>
        </div>}

        {/* STEP 3 */}
        {step === 3 && <div className="cx-step">
          <h2>Set up your checks</h2>
          {needsBusinessSystem(checks)
            ? <BusinessSystemPicker value={targetSystem} onChange={setTargetSystem} googleConnected={Boolean(googleConn)} googleConfigured={oauth.google_sheets} robotEmail={robotEmail} ghlConnected={Boolean(ghl)} sheet={sheetTarget} onSheet={setSheetTarget} onHeaders={setSheetHeaders} onConnectGoogle={() => { window.location.href = "/api/oauth/google_sheets/start"; }} ghlPanel={ghlPanel} />
            : <p className="cx-note">Your checks only look at the run itself, so there is nothing to connect.</p>}

          <h3 className="cx-h">Your checks</h3>
          <div className="cx-checks">
            {checks.map(c => {
              const problem = sheetOk ? problemFor(c) : null;
              return (
                <div key={c.id} className={`cx-check ${problem ? "bad" : ""}`}>
                  <div className="cx-check-head">
                    {checkIcon(c, targetSystem, 34)}
                    <span><b>{c.label || autoLabel(c, ctx)}</b><small>{c.kind === "output" ? "From the run itself" : targetSystem === "google_sheets" ? (sheetTarget ? `${sheetTarget.spreadsheetName} → ${sheetTarget.sheetName}` : "Choose a sheet above") : targetSystem === "ghl" ? "HighLevel" : "Choose where to look"}</small></span>
                    <button type="button" aria-label="Remove check" onClick={() => removeCheck(c.id)}>✕</button>
                  </div>
                  {c.kind === "value" && <div className="cx-row cx-three">
                    {targetSystem === "google_sheets" && sheetHeaders.length
                      ? <select value={sheetHeaders.find(h => sameName(h, c.field)) ?? ""} onChange={e => patchCheck(c.id, { field: e.target.value })}><option value="">Column…</option>{sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select>
                      : <input name={`outcom-field-${c.id}`} autoComplete="off" value={c.field} onChange={e => patchCheck(c.id, { field: e.target.value })} placeholder="Column" />}
                    <select value={c.operator} onChange={e => patchCheck(c.id, { operator: e.target.value as Operator })}>{OPERATORS.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}</select>
                    {c.operator !== "exists" ? <input name={`outcom-value-${c.id}`} autoComplete="off" value={c.expectedValue} onChange={e => patchCheck(c.id, { expectedValue: e.target.value })} placeholder="Value" /> : <span className="cx-muted cx-pad">no value needed</span>}
                  </div>}
                  {problem && <p className="cx-error">{problem}</p>}
                  {c.kind !== "output" && <details className="cx-adv"><summary>Advanced</summary>
                    <label className="cx-field">Where is the record id in your webhook?<input value={c.valueFrom} onChange={e => patchCheck(c.id, { valueFrom: e.target.value })} /></label>
                    <label className="cx-field">Name of this check<input value={c.label} onChange={e => patchCheck(c.id, { label: e.target.value })} /></label>
                  </details>}
                </div>
              );
            })}
          </div>

          {message && <p className="cx-error">{message}</p>}
          <div className="cx-nav">
            <button type="button" className="simple-secondary" onClick={() => setStep(2)}>Back</button>
            <button type="button" className="simple-primary" disabled={creating || !ready} onClick={protect}>{creating ? "Saving…" : "Protect this automation"}</button>
          </div>
        </div>}
      </section>

      {/* AFTER PROTECT */}
      {created && !native && webhookInfo && <section id="live-webhook" className="cx-flow cx-done">
        <div className="cx-done-head"><span className="cx-pill">● Protected</span><h2>{webhookInfo.workflow.name}</h2><p>One last step: send each run’s result to Outcom.</p></div>
        <ol className="cx-todo">
          <li><b>Copy your private address</b>
            <div className="cx-code"><code>{webhookInfo.url}</code><button type="button" className="simple-secondary" onClick={() => copy("url", webhookInfo.url)}>{copied === "url" ? "Copied ✓" : "Copy"}</button></div>
          </li>
          <li><b>At the end of your automation, add {stepFor(webhookInfo.provider)}</b>
            <small className="cx-muted">Method POST · body JSON · paste the address.</small>
            <div className="cx-code"><code>{bodySample}</code><button type="button" className="simple-secondary" onClick={() => copy("body", bodySample)}>{copied === "body" ? "Copied ✓" : "Copy"}</button></div>
            <small className="cx-muted">Replace YOUR_VALUE with {keyHint}, taken from the step before.</small>
          </li>
          <li><b>Run it once</b>
            <div className="cx-status"><span className={`cx-dot ${webhookInfo.lastReceivedAt ? "on" : ""}`} />{webhookInfo.lastReceivedAt ? `First run received ${new Date(webhookInfo.lastReceivedAt).toLocaleString()}` : "Waiting for the first run"}
              {!webhookInfo.lastReceivedAt && <button type="button" className="cx-link" onClick={checkForRun}>Check now</button>}</div>
          </li>
        </ol>
        {busy && <LoadingScreen inline message={busy} />}
        {message && <p className="cx-error">{message}</p>}
        <div className="cx-nav"><button type="button" className="cx-link" onClick={rotate}>Make a new address</button><a className="simple-primary" href="/workflows">See my workflows</a></div>
      </section>}

      {created && native && <section id="live-webhook" className="cx-flow cx-done">
        <div className="cx-done-head"><span className="cx-pill">● Protected</span><h2>{name}</h2><p>Outcom is watching this n8n workflow directly. Nothing else to set up.</p></div>
        <div className="cx-nav"><span /><a className="simple-primary" href="/workflows">See my workflows</a></div>
      </section>}
    </div>
  );
}
