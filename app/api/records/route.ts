import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";

export async function GET() {
  try {
    const store = await getWorkspaceStore();
    const db = await import("@/lib/supabase/server").then((m) => m.createSupabaseServiceClient());
    const { data, error } = await db.from("contacts").select("id,name,tags,status,created_at").eq("workspace_id", store.workspaceId).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ records: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load records." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const status = String(body.status || "new").trim();
    const tags = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [];
    if (!id) return NextResponse.json({ error: "Record ID is required." }, { status: 400 });
    const store = await getWorkspaceStore();
    const record = await store.contacts.upsert({ id, name: name || "Unknown", status, tags });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create record." }, { status: 400 });
  }
}
