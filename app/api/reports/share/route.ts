import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { SHARE_DAYS, createShare, listShares, revokeShare } from "@/lib/report-shares";

export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function workspace() {
  try { return await getWorkspaceStore(); } catch { return null; }
}

export async function GET() {
  const store = await workspace();
  if (!store) return fail("Sign in required.", 401);
  try { return NextResponse.json({ shares: await listShares(store.workspaceId) }); }
  catch (e) { return fail(e instanceof Error ? e.message : "Could not load links.", 500); }
}

export async function POST(request: Request) {
  const store = await workspace();
  if (!store) return fail("Sign in required.", 401);
  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 80);
  const preparedBy = String(body.preparedBy ?? "").trim().slice(0, 80);
  const days = Number(body.days ?? 30);
  if (!title) return fail("Give the report a title, for example the client name.");
  if (!SHARE_DAYS.includes(days as (typeof SHARE_DAYS)[number])) return fail("Period must be 7, 30 or 90 days.");
  const requested: string[] = Array.isArray(body.workflowIds) ? body.workflowIds.map(String) : [];
  const own = new Set((await store.workflows.list()).map((w) => w.id));
  if (requested.some((id) => !own.has(id))) return fail("Unknown workflow in selection.");
  try { return NextResponse.json({ share: await createShare(store.workspaceId, { title, preparedBy, workflowIds: [...new Set(requested)], days }) }); }
  catch (e) { return fail(e instanceof Error ? e.message : "Could not create the link.", 500); }
}

export async function DELETE(request: Request) {
  const store = await workspace();
  if (!store) return fail("Sign in required.", 401);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return fail("id is required.");
  try { await revokeShare(store.workspaceId, id); return NextResponse.json({ ok: true }); }
  catch (e) { return fail(e instanceof Error ? e.message : "Could not revoke the link.", 500); }
}
