import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { getInboundWebhookByToken, touchInboundWebhook } from "@/lib/webhooks";
import { evaluateEvent } from "@/lib/outcome-checker";`r`n`r`nexport const runtime = "nodejs";`r`nexport const dynamic = "force-dynamic";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]) {
  return values.find((value) => typeof value === "string" && value.trim()) as string | undefined;
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "This is an inbound POST webhook. Send a JSON execution event to this URL." }, { status: 405 });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || token.length < 32) return NextResponse.json({ error: "Invalid webhook." }, { status: 404 });
    const endpoint = await getInboundWebhookByToken(token);
    if (!endpoint) return NextResponse.json({ error: "Webhook not found or disabled." }, { status: 404 });

    const raw = await request.text();
    let parsed: unknown = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ error: "Webhook body must be valid JSON." }, { status: 400 }); }
    const body = object(parsed);
    const data = object(body.data);
    const headers = request.headers;
    const executionId = firstString(
      headers.get("x-outcom-execution-id"),
      headers.get("idempotency-key"),
      body.execution_id,
      body.executionId,
      body.run_id,
      body.runId,
      body.event_id,
      body.eventId,
      body.id,
    ) || `inbound:${crypto.createHash("sha256").update(raw || JSON.stringify(body)).digest("hex")}`;
    const timestampRaw = firstString(body.timestamp, body.occurred_at, body.occurredAt, body.created_at, body.createdAt);
    const parsedTimestamp = timestampRaw ? new Date(timestampRaw) : new Date();
    const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date().toISOString() : parsedTimestamp.toISOString();
    const statusRaw = firstString(body.status, body.execution_status, body.executionStatus)?.toLowerCase();
    const status = statusRaw === "failed" || statusRaw === "error" || body.success === false ? "failed" : "success";
    const targetRecordId = firstString(
      body.target_record_id,
      body.targetRecordId,
      body.contact_id,
      body.contactId,
      data.target_record_id,
      data.targetRecordId,
      data.contact_id,
      data.contactId,
    );

    if (body.test === true || data.test === true) {
      await touchInboundWebhook(endpoint.id, endpoint.workspace_id);
      return NextResponse.json({ ok: true, test: true, provider: endpoint.provider, workflowId: endpoint.workflow_id, message: "Outcom received the test webhook." });
    }

    const store = await getWorkspaceStore(endpoint.workspace_id);
    const workflow = await store.workflows.get(endpoint.workflow_id);
    if (!workflow) return NextResponse.json({ error: "Protected workflow no longer exists." }, { status: 410 });
    const duplicate = await store.events.getByExecution(workflow.id, executionId);
    if (duplicate) {
      await touchInboundWebhook(endpoint.id, endpoint.workspace_id);
      return NextResponse.json({ ok: true, duplicate: true, eventId: duplicate.id, executionId });
    }

    const event = await store.events.create({
      workflowId: workflow.id,
      executionId,
      timestamp,
      platform: endpoint.provider,
      status,
      data: {
        ...body,
        ...data,
        ...(targetRecordId ? { target_record_id: targetRecordId, contact_id: targetRecordId } : {}),
      },
      metadata: {
        ...(object(body.metadata)),
        source: `${endpoint.provider}-inbound-webhook`,
        webhook_endpoint_id: endpoint.id,
        received_at: new Date().toISOString(),
      },
    });
    const results = await evaluateEvent(event);
    await touchInboundWebhook(endpoint.id, endpoint.workspace_id);
    return NextResponse.json({ ok: true, duplicate: false, eventId: event.id, executionId, status, results }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, { status: 400 });
  }
}

