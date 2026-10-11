// Tokens the customer pasted (Airtable personal access token, HubSpot private app token). Encrypted at rest, never sent to the browser.
import { getWorkspaceStore } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/oauth";

export type TokenProvider = "airtable" | "hubspot";

export async function getStoredToken(provider: TokenProvider, workspaceId?: string): Promise<string | null> {
  const store = await getWorkspaceStore(workspaceId);
  const c = await store.connections.latest(provider);
  return c ? decryptSecret(c.accessToken) : null;
}

export async function saveToken(provider: TokenProvider, v: { accountId: string; accountName: string; token: string; metadata?: Record<string, unknown> }) {
  const store = await getWorkspaceStore();
  await store.connections.upsert({ provider, accountId: v.accountId, accountName: v.accountName, email: null, accessToken: encryptSecret(v.token), refreshToken: null, expiresAt: null, metadata: { authMode: "private_token", readOnly: true, ...(v.metadata ?? {}) } });
}
