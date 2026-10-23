"use client";

import DescribeChecks from "./describe-checks";
import MoreChecks from "./more-checks";
import { BrandLogo } from "./brand-logo";
import { HTTP_TOOLS, type HttpToolId } from "@/lib/connect-guide";
import { CHECK_TEMPLATES } from "@/lib/check-templates";
import type { CheckSuggestion } from "@/lib/check-suggestions";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IntegrationLogo } from "@/app/integrations";
import LoadingScreen from "@/app/loading-screen";
import AfterProtect, { type WebhookInfo } from "@/app/connect/after-protect";
import FlowDiagram from "@/app/connect/flow-diagram";
import ScanWorkflow, { type ScanResult } from "@/app/connect/scan-workflow";
import type { FlowNode } from "@/lib/suggested-checks";
import BusinessSystemPicker, { type SheetTargetState, type TargetSystem } from "@/app/connect/business-system";
import { OutputIcon, RecordIcon, SheetIcon, TableIcon, TagIcon } from "@/app/connect/icons";
import type { AirtableTargetState, HubspotTargetState } from "@/app/connect/token-panels";
import {
  COUNT_OPERATORS, MAX_CHECKS, OPERATORS, autoLabel, hasNamedFields, needsBusinessSystem, newCheck, toPayload, updateCheck, validateCheck,
  type CheckDraft, type CheckKind, type CountOperator, type Operator,
} from "@/lib/connect-checks";

type CoreTool = "n8n" | "zapier" | "make" | "custom";
type ExtraTool = HttpToolId;
type Platform = CoreTool | ExtraTool;
const EXTRA_TOOLS = (Object.entries(HTTP_TOOLS) as Array<[ExtraTool, (typeof HTTP_TOOLS)[ExtraTool]]>).map(([id, t]) => ({ id, name: t.label, group: t.group }));
const EXTRA_GROUPS = [...new Set(EXTRA_TOOLS.map(t => t.group))];
type Provider = "ghl" | "google_sheets" | "airtable" | "hubspot" | Platform;
type Connection = { provider: Provider; accountName: string; email?: string | null; expiresAt?: string | null };
type Discovered = { id: string; name: string; enabled: boolean; platform: string };
type OAuthStatus = { ghl: boolean; zapier: boolean; make: boolean; google_sheets: boolean; airtable: boolean; hubspot: boolean };

const DRAFT_KEY = "outcom-connect-draft-v79";

const platforms: Array<{ id: CoreTool; name: string; hint: string }> = [
  { id: "n8n", name: "n8n", hint: "Webhook or API key" },
  { id: "zapier", name: "Zapier", hint: "Webhook" },
  { id: "make", name: "Make", hint: "Webhook or API token" },
  { id: "custom", name: "Other tool", hint: "Anything that can POST" },
];

const platformLabel = (p: string) => (p === "custom" ? "your tool" : p === "n8n" ? "n8n" : p === "make" ? "Make" : p === "zapier" ? "Zapier" : p);

const KIND_INFO: Record<Exclude<CheckKind, "value">, { title: string; text: string; icon: (s: number) => React.ReactNode }> = {
  exists: { title: "The record was created", text: "The row or contact is really there.", icon: s => <RecordIcon size={s} /> },
  output: { title: "The run produced something", text: "At least one output came out.", icon: s => <OutputIcon size={s} /> },
  tags: { title: "Tags are kept", text: "Existing tags did not disappear.", icon: s => <TagIcon size={s} /> },
  required: { title: "Fields are filled in", text: "Nothing important is blank.", icon: s => <RecordIcon size={s} /> },
  count: { title: "Number of records", text: "No duplicates, none missing.", icon: s => <RecordIcon size={s} /> },
  fresh: { title: "Written on time", text: "The record is recent.", icon: s => <RecordIcon size={s} /> },
};

