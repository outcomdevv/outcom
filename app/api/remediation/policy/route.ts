import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { normalizeAutonomyPolicy } from "@/lib/autonomy";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const ctx = await requireWorkspace(), db: any = createSupabaseServiceClient();
    const { data, error } = await db.from("remediation_policies").select("*").eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ policy: data?.policy ?? normalizeAutonomyPolicy(null), updatedAt: data?.updated_at ?? null });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load autonomy policy." }, { status: 401 }); }
}
export async function PUT(request: Request) {
  try {
    const ctx = await requireWorkspace();
    if (ctx.role !== "owner" && ctx.role !== "admin") return NextResponse.json({ error: "Only workspace owners and admins can change autonomy policy." }, { status: 403 });
    const body = await request.json(), policy = normalizeAutonomyPolicy(body?.policy), db: any = createSupabaseServiceClient();
    const { data, error } = await db.from("remediation_policies").upsert({ workspace_id: ctx.workspaceId, policy, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" }).select().single();
    if (error) throw error;
    const { error: auditError } = await db.from("remediation_audit_log").insert({ workspace_id: ctx.workspaceId, actor_id: ctx.user.id, event_type: "policy_updated", details: { mode: policy.mode, enabled: policy.enabled, allowedActions: policy.allowedActions, allowedWorkflowIds: policy.allowedWorkflowIds } });
    if (auditError) throw auditError;
    return NextResponse.json({ policy: data.policy, updatedAt: data.updated_at });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save autonomy policy." }, { status: 400 }); }
}