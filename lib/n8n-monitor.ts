import { getValidN8nApiKey } from "@/lib/n8n";
import { getWorkspaceStore } from "@/lib/db";

export type N8nNode = { id: string; name: string; type: string; parameters?: Record<string, any>; position?: number[]; credentials?: Record<string, any> };
export type N8nWorkflowDetail = { id: string; name: string; active?: boolean; nodes: N8nNode[]; connections?: Record<string, any>; updatedAt?: string | null; createdAt?: string | null };

async function n8nFetch(path: string, init?: RequestInit, workspaceId?: string) {
  const connection = await getValidN8nApiKey(workspaceId);
  if (!connection) throw new Error("n8n is not connected");
  const base = connection.baseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { Accept: "application/json", "X-N8N-API-KEY": connection.apiKey, ...(init?.headers || {}) },
    cache: "no-store",
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `n8n returned HTTP ${response.status}`);
  return body;
}

export async function getN8nWorkflow(id: string, workspaceId?: string): Promise<N8nWorkflowDetail> {
  const body = await n8nFetch(`/api/v1/workflows/${encodeURIComponent(id)}`, undefined, workspaceId);
  return body as N8nWorkflowDetail;
}

export async function listN8nExecutions(workflowId: string, limit = 10, workspaceId?: string) {
  const body = await n8nFetch(`/api/v1/executions?workflowId=${encodeURIComponent(workflowId)}&limit=${Math.min(limit, 50)}&includeData=false`, undefined, workspaceId);
  return (body.data || []) as Array<Record<string, any>>;
}

export async function getN8nExecution(id: string, workspaceId?: string) {
  return n8nFetch(`/api/v1/executions/${encodeURIComponent(id)}?includeData=true`, undefined, workspaceId);
}

function walkJson(value: unknown, visit: (value: any) => void, depth = 0) {
  if (depth > 8 || value == null) return;
  visit(value);
  if (Array.isArray(value)) for (const item of value) walkJson(item, visit, depth + 1);
  else if (typeof value === "object") for (const item of Object.values(value as Record<string, unknown>)) walkJson(item, visit, depth + 1);
}

function outputForNode(execution: any, nodeName: string): any[] {
  const runs = execution?.data?.resultData?.runData?.[nodeName];
  if (!Array.isArray(runs)) return [];
  const latest = runs[runs.length - 1];
  const main = latest?.data?.main;
  if (!Array.isArray(main)) return [];
  return main.flatMap((branch: any) => Array.isArray(branch) ? branch.map((x: any) => x?.json ?? x) : []);
}

function stringExpression(value: unknown) {
  if (typeof value !== "string") return null;
  const m = value.match(/^=??\s*\{\{\s*\$json\.([A-Za-z0-9_.-]+)\s*\}\}\s*$/);
  return m?.[1] || null;
}

function literalString(value: unknown) {
  return typeof value === "string" && !value.includes("{{") && !value.startsWith("=") ? value : null;
}

function findLikelyId(outputs: any[], node: N8nNode) {
  for (const item of outputs) {
    if (item && typeof item === "object") {
      for (const key of ["id", "contactId", "contact_id"]) if (item[key] != null) return String(item[key]);
      if (item.contact?.id != null) return String(item.contact.id);
      if (item.data?.contact?.id != null) return String(item.data.contact.id);
    }
  }
  const p = node.parameters || {};
  for (const key of ["contactId", "contact_id", "id"]) {
    const literal = literalString(p[key]);
    if (literal) return literal;
  }
  return null;
}

