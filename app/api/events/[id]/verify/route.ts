import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { evaluateEvent } from "@/lib/outcome-checker";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = await getWorkspaceStore();
    const event = await store.events.get(id);
    if (!event) return NextResponse.json({ verified: false, error: "Execution not found." }, { status: 404 });
    const results = await evaluateEvent(event, store.workspaceId);
    const openIncidents = (await store.incidents.list(event.workflowId)).filter((incident) => incident.eventId === event.id && incident.status === "open");
    return NextResponse.json({ verified: results.every((result) => result.state === "passed"), event, results, openIncidents });
  } catch (error) {
    return NextResponse.json({ verified: false, error: error instanceof Error ? error.message : "Verification failed." }, { status: 400 });
  }
}
