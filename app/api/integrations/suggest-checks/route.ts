import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { suggestChecks } from "@/lib/suggested-checks";

const MAX_BYTES = 2_000_000;

// POST { workflow: <n8n export object or JSON string> } -> suggested outcome checks. Reads nothing from n8n, stores nothing.
export async function POST(request: Request) {
  try {
    await getWorkspaceStore(); // same sign-in requirement as the other integration routes
    const text = await request.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "That file is too large (2 MB limit)." }, { status: 413 });
    let body: any;
    try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Send JSON: { \"workflow\": ... }" }, { status: 400 }); }
    const result = suggestChecks(body?.workflow);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ error: "Could not analyse this workflow." }, { status: 500 });
  }
}
