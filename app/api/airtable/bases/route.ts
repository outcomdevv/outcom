import { NextResponse } from "next/server";
import { AirtableError, listAirtableBases } from "@/lib/airtable";
import { getStoredToken } from "@/lib/token-store";

// GET -> the Airtable bases this connection can read, so nobody has to paste a link.
export async function GET() {
  try {
    const token = await getStoredToken("airtable");
    if (!token) return NextResponse.json({ error: "Connect Airtable first." }, { status: 400 });
    return NextResponse.json({ bases: await listAirtableBases(token) });
  } catch (e) {
    const status = e instanceof AirtableError && e.status >= 400 && e.status < 500 ? e.status : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read Airtable." }, { status });
  }
}
