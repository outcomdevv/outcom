import { ghlAdapter } from "@/lib/adapters/ghl";
import { MockCRMAdapter } from "@/lib/adapters/mock-crm";
import type { DownstreamAdapter } from "@/lib/adapters/types";
import { GoogleSheetsAdapter, parseSheetTarget } from "@/lib/google-sheets";
import { resolveGoogleToken } from "@/lib/google-access";
import { AirtableAdapter, parseAirtableTarget } from "@/lib/airtable";
import { HubspotAdapter, parseHubspotTarget } from "@/lib/hubspot";
import { getStoredToken } from "@/lib/token-store";

/** A downstream (system-of-truth) adapter factory. `target` is the per-contract configuration (e.g. which spreadsheet). */
export type AdapterFactory = (workspaceId?: string, target?: unknown) => Promise<DownstreamAdapter> | DownstreamAdapter;

const factories = new Map<string, AdapterFactory>([
  ["mock_crm", () => new MockCRMAdapter()],
  ["ghl", (workspaceId) => ghlAdapter(workspaceId)],
  ["airtable", async (workspaceId, target) => {
    const parsed = parseAirtableTarget(target);
    if (!parsed) throw new Error("Airtable table is not configured for this outcome.");
    const token = await getStoredToken("airtable", workspaceId);
    if (!token) throw new Error("Airtable is not connected.");
    return new AirtableAdapter(token, parsed);
  }],
  ["hubspot", async (workspaceId, target) => {
    const token = await getStoredToken("hubspot", workspaceId);
    if (!token) throw new Error("HubSpot is not connected.");
    return new HubspotAdapter(token, parseHubspotTarget(target));
  }],
  ["google_sheets", async (workspaceId, target) => {
    const parsed = parseSheetTarget(target);
    if (!parsed) throw new Error("Google Sheets target is not configured for this outcome.");
    const access = await resolveGoogleToken({ workspaceId, access: parsed.access });
    if (!access) throw new Error("Google is not connected and Outcom's robot account is not set up.");
    return new GoogleSheetsAdapter(access.token, parsed);
  }],
]);

export function registerAdapter(system: string, factory: AdapterFactory) { factories.set(system, factory); }
export function hasAdapter(system: string) { return factories.has(system); }
export async function adapterFor(system: string, workspaceId?: string, target?: unknown): Promise<DownstreamAdapter> {
  const factory = factories.get(system);
  if (!factory) throw new Error(`Unsupported downstream system: ${system}`);
  return factory(workspaceId, target);
}
