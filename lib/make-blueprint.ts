// Reads a Make scenario blueprint (Scenario ⋯ → Export Blueprint) and proposes what Outcom should verify.
// Pure and deterministic. Only modules whose blueprint shape has been seen on a real export are supported;
// everything else is shown honestly as "not read yet" instead of guessed.
import type { FlowNode, Risk, Suggestion, SuggestedChecksResult } from "@/lib/suggested-checks";

type MakeModule = { id: number; module: string; mapper: Record<string, any>; metadata: Record<string, any>; routes?: Array<{ flow?: unknown[] }> };

const MAX_MODULES = 300;
// Apps that move or reshape data but never write the business result.
const PLUMBING = new Set(["gateway", "builtin", "util", "json", "tools", "http", "regexp", "flow-control"]);
const WRITER = /^airtable:(Action)?(Create|Update|Upsert|Add)/i;

/** Accepts the exported object or its JSON text. Returns null when this is not a Make blueprint. */
function pickBlueprint(input: unknown): { name: string; flow: unknown[]; metadata: any } | null {
  let v: any = input;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
  if (!v || typeof v !== "object" || !Array.isArray(v.flow)) return null;
  if (!v.flow.some((m: any) => m && typeof m.module === "string" && /^[\w-]+:/.test(m.module))) return null;
  return { name: typeof v.name === "string" ? v.name : "", flow: v.flow, metadata: v.metadata };
}

function asModule(raw: any): MakeModule | null {
  if (!raw || typeof raw !== "object" || typeof raw.module !== "string" || typeof raw.id !== "number") return null;
  return { id: raw.id, module: raw.module, mapper: raw.mapper && typeof raw.mapper === "object" ? raw.mapper : {}, metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}, routes: Array.isArray(raw.routes) ? raw.routes : undefined };
}

/** Router branches are flattened in order, so the picture stays a simple list. */
function flatten(list: unknown[], out: MakeModule[], depth = 0) {
  if (depth > 8) return;
  for (const raw of list) {
    const m = asModule(raw);
    if (!m) continue;
    out.push(m);
    for (const r of m.routes ?? []) if (Array.isArray(r.flow)) flatten(r.flow, out, depth + 1);
  }
}

const app = (m: MakeModule) => m.module.split(":")[0];
const humanize = (s: string) => s.replace(/^Action|^Trigger|^Watch/, m => (m === "Watch" ? "Watch " : "")).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
const niceName = (m: MakeModule): string => {
  const designer = m.metadata?.designer?.name;
  if (typeof designer === "string" && designer.trim()) return designer.trim();
  const tail = m.module.split(":")[1] ?? m.module;
  return humanize(tail) || m.module;
};
const isTrigger = (m: MakeModule, first: boolean) => first || /webhook|^watch|trigger/i.test(m.module);

/** Column labels by field id, read from the options Make saved with the module. */
function labelsOf(m: MakeModule): Record<string, string> {
  const out: Record<string, string> = {};
  const spec = (m.metadata?.restore?.expect?.table?.nested ?? []).find((n: any) => n?.name === "record")?.spec ?? m.metadata?.expect?.find?.((e: any) => e?.name === "record")?.spec ?? [];
  for (const f of Array.isArray(spec) ? spec : []) if (f && typeof f.name === "string" && typeof f.label === "string") out[f.name] = f.label;
  return out;
}

const REF = /\{\{\s*(\d+)\.([^}]+?)\s*\}\}/;
const KEY_PRIORITY = [/^e-?mail/i, /phone|mobile|whatsapp/i, /(^|\s)id$/i, /^name$/i];

