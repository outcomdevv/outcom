import { NextResponse } from "next/server";
import { listN8nWorkflows } from "@/lib/adapters/n8n";

export async function GET() {
  try {
    const result = await listN8nWorkflows();
    return NextResponse.json({ connected: result.connected, items: result.items.map((item) => ({ ...item, platform: "n8n", url: null })) });
  } catch (error) {
    return NextResponse.json({ connected: false, items: [], error: error instanceof Error ? error.message : "n8n discovery failed" }, { status: 502 });
  }
}
