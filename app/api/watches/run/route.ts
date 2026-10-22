import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { runWatches } from "@/lib/watch-runner";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let store;
  try { store = await getWorkspaceStore(); } catch { return NextResponse.json({ error: "Sign in required." }, { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  try { return NextResponse.json({ runs: await runWatches(store.workspaceId, typeof body.workflowId === "string" ? body.workflowId : undefined) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not run the watches." }, { status: 500 }); }
}
