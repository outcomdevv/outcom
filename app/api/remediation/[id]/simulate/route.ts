import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { MockExecutionProvider } from "@/lib/execution/mock-provider";
import type { ExecutionRequest } from "@/lib/execution/types";
import type { RemediationAction } from "@/lib/remediation";

export const dynamic = "force-dynamic";

/**
 * Runs an explicitly labelled simulation for an approved proposal.
 * This route never dispatches to n8n, CRM, or any external system.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let db: any;
  let attemptId: string | null = null;
  try {
    const ctx = await requireWorkspace();
    const { id } = await params;
    const idempotencyKey = _request.headers.get("idempotency-key") ?? "";
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: "A valid Idempotency-Key header (8-128 safe characters) is required." }, { status: 400 });
    }

    db = createSupabaseServiceClient();
    const { data: proposal, error: proposalError } = await db
      .from("remediation_proposals")
      .select("id,workspace_id,workflow_id,action,preview,status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", id)
      .maybeSingle();
    if (proposalError) throw proposalError;
    if (!proposal) return NextResponse.json({ error: "Proposal not found in this workspace." }, { status: 404 });
    if (proposal.status !== "approved") {
      return NextResponse.json({ error: "Only approved proposals can be simulated.", proposalStatus: proposal.status }, { status: 409 });
    }

    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ proposalId: proposal.id, workflowId: proposal.workflow_id, action: proposal.action, preview: proposal.preview }))
      .digest("hex");
    const { data: attempt, error: insertError } = await db
      .from("remediation_execution_attempts")
      .insert({
        workspace_id: ctx.workspaceId,
        proposal_id: proposal.id,
        idempotency_key: idempotencyKey,
        provider_id: "mock_simulator",
        execution_mode: "simulation",
        state: "running",
        request_fingerprint: fingerprint,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError?.code === "23505") {
      const { data: existing, error: existingError } = await db
        .from("remediation_execution_attempts")
        .select("*")
        .eq("workspace_id", ctx.workspaceId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing && existing.request_fingerprint !== fingerprint) {
        return NextResponse.json({ error: "Idempotency key was already used for a different request." }, { status: 409 });
      }
      return NextResponse.json({ attempt: existing, replayed: true, message: "This idempotency key was already processed; no second simulation was started." }, { status: 200 });
    }
    if (insertError) throw insertError;
    attemptId = attempt.id;

    const request: ExecutionRequest = {
      workspaceId: ctx.workspaceId,
      proposalId: proposal.id,
      workflowId: proposal.workflow_id,
      action: proposal.action as RemediationAction,
      preview: proposal.preview ?? {},
      idempotencyKey,
    };
    const provider = new MockExecutionProvider();
    try {
      const execution = await provider.execute(request);
      const verification = await provider.verify(request, execution.operationId);
      const state = verification.passed ? "succeeded" : "verification_failed";
      const evidence = {
        simulated: true,
        provider: provider.id,
        operationId: execution.operationId,
        before: execution.before ?? null,
        after: verification.observed ?? execution.after ?? null,
        checks: [{ name: "simulated_readback", passed: verification.passed, detail: verification.detail }],
      };
      const { data: saved, error: saveError } = await db
        .from("remediation_execution_attempts")
        .update({ state, evidence, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("workspace_id", ctx.workspaceId)
        .eq("id", attemptId)
        .select()
        .single();
      if (saveError) throw saveError;
      const { error: auditError } = await db.from("remediation_audit_log").insert({
        workspace_id: ctx.workspaceId,
        actor_id: ctx.user.id,
        proposal_id: proposal.id,
        event_type: verification.passed ? "verification_passed" : "verification_failed",
        details: { mode: "simulation", attempt_id: attemptId, provider: provider.id },
      });
      if (auditError) throw auditError;
      return NextResponse.json({
        attempt: saved,
        simulation: true,
        message: verification.passed
          ? "Simulation and simulated read-back passed. No external system was changed."
          : "Simulation ran, but simulated read-back failed. No external system was changed.",
      }, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Simulation failed.";
      await db.from("remediation_execution_attempts")
        .update({ state: "failed", error_message: message.slice(0, 500), completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("workspace_id", ctx.workspaceId)
        .eq("id", attemptId);
      await db.from("remediation_audit_log").insert({
        workspace_id: ctx.workspaceId,
        actor_id: ctx.user.id,
        proposal_id: proposal.id,
        event_type: "execution_failed",
        details: { mode: "simulation", attempt_id: attemptId, provider: "mock_simulator" },
      });
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run simulation." }, { status: 400 });
  }
}