function airtableSuggestion(m: MakeModule): Suggestion {
  const base = typeof m.mapper.base === "string" ? m.mapper.base : null;
  const table = typeof m.mapper.table === "string" ? m.mapper.table : null;
  const baseName = m.metadata?.restore?.expect?.base?.label;
  const tableName = m.metadata?.restore?.expect?.table?.label;
  const labels = labelsOf(m);
  const record = m.mapper.record && typeof m.mapper.record === "object" ? m.mapper.record : {};

  const mapped = Object.entries(record)
    .filter(([, v]) => typeof v === "string" && REF.test(v))
    .map(([id, v]) => ({ id, label: labels[id] ?? id, value: String(v) }));
  const key = KEY_PRIORITY.map(re => mapped.find(x => re.test(x.label))).find(Boolean) ?? mapped[0] ?? null;

  const missing: string[] = [];
  if (!base || !table) missing.push("Which Airtable base and table this step writes to.");
  if (!key) missing.push("No column is filled from earlier data (for example Email from the webhook). Fill one column, export again, and read it again. Or pick the column yourself below.");

  const label = `A record exists in ${typeof tableName === "string" && tableName ? tableName : "Airtable"}`;
  return {
    nodeName: niceName(m), nodeType: m.module,
    title: `A record was saved in ${typeof tableName === "string" && tableName ? tableName : "Airtable"}`,
    question: key ? `After each run, should a record with the same ${key.label} exist in Airtable?` : "After each run, should the new record exist in Airtable?",
    confidence: key && base && table ? "high" : "medium",
    supported: true,
    contract: {
      type: "record_exists", system: "airtable", entity: "record", label, valueFrom: "event.data.target_record_id",
      airtable: base && table ? { baseId: base, tableId: table, tableName: typeof tableName === "string" ? tableName : undefined, baseName: typeof baseName === "string" ? baseName : undefined, keyField: key?.label ?? "" } : undefined,
    },
    recordId: key
      ? { field: key.label, expression: key.value, explanation: `The scenario fills “${key.label}” with ${key.value}. Outcom sends the same value as target_record_id.` }
      : { field: null, expression: null, explanation: "Send the value that identifies the record, for example the email." },
    reasons: [`“${niceName(m)}” writes to Airtable${typeof tableName === "string" && tableName ? ` (table ${tableName})` : ""}.`],
    missing,
  };
}

export function suggestFromMakeBlueprint(input: unknown): SuggestedChecksResult | null {
  const bp = pickBlueprint(input);
  if (!bp) return null;
  const mods: MakeModule[] = [];
  flatten(bp.flow, mods);
  if (!mods.length) return { ok: false, error: "The scenario has no readable modules." };
  if (mods.length > MAX_MODULES) return { ok: false, error: `This scenario has more than ${MAX_MODULES} modules; Outcom does not read scenarios that large yet.` };

  const suggestions: Suggestion[] = [];
  const risks: Risk[] = [];
  const flow: FlowNode[] = mods.slice(0, 12).map((m, i) => {
    const writer = WRITER.test(m.module);
    return { name: niceName(m), type: app(m), kind: isTrigger(m, i === 0) ? "trigger" : writer ? "data" : "step" };
  });

  // The last module that writes business data decides what success looks like.
  const writers = mods.filter(m => WRITER.test(m.module));
  const last = writers[writers.length - 1];
  if (last) suggestions.push(airtableSuggestion(last));

  // Other apps that probably write data: shown honestly as not readable yet (never a false check).
  const seen = new Set<string>();
  for (const m of mods) {
    const a = app(m);
    if (PLUMBING.has(a) || a === "airtable" || seen.has(a)) continue;
    if (/^watch|webhook/i.test(m.module.split(":")[1] ?? "")) continue;
    seen.add(a);
    suggestions.push({
      nodeName: niceName(m), nodeType: m.module, title: `A step in ${a}`, question: "", confidence: "low", supported: false, contract: null,
      recordId: { field: null, expression: null, explanation: "" },
      reasons: [`Outcom cannot read “${niceName(m)}” (${a}) from a Make blueprint yet.`], missing: [],
    });
  }

  // Error handlers that swallow failures hide silent failures: say so.
  for (const m of mods) {
    const handlers = m.metadata?.errorHandler ?? m.mapper?.errorHandler;
    if (handlers && WRITER.test(m.module)) risks.push({ nodeName: niceName(m), kind: "continues_on_error", message: `“${niceName(m)}” has an error handler, so the run can look green while nothing was written. This is exactly what Outcom is for.` });
  }

  return { ok: true, workflowName: bp.name.trim() || "Untitled workflow", flow, trigger: mods[0] ? { name: niceName(mods[0]), type: app(mods[0]) } : null, stepCount: mods.length, suggestions, risks };
}
