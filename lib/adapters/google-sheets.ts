import { getWorkspaceStore } from "@/lib/db";
import { getValidAccessToken } from "@/lib/oauth";
import type { DownstreamAdapter } from "@/lib/adapters/types";

function normalize(value: unknown) { return String(value ?? "").trim().toLowerCase(); }

export class GoogleSheetsAdapter implements DownstreamAdapter {
  private async config() {
    const store = await getWorkspaceStore();
    const connection = await store.connections.latest("google_sheets");
    if (!connection) throw new Error("Google Sheets connection not found.");
    const metadata = connection.metadata || {};
    if (!metadata.spreadsheetId || !metadata.sheetName || !metadata.lookupField) throw new Error("Google Sheets is connected but no spreadsheet, sheet or lookup column is configured.");
    return { store, connection, spreadsheetId: String(metadata.spreadsheetId), sheetName: String(metadata.sheetName), lookupField: String(metadata.lookupField) };
  }
  private async rows() {
    const cfg = await this.config();
    const token = await getValidAccessToken("google_sheets", cfg.store.workspaceId);
    if (!token) throw new Error("Google Sheets access token is unavailable.");
    const range = `${cfg.sheetName}!A:ZZ`;
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || "Google Sheets read failed.");
    const values: unknown[][] = Array.isArray(body.values) ? body.values : [];
    const headers = (values[0] || []).map((x) => String(x ?? "").trim());
    const lookupIndex = headers.findIndex((x) => normalize(x) === normalize(cfg.lookupField));
    if (lookupIndex < 0) throw new Error(`Lookup column "${cfg.lookupField}" was not found in the first row of the sheet.`);
    return values.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, row[index] ?? ""])) as Record<string, unknown>).map((record, index) => ({ record, rowIndex: index + 2, lookup: normalize((values[index + 1] || [])[lookupIndex]) }));
  }
  async getRecord(id: string) {
    const cfg = await this.config();
    const records = await this.rows();
    const found = records.find((item) => item.lookup === normalize(id));
    if (!found) return null;
    return { ...found.record, _outcom_row: found.rowIndex, _outcom_spreadsheet: cfg.spreadsheetId, _outcom_sheet: cfg.sheetName };
  }
  async getField(id: string, field: string) { const record = await this.getRecord(id); return record?.[field] ?? null; }
  async getTags(id: string) { const value = await this.getField(id, "tags"); if (Array.isArray(value)) return value.map(String); if (typeof value === "string") return value.split(",").map((x) => x.trim()).filter(Boolean); return null; }
  async getStatus(id: string) { const value = await this.getField(id, "status"); return value == null ? null : String(value); }
}

export const googleSheetsAdapter = new GoogleSheetsAdapter();
