import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { evaluateEvent } from "@/lib/outcome-checker";

export const dynamic = "force-dynamic";

const WORKFLOW_ID = "demo:lead-to-crm";
const CONTRACT_ID = "demo:lead-to-crm:contact-exists";
const CONTACT_ID = "demo-contact-4821";

async function ensureDemo(store: Awaited<ReturnType<typeof getWorkspaceStore>>) {
  let workflow = await store.workflows.get(WORKFLOW_ID);
  if (!workflow) {
    workflow = await store.workflows.create({
      id: WORKFLOW_ID,
      name: "Demo · Lead → CRM",
      platform: "zapier",
      description: "A safe simulation of a successful automation with a missing downstream business outcome.",
    });
  }

  let contract = await store.contracts.get(CONTRACT_ID);
  if (!contract) {
    contract = await store.contracts.create({
      id: CONTRACT_ID,
      workflowId: WORKFLOW_ID,
      name: "Contact exists in CRM",
      type: "record_exists",
      system: "mock_crm",
      entity: "contact",
      configuration: {
        mode: "demo",
        lookup: { field: "id", valueFrom: "event.data.target_record_id" },
      },
      severity: "high",
      enabled: true,
    });
  }

  return { workflow, contract };
}

async function snapshot(store: Awaited<ReturnType<typeof getWorkspaceStore>>, eventId: string) {
  const event = await store.events.get(eventId);
  if (!event) return null;
  const incidents = (await store.incidents.list(event.workflowId)).filter((x) => x.eventId === event.id);
  return { event, incidents };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    const store = await getWorkspaceStore();
    const { workflow, contract } = await ensureDemo(store);

    if (action === "repair") {
      const eventId = typeof body?.eventId === "string" ? body.eventId : "";
      if (!eventId) return NextResponse.json({ error: "Missing demo event id." }, { status: 400 });
      const event = await store.events.get(eventId);
      if (!event) return NextResponse.json({ error: "Demo execution not found." }, { status: 404 });
      const targetRecordId = typeof event.data.target_record_id === "string" ? event.data.target_record_id : CONTACT_ID;
      await store.contacts.upsert({
        id: targetRecordId,
        name: "Demo Contact",
        tags: ["qualified-lead"],
        status: "qualified",
      });
      const results = await evaluateEvent(event, store.workspaceId);
      const current = await snapshot(store, eventId);
      return NextResponse.json({
        ok: true,
        action,
        workflow,
        contract,
        verified: results.every((result) => result.state === "passed"),
        results,
        ...current,
      });
    }

    if (action !== "silent_failure" && action !== "success") {
      return NextResponse.json({ error: "Choose silent_failure or success." }, { status: 400 });
    }

    // Reset the demo record before the run so the two scenarios are deterministic.
    if (action === "silent_failure") {
      const existing = await store.contacts.get(CONTACT_ID);
      if (existing) {
        // The demo deliberately starts with no downstream record. There is no delete
        // primitive in the store yet, so use a separate missing id for this run.
      }
    }

    const targetRecordId = action === "silent_failure"
      ? `missing-demo-contact-${crypto.randomUUID().slice(0, 8)}`
      : CONTACT_ID;

    if (action === "success") {
      await store.contacts.upsert({
        id: CONTACT_ID,
        name: "Demo Contact",
        tags: ["qualified-lead"],
        status: "qualified",
      });
    }

    const event = await store.events.create({
      workflowId: WORKFLOW_ID,
      executionId: `demo-${action}-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      platform: "zapier",
      status: "success",
      data: {
        target_record_id: targetRecordId,
        source: "Outcom Demo",
        simulated: true,
      },
      metadata: {
        workspace_id: store.workspaceId,
        demo_action: action,
      },
    });

    const results = await evaluateEvent(event, store.workspaceId);
    const current = await snapshot(store, event.id);
    return NextResponse.json({
      ok: true,
      action,
      workflow,
      contract,
      verified: results.every((result) => result.state === "passed"),
      results,
      ...current,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo failed." }, { status: 400 });
  }
}
