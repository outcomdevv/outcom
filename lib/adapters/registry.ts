import { ghlAdapter } from "@/lib/adapters/ghl";
import { MockCRMAdapter } from "@/lib/adapters/mock-crm";
import type { DownstreamAdapter } from "@/lib/adapters/types";
import { GoogleSheetsAdapter, parseSheetTarget } from "@/lib/google-sheets";
import { getValidAccessToken } from "@/lib/oauth";

/** A downstream (system-of-truth) adapter factory. `target` is the per-contract configuration (e.g. which spreadsheet). */
export type AdapterFactory = (workspaceId?: string, target?: unknown) => Promise<DownstreamAdapter> | DownstreamAdapter;

const factories = new Map<string, AdapterFactory>([
  ["mock_crm", () => new MockCRMAdapter()],
  ["ghl", (workspaceId) => ghlAdapter(workspaceId)],
  ["google_sheets", async (workspaceId, target) => {
    const parsed = parseSheetTarget(target);
    if (!parsed) throw new Error("Google Sheets target is not configured for this outcome.");
    const token = await getValidAccessToken("google_sheets", workspaceId);
    if (!token) throw new Error("Google is not connected.");
    return new GoogleSheetsAdapter(token, parsed);
  }],
]);

export function registerAdapter(system: string, factory: AdapterFactory) { factories.set(system, factory); }
export function hasAdapter(system: string) { return factories.has(system); }
export async function adapterFor(system: string, workspaceId?: string, target?: unknown): Promise<DownstreamAdapter> {
  const factory = factories.get(system);
  if (!factory) throw new Error(`Unsupported downstream system: ${system}`);
  return factory(workspaceId, target);
}
