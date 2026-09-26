import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { encryptSecret } from "@/lib/oauth";
import { inboundWebhookUrl } from "@/lib/webhooks";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const hashToken = (token: string) => crypto.createHash("sha256").update(token, "utf8").digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = String(body.provider || "").trim();
    const workflowId = String(body.workflowId || "").trim();
    if (!["zapier", "make"].includes(provider) || !workflowId) return NextResponse.json({ error: "provider and workflowId are required." }, { status: 400 });

    const store = await getWorkspaceStore();
    const workflow = await store.workflows.get(workflowId);
    if (!workflow || workflow.platform !== provider) return NextResponse.json({ error: "Protected workflow not found." }, { status: 404 });

    const db: any = createSupabaseServiceClient();
    const current = await db.from("webhook_endpoints").select("id").eq("workspace_id", store.workspaceId).eq("workflow_id", workflowId).eq("provider", provider).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: "Webhook endpoint not found." }, { status: 404 });

    const token = newToken();
    const now = new Date().toISOString();
    const updated = await db.from("webhook_endpoints").update({ token_hash: hashToken(token), token_encrypted: encryptSecret(token), enabled: true, last_received_at: null, updated_at: now }).eq("workspace_id", store.workspaceId).eq("id", current.data.id).select("id,workflow_id,provider,enabled,last_received_at,created_at").single();
    if (updated.error) throw updated.error;

    return NextResponse.json({ ok: true, id: updated.data.id, workflowId, provider, url: inboundWebhookUrl(token), rotatedAt: now });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not rotate webhook endpoint." }, { status: 400 });
  }
}
