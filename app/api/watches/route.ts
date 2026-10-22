import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { parseWatch, watchLabel, watchMode } from "@/lib/watches";

export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
async function workspace() { try { return await getWorkspaceStore(); } catch { return null; } }

export async function POST(request: Request) {
  const store = await workspace();
  if (!store) return fail("Sign in required.", 401);
  const body = await request.json().catch(() => ({}));
  const workflowId = String(body.workflowId ?? "").trim();
  const workflow = workflowId ? await store.workflows.get(workflowId) : null;
  if (!workflow) return fail("Workflow not found.", 404);
  const parsed = parseWatch(body);
  if (!parsed.ok) return fail(parsed.error);
  let otherName: string | undefined;
  if (parsed.mode === "watch_reconcile") {
    const otherId = String(parsed.configuration.otherWorkflowId);
    if (otherId === workflowId) return fail("Choose a different workflow to compare with.");
    const other = await store.workflows.get(otherId);
    if (!other) return fail("The workflow to compare with was not found.");
    otherName = other.name;
  }
  const created = await store.contracts.create({ workflowId, name: watchLabel(parsed.mode, parsed.configuration, otherName), type: "state_invariant", system: "event", entity: "watch", configuration: parsed.configuration, severity: "high", enabled: true });
  return NextResponse.json({ watch: created });
}

export async function PATCH(request: Request) {
  const store = await workspace();
  if (!store) return fail("Sign in required.", 401);
  const body = await request.json().catch(() => ({}));
  const c = await store.contracts.get(String(body.id ?? ""));
  if (!c || !watchMode(c)) return fail("Watch not found.", 404);
  await store.contracts.setEnabled(c.id, Boolean(body.enabled));
  return NextResponse.json({ ok: true });
}
