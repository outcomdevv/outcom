import { NextResponse } from "next/server";
import { protectN8nWorkflow } from "@/lib/n8n-monitor";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workflowId = String(body.workflowId || "");
    const expectedOutcome = String(body.expectedOutcome || "").trim();
    if (!workflowId) return NextResponse.json({ error: "workflowId is required" }, { status: 400 });
    return NextResponse.json(await protectN8nWorkflow(workflowId, undefined, expectedOutcome || undefined));
  } catch (error) {
    return NextResponse.json({ protected: false, error: error instanceof Error ? error.message : "Could not protect workflow" }, { status: 502 });
  }
}
