import { decryptSecret, encryptSecret } from "@/lib/oauth";
import { getWorkspaceStore } from "@/lib/db";

export function normalizeN8nBaseUrl(value: string) {
  const input = value.trim();
  const parsed = new URL(input);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("n8n URL must start with http:// or https://");
  parsed.hash = ""; parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}

export async function probeN8nConnection(baseUrl: string, apiKey: string) {
  const normalized = normalizeN8nBaseUrl(baseUrl);
  if (!apiKey.trim()) throw new Error("n8n API key is required");
  const response = await fetch(`${normalized}/api/v1/workflows?limit=1`, {
    headers: { Accept: "application/json", "X-N8N-API-KEY": apiKey.trim() },
    cache: "no-store",
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `n8n rejected the API key (HTTP ${response.status}).`);
  return { baseUrl: normalized, hostname: new URL(normalized).hostname };
}

export async function saveN8nConnection(baseUrl: string, apiKey: string) {
  const normalized = normalizeN8nBaseUrl(baseUrl);
  if (!apiKey.trim()) throw new Error("n8n API key is required");
  const store = await getWorkspaceStore();
  return store.connections.upsert({
    provider: "n8n",
    accountId: normalized,
    accountName: new URL(normalized).hostname,
    accessToken: encryptSecret(apiKey.trim()),
    refreshToken: null,
    expiresAt: null,
    metadata: { baseUrl: normalized },
  });
}

export async function getValidN8nApiKey(workspaceId?: string) {
  const store = await getWorkspaceStore(workspaceId);
  const connection = await store.connections.latest("n8n");
  if (!connection) return null;
  return { apiKey: decryptSecret(connection.accessToken), baseUrl: String(connection.metadata?.baseUrl || connection.accountId) };
}
