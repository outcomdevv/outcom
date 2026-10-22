// "Reported evidence": the automation itself reads the destination (with the connection it already has)
// and tells Outcom what it saw. Outcom judges that evidence, so any app the automation can read works,
// with no connector to build. Pure and testable.
import type { DownstreamAdapter } from "@/lib/adapters/types";

export type EvidenceItem = {
  step: string;
  found: boolean;
  /** How many matching records the workflow saw. Lets Outcom catch duplicates. */
  count?: number;
  key?: string;
  fields: Record<string, unknown>;
  source?: string;
};

const MAX_STEPS = 20;
const MAX_FIELDS = 50;
const MAX_TEXT = 500;

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** "Create CRM contact" -> "create-crm-contact". The same text always maps to the same step. */
export function slugStep(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function cleanValue(v: unknown): unknown {
  if (typeof v === "string") return v.length > MAX_TEXT ? v.slice(0, MAX_TEXT) : v;
  if (typeof v === "number" || typeof v === "boolean" || v === null) return v;
  if (Array.isArray(v)) return v.slice(0, 20).map(cleanValue);
  if (isObject(v)) return JSON.stringify(v).slice(0, MAX_TEXT);
  return undefined;
}

/** Never store values whose field name says they are secrets, even if a workflow sends them by accident. */
const SENSITIVE_KEY = /pass(word|wd)?|secret|token|api[_-]?key|authorization|credit|card[_-]?(number|no)|cvv|ssn|iban/i;

function cleanFields(v: unknown): Record<string, unknown> {
  if (!isObject(v)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v).slice(0, MAX_FIELDS)) {
    const c = SENSITIVE_KEY.test(k) ? "[redacted]" : cleanValue(val);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

function parseItem(raw: unknown, fallbackStep?: string): EvidenceItem | null {
  if (!isObject(raw)) return null;
  const step = slugStep(raw.step ?? raw.name ?? fallbackStep);
  if (!step) return null;
  const fields = cleanFields(raw.fields ?? raw.data ?? raw.record ?? raw.values);
  const count = Number(raw.count);
  const found = typeof raw.found === "boolean" ? raw.found
    : typeof raw.found === "string" && /^(true|false)$/i.test(raw.found) ? raw.found.toLowerCase() === "true"
    : raw.count !== undefined && raw.count !== null && raw.count !== "" && Number.isFinite(count) ? count > 0
    : Object.keys(fields).length > 0;
  const key = typeof raw.key === "string" && raw.key.trim() ? raw.key.trim().slice(0, 200)
    : typeof raw.key === "number" ? String(raw.key) : undefined;
  const source = typeof raw.source === "string" && raw.source.trim() ? raw.source.trim().slice(0, 120) : undefined;
  const countOut = raw.count !== undefined && raw.count !== null && raw.count !== "" && Number.isFinite(count) && count >= 0 ? Math.floor(count) : undefined;
  return { step, found, ...(countOut !== undefined ? { count: countOut } : {}), ...(key ? { key } : {}), fields, ...(source ? { source } : {}) };
}

/**
 * Accepts three shapes, from the body or its `data` object:
 *   evidence: [{ step, found, key, fields }]
 *   evidence: { crm: { found, fields } }
 *   a single item at the top level: { step: "crm", found: true, fields: {...} }
 */
export function normalizeEvidence(...sources: unknown[]): Record<string, EvidenceItem> {
  const out: Record<string, EvidenceItem> = {};
  const add = (item: EvidenceItem | null) => { if (item && (out[item.step] || Object.keys(out).length < MAX_STEPS)) out[item.step] = item; };
  for (const src of sources) {
    if (!isObject(src)) continue;
    const ev = src.evidence;
    if (Array.isArray(ev)) for (const raw of ev) add(parseItem(raw));
    else if (isObject(ev)) {
      if (typeof ev.step === "string") add(parseItem(ev));
      else for (const [step, raw] of Object.entries(ev)) add(parseItem(raw, step));
    }
    if (typeof src.step === "string" && (src.found !== undefined || src.count !== undefined || src.fields !== undefined)) add(parseItem(src));
  }
  return out;
}

/** Evidence stored on an event: { "<step slug>": EvidenceItem }. */
export function evidenceFor(data: unknown, step: unknown): EvidenceItem | null {
  const slug = slugStep(step);
  const all = isObject(data) && isObject(data.evidence) ? data.evidence : null;
  const item = all && slug ? all[slug] : null;
  return isObject(item) ? (item as unknown as EvidenceItem) : null;
}

const ci = (fields: Record<string, unknown>, name: string) => {
  const hit = Object.keys(fields).find((k) => k.toLowerCase() === name.toLowerCase());
  return hit === undefined ? undefined : fields[hit];
};

/** Lets the normal checks (record exists, column value, tags) read what the automation reported. */
export class ReportedAdapter implements DownstreamAdapter {
  constructor(private readonly evidence: EvidenceItem) {}
  async getRecord(id: string) {
    return this.evidence.found ? { id: this.evidence.key ?? id, ...this.evidence.fields } : null;
  }
  async getField(_id: string, field: string) { return ci(this.evidence.fields, field); }
  async getTags(_id: string) {
    const tags = ci(this.evidence.fields, "tags");
    return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : null;
  }
  async getStatus(_id: string) {
    const status = ci(this.evidence.fields, "status");
    return typeof status === "string" ? status : null;
  }
}
