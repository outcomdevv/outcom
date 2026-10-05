// Google service account access ("share your sheet with Outcom's robot email").
// The customer shares a spreadsheet with our robot address as Viewer. No Google sign-in, no OAuth app review.
// Read-only scope. Pure + fetch/clock-injected so it can be unit-tested without Google.
import { createSign } from "node:crypto";

export const SERVICE_ACCOUNT_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type ServiceAccount = { email: string; privateKey: string };
type Fetch = typeof fetch;

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/**
 * Reads GOOGLE_SERVICE_ACCOUNT_JSON: the downloaded key file, either raw JSON or base64 of it.
 * Returns null when not configured or malformed (so the UI can say "not set up" instead of crashing).
 */
export function loadServiceAccount(raw: string | undefined = process.env.GOOGLE_SERVICE_ACCOUNT_JSON): ServiceAccount | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const attempts = [text, (() => { try { return Buffer.from(text, "base64").toString("utf8"); } catch { return ""; } })()];
  for (const candidate of attempts) {
    try {
      const j = JSON.parse(candidate);
      const email = typeof j?.client_email === "string" ? j.client_email.trim() : "";
      // Vercel env UIs often turn real newlines into the two characters \n.
      const privateKey = typeof j?.private_key === "string" ? j.private_key.replace(/\\n/g, "\n") : "";
      if (email && privateKey.includes("BEGIN PRIVATE KEY")) return { email, privateKey };
    } catch { /* try the next form */ }
  }
  return null;
}

export const serviceAccountEmail = () => loadServiceAccount()?.email ?? null;

export function signServiceAccountJwt(sa: ServiceAccount, nowSeconds: number, scope = SERVICE_ACCOUNT_SCOPE): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.email, scope, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.privateKey);
  return `${header}.${claims}.${b64url(signature)}`;
}

let cached: { email: string; token: string; expiresAt: number } | null = null;
export const clearServiceAccountTokenCache = () => { cached = null; };

export class ServiceAccountError extends Error {
  constructor(public kind: "not_configured" | "rejected" | "upstream", message: string) { super(message); this.name = "ServiceAccountError"; }
}

/** Access token for the robot account (cached ~55 minutes). Throws ServiceAccountError, never leaks the key. */
export async function getServiceAccountToken(opts: { fetchImpl?: Fetch; now?: () => number; sa?: ServiceAccount | null } = {}): Promise<string> {
  const sa = opts.sa === undefined ? loadServiceAccount() : opts.sa;
  if (!sa) throw new ServiceAccountError("not_configured", "Outcom's Google robot account is not set up on this deployment (GOOGLE_SERVICE_ACCOUNT_JSON).");
  const now = (opts.now ?? Date.now)();
  if (cached && cached.email === sa.email && cached.expiresAt - 60_000 > now) return cached.token;

  let assertion: string;
  try { assertion = signServiceAccountJwt(sa, Math.floor(now / 1000)); }
  catch { throw new ServiceAccountError("rejected", "The Google service-account private key could not be used. Re-download the key file and set it again."); }

  const body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  let r: Response;
  try {
    r = await (opts.fetchImpl ?? fetch)(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  } catch { throw new ServiceAccountError("upstream", "Could not reach Google to get a token."); }
  const j: any = await r.json().catch(() => null);
  if (!r.ok || typeof j?.access_token !== "string") {
    const kind = r.status >= 500 ? "upstream" : "rejected";
    throw new ServiceAccountError(kind, kind === "upstream" ? "Google token service is unavailable." : "Google rejected the service-account credentials.");
  }
  const ttl = Number(j.expires_in);
  cached = { email: sa.email, token: j.access_token, expiresAt: now + (Number.isFinite(ttl) && ttl > 0 ? ttl : 3600) * 1000 };
  return cached.token;
}
