import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Number of open findings, for the badge in the menu and the header. */
export async function GET() {
  try {
    const store = await getWorkspaceStore();
    const open = (await store.incidents.list()).filter((i) => i.status === "open").length;
    return NextResponse.json({ open }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
}
