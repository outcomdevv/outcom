import { getValidN8nApiKey } from "@/lib/n8n";

export type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export async function listN8nWorkflows() {
  const connection = await getValidN8nApiKey();
  if (!connection) return { connected: false as const, items: [] as N8nWorkflow[] };
  const base = connection.baseUrl.replace(/\/$/, "");
  const url = new URL(`${base}/api/v1/workflows`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("active", "true");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-N8N-API-KEY": connection.apiKey },
    cache: "no-store",
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `n8n returned HTTP ${response.status}`);
  return {
    connected: true as const,
    items: (body.data || []).map((workflow: any) => ({
      id: String(workflow.id),
      name: workflow.name || "Untitled workflow",
      active: Boolean(workflow.active),
      updatedAt: workflow.updatedAt || null,
      createdAt: workflow.createdAt || null,
    })),
  };
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