const checkIcon = (c: CheckDraft, system: TargetSystem, size: number) =>
  c.kind === "value" ? (system === "google_sheets" ? <SheetIcon size={size} /> : system === "airtable" ? <TableIcon size={size} /> : <RecordIcon size={size} />) : KIND_INFO[c.kind].icon(size);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function ConnectClient() {
  const router = useRouter();
  const params = useSearchParams();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [oauth, setOauth] = useState<OAuthStatus>({ ghl: false, zapier: false, make: false, google_sheets: false, airtable: false, hubspot: false });
  const [robotEmail, setRobotEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [platform, setPlatform] = useState<Platform>("n8n");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [workflowId, setWorkflowId] = useState("");

  const [checks, setChecks] = useState<CheckDraft[]>([]);
  const [valueDraft, setValueDraft] = useState<{ field: string; operator: Operator; expectedValue: string; expectedFrom: string; useRun: boolean }>({ field: "", operator: "equals", expectedValue: "", expectedFrom: "", useRun: false });
  const [targetSystem, setTargetSystem] = useState<TargetSystem>("google_sheets");
  const [reportedStep, setReportedStep] = useState("");
  const [reportedApp, setReportedApp] = useState("");
  /** Picking an app suggests its name as the read-back step, unless the user already typed their own. */
  const pickReportedApp = (id: string) => { setReportedStep(cur => (!cur.trim() || cur === reportedApp ? (id && id !== "other" ? id : "") : cur)); setReportedApp(id); };
  const [sheetTarget, setSheetTarget] = useState<SheetTargetState | null>(null);
  const [airtableTarget, setAirtableTarget] = useState<AirtableTargetState | null>(null);
  const [hubspotTarget, setHubspotTarget] = useState<HubspotTargetState | null>(null);
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

  const [flow, setFlow] = useState<FlowNode[] | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [recordExpr, setRecordExpr] = useState<string | null>(null);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [sheetBlocked, setSheetBlocked] = useState<string | null>(null);
  const [robotCopied, setRobotCopied] = useState(false);

  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [native, setNative] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);

  const conn = (p: Provider) => connections.find(x => x.provider === p);
  const ghl = conn("ghl");
  const googleConn = conn("google_sheets");
  const n8n = conn("n8n");
  const zapier = conn("zapier");
  const make = conn("make");
  const airtable = conn("airtable");
  const hubspot = conn("hubspot");
  const tab = targetSystem === "airtable" ? airtableTarget?.tableName ?? null : targetSystem === "reported" ? (reportedStep.trim() || null) : sheetTarget?.sheetName ?? null;
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
        if (["google_sheets", "airtable", "hubspot", "ghl", "reported", "none"].includes(d.targetSystem)) setTargetSystem(d.targetSystem);
        if (typeof d.reportedStep === "string") setReportedStep(d.reportedStep);
        if (typeof d.reportedApp === "string") setReportedApp(d.reportedApp);
        if (d.airtableTarget && typeof d.airtableTarget === "object") setAirtableTarget(d.airtableTarget);
        if (d.hubspotTarget && typeof d.hubspotTarget === "object") setHubspotTarget(d.hubspotTarget);
        if (d.sheetTarget && typeof d.sheetTarget === "object") setSheetTarget(d.sheetTarget);
        if (typeof d.n8nBaseUrl === "string") setN8nBaseUrl(d.n8nBaseUrl);
        if (Array.isArray(d.flow)) setFlow(d.flow);
        if (typeof d.connectFrom === "string") setConnectFrom(d.connectFrom);
      }
    } catch { /* ignore a broken draft */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ platform, step, name, workflowId, checks, targetSystem, reportedStep, reportedApp, sheetTarget, airtableTarget, hubspotTarget, n8nBaseUrl, flow, connectFrom })); } catch { /* storage unavailable */ }
  }, [hydrated, platform, step, name, workflowId, checks, targetSystem, reportedStep, reportedApp, sheetTarget, airtableTarget, hubspotTarget, n8nBaseUrl, flow, connectFrom]);

  // A saved or scanned sheet has no column list yet; fetch it so typos can be caught and access problems shown early.
  async function loadHeaders() {
    if (!sheetTarget) return;
    const access = sheetTarget.access === "service_account" ? "&access=service_account" : "";
    try {
      const r = await fetch(`/api/google/sheets/${encodeURIComponent(sheetTarget.spreadsheetId)}?tab=${encodeURIComponent(sheetTarget.sheetName)}${access}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(j.headers)) { setSheetHeaders(j.headers); setSheetBlocked(null); }
      else setSheetBlocked(typeof j?.error === "string" && j.error ? j.error : "Outcom can't open this sheet yet.");
    } catch { setSheetBlocked("Outcom can't reach Google right now."); }
  }
  useEffect(() => {
    if (!hydrated || targetSystem !== "google_sheets" || !sheetTarget || sheetHeaders.length) return;
    void loadHeaders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, targetSystem, sheetTarget, sheetHeaders.length]);

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

  // Each system has its own list of columns; never show one system's columns for another.
  function changeSystem(next: TargetSystem) {
    if (next === targetSystem) return;
    setTargetSystem(next); setSheetHeaders([]); setSheetBlocked(null); setMessage(null);
  }
  const currentTarget = targetSystem === "google_sheets" ? sheetTarget : targetSystem === "airtable" ? airtableTarget : targetSystem === "hubspot" ? hubspotTarget : targetSystem === "reported" ? { step: reportedStep.trim(), ...(reportedApp ? { app: reportedApp } : {}) } : null;
  const systemName = targetSystem === "google_sheets" ? "Google Sheets" : targetSystem === "airtable" ? "Airtable" : targetSystem === "hubspot" ? "HubSpot" : targetSystem === "ghl" ? "HighLevel" : targetSystem === "reported" ? "Any other app" : "";

  const hasKind = (k: CheckKind) => checks.some(c => c.kind === k);
  const nextId = () => `check-${crypto.randomUUID()}`;

  function toggleKind(kind: Exclude<CheckKind, "value">) {
    setMessage(null);
    if (kind === "tags") changeSystem("ghl"); // tags only exist in HighLevel
    setChecks(cur => cur.some(c => c.kind === kind)
      ? cur.filter(c => c.kind !== kind)
      : cur.length >= MAX_CHECKS ? cur : [...cur, updateCheck(newCheck(kind, nextId()), {}, ctx)]);
  }

  function addExtra(kind: CheckKind, patch: Partial<CheckDraft>) {
    setMessage(null);
    if (checks.length >= MAX_CHECKS) return setMessage(`You can add up to ${MAX_CHECKS} checks.`);
    setChecks(cur => [...cur, updateCheck(newCheck(kind, nextId()), patch, ctx)]);
  }

  function applyTemplate(id: string) {
    const t = CHECK_TEMPLATES.find(x => x.id === id);
    if (!t) return;
    setMessage(null);
    const skipped: string[] = [];
    setChecks(cur => {
      let next = [...cur];
      for (const it of t.items) {
        if (next.length >= MAX_CHECKS) break;
        if (it.kind === "count" && targetSystem !== "reported") { skipped.push("the duplicate check (needs “Any other app”)"); continue; }
        if ((it.kind === "exists" || it.kind === "output") && next.some(c => c.kind === it.kind)) continue;
        next = [...next, updateCheck(newCheck(it.kind, nextId()), it.patch ?? {}, ctx)];
      }
      return next;
    });
    if (skipped.length) setMessage(`Added “${t.title}” without ${skipped.join(" and ")}. Edit the field names in the next step.`);
  }

  function addSuggested(s: CheckSuggestion) {
    setMessage(null);
    if (s.kind !== "value") { if (!hasKind(s.kind)) toggleKind(s.kind); return; }
    if (checks.length >= MAX_CHECKS) return setMessage(`You can add up to ${MAX_CHECKS} checks.`);
    setChecks(cur => [...cur, updateCheck(newCheck("value", nextId()), { field: s.field, operator: s.operator, expectedValue: s.expectedValue }, ctx)]);
  }

  function addValueCheck() {
    if (checks.length >= MAX_CHECKS) return setMessage(`You can add up to ${MAX_CHECKS} checks.`);
    const patch = { field: valueDraft.field, operator: valueDraft.operator, expectedValue: valueDraft.useRun ? "" : valueDraft.expectedValue, expectedFrom: valueDraft.useRun ? valueDraft.expectedFrom : "" };
    if (valueDraft.useRun && valueDraft.operator !== "exists" && !valueDraft.expectedFrom.trim()) return setMessage("Type the name of the field your run sends, for example email.");
    const problem = validateCheck({ ...newCheck("value", "x"), ...patch }, { system: targetSystem === "none" || targetSystem === "ghl" ? "google_sheets" : targetSystem });
    if (problem) return setMessage(problem);
    setMessage(null);
    setChecks(cur => [...cur, updateCheck(newCheck("value", nextId()), patch, ctx)]);
    setValueDraft({ field: "", operator: "equals", expectedValue: "", expectedFrom: "", useRun: false });
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
    if (c.kind === "value" && (targetSystem === "google_sheets" || targetSystem === "airtable") && sheetHeaders.length && !sheetHeaders.some(h => sameName(h, c.field)))
      return `There is no column called “${c.field.trim()}” in this sheet. Pick one from the list.`;
    return null;
  }

  /* ---------- read the workflow ---------- */

  function applyScan(r: ScanResult) {
    setFlow(r.flow);
    setScanWarnings(r.risks.map(x => x.message));
    if (r.workflowName && r.workflowName !== "Untitled workflow") setName(cur => (cur.trim() ? cur : r.workflowName));
    const top = r.suggestions.find(x => x.supported && x.contract);
    if (!top || !top.contract) {
      setConnectFrom(null);
      setRecordExpr(null);
      setScanNote("Outcom read your workflow but found no step that saves business data it can check yet. You can still pick your checks yourself.");
      return;
    }
    const c = top.contract;
    setConnectFrom(top.nodeName);
    setRecordExpr(top.recordId.expression);
    setSheetHeaders([]); setSheetBlocked(null);
    if (c.system === "google_sheets") {
      setTargetSystem("google_sheets");
      setSheetTarget(c.target ? { spreadsheetId: c.target.spreadsheetId, spreadsheetName: c.target.spreadsheetName || "Google Sheet", sheetName: c.target.sheetName, keyColumn: c.target.keyColumn, access: googleConn ? "oauth" : robotEmail ? "service_account" : "oauth" } : null);
    } else if (c.system === "airtable") {
      setTargetSystem("airtable");
      setSheetTarget(null);
      // Without a key column the user picks it from the table list below; the base and table are still known.
      setAirtableTarget(c.airtable && c.airtable.keyField ? { baseId: c.airtable.baseId, tableId: c.airtable.tableId, tableName: c.airtable.tableName || "Airtable table", keyField: c.airtable.keyField } : null);
    } else if (c.system === "ghl") { setTargetSystem("ghl"); setSheetTarget(null); }
    const local = { system: (c.system === "ghl" || c.system === "airtable" ? c.system : "google_sheets") as TargetSystem, tab: c.target?.sheetName ?? c.airtable?.tableName ?? null };
    setChecks(cur => [updateCheck(newCheck("exists", nextId()), {}, local), updateCheck(newCheck("output", nextId()), {}, local), ...cur.filter(x => x.kind !== "exists" && x.kind !== "output" && x.kind !== "tags")]);
    setScanNote(`Found “${top.nodeName}”. ${top.question}`);
    setMessage(null);
    setStep(3);
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
      if (targetSystem === "ghl" && !ghl) return setMessage("Connect HighLevel first, or choose another place to look.");
      if (targetSystem === "airtable" && !airtable) return setMessage("Connect Airtable first.");
      if (targetSystem === "airtable" && !airtableTarget) return setMessage("Choose the Airtable table and the column that identifies each record.");
      if (targetSystem === "hubspot" && !hubspot) return setMessage("Connect HubSpot first.");
      if (targetSystem === "reported" && !reportedStep.trim()) return setMessage("Give the read-back step a short name, for example crm.");
      if (targetSystem === "google_sheets" && !sheetTarget) return setMessage("Choose the sheet, the tab and the column that identifies each row.");
    }
    if (needsBusinessSystem(checks) && targetSystem === "google_sheets" && sheetBlocked) return setMessage(robotEmail && sheetTarget?.access === "service_account" ? `Share the sheet with ${robotEmail} as Viewer first.` : sheetBlocked);
    for (const c of checks) {
      const problem = problemFor(c);
      if (problem) return setMessage(problem);
    }

    setCreating(true); setMessage(null);
    try {
      const id = workflowId.trim() || `manual-${crypto.randomUUID()}`;
      const payload = checks.map(c => toPayload(c, targetSystem, currentTarget, tab));
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

  const selectedPlatform = platforms.find(p => p.id === platform) ?? { id: "custom" as const, name: EXTRA_TOOLS.find(t => t.id === platform)?.name ?? "Other tool", hint: "" };
  const connectedHere = platform === "n8n" ? n8n : platform === "zapier" ? zapier : platform === "make" ? make : undefined;
  const sheetOk = targetSystem === "google_sheets" ? Boolean(sheetTarget) : targetSystem === "airtable" ? Boolean(airtableTarget) : targetSystem === "reported" ? Boolean(reportedStep.trim()) : true;
  const valueChecks = checks.filter(c => c.kind !== "exists" && c.kind !== "output" && c.kind !== "tags");
  const ready = checks.length > 0;

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
          <div className="cx-more">
            <h4>More tools <small>Anything that can send an HTTP request works. Each tool below gets its own instructions.</small></h4>
            {EXTRA_GROUPS.map(g => (
              <div key={g}>
                <span className="cx-group">{g}</span>
                <div className="cx-options cx-mini">
                  {EXTRA_TOOLS.filter(t => t.group === g).map(t => (
                    <button type="button" key={t.id} className={`cx-option ${platform === t.id ? "on" : ""}`} onClick={() => { setPlatform(t.id); setMessage(null); setDiscoveryLoaded(false); }}>
                      {t.id === "ghl_workflows" ? <IntegrationLogo name="ghl" size={30} /> : <BrandLogo id={t.id} label={t.name} size={30} />}<span><b>{t.name}</b></span><i>{platform === t.id ? "✓" : ""}</i>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <label className="cx-field">Name this automation
            <input name="outcom-automation-name" autoComplete="off" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lead intake → Sheet" />
          </label>

          {(platform === "n8n" || platform === "make") && <ScanWorkflow platform={platform} onRead={applyScan} />}
          {(platform === "n8n" || platform === "make") && scanNote && <div className="cx-found">
            <b>{scanNote}</b>
            {flow && flow.length > 0 && <FlowDiagram flow={flow} connectFrom={connectFrom} />}
            {scanWarnings.map(w => <p key={w} className="cx-warn">⚠ {w}</p>)}
          </div>}

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
            <IntegrationLogo name={platform as CoreTool} size={28} /><span><b>{selectedPlatform.name} connected</b><small>{reauthProvider === platform ? "Reconnect to continue" : "Pick a workflow, or just name it above"}</small></span>
            <button type="button" className="cx-link" onClick={() => discover(platform as "n8n" | "zapier" | "make")}>{loadingDiscovery ? "Loading…" : "Show my workflows"}</button>
          </div>}

          {discoveryLoaded && <div className="cx-list">
            {discovered.length === 0 && <p className="cx-muted">No workflows found. Type a name above instead.</p>}
            {discoveryWarning && <p className="cx-muted">{discoveryWarning}</p>}
            {discovered.map(d => (
              <button type="button" key={`${d.platform}:${d.id}`} onClick={() => { setWorkflowId(d.id); setName(d.name); setPlatform(d.platform as Platform); setStep(2); }}>
                <IntegrationLogo name={(d.platform === "n8n" || d.platform === "zapier" || d.platform === "make" ? d.platform : "custom") as CoreTool} size={24} />
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
          <DescribeChecks onAdd={addSuggested} disabled={checks.length >= MAX_CHECKS} />
          <MoreChecks system={targetSystem} disabled={checks.length >= MAX_CHECKS} onTemplate={applyTemplate} onRequired={f => addExtra("required", { field: f })} onCount={(op, n) => addExtra("count", { countOp: op, expectedCount: Number.isFinite(n) ? n : 1 })} onFresh={(f, m) => addExtra("fresh", { field: f, expectedCount: Number.isFinite(m) ? m : 10 })} />

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
                ? <div style={{ display: "grid", gap: 6 }}>
                    <select value={valueDraft.useRun ? "run" : "fixed"} onChange={e => setValueDraft(v => ({ ...v, useRun: e.target.value === "run" }))} aria-label="Compare with"><option value="fixed">a fixed value</option><option value="run">a field from the run</option></select>
                    {valueDraft.useRun
                      ? <input name="outcom-check-from" autoComplete="off" value={valueDraft.expectedFrom} onChange={e => setValueDraft(v => ({ ...v, expectedFrom: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") addValueCheck(); }} placeholder="Field your run sends · e.g. email" />
                      : <input name="outcom-check-value" autoComplete="off" value={valueDraft.expectedValue} onChange={e => setValueDraft(v => ({ ...v, expectedValue: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") addValueCheck(); }} placeholder="Value · e.g. Qualified" />}
                  </div>
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
          {scanNote && connectFrom && <p className="cx-note">Filled in from your workflow. Check it, then press Protect.</p>}
          {needsBusinessSystem(checks) && targetSystem === "google_sheets" && sheetTarget && sheetBlocked && <div className="cx-card cx-block">
            <p className="cx-error">{robotEmail && sheetTarget.access === "service_account" ? `Outcom can't open “${sheetTarget.spreadsheetName}” yet. Share it with the address below as Viewer.` : sheetBlocked}</p>
            {robotEmail && sheetTarget.access === "service_account" && <div className="cx-code"><code>{robotEmail}</code><button type="button" className="simple-secondary" onClick={() => { void navigator.clipboard?.writeText(robotEmail); setRobotCopied(true); }}>{robotCopied ? "Copied ✓" : "Copy"}</button></div>}
            <button type="button" className="simple-primary" onClick={() => void loadHeaders()}>I shared it, check again</button>
          </div>}
          {needsBusinessSystem(checks)
            ? <BusinessSystemPicker value={targetSystem} onChange={changeSystem} googleConnected={Boolean(googleConn)} googleConfigured={oauth.google_sheets} robotEmail={robotEmail} ghlConnected={Boolean(ghl)} airtableConnected={Boolean(airtable)} hubspotConnected={Boolean(hubspot)} airtableOAuth={oauth.airtable} hubspotOAuth={oauth.hubspot} airtable={airtableTarget} onAirtable={setAirtableTarget} hubspot={hubspotTarget} onHubspot={setHubspotTarget} onTokenSaved={() => void loadConnections()} sheet={sheetTarget} onSheet={setSheetTarget} onHeaders={setSheetHeaders} onConnectGoogle={() => { window.location.href = "/api/oauth/google_sheets/start"; }} ghlPanel={ghlPanel} reportedStep={reportedStep} onReportedStep={setReportedStep} reportedApp={reportedApp} onReportedApp={pickReportedApp} />
            : <p className="cx-note">Your checks only look at the run itself, so there is nothing to connect.</p>}

          <h3 className="cx-h">Your checks</h3>
          <div className="cx-checks">
            {checks.map(c => {
              const problem = sheetOk ? problemFor(c) : null;
              return (
                <div key={c.id} className={`cx-check ${problem ? "bad" : ""}`}>
                  <div className="cx-check-head">
                    {checkIcon(c, targetSystem, 34)}
                    <span><b>{c.label || autoLabel(c, ctx)}</b><small>{c.kind === "output" ? "From the run itself" : targetSystem === "google_sheets" ? (sheetTarget ? `${sheetTarget.spreadsheetName} → ${sheetTarget.sheetName}` : "Choose a sheet above") : targetSystem === "airtable" ? (airtableTarget ? airtableTarget.tableName : "Choose a table above") : systemName || "Choose where to look"}</small></span>
                    <button type="button" aria-label="Remove check" onClick={() => removeCheck(c.id)}>✕</button>
                  </div>
                  {c.kind === "value" && <div className="cx-row cx-three">
                    {hasNamedFields(targetSystem) && sheetHeaders.length
                      ? <select value={sheetHeaders.find(h => sameName(h, c.field)) ?? ""} onChange={e => patchCheck(c.id, { field: e.target.value })}><option value="">{targetSystem === "hubspot" ? "Property…" : "Column…"}</option>{sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select>
                      : <input name={`outcom-field-${c.id}`} autoComplete="off" value={c.field} onChange={e => patchCheck(c.id, { field: e.target.value })} placeholder="Column" />}
                    <select value={c.operator} onChange={e => patchCheck(c.id, { operator: e.target.value as Operator })}>{OPERATORS.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}</select>
                    {c.expectedFrom ? <span className="cx-muted cx-pad">the run’s “{c.expectedFrom}”</span> : c.operator !== "exists" ? <input name={`outcom-value-${c.id}`} autoComplete="off" value={c.expectedValue} onChange={e => patchCheck(c.id, { expectedValue: e.target.value })} placeholder="Value" /> : <span className="cx-muted cx-pad">no value needed</span>}
                  </div>}
                  {c.kind === "required" && <div className="cx-row"><input name={`outcom-req-${c.id}`} autoComplete="off" value={c.field} onChange={e => patchCheck(c.id, { field: e.target.value })} placeholder="Fields, separated by commas · e.g. email, owner" /></div>}
                  {c.kind === "count" && <div className="cx-row cx-three">
                    <select value={c.countOp ?? "equals"} onChange={e => patchCheck(c.id, { countOp: e.target.value as CountOperator })}>{COUNT_OPERATORS.map(o => <option key={o.id} value={o.id}>{o.text}</option>)}</select>
                    <input inputMode="numeric" value={String(c.expectedCount)} onChange={e => patchCheck(c.id, { expectedCount: Number(e.target.value.replace(/\D/g, "") || 0) })} aria-label="Number of records" />
                    <span className="cx-muted cx-pad">record(s) must exist</span>
                  </div>}
                  {c.kind === "fresh" && <div className="cx-row cx-three">
                    <input name={`outcom-fresh-${c.id}`} autoComplete="off" value={c.field} onChange={e => patchCheck(c.id, { field: e.target.value })} placeholder="Date field · e.g. created_at" />
                    <input inputMode="numeric" value={String(c.expectedCount)} onChange={e => patchCheck(c.id, { expectedCount: Number(e.target.value.replace(/\D/g, "") || 0) })} aria-label="Minutes" />
                    <span className="cx-muted cx-pad">minutes from the run</span>
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
      {created && !native && webhookInfo && <AfterProtect info={webhookInfo} keyColumn={targetSystem === "airtable" ? airtableTarget?.keyField ?? null : targetSystem === "hubspot" ? ({ email: "Email", phone: "Phone", id: "Contact ID" } as Record<string, string>)[hubspotTarget?.keyProperty ?? "email"] ?? "Email" : sheetTarget?.keyColumn ?? null} system={targetSystem} reportedStep={reportedStep.trim()} reportedApp={reportedApp} flow={flow} connectFrom={connectFrom} expression={platform === "make" ? recordExpr : null} onInfo={setWebhookInfo} />}

      {created && native && <section id="live-webhook" className="cx-flow cx-done">
        <div className="cx-done-head"><span className="cx-pill">● Protected</span><h2>{name}</h2><p>Outcom is watching this n8n workflow directly. Nothing else to set up.</p></div>
        <div className="cx-nav"><span /><a className="simple-primary" href="/workflows">See my workflows</a></div>
      </section>}
    </div>
  );
}
