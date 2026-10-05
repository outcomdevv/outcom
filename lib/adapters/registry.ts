import { ghlAdapter } from "@/lib/adapters/ghl";
import { MockCRMAdapter } from "@/lib/adapters/mock-crm";
import type { DownstreamAdapter } from "@/lib/adapters/types";
import { GoogleSheetsAdapter, parseSheetTarget } from "@/lib/google-sheets";
import { resolveGoogleToken } from "@/lib/google-access";

/** A downstream (system-of-truth) adapter factory. `target` is the per-contract configuration (e.g. which spreadsheet). */
export type AdapterFactory = (workspaceId?: string, target?: unknown) => Promise<DownstreamAdapter> | DownstreamAdapter;

const factories = new Map<string, AdapterFactory>([
  ["mock_crm", () => new MockCRMAdapter()],
  ["ghl", (workspaceId) => ghlAdapter(workspaceId)],
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
