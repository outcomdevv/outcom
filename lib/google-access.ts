import { getValidAccessToken } from "@/lib/oauth";
import { getServiceAccountToken, loadServiceAccount } from "@/lib/google-service-account";

export type GoogleAccess = "oauth" | "service_account";

/**
 * Picks the Google token for a spreadsheet request.
 * - access "service_account": always the robot account (customer shared the sheet with it).
 * - otherwise: the connected Google account; if none is connected but the robot account exists, fall back to it
 *   (the picker can only open pasted links in that mode, it cannot browse Drive).
 * Returns null when neither is available.
 */
export async function resolveGoogleToken(opts: { workspaceId?: string; access?: GoogleAccess } = {}): Promise<{ token: string; access: GoogleAccess } | null> {
  if (opts.access === "service_account") return { token: await getServiceAccountToken(), access: "service_account" };
  const oauth = await getValidAccessToken("google_sheets", opts.workspaceId);
  if (oauth) return { token: oauth, access: "oauth" };
  if (loadServiceAccount()) return { token: await getServiceAccountToken(), access: "service_account" };
  return null;
}
