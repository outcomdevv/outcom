import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { getOrCreateInboundWebhook, type InboundProvider } from "@/lib/webhooks";

const PROVIDERS = new Set<InboundProvider>(["zapier", "make"]);

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const provider = String(params.get("provider") || "") as InboundProvider;
    const workflowId = String(params.get("workflowId") || "").trim();

    if (!PROVIDERS.has(provider)) {
      return NextResponse.json({ error: "Unsupported webhook provider." }, { status: 400 });
    }
    if (!workflowId) {
      return NextResponse.json({ error: "workflowId is required." }, { status: 400 });
    }

    const store = await getWorkspaceStore();
    const workflow = await store.workflows.get(workflowId);
    if (!workflow || workflow.platform !== provider) {
      return NextResponse.json({ error: "Protected workflow not found." }, { status: 404 });
    }

    const endpoint = await getOrCreateInboundWebhook(store.workspaceId, workflowId, provider);
    return NextResponse.json({
      provider,
      workflowId,
      lastReceivedAt: endpoint.lastReceivedAt,
      enabled: endpoint.enabled,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read webhook status." },
      { status: 400 }
    );
  }
}
