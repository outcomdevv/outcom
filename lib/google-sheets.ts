// Google Sheets as a read-only "system of truth". Pure + fetch-injected so it is unit-testable with mocked responses.
import type { DownstreamAdapter } from "@/lib/adapters/types";

export type SheetTarget = { spreadsheetId: string; sheetName: string; keyColumn: string; spreadsheetName?: string; access?: "oauth" | "service_account" };
export type SheetFile = { id: string; name: string; modifiedTime: string | null };
export type SheetMeta = { id: string; title: string; tabs: string[] };

export class GoogleApiError extends Error {
  constructor(public kind: "reauth_required" | "forbidden" | "not_found" | "rate_limited" | "upstream", public status: number, message: string) { super(message); this.name = "GoogleApiError"; }
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE = "https://www.googleapis.com/drive/v3/files";
export const MAX_ROWS = 5000;
const MAX_COLS = "AZ";

type Fetch = typeof fetch;

function classify(status: number): GoogleApiError {
  if (status === 401) return new GoogleApiError("reauth_required", 401, "Google rejected the stored token. Reconnect Google.");
  if (status === 403) return new GoogleApiError("forbidden", 403, "Google denied access to this spreadsheet. Check that the connected Google account (or Outcom's robot email) can open it.");
  if (status === 404) return new GoogleApiError("not_found", 404, "Spreadsheet or tab not found. It may have been deleted or renamed.");
  if (status === 429) return new GoogleApiError("rate_limited", 429, "Google rate limit reached. Try again shortly.");
  return new GoogleApiError("upstream", status, `Google returned HTTP ${status}.`);
}

async function getJson(url: string, token: string, f: Fetch, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await f(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!r.ok) throw classify(r.status);
    return await r.json();
  } catch (e) {
    if (e instanceof GoogleApiError) throw e;
    throw new GoogleApiError("upstream", 0, "Could not reach Google Sheets (network or timeout).");
  } finally { clearTimeout(timer); }
}

/** Accepts a bare id or any docs.google.com/spreadsheets/d/<id>/... URL. */
export function parseSpreadsheetId(input: string): string | null {
  const s = String(input || "").trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : null;
}

export async function listSpreadsheets(token: string, opts: { query?: string; fetchImpl?: Fetch } = {}): Promise<SheetFile[]> {
  const f = opts.fetchImpl ?? fetch;
  const clauses = ["mimeType='application/vnd.google-apps.spreadsheet'", "trashed=false"];
  const q = (opts.query || "").trim().replace(/['\\]/g, "\\$&");
  if (q) clauses.push(`name contains '${q}'`);
  const url = new URL(DRIVE);
  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("fields", "files(id,name,modifiedTime)");
  const body = await getJson(url.toString(), token, f);
  return (Array.isArray(body.files) ? body.files : []).map((x: any) => ({ id: String(x.id), name: String(x.name || "Untitled"), modifiedTime: x.modifiedTime || null }));
}

const quoteTab = (name: string) => `'${name.replace(/'/g, "''")}'`;

export async function getSheetMeta(token: string, spreadsheetId: string, fetchImpl?: Fetch): Promise<SheetMeta> {
  const f = fetchImpl ?? fetch;
  const url = `${SHEETS}/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`;
  const body = await getJson(url, token, f);
  return { id: spreadsheetId, title: String(body.properties?.title || "Untitled"), tabs: (Array.isArray(body.sheets) ? body.sheets : []).map((s: any) => String(s.properties?.title)).filter(Boolean) };
}

export async function getHeaders(token: string, spreadsheetId: string, sheetName: string, fetchImpl?: Fetch): Promise<string[]> {
  const f = fetchImpl ?? fetch;
  const range = encodeURIComponent(`${quoteTab(sheetName)}!A1:${MAX_COLS}1`);
  const body = await getJson(`${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${range}`, token, f);
  const row: unknown[] = Array.isArray(body.values?.[0]) ? body.values[0] : [];
  return row.map(v => String(v ?? "").trim()).filter(Boolean);
}

/** Sheet headers are human-typed ("Status", "status "); match field names case-insensitively. */
export function ciGet(record: Record<string, unknown>, field: string): unknown {
  if (field in record) return record[field];
  const key = Object.keys(record).find(k => k.trim().toLowerCase() === field.trim().toLowerCase());
  return key === undefined ? undefined : record[key];
}

export class GoogleSheetsAdapter implements DownstreamAdapter {
  constructor(private token: string, private target: SheetTarget, private fetchImpl: Fetch = fetch, private maxRows = MAX_ROWS) {
    if (!target?.spreadsheetId || !target?.sheetName || !target?.keyColumn) throw new Error("Google Sheets target is incomplete (spreadsheet, tab and key column are required).");
  }

  /** null = row definitively not found. Throws (-> UNKNOWN) if we could not scan the whole sheet. */
  async getRecord(id: string): Promise<Record<string, unknown> | null> {
    const needle = String(id ?? "").trim().toLowerCase();
    if (!needle) return null;
    const range = encodeURIComponent(`${quoteTab(this.target.sheetName)}!A1:${MAX_COLS}${this.maxRows}`);
    const body = await getJson(`${SHEETS}/${encodeURIComponent(this.target.spreadsheetId)}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`, this.token, this.fetchImpl);
    const rows: unknown[][] = Array.isArray(body.values) ? body.values : [];
    const headers = (rows[0] ?? []).map(h => String(h ?? "").trim());
    const keyIndex = headers.findIndex(h => h.toLowerCase() === this.target.keyColumn.trim().toLowerCase());
    if (keyIndex < 0) throw new Error(`Key column "${this.target.keyColumn}" was not found in the header row of "${this.target.sheetName}".`);
    for (const row of rows.slice(1)) {
      if (String(row[keyIndex] ?? "").trim().toLowerCase() === needle) {
        const record: Record<string, unknown> = {};
        headers.forEach((h, i) => { if (h) record[h] = row[i] ?? ""; });
        return record;
      }
    }
    if (rows.length >= this.maxRows) throw new Error(`Row not found in the first ${this.maxRows} rows; Outcom cannot confirm it is absent from a larger sheet.`);
    return null;
  }
  async getField(id: string, field: string) { const r = await this.getRecord(id); return r ? (ciGet(r, field) ?? null) : null; }
  async getTags(id: string) {
    const r = await this.getRecord(id); const raw = r ? ciGet(r, "tags") : undefined;
    return typeof raw === "string" ? raw.split(",").map(t => t.trim()).filter(Boolean) : null;
  }
  async getStatus(id: string) { const r = await this.getRecord(id); const s = r ? ciGet(r, "status") : undefined; return typeof s === "string" ? s : null; }
}

export function parseSheetTarget(value: unknown): SheetTarget | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const spreadsheetId = typeof v.spreadsheetId === "string" ? parseSpreadsheetId(v.spreadsheetId) : null;
  const sheetName = typeof v.sheetName === "string" ? v.sheetName.trim() : "";
  const keyColumn = typeof v.keyColumn === "string" ? v.keyColumn.trim() : "";
  if (!spreadsheetId || !sheetName || !keyColumn) return null;
  const access = v.access === "service_account" ? "service_account" : v.access === "oauth" ? "oauth" : undefined;
  return { spreadsheetId, sheetName, keyColumn, spreadsheetName: typeof v.spreadsheetName === "string" ? v.spreadsheetName : undefined, ...(access ? { access } : {}) };
}
