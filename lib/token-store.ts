// Tokens the customer pasted (Airtable personal access token, HubSpot private app token). Encrypted at rest, never sent to the browser.
import { getWorkspaceStore } from "@/lib/db";
import { encryptSecret, getValidAccessToken } from "@/lib/oauth";

export type TokenProvider = "airtable" | "hubspot";

/** Pasted tokens never expire; OAuth tokens are refreshed automatically before they run out. */
export async function getStoredToken(provider: TokenProvider, workspaceId?: string): Promise<string | null> {
  return getValidAccessToken(provider, workspaceId);
}

export async function saveToken(provider: TokenProvider, v: { accountId: string; accountName: string; token: string; metadata?: Record<string, unknown> }) {
  const store = await getWorkspaceStore();
  await store.connections.upsert({ provider, accountId: v.accountId, accountName: v.accountName, email: null, accessToken: encryptSecret(v.token), refreshToken: null, expiresAt: null, metadata: { authMode: "private_token", readOnly: true, ...(v.metadata ?? {}) } });
}
