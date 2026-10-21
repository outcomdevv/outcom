import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/oauth";
import { appPublicUrl } from "@/lib/webhooks";

export const SHARE_DAYS = [7, 30, 90] as const;
export type ShareRow = { id: string; title: string; preparedBy: string; workflowIds: string[]; days: number; url: string; createdAt: string };
export type ShareRecord = { workspaceId: string; title: string; preparedBy: string; workflowIds: string[]; days: number };

const hashToken = (token: string) => crypto.createHash("sha256").update(token, "utf8").digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");
const reportUrl = (token: string) => appPublicUrl(`/report/${encodeURIComponent(token)}`);
const MISSING = "Report sharing is not set up yet. Run supabase/migrations/005_report_shares.sql in the Supabase SQL Editor.";

function unwrap<T extends { error: any }>(res: T): T {
  if (res.error) throw new Error(res.error.code === "42P01" ? MISSING : res.error.message || "Database error");
  return res;
}
const toRow = (r: any): ShareRow => ({ id: r.id, title: r.title, preparedBy: r.prepared_by ?? "", workflowIds: r.workflow_ids ?? [], days: r.days, url: reportUrl(decryptSecret(r.token_encrypted)), createdAt: r.created_at });

export async function listShares(workspaceId: string): Promise<ShareRow[]> {
  const db: any = createSupabaseServiceClient();
  const res = await db.from("report_shares").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (res.error?.code === "42P01") return [];
  return (unwrap(res).data ?? []).map(toRow);
}

export async function createShare(workspaceId: string, v: { title: string; preparedBy: string; workflowIds: string[]; days: number }): Promise<ShareRow> {
  const db: any = createSupabaseServiceClient();
  const token = newToken();
  const row = { id: `share_${crypto.randomUUID()}`, workspace_id: workspaceId, title: v.title, prepared_by: v.preparedBy, workflow_ids: v.workflowIds, days: v.days, token_hash: hashToken(token), token_encrypted: encryptSecret(token) };
  const res = unwrap(await db.from("report_shares").insert(row).select().single());
  return toRow(res.data);
}

export async function revokeShare(workspaceId: string, id: string): Promise<void> {
  const db: any = createSupabaseServiceClient();
  unwrap(await db.from("report_shares").delete().eq("workspace_id", workspaceId).eq("id", id));
}

/** Public lookup by link token. Returns null for unknown or revoked links. */
export async function resolveShare(token: string): Promise<ShareRecord | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const db: any = createSupabaseServiceClient();
  const res = await db.from("report_shares").select("workspace_id,title,prepared_by,workflow_ids,days").eq("token_hash", hashToken(token)).maybeSingle();
  if (res.error || !res.data) return null;
  return { workspaceId: res.data.workspace_id, title: res.data.title, preparedBy: res.data.prepared_by ?? "", workflowIds: res.data.workflow_ids ?? [], days: res.data.days };
}
