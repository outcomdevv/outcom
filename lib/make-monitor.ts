import { getValidAccessToken } from "@/lib/oauth";
import { getWorkspaceStore } from "@/lib/db";
import type { WorkflowEvent } from "@/lib/contracts/types";

const normalizeBase = (value: string) => value.replace(/\/$/, "");

async function makeConnection(workspaceId?: string) {
  const store = await getWorkspaceStore(workspaceId);
  const connection = await store.connections.latest("make");
  if (!connection) throw new Error("Make is not connected.");
  const token = await getValidAccessToken("make");
  if (!token) throw new Error("Make connection has no usable access token.");
  const base = normalizeBase(String(connection.metadata?.baseUrl || process.env.MAKE_API_BASE_URL || "https://eu1.make.com/api/v2"));
  const teamId = String(connection.metadata?.teamId || "").trim();
  if (!teamId) throw new Error("Make Team ID is missing. Reconnect with OAuth or add the Team ID to the connection.");
  const auth = connection.metadata?.authMode === "oauth" ? `Bearer ${token}` : `Token ${token}`;
  return { store, token, base, teamId, auth };
}

async function json(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

async function getMake(path: string, ctx: { base: string; auth: string }) {
  const response = await fetch(`${ctx.base}${path}`, { headers: { Authorization: ctx.auth, Accept: "application/json" }, cache: "no-store" });
  const body = await json(response);
  if (!response.ok) throw new Error(`Make API ${response.status}: ${body.message || body.error || "request failed"}`);
  return body;
}

function parseBlueprint(payload: any): any {
  const raw = payload?.response?.blueprint ?? payload?.blueprint ?? payload?.response;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw && typeof raw === "object" ? raw : null;
}

function collectModules(blueprint: any): any[] {
  const modules = blueprint?.flow || blueprint?.modules || blueprint?.scenario?.flow;
  return Array.isArray(modules) ? modules : [];
}

function moduleName(module: any) {
  return String(module?.module || module?.app || module?.type || "").toLowerCase();
}

function isHighLevelModule(module: any) {
  const name = moduleName(module);
  return /highlevel|gohighlevel|leadconnector|leadconnectorhq/.test(name);
}

function isWriteModule(module: any) {
  const raw = JSON.stringify(module?.parameters || module?.mapper || module || {}).toLowerCase();
  return /create|update|upsert|add|modify/.test(raw) && !/search|get|find|watch|list/.test(raw);
}

function likelyEntity(module: any) {
  const raw = JSON.stringify(module || {}).toLowerCase();
  if (raw.includes("opportunity") || raw.includes("pipeline")) return "opportunity";
  if (raw.includes("conversation") || raw.includes("message")) return "conversation";
  return "contact";
}

function walk(value: any, visit: (key: string, value: any) => void, seen = new Set<any>()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) { for (const item of value) walk(item, visit, seen); return; }
  for (const [key, child] of Object.entries(value)) { visit(key, child); walk(child, visit, seen); }
}

function findEntityId(value: any) {
  let found: string | null = null;
  walk(value, (key, child) => {
    if (found) return;
    if (!/(^id$|contactid|contact_id|contact\.id|recordid|record_id|leadid|lead_id)/i.test(key)) return;
    if (typeof child === "string" || typeof child === "number") found = String(child);
  });
  return found;
}

function inferTags(value: any) {
  let tags: string[] | null = null;
  walk(value, (key, child) => {
    if (tags || !/tags?/i.test(key) || !Array.isArray(child)) return;
    const strings = child.filter((x) => typeof x === "string") as string[];
    if (strings.length) tags = strings;
  });
  return tags;
}

