import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";

const PROVIDERS = new Set(["zapier", "make"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = String(body.provider || "").trim();
    const externalId = String(body.externalId || "").trim();
    const name = String(body.name || "").trim();
    const expectedOutcome = String(body.expectedOutcome || "").trim();
    if (!PROVIDERS.has(provider)) return NextResponse.json({ protected: false, error: "Webhook protection is supported for Zapier and Make." }, { status: 400 });
    if (!externalId || !name) return NextResponse.json({ protected: false, error: "Workflow ID and name are required." }, { status: 400 });

    const store = await getWorkspaceStore();
    const localId = `${provider}:${externalId}`;
    const workflow = await store.workflows.get(localId) || await store.workflows.create({
      id: localId,
      name,
      platform: provider,
      description: expectedOutcome ? `Protected by Outcom · ${expectedOutcome}` : "Protected by Outcom · inbound execution observer",
    });
    const contracts = await store.contracts.list(workflow.id);
    const hasRecordContract = contracts.some((c) => c.type === "record_exists" && c.configuration?.mode === "inbound_webhook");
    const createdContracts = hasRecordContract ? [] : [await store.contracts.create({
      workflowId: workflow.id,
      name: "Downstream business record exists",
      type: "record_exists",
      system: "ghl",
      entity: "contact",
      configuration: {
        mode: "inbound_webhook",
        expectedOutcome: expectedOutcome || null,
        lookup: { field: "id", valueFrom: "event.data.target_record_id" },
      },
      severity: "high",
      enabled: true,
    })];

    await store.monitors.upsert({ workflowId: workflow.id, provider, externalId, mode: "inbound_webhook", metadata: { expectedOutcome: expectedOutcome || null } });
    return NextResponse.json({ protected: true, workflow, createdContracts });
  } catch (error) {
    return NextResponse.json({ protected: false, error: error instanceof Error ? error.message : "Could not protect workflow." }, { status: 400 });
  }
}
