// Airtable as a read-only "system of truth". Pure + fetch-injected so it can be unit-tested with mocked responses.
// The customer pastes a personal access token with data.records:read and schema.bases:read, plus a link to the table.
import type { DownstreamAdapter } from "@/lib/adapters/types";

export type AirtableTarget = { baseId: string; tableId: string; tableName?: string; keyField: string };
export type AirtableTable = { id: string; name: string; fields: string[] };

export class AirtableError extends Error {
  constructor(public kind: "reauth_required" | "forbidden" | "not_found" | "bad_field" | "rate_limited" | "upstream", public status: number, message: string) { super(message); this.name = "AirtableError"; }
}

const API = "https://api.airtable.com/v0";
type Fetch = typeof fetch;

function classify(status: number, field?: string): AirtableError {
  if (status === 401) return new AirtableError("reauth_required", 401, "Airtable rejected the connection. Reconnect Airtable and try again.");
  if (status === 403) return new AirtableError("forbidden", 403, "Outcom has no access to that base. Reconnect Airtable and allow this base.");
  if (status === 404) return new AirtableError("not_found", 404, "Airtable base or table not found. It may have been deleted, or the token has no access to it.");
  if (status === 422) return new AirtableError("bad_field", 422, field ? `Airtable has no column called “${field}” in this table.` : "Airtable could not read that column.");
  if (status === 429) return new AirtableError("rate_limited", 429, "Airtable rate limit reached. Try again shortly.");
  return new AirtableError("upstream", status, `Airtable returned HTTP ${status}.`);
}

async function getJson(url: string, token: string, f: Fetch, field?: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await f(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!r.ok) throw classify(r.status, field);
    return await r.json();
  } catch (e) {
    if (e instanceof AirtableError) throw e;
    throw new AirtableError("upstream", 0, "Could not reach Airtable (network or timeout).");
  } finally { clearTimeout(timer); }
}

/** Accepts https://airtable.com/appXXXX/tblYYYY/... (or just /appXXXX). */
export function parseAirtableLink(input: string): { baseId: string; tableId: string | null } | null {
  const s = String(input || "").trim();
  const base = s.match(/\b(app[a-zA-Z0-9]{10,})\b/);
  if (!base) return null;
  const table = s.match(/\b(tbl[a-zA-Z0-9]{10,})\b/);
  return { baseId: base[1], tableId: table ? table[1] : null };
}

export function parseAirtableTarget(raw: unknown): AirtableTarget | null {
  const t: any = raw && typeof raw === "object" ? raw : null;
  if (!t) return null;
  const baseId = typeof t.baseId === "string" ? t.baseId.trim() : "";
  const tableId = typeof t.tableId === "string" ? t.tableId.trim() : "";
  const keyField = typeof t.keyField === "string" ? t.keyField.trim() : "";
  if (!/^app[a-zA-Z0-9]{10,}$/.test(baseId) || !/^tbl[a-zA-Z0-9]{10,}$/.test(tableId) || !keyField) return null;
  return { baseId, tableId, keyField, ...(typeof t.tableName === "string" && t.tableName.trim() ? { tableName: t.tableName.trim() } : {}) };
}

/** Bases the connection can see (needs schema.bases:read). Follows Airtable's pagination, capped so a huge account cannot stall the page. */
export async function listAirtableBases(token: string, opts: { fetchImpl?: Fetch } = {}): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = [];
  let offset: string | undefined;
  for (let page = 0; page < 5; page++) {
    const body = await getJson(`${API}/meta/bases${offset ? `?offset=${encodeURIComponent(offset)}` : ""}`, token, opts.fetchImpl ?? fetch);
    for (const b of Array.isArray(body.bases) ? body.bases : []) out.push({ id: String(b.id), name: String(b.name || "Untitled base") });
    offset = typeof body.offset === "string" && body.offset ? body.offset : undefined;
    if (!offset) break;
  }
  return out;
}

/** Tables of a base with their column names (needs the schema.bases:read scope). */
export async function listAirtableTables(token: string, baseId: string, opts: { fetchImpl?: Fetch } = {}): Promise<AirtableTable[]> {
  const body = await getJson(`${API}/meta/bases/${encodeURIComponent(baseId)}/tables`, token, opts.fetchImpl ?? fetch);
  return (Array.isArray(body.tables) ? body.tables : []).map((t: any) => ({ id: String(t.id), name: String(t.name || "Untitled"), fields: (Array.isArray(t.fields) ? t.fields : []).map((x: any) => String(x.name)) }));
}

const quote = (v: string) => `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const fieldRef = (name: string) => `{${name.replace(/\}/g, "\\}")}}`;

/** Case-insensitive match on the key column; works for text, email, number and single-select columns. */
export const matchFormula = (field: string, value: string) => `LOWER(${fieldRef(field)}&"")=LOWER(${quote(value)})`;

export class AirtableAdapter implements DownstreamAdapter {
  constructor(private token: string, private target: AirtableTarget, private fetchImpl: Fetch = fetch) {}

  async getRecord(id: string) {
    const value = String(id ?? "").trim();
    if (!value) return null;
    const url = new URL(`${API}/${encodeURIComponent(this.target.baseId)}/${encodeURIComponent(this.target.tableId)}`);
    url.searchParams.set("maxRecords", "1");
    url.searchParams.set("filterByFormula", matchFormula(this.target.keyField, value));
    const body = await getJson(url.toString(), this.token, this.fetchImpl, this.target.keyField);
    const rec = Array.isArray(body.records) ? body.records[0] : null;
    return rec ? { id: String(rec.id), ...(rec.fields && typeof rec.fields === "object" ? rec.fields : {}) } : null;
  }
  async getField(id: string, field: string) { const r: any = await this.getRecord(id); return r?.[field] ?? null; }
  async getTags(id: string) { const r: any = await this.getRecord(id); return Array.isArray(r?.tags) ? r.tags : null; }
  async getStatus(id: string) { const r: any = await this.getRecord(id); return typeof r?.status === "string" ? r.status : null; }
}