export async function protectMakeScenario(externalScenarioId: string, workspaceId?: string) {
  const ctx = await makeConnection(workspaceId);
  const detail = await getMake(`/scenarios/${encodeURIComponent(externalScenarioId)}`, ctx);
  const blueprintPayload = await getMake(`/scenarios/${encodeURIComponent(externalScenarioId)}/blueprint`, ctx);
  const blueprint = parseBlueprint(blueprintPayload);
  const modules = collectModules(blueprint);
  const writes = modules.filter((m) => isHighLevelModule(m) && isWriteModule(m));
  const localId = `make:${externalScenarioId}`;
  const store = ctx.store;

  if (!writes.length) {
    return { protected: false as const, reason: "Outcom could not conservatively infer a downstream HighLevel write from this Make scenario.", scenario: detail?.scenario?.name || `Make scenario ${externalScenarioId}` };
  }

  const local = await store.workflows.get(localId) || await store.workflows.create({ id: localId, name: detail?.scenario?.name || `Make scenario ${externalScenarioId}`, platform: "make", description: "Auto-protected by Outcom · native Make observer" });
  const contracts = await store.contracts.list(local.id);
  const created: any[] = [];
  for (const module of writes) {
    const entity = likelyEntity(module);
    if (entity !== "contact") continue;
    const existing = contracts.find((c) => c.type === "record_exists" && c.configuration?.sourceModule === module?.id && c.configuration?.auto === true);
    if (!existing) created.push(await store.contracts.create({ workflowId: local.id, name: `Make write: downstream contact exists`, type: "record_exists", system: "ghl", entity: "contact", configuration: { auto: true, sourceModule: module?.id || null, sourceModuleName: module?.label || module?.name || moduleName(module), lookup: { field: "id", valueFrom: "event.data.target_record_id" } }, severity: "high", enabled: true }));
  }

  await store.monitors.upsert({ workflowId: local.id, provider: "make", externalId: String(externalScenarioId), mode: "native_observer", metadata: { teamId: ctx.teamId, baseUrl: ctx.base, authMode: "native_api", moduleCount: modules.length, inferredWrites: writes.map((m) => ({ id: m.id, name: m.label || m.name || moduleName(m) })) } });
  return { protected: true as const, workflow: local, createdContracts: created, modules: modules.length, inferredWrites: writes.length };
}

export async function syncMakeWorkflow(localWorkflowId: string, workspaceId?: string) {
  const ctx = await makeConnection(workspaceId);
  const monitor = await ctx.store.monitors.getByWorkflow(localWorkflowId);
  if (!monitor || monitor.provider !== "make") throw new Error("Workflow is not protected by Make observation.");
  if (monitor.mode !== "native_observer") return { imported: 0, workflow: monitor.externalId, executionsChecked: 0, skipped: true, reason: "inbound_webhook" };
  const scenarioId = String(monitor.externalId);
  const logsPayload = await getMake(`/scenarios/${encodeURIComponent(scenarioId)}/logs?pg[limit]=10`, ctx);
  const logs = Array.isArray(logsPayload?.scenarioLogs) ? logsPayload.scenarioLogs : [];
  let imported = 0;
  for (const log of [...logs].reverse()) {
    const executionId = String(log.id || log.executionId || log.imtId || "");
    if (!executionId || await ctx.store.events.getByExecution(localWorkflowId, executionId)) continue;
    const detailPayload = await getMake(`/scenarios/${encodeURIComponent(scenarioId)}/executions/${encodeURIComponent(executionId)}`, ctx);
    const detail = detailPayload?.execution || detailPayload;
    const statusRaw = String(detail?.status || "").toUpperCase();
    const status: WorkflowEvent["status"] = statusRaw === "SUCCESS" || String(log.status) === "1" ? "success" : "failed";
    const outputs = detail?.outputs ?? detail?.output ?? detail?.data ?? detail;
    const targetRecordId = findEntityId(outputs);
    const tags = inferTags(outputs);
    const event = await ctx.store.events.create({
      workflowId: localWorkflowId,
      executionId,
      timestamp: String(detail?.timestamp || log.timestamp || new Date().toISOString()),
      platform: "make",
      status,
      data: { target_record_id: targetRecordId, contact_id: targetRecordId, target_system: "ghl", output: outputs, target_tags: tags, make_status: statusRaw || log.status || null },
      metadata: { source: "make-native-observer", scenario_id: scenarioId, observed_without_instrumentation: true },
    });
    await import("@/lib/outcome-checker").then(({ evaluateEvent }) => evaluateEvent(event));
    imported++;
  }
  await ctx.store.monitors.touch(localWorkflowId);
  return { imported, workflow: monitor.externalId, executionsChecked: logs.length };
}