function findTagsConfiguration(node: N8nNode) {
  const p: any = node.parameters || {};
  const candidates = [p.tags, p.updateFields?.tags, p.additionalFields?.tags];
  for (const value of candidates) {
    if (Array.isArray(value) && value.every((x) => typeof x === "string")) return value as string[];
    if (typeof value === "string" && value.trim() && !value.includes("{{")) return value.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return null;
}

export function analyzeN8nWorkflow(workflow: N8nWorkflowDetail) {
  const candidates = workflow.nodes.filter((node) => node.type === "n8n-nodes-base.highLevel");
  const writes = candidates.filter((node) => ["create", "update", "delete"].includes(String(node.parameters?.operation || "")));
  const protections = writes.map((node) => ({
    nodeId: node.id,
    nodeName: node.name,
    system: "ghl",
    entity: String(node.parameters?.resource || "contact"),
    operation: String(node.parameters?.operation || "unknown"),
    tagsConfigured: findTagsConfiguration(node),
    confidence: node.parameters?.resource === "contact" ? "high" : "medium",
  }));
  return {
    workflowId: workflow.id,
    workflowName: workflow.name,
    candidateCount: protections.length,
    protections,
    recommendation: protections.length
      ? "Outcom can protect this workflow without adding an HTTP Request node. It will observe native n8n executions and verify the downstream state directly."
      : "No supported HighLevel write node was found yet. Outcom cannot safely infer the business outcome from this workflow without more context.",
  };
}

function resolvePath(obj: any, path: string) {
  return path.split(".").reduce((v, k) => v?.[k], obj);
}

function extractFromOutputs(outputsByNode: Record<string, any[]>, preferredNode: N8nNode) {
  const preferred = outputsByNode[preferredNode.name] || [];
  const id = findLikelyId(preferred, preferredNode);
  if (id) return { id, output: preferred };
  let fallback: string | null = null;
  walkJson(outputsByNode, (value) => {
    if (fallback || !value || typeof value !== "object") return;
    for (const key of ["contactId", "contact_id", "id"]) {
      if (typeof value[key] === "string" || typeof value[key] === "number") { fallback = String(value[key]); return; }
    }
  });
  return { id: fallback, output: preferred };
}

export function executionToOutcomeEvent(execution: any, workflow: N8nWorkflowDetail) {
  const runData = execution?.data?.resultData?.runData || {};
  const outputsByNode: Record<string, any[]> = {};
  for (const node of workflow.nodes) outputsByNode[node.name] = outputForNode(execution, node.name);
  const protection = analyzeN8nWorkflow(workflow).protections.find((x) => x.entity === "contact") || analyzeN8nWorkflow(workflow).protections[0];
  const node = protection ? workflow.nodes.find((x) => x.id === protection.nodeId) : null;
  const extracted = node ? extractFromOutputs(outputsByNode, node) : { id: null, output: [] };
  const nodeOutput = extracted.output[0] || {};
  const tags = Array.isArray(nodeOutput.tags) ? nodeOutput.tags.filter((x: any) => typeof x === "string") : protection?.tagsConfigured;
  return {
    workflow_id: `n8n:${workflow.id}`,
    execution_id: String(execution.id),
    timestamp: String(execution.stoppedAt || execution.startedAt || new Date().toISOString()),
    platform: "n8n",
    status: (execution.status === "success" || execution.finished === true) ? "success" as const : "failed" as const,
    data: {
      target_record_id: extracted.id,
      contact_id: extracted.id,
      target_system: protection?.system || null,
      target_node: protection?.nodeName || null,
      target_operation: protection?.operation || null,
      target_tags: tags || null,
      output: nodeOutput,
      run_data_nodes: Object.keys(runData),
    },
    metadata: { source: "n8n-native-observer", workflow_id: workflow.id, observed_without_instrumentation: true },
  };
}

export async function protectN8nWorkflow(externalWorkflowId: string, workspaceId?: string, expectedOutcome?: string) {
  const workflow = await getN8nWorkflow(externalWorkflowId, workspaceId);
  const analysis = analyzeN8nWorkflow(workflow);
  if (!analysis.protections.length) return { protected: false as const, analysis };
  const store = await getWorkspaceStore(workspaceId);
  const localId = `n8n:${workflow.id}`;
  const existing = await store.workflows.get(localId);
  const local = existing || await store.workflows.create({ id: localId, name: workflow.name, platform: "n8n", description: expectedOutcome ? `Auto-protected by Outcom · ${expectedOutcome}` : "Auto-protected by Outcom · native execution observer" });
  const created: any[] = [];
  for (const protection of analysis.protections) {
    const existingContracts = await store.contracts.list(local.id);
    const existingContract = existingContracts.find((c) => c.configuration?.sourceNode === protection.nodeId && c.configuration?.auto === true && c.type === "record_exists");
    if (!existingContract && protection.entity === "contact" && protection.operation !== "delete") {
      created.push(await store.contracts.create({ workflowId: local.id, name: `${protection.nodeName}: downstream contact exists`, type: "record_exists", system: "ghl", entity: "contact", configuration: { auto: true, expectedOutcome: expectedOutcome || null, sourceNode: protection.nodeId, sourceNodeName: protection.nodeName, lookup: { field: "id", valueFrom: "event.data.target_record_id" } }, severity: "high", enabled: true }));
    }
    if (protection.tagsConfigured?.length) {
      const existingContracts2 = await store.contracts.list(local.id);
      const existingInvariant = existingContracts2.find((c) => c.configuration?.sourceNode === protection.nodeId && c.configuration?.mode === "preserve_tags");
      if (!existingInvariant) created.push(await store.contracts.create({ workflowId: local.id, name: `${protection.nodeName}: existing tags must not disappear`, type: "state_invariant", system: "ghl", entity: "contact", configuration: { auto: true, expectedOutcome: expectedOutcome || null, mode: "preserve_tags", sourceNode: protection.nodeId, field: "tags", lookup: { field: "id", valueFrom: "event.data.target_record_id" } }, severity: "high", enabled: true }));
    }
  }
  await store.monitors.upsert({ workflowId: local.id, provider: "n8n", externalId: workflow.id, mode: "native_observer", metadata: { nodeCount: workflow.nodes.length, lastAnalysis: analysis, expectedOutcome: expectedOutcome || null } });
  return { protected: true as const, workflow: local, analysis, contracts: await store.contracts.list(local.id), createdContracts: created };
}

export async function syncN8nWorkflow(localWorkflowId: string, workspaceId?: string) {
  const store = await getWorkspaceStore(workspaceId);
  const monitor = await store.monitors.getByWorkflow(localWorkflowId);
  if (!monitor) throw new Error("Workflow is not protected by native n8n observation");
  const workflow = await getN8nWorkflow(monitor.externalId, workspaceId);
  const executions = await listN8nExecutions(monitor.externalId, 10, workspaceId);
  let imported = 0;
  for (const summary of executions.reverse()) {
    if (await store.events.getByExecution(localWorkflowId, String(summary.id))) continue;
    const detail = await getN8nExecution(String(summary.id), workspaceId);
    const event = executionToOutcomeEvent(detail, workflow);
    const stored = await store.events.create({ workflowId: localWorkflowId, executionId: event.execution_id, timestamp: event.timestamp, platform: event.platform, status: event.status, data: event.data, metadata: event.metadata });
    await import("@/lib/outcome-checker").then(({ evaluateEvent }) => evaluateEvent(stored));
    imported++;
  }
  await store.monitors.touch(localWorkflowId);
  return { imported, workflow: workflow.name, executionsChecked: executions.length };
}
