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
    const expectedOutcomes = Array.isArray(body.expectedOutcomes)
      ? body.expectedOutcomes.filter((x: any) => x && typeof x === "object" && typeof x.label === "string")
      : [];
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
    const requested = expectedOutcomes.length
      ? expectedOutcomes
      : [{ label: expectedOutcome || "Downstream business record exists", type: "record_exists" }];
    const createdContracts: any[] = [];

    for (const item of requested) {
      const type = item.type === "state_invariant" || item.type === "output_count" ? item.type : "record_exists";
      const label = String(item.label || "Business outcome").trim();
      const alreadyExists = contracts.some((c) => c.type === type && c.configuration?.expectedOutcome === label);
      if (alreadyExists) continue;

      if (type === "output_count") {
        createdContracts.push(await store.contracts.create({
          workflowId: workflow.id, name: label, type: "output_count", system: "event", entity: "output",
          configuration: { mode: "inbound_webhook", expectedOutcome: label, expected: { operator: "greater_than", value: 0 } },
          severity: "high", enabled: true,
        }));
      } else if (type === "state_invariant") {
        createdContracts.push(await store.contracts.create({
          workflowId: workflow.id, name: label, type: "state_invariant", system: "ghl", entity: "contact",
          configuration: { mode: "preserve_tags", inbound_webhook: true, expectedOutcome: label, field: "tags", lookup: { field: "id", valueFrom: "event.data.target_record_id" } },
          severity: "high", enabled: true,
        }));
      } else {
        createdContracts.push(await store.contracts.create({
          workflowId: workflow.id, name: label, type: "record_exists", system: "ghl", entity: "contact",
          configuration: { mode: "inbound_webhook", expectedOutcome: label, lookup: { field: "id", valueFrom: "event.data.target_record_id" } },
          severity: "high", enabled: true,
        }));
      }
    }

    await store.monitors.upsert({ workflowId: workflow.id, provider, externalId, mode: "inbound_webhook", metadata: { expectedOutcome: expectedOutcome || null, expectedOutcomes: requested } });
    return NextResponse.json({ protected: true, workflow, createdContracts, outcomes: requested });
  } catch (error) {
    return NextResponse.json({ protected: false, error: error instanceof Error ? error.message : "Could not protect workflow." }, { status: 400 });
  }
}
