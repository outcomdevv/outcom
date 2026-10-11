import { NextResponse } from "next/server";
import { DEFAULT_CONTACT_PROPERTIES, listContactProperties } from "@/lib/hubspot";
import { getStoredToken } from "@/lib/token-store";

// GET -> contact property names to pick from (falls back to the common ones).
export async function GET() {
  try {
    const token = await getStoredToken("hubspot");
    if (!token) return NextResponse.json({ error: "Connect HubSpot first." }, { status: 400 });
    return NextResponse.json({ properties: await listContactProperties(token) });
  } catch {
    return NextResponse.json({ properties: DEFAULT_CONTACT_PROPERTIES });
  }
}
