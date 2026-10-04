import { getValidN8nApiKey } from "@/lib/n8n";

export type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export async function listN8nWorkflows(fetchImpl: typeof fetch = fetch, maxPages = 40) {
  const connection = await getValidN8nApiKey();
  if (!connection) return { connected: false as const, items: [] as N8nWorkflow[], partial: false };
  const base = connection.baseUrl.replace(/\/$/, "");
  const byId = new Map<string, N8nWorkflow>();
  let cursor: string | null = null;
  let pages = 0;
  let partial = false;
  do {
    const url = new URL(`${base}/api/v1/workflows`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetchImpl(url, { headers: { Accept: "application/json", "X-N8N-API-KEY": connection.apiKey }, cache: "no-store" });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (pages === 0) throw new Error(response.status === 401 ? "n8n rejected the API key. Create a new key in n8n and reconnect." : body.message || `n8n returned HTTP ${response.status}`);
      partial = true; break;
    }
    for (const workflow of Array.isArray(body.data) ? body.data : []) {
      byId.set(String(workflow.id), { id: String(workflow.id), name: workflow.name || "Untitled workflow", active: Boolean(workflow.active), updatedAt: workflow.updatedAt || null, createdAt: workflow.createdAt || null });
    }
    pages += 1;
    cursor = typeof body.nextCursor === "string" && body.nextCursor ? body.nextCursor : null;
    if (cursor && pages >= maxPages) { partial = true; break; }
  } while (cursor);
  return { connected: true as const, items: [...byId.values()], partial };
}

export async function getN8nHealth() {
  const connection = await getValidN8nApiKey();
  if (!connection) return { connected: false as const };
  const base = connection.baseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/api/v1/workflows?limit=1`, {
    headers: { Accept: "application/json", "X-N8N-API-KEY": connection.apiKey },
    cache: "no-store",
  });
  return { connected: response.ok, status: response.status };
}
