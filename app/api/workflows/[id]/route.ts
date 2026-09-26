import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";

function workflowIdCandidates(rawId: string) {
  const decoded = decodeURIComponent(rawId);
  const candidates = [decoded];

  const dotToColon = decoded.replace(/^([^.:/]+)\.(.+)$/, "$1:$2");
  const colonToDot = decoded.replace(/^([^.:/]+):(.+)$/, "$1.$2");

  if (dotToColon !== decoded) candidates.push(dotToColon);
  if (colonToDot !== decoded) candidates.push(colonToDot);

  return [...new Set(candidates)];
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await getWorkspaceStore();
  const rawId = (await params).id;

  let workflow: Awaited<ReturnType<typeof store.workflows.get>> = null;
  for (const candidate of workflowIdCandidates(rawId)) {
    workflow = await s.workflows.get(candidate);
    if (workflow) break;
  }

  if (!workflow) {
    return NextResponse.json(
      { error: "Workflow not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    workflow,
    contracts: await s.contracts.list(workflow.id),
    events: await s.events.list(workflow.id),
    incidents: await s.incidents.list(workflow.id),
  });
}

