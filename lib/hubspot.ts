// HubSpot contacts as a read-only "system of truth". Pure + fetch-injected so it can be unit-tested with mocked responses.
// The customer pastes a Private App token with the crm.objects.contacts.read scope.
import type { DownstreamAdapter } from "@/lib/adapters/types";

export type HubspotTarget = { keyProperty: string; properties?: string[] };
export const DEFAULT_CONTACT_PROPERTIES = ["email", "firstname", "lastname", "phone", "company", "jobtitle", "lifecyclestage", "hs_lead_status"];

export class HubspotError extends Error {
  constructor(public kind: "reauth_required" | "forbidden" | "bad_property" | "rate_limited" | "upstream", public status: number, message: string) { super(message); this.name = "HubspotError"; }
}

const API = "https://api.hubapi.com";
type Fetch = typeof fetch;

function classify(status: number, property?: string): HubspotError {
  if (status === 401) return new HubspotError("reauth_required", 401, "HubSpot rejected the token. Paste a new one.");
  if (status === 403) return new HubspotError("forbidden", 403, "This HubSpot token cannot read contacts. Add the crm.objects.contacts.read scope to the private app.");
  if (status === 400) return new HubspotError("bad_property", 400, property ? `HubSpot has no contact property called “${property}”.` : "HubSpot could not read that property.");
  if (status === 429) return new HubspotError("rate_limited", 429, "HubSpot rate limit reached. Try again shortly.");
  return new HubspotError("upstream", status, `HubSpot returned HTTP ${status}.`);
}

async function call(path: string, token: string, f: Fetch, init: { method?: string; body?: unknown } = {}, property?: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await f(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store", signal: controller.signal,
    });
    if (r.status === 404) return null;
    if (!r.ok) throw classify(r.status, property);
    return await r.json();
  } catch (e) {
    if (e instanceof HubspotError) throw e;
    throw new HubspotError("upstream", 0, "Could not reach HubSpot (network or timeout).");
  } finally { clearTimeout(timer); }
}

export function parseHubspotTarget(raw: unknown): HubspotTarget {
  const t: any = raw && typeof raw === "object" ? raw : {};
  const key = typeof t.keyProperty === "string" && t.keyProperty.trim() ? t.keyProperty.trim().toLowerCase() : "email";
  const extra = Array.isArray(t.properties) ? t.properties.filter((x: unknown): x is string => typeof x === "string" && /^[a-z0-9_]+$/i.test(x)).map((x: string) => x.toLowerCase()) : [];
  return { keyProperty: key, ...(extra.length ? { properties: extra } : {}) };
}

/** Contact property names the customer can check (best effort; needs crm.schemas.contacts.read, falls back to common ones). */
export async function listContactProperties(token: string, opts: { fetchImpl?: Fetch } = {}): Promise<string[]> {
  try {
    const body = await call("/crm/v3/properties/contacts", token, opts.fetchImpl ?? fetch);
    const names = (Array.isArray(body?.results) ? body.results : []).map((p: any) => String(p.name)).filter(Boolean);
    return names.length ? names.sort() : DEFAULT_CONTACT_PROPERTIES;
  } catch { return DEFAULT_CONTACT_PROPERTIES; }
}

export class HubspotAdapter implements DownstreamAdapter {
  /** HubSpot search is indexed a few seconds after a write, so a "not found" is retried before it is believed. */
  constructor(private token: string, private target: HubspotTarget, private fetchImpl: Fetch = fetch, private retryMs = 2000, private retries = 2) {}

  private get properties() { return Array.from(new Set([...DEFAULT_CONTACT_PROPERTIES, this.target.keyProperty, ...(this.target.properties ?? [])])).filter(p => p !== "id"); }

  private async lookup(value: string) {
    const props = this.properties;
    if (this.target.keyProperty === "id") {
      const r = await call(`/crm/v3/objects/contacts/${encodeURIComponent(value)}?properties=${encodeURIComponent(props.join(","))}`, this.token, this.fetchImpl);
      return r ? { id: String(r.id), ...(r.properties ?? {}) } : null;
    }
    const v = this.target.keyProperty === "email" ? value.toLowerCase() : value;
    const body = await call("/crm/v3/objects/contacts/search", this.token, this.fetchImpl, {
      method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: this.target.keyProperty, operator: "EQ", value: v }] }], properties: props, limit: 1 },
    }, this.target.keyProperty);
    const rec = Array.isArray(body?.results) ? body.results[0] : null;
    return rec ? { id: String(rec.id), ...(rec.properties ?? {}) } : null;
  }

  async getRecord(id: string) {
    const value = String(id ?? "").trim();
    if (!value) return null;
    for (let i = 0; ; i++) {
      const found = await this.lookup(value);
      if (found || i >= this.retries) return found;
      await new Promise(res => setTimeout(res, this.retryMs));
    }
  }
  async getField(id: string, field: string) { const r: any = await this.getRecord(id); return r?.[field.toLowerCase()] ?? r?.[field] ?? null; }
  async getTags() { return null; }
  async getStatus(id: string) { const r: any = await this.getRecord(id); return typeof r?.hs_lead_status === "string" ? r.hs_lead_status : null; }
}
