import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth";
import type { Incident, OutcomeContract, Workflow, WorkflowEvent } from "@/lib/contracts/types";
import type { OAuthProvider } from "@/lib/oauth";

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const asRecord = (value: unknown) => (value && typeof value === "object" ? value as Record<string, unknown> : {});
const workflow = (r: any): Workflow => ({ id: r.id, name: r.name, platform: r.platform, description: r.description ?? "", createdAt: r.created_at, updatedAt: r.updated_at });
const contract = (r: any): OutcomeContract => ({ id: r.id, workflowId: r.workflow_id, name: r.name, type: r.type, system: r.system, entity: r.entity, configuration: asRecord(r.configuration), severity: r.severity, enabled: Boolean(r.enabled), createdAt: r.created_at, updatedAt: r.updated_at });
const event = (r: any): WorkflowEvent => ({ id: r.id, workflowId: r.workflow_id, executionId: r.execution_id, timestamp: r.timestamp, platform: r.platform, status: r.status, data: asRecord(r.data), metadata: asRecord(r.metadata), createdAt: r.created_at });
const incident = (r: any): Incident => ({ id: r.id, workflowId: r.workflow_id, eventId: r.event_id, contractId: r.contract_id, type: r.type, severity: r.severity, status: r.status, title: r.title, summary: r.summary, expected: r.expected, observed: r.observed, evidence: Array.isArray(r.evidence) ? r.evidence : [], impact: r.impact, recommendedAction: r.recommended_action, detectedAt: r.detected_at, resolvedAt: r.resolved_at, createdAt: r.created_at });

