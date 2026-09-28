import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import type { ContractType, OutcomeContract, Severity } from "@/lib/contracts/types";

const types = new Set<ContractType>(["record_exists", "state_invariant", "output_count"]);
const systems = new Set(["outcom_records", "google_sheets", "ghl"]);

export async function GET() {
  try {
    const store = await getWorkspaceStore();
    return NextResponse.json({ contracts: await store.contracts.list() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workflowId = String(body.workflowId || "").trim();
    const name = String(body.name || "").trim();
    const type = String(body.type || "record_exists") as ContractType;
    const system = String(body.system || "outcom_records").trim();
    const entity = String(body.entity || "record").trim();
    const severity = String(body.severity || "high") as Severity;
    const configuration = body.configuration && typeof body.configuration === "object" ? body.configuration : {};
    if (!workflowId || !name) return NextResponse.json({ error: "Workflow and contract name are required." }, { status: 400 });
    if (!types.has(type)) return NextResponse.json({ error: "Unsupported outcome contract type." }, { status: 400 });
    if (!systems.has(system)) return NextResponse.json({ error: "Unsupported business system." }, { status: 400 });
    const store = await getWorkspaceStore();
    const workflow = await store.workflows.get(workflowId);
    if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    if (system === "google_sheets") {
      const connection = (await store.connections.list()).find((x) => x.provider === "google_sheets");
      if (!connection) return NextResponse.json({ error: "Connect Google Sheets before creating a Sheets contract." }, { status: 400 });
      const metadata = connection.metadata || {};
      if (!metadata.spreadsheetId || !metadata.sheetName || !metadata.lookupField) return NextResponse.json({ error: "Configure a Google Sheet and its lookup column first." }, { status: 400 });
    }
    const contract = await store.contracts.create({
      workflowId,
      name,
      type,
      system,
      entity,
      configuration,
      severity,
      enabled: true,
    } satisfies Omit<OutcomeContract, "id" | "createdAt" | "updatedAt">);
    return NextResponse.json({ contract });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create outcome contract." }, { status: 400 });
  }
}
