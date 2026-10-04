import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { getOrCreateInboundWebhook, type InboundProvider } from "@/lib/webhooks";
import { isInboundSource } from "@/lib/integrations/registry";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = String(body.provider || "") as InboundProvider;
    const workflowId = String(body.workflowId || "").trim();
    if (!isInboundSource(provider)) return NextResponse.json({ error: "This platform is not supported for inbound webhooks." }, { status: 400 });
    if (!workflowId) return NextResponse.json({ error: "workflowId is required." }, { status: 400 });

    const store = await getWorkspaceStore();
    const workflow = await store.workflows.get(workflowId);
    if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    if (workflow.platform !== provider) return NextResponse.json({ error: `Workflow platform is ${workflow.platform}, not ${provider}.` }, { status: 400 });

    const endpoint = await getOrCreateInboundWebhook(store.workspaceId, workflowId, provider);
    return NextResponse.json({
      ...endpoint,
      provider,
      workflow: { id: workflow.id, name: workflow.name },
      sample: {
        execution_id: "your-unique-run-id",
        timestamp: new Date().toISOString(),
        status: "success",
        target_record_id: "the-id-or-key-of-the-record-this-run-created-or-updated",
        data: { source: provider, target_record_id: "the-id-or-key-of-the-record-this-run-created-or-updated" },
        metadata: { outcom: "v60" },
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create webhook endpoint." }, { status: 400 });
  }
}