export async function getWorkspaceStore(workspaceId?: string) {
  const ctx = workspaceId ? null : await requireWorkspace();
  const wid = workspaceId || ctx!.workspaceId;
  // The public schema is intentionally accessed through a dynamic table helper.
  // Keep the Supabase client as any here so TypeScript does not lose the query-builder
  // methods when the table name is dynamic; runtime access is still constrained by wid.
  const db: any = createSupabaseServiceClient();
  const scoped = (table: string) => db.from(table);
  const scope = (query: any) => query.eq("workspace_id", wid);

  return {
    workspaceId: wid,
    workflows: {
      async list() { const { data, error } = await scope(scoped("workflows").select("*")).order("created_at", { ascending: false }); if (error) throw error; return (data ?? []).map(workflow); },
      async get(workflowId: string) { const { data, error } = await scope(scoped("workflows").select("*")).eq("id", workflowId).maybeSingle(); if (error) throw error; return data ? workflow(data) : null; },
      async create(v: Pick<Workflow, "id" | "name" | "platform" | "description">) { const { data, error } = await db.from("workflows").upsert({ workspace_id: wid, id: v.id || id("workflow"), name: v.name, platform: v.platform, description: v.description ?? "", updated_at: new Date().toISOString() }, { onConflict: "workspace_id,id" }).select().single(); if (error) throw error; return workflow(data); },
    },
    contracts: {
      async list(workflowId?: string) { let q = scope(scoped("contracts").select("*")).order("created_at", { ascending: false }); if (workflowId) q = q.eq("workflow_id", workflowId); const { data, error } = await q; if (error) throw error; return (data ?? []).map(contract); },
      async get(contractId: string) { const { data, error } = await scope(scoped("contracts").select("*")).eq("id", contractId).maybeSingle(); if (error) throw error; return data ? contract(data) : null; },
      async create(v: Omit<OutcomeContract, "id" | "createdAt" | "updatedAt"> & { id?: string }) { const row = { workspace_id: wid, id: v.id || id("contract"), workflow_id: v.workflowId, name: v.name, type: v.type, system: v.system, entity: v.entity, configuration: v.configuration, severity: v.severity, enabled: v.enabled, updated_at: new Date().toISOString() }; const { data, error } = await db.from("contracts").insert(row).select().single(); if (error) throw error; return contract(data); },
    },
    events: {
      async list(workflowId?: string) { let q = scope(scoped("events").select("*")).order("timestamp", { ascending: false }); if (workflowId) q = q.eq("workflow_id", workflowId); const { data, error } = await q; if (error) throw error; return (data ?? []).map(event); },
      async getByExecution(workflowId: string, executionId: string) { const { data, error } = await scope(scoped("events").select("*")).eq("workflow_id", workflowId).eq("execution_id", executionId).maybeSingle(); if (error) throw error; return data ? event(data) : null; },
      async create(v: Omit<WorkflowEvent, "id" | "createdAt">) { const row = { workspace_id: wid, id: id("event"), workflow_id: v.workflowId, execution_id: v.executionId, timestamp: v.timestamp, platform: v.platform, status: v.status, data: v.data, metadata: v.metadata }; const { data, error } = await db.from("events").insert(row).select().single(); if (error) { if (error.code === "23505") return (await this.getByExecution(v.workflowId, v.executionId))!; throw error; } return event(data); },
    },
    incidents: {
      async list(workflowId?: string) { let q = scope(scoped("incidents").select("*")).order("detected_at", { ascending: false }); if (workflowId) q = q.eq("workflow_id", workflowId); const { data, error } = await q; if (error) throw error; return (data ?? []).map(incident); },
      async get(incidentId: string) { const { data, error } = await scope(scoped("incidents").select("*")).eq("id", incidentId).maybeSingle(); if (error) throw error; return data ? incident(data) : null; },
      async getFor(eventId: string, contractId: string) { const { data, error } = await scope(scoped("incidents").select("*")).eq("event_id", eventId).eq("contract_id", contractId).maybeSingle(); if (error) throw error; return data ? incident(data) : null; },
      async create(v: Omit<Incident, "id" | "createdAt" | "detectedAt" | "resolvedAt" | "status">) { const row = { workspace_id: wid, id: id("incident"), workflow_id: v.workflowId, event_id: v.eventId, contract_id: v.contractId, type: v.type, severity: v.severity, status: "open", title: v.title, summary: v.summary, expected: v.expected, observed: v.observed, evidence: v.evidence, impact: v.impact, recommended_action: v.recommendedAction }; const { data, error } = await db.from("incidents").insert(row).select().single(); if (error) { if (error.code === "23505") return (await this.getFor(v.eventId, v.contractId))!; throw error; } return incident(data); },
      async resolve(incidentId: string) { const { data, error } = await scope(scoped("incidents").update({ status: "resolved", resolved_at: new Date().toISOString() })).eq("id", incidentId).select().maybeSingle(); if (error) throw error; return data ? incident(data) : null; },
    },
    contacts: {
      async get(contactId: string) { const { data, error } = await scope(scoped("contacts").select("*")).eq("id", contactId).maybeSingle(); if (error && error.code !== "42P01") throw error; return data ? data : null; },
      async upsert(v: { id: string; name?: string; tags?: string[]; status?: string }) { const current = await this.get(v.id); const row = { workspace_id: wid, id: v.id, name: v.name ?? current?.name ?? "Unknown", tags: v.tags ?? current?.tags ?? [], status: v.status ?? current?.status ?? "new" }; const { data, error } = await db.from("contacts").upsert(row, { onConflict: "workspace_id,id" }).select().single(); if (error) throw error; return data; },
    },
    oauthStates: {
      async create(v: { state: string; provider: OAuthProvider; expiresAt: string }) { const { error } = await db.from("oauth_states").insert({ state: v.state, workspace_id: wid, provider: v.provider, expires_at: v.expiresAt }); if (error) throw error; return v; },
      async consume(state: string, provider: OAuthProvider) { const { data, error } = await db.from("oauth_states").select("*").eq("workspace_id", wid).eq("state", state).eq("provider", provider).maybeSingle(); if (error) throw error; await db.from("oauth_states").delete().eq("workspace_id", wid).eq("state", state); return data && new Date(data.expires_at).getTime() > Date.now() ? data : null; },
    },
    connections: {
      async list() { const { data, error } = await scope(scoped("connections").select("id,provider,account_id,account_name,email,expires_at,metadata,created_at,updated_at")).order("updated_at", { ascending: false }); if (error) throw error; return (data ?? []).map((r: any) => ({ id: r.id, provider: r.provider, accountId: r.account_id, accountName: r.account_name, email: r.email, expiresAt: r.expires_at, metadata: asRecord(r.metadata), createdAt: r.created_at, updatedAt: r.updated_at })); },
      async latest(provider: string) { const { data, error } = await scope(scoped("connections").select("*")).eq("provider", provider).order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data ? { id: data.id, provider: data.provider, accountId: data.account_id, accountName: data.account_name, email: data.email, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at, metadata: asRecord(data.metadata), createdAt: data.created_at, updatedAt: data.updated_at } : null; },
      async upsert(v: { provider: string; accountId: string; accountName: string; email?: string | null; accessToken: string; refreshToken?: string | null; expiresAt?: string | null; metadata?: Record<string, unknown> }) { const existing = await this.latest(v.provider); const connectionId = existing?.accountId === v.accountId ? existing.id : id("connection"); const row = { workspace_id: wid, id: connectionId, provider: v.provider, account_id: v.accountId, account_name: v.accountName, email: v.email ?? null, access_token: v.accessToken, refresh_token: v.refreshToken ?? null, expires_at: v.expiresAt ?? null, metadata: v.metadata ?? {}, updated_at: new Date().toISOString() }; const { data, error } = await db.from("connections").upsert(row, { onConflict: "workspace_id,provider,account_id" }).select().single(); if (error) throw error; return { id: data.id, provider: data.provider, accountId: data.account_id, accountName: data.account_name, email: data.email, expiresAt: data.expires_at, metadata: asRecord(data.metadata), createdAt: data.created_at, updatedAt: data.updated_at }; },
      async updateTokens(connectionId: string, v: { accessToken: string; refreshToken: string | null; expiresAt: string | null }) { const { error } = await scope(scoped("connections").update({ access_token: v.accessToken, refresh_token: v.refreshToken, expires_at: v.expiresAt, updated_at: new Date().toISOString() })).eq("id", connectionId); if (error) throw error; return this.list(); },
    },
    monitors: {
      async list() { const { data, error } = await scope(scoped("monitors").select("*")).order("updated_at", { ascending: false }); if (error) throw error; return (data ?? []).map((r: any) => ({ workspaceId: r.workspace_id, workflowId: r.workflow_id, provider: r.provider, externalId: r.external_id, mode: r.mode, metadata: asRecord(r.metadata), createdAt: r.created_at, updatedAt: r.updated_at })); },
      async getByWorkflow(workflowId: string) { const { data, error } = await scope(scoped("monitors").select("*")).eq("workflow_id", workflowId).maybeSingle(); if (error) throw error; return data ? { workspaceId: data.workspace_id, workflowId: data.workflow_id, provider: data.provider, externalId: data.external_id, mode: data.mode, metadata: asRecord(data.metadata), createdAt: data.created_at, updatedAt: data.updated_at } : null; },
      async upsert(v: { workflowId: string; provider: string; externalId: string; mode: string; metadata?: Record<string, unknown> }) { const { data, error } = await db.from("monitors").upsert({ workspace_id: wid, workflow_id: v.workflowId, provider: v.provider, external_id: v.externalId, mode: v.mode, metadata: v.metadata ?? {}, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,workflow_id" }).select().single(); if (error) throw error; return data; },
      async touch(workflowId: string) { const { error } = await scope(scoped("monitors").update({ updated_at: new Date().toISOString() })).eq("workflow_id", workflowId); if (error) throw error; },
    },
    snapshots: {
      async get(contractId: string, entityId: string) { const { data, error } = await scope(scoped("state_snapshots").select("*")).eq("contract_id", contractId).eq("entity_id", entityId).maybeSingle(); if (error) throw error; return data ? { contractId: data.contract_id, entityId: data.entity_id, snapshot: asRecord(data.snapshot), observedAt: data.observed_at } : null; },
      async upsert(v: { contractId: string; entityId: string; snapshot: Record<string, unknown> }) { const { error } = await db.from("state_snapshots").upsert({ workspace_id: wid, contract_id: v.contractId, entity_id: v.entityId, snapshot: v.snapshot, observed_at: new Date().toISOString() }, { onConflict: "workspace_id,contract_id,entity_id" }); if (error) throw error; },
    },
    webhooks: {
      async seen(webhookId: string) { const { data, error } = await scope(scoped("webhooks").select("id")).eq("webhook_id", webhookId).maybeSingle(); if (error) throw error; return Boolean(data); },
      async create(v: { provider: string; webhookId: string; eventType: string; payload: Record<string, unknown> }) { const { error } = await db.from("webhooks").insert({ workspace_id: wid, id: id("webhook"), provider: v.provider, webhook_id: v.webhookId, event_type: v.eventType, payload: v.payload }); if (error && error.code !== "23505") throw error; },
    },
    settings: {
      async get() { const { data, error } = await scope(scoped("workspace_settings").select("groq_api_key_encrypted,groq_model")).maybeSingle(); if (error) throw error; return data ? { groqApiKeyEncrypted: data.groq_api_key_encrypted, groqModel: data.groq_model } : { groqApiKeyEncrypted: null, groqModel: "openai/gpt-oss-120b" }; },
      async update(v: { groqApiKeyEncrypted?: string | null; groqModel?: string }) { const { data, error } = await db.from("workspace_settings").upsert({ workspace_id: wid, groq_api_key_encrypted: v.groqApiKeyEncrypted ?? null, groq_model: v.groqModel ?? "openai/gpt-oss-120b", updated_at: new Date().toISOString() }, { onConflict: "workspace_id" }).select().single(); if (error) throw error; return { groqApiKeyEncrypted: data.groq_api_key_encrypted, groqModel: data.groq_model }; },
    },
  };
}

export const store = {
  async get() { return getWorkspaceStore(); },
};
