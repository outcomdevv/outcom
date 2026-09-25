import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/oauth";

export type InboundProvider = "zapier" | "make";

const appBaseUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const hashToken = (token: string) => crypto.createHash("sha256").update(token, "utf8").digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

export function inboundWebhookUrl(token: string) {
  return `${appBaseUrl()}/api/inbound/${encodeURIComponent(token)}`;
}

export async function getOrCreateInboundWebhook(workspaceId: string, workflowId: string, provider: InboundProvider) {
  const db: any = createSupabaseServiceClient();
  const existing = await db.from("webhook_endpoints").select("*").eq("workspace_id", workspaceId).eq("workflow_id", workflowId).eq("provider", provider).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const token = decryptSecret(existing.data.token_encrypted);
    return {
      id: existing.data.id as string,
      workflowId: existing.data.workflow_id as string,
      provider: existing.data.provider as InboundProvider,
      url: inboundWebhookUrl(token),
      enabled: Boolean(existing.data.enabled),
      lastReceivedAt: existing.data.last_received_at as string | null,
      createdAt: existing.data.created_at as string,
      reused: true,
    };
  }

  const token = newToken();
  const row = {
    id: `wh_endpoint_${crypto.randomUUID()}`,
    workspace_id: workspaceId,
    workflow_id: workflowId,
    provider,
    token_hash: hashToken(token),
    token_encrypted: encryptSecret(token),
    enabled: true,
  };
  const created = await db.from("webhook_endpoints").insert(row).select("id,workflow_id,provider,enabled,last_received_at,created_at").single();
  if (created.error) throw created.error;
  return {
    id: created.data.id as string,
    workflowId: created.data.workflow_id as string,
    provider: created.data.provider as InboundProvider,
    url: inboundWebhookUrl(token),
    enabled: Boolean(created.data.enabled),
    lastReceivedAt: created.data.last_received_at as string | null,
    createdAt: created.data.created_at as string,
    reused: false,
  };
}

export async function getInboundWebhookByToken(token: string) {
  const db: any = createSupabaseServiceClient();
  const hash = hashToken(token);
  const result = await db.from("webhook_endpoints").select("*").eq("token_hash", hash).eq("enabled", true).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  return result.data;
}

export async function touchInboundWebhook(id: string, workspaceId: string) {
  const db: any = createSupabaseServiceClient();
  const now = new Date().toISOString();
  await db.from("webhook_endpoints").update({ last_received_at: now, updated_at: now }).eq("workspace_id", workspaceId).eq("id", id);
}
