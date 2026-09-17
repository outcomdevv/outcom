import { NextResponse } from "next/server";
import { protectMakeScenario } from "@/lib/make-monitor";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scenarioId = String(body.workflowId || body.scenarioId || "").trim();
    if (!scenarioId) return NextResponse.json({ protected: false, error: "Make scenario ID is required." }, { status: 400 });
    return NextResponse.json(await protectMakeScenario(scenarioId));
  } catch (error) {
    return NextResponse.json({ protected: false, error: error instanceof Error ? error.message : "Make protection failed." }, { status: 400 });
  }
}
