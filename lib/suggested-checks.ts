// "Suggested checks": read an n8n workflow export and propose what Outcom should verify after each run.
// Pure and deterministic (no AI, no network). Idea: the LAST step that writes business data tells us what success looks like.
// Honest about uncertainty: every suggestion has a confidence label and a list of what we could not read.

export type Confidence = "high" | "medium" | "low";

export type SuggestedContract = {
  type: "record_exists" | "output_count";
  system: "google_sheets" | "ghl" | "event";
  entity: string;
  label: string;
  valueFrom: string;
  target?: { spreadsheetId: string; spreadsheetName?: string; sheetName: string; keyColumn: string };
  operator?: string;
  expectedCount?: number;
};

export type Suggestion = {
  nodeName: string;
  nodeType: string;
  title: string;
  /** One plain question the user confirms. */
  question: string;
  confidence: Confidence;
  /** false = Outcom cannot check this system yet (shown honestly, not hidden). */
  supported: boolean;
  contract: SuggestedContract | null;
  /** What the workflow should send to Outcom as target_record_id. */
  recordId: { field: string | null; expression: string | null; explanation: string };
  reasons: string[];
  /** Things we could not read from the file; the user must fill these in. */
  missing: string[];
};

export type Risk = { nodeName: string; kind: "continues_on_error" | "disabled_step"; message: string };

export type SuggestedChecksResult = {
  ok: true;
  workflowName: string;
  trigger: { name: string; type: string } | null;
  stepCount: number;
  suggestions: Suggestion[];
  risks: Risk[];
} | { ok: false; error: string };

type N8nNode = { name: string; type: string; parameters: Record<string, any>; position: [number, number]; disabled: boolean; onError: string | null; continueOnFail: boolean };

const MAX_NODES = 500;

function asNode(raw: any): N8nNode | null {
  if (!raw || typeof raw !== "object" || typeof raw.name !== "string" || typeof raw.type !== "string") return null;
  const pos = Array.isArray(raw.position) && raw.position.length >= 2 ? [Number(raw.position[0]) || 0, Number(raw.position[1]) || 0] as [number, number] : [0, 0] as [number, number];
  return {
    name: raw.name, type: raw.type, position: pos,
    parameters: raw.parameters && typeof raw.parameters === "object" ? raw.parameters : {},
    disabled: raw.disabled === true,
    onError: typeof raw.onError === "string" ? raw.onError : null,
    continueOnFail: raw.continueOnFail === true,
  };
}

/** Accepts the exported object, a JSON string, an array of workflows (n8n "download" of several) or {data:[...]}. */
function pickWorkflow(input: unknown): any | null {
  let v: any = input;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
  if (Array.isArray(v)) v = v[0];
  if (v && typeof v === "object" && Array.isArray(v.data) && !Array.isArray(v.nodes)) v = v.data[0];
  return v && typeof v === "object" && Array.isArray(v.nodes) ? v : null;
}

const shortType = (t: string) => t.split(".").pop() ?? t;
const isTrigger = (n: N8nNode) => /trigger$/i.test(shortType(n.type)) || /^(webhook|formTrigger|cron|start)$/i.test(shortType(n.type));

/** n8n resource-locator fields are { __rl, value, mode, cachedResultName } or a plain string. */
function locator(v: any): { value: string | null; label: string | null; isExpression: boolean } {
  if (typeof v === "string") return { value: v || null, label: null, isExpression: v.startsWith("=") };
  if (v && typeof v === "object") {
    const value = typeof v.value === "string" || typeof v.value === "number" ? String(v.value) : null;
    const label = typeof v.cachedResultName === "string" ? v.cachedResultName : null;
    return { value, label, isExpression: Boolean(value && value.startsWith("=")) };
  }
  return { value: null, label: null, isExpression: false };
}

const SHEET_WRITE_OPS = new Set(["append", "appendOrUpdate", "update"]);
const PLANNED_TARGETS: Record<string, string> = { hubspot: "HubSpot", airtable: "Airtable", notion: "Notion", pipedrive: "Pipedrive", stripe: "Stripe", salesforce: "Salesforce", postgres: "Postgres", mySql: "MySQL", supabase: "Supabase", zohoCrm: "Zoho CRM" };
const NOTIFY = new Set(["gmail", "emailSend", "slack", "telegram", "twilio", "whatsApp", "discord", "microsoftOutlook"]);

/** Turns "={{ $json.email }}" into a snippet the user can paste into an HTTP Request body. */
function expressionFor(value: unknown): { field: string | null; expression: string | null } {
  if (typeof value !== "string") return { field: null, expression: null };
  const m = value.match(/\{\{\s*([^}]+?)\s*\}\}/);
  if (!m) return { field: null, expression: null };
  const inner = m[1];
  const f = inner.match(/\$json(?:\.([A-Za-z0-9_]+)|\[['"]([^'"]+)['"]\])/) ?? inner.match(/\$\(['"][^'"]+['"]\)\.item\.json(?:\.([A-Za-z0-9_]+)|\[['"]([^'"]+)['"]\])/);
  return { field: f ? (f[1] ?? f[2] ?? null) : null, expression: `{{ ${inner} }}` };
}

function sheetsSuggestion(n: N8nNode): Suggestion {
  const p = n.parameters;
  const op = typeof p.operation === "string" ? p.operation : "append"; // n8n's default operation for sheet rows
  const doc = locator(p.documentId);
  const tab = locator(p.sheetName);
  const columns = p.columns && typeof p.columns === "object" ? p.columns : {};
  const mapped: Record<string, unknown> = columns.value && typeof columns.value === "object" ? columns.value : {};
  const matching: string[] = Array.isArray(columns.matchingColumns) ? columns.matchingColumns.filter((x: unknown) => typeof x === "string") : [];

  const keyColumn = matching[0] ?? Object.keys(mapped).find(k => /e-?mail|phone|^id$|_id$|\bid\b|key|ref/i.test(k)) ?? null;
  const keyExpr = keyColumn ? expressionFor(mapped[keyColumn]) : { field: null, expression: null };

  const spreadsheetId = doc.isExpression ? null : doc.value;
  const sheetName = tab.isExpression ? null : (tab.value && /^gid=\d+$/.test(tab.value) ? tab.label : tab.value ?? tab.label);

  const missing: string[] = [];
  if (!spreadsheetId) missing.push(doc.isExpression ? "Spreadsheet is chosen dynamically (expression); pick it in Outcom." : "Spreadsheet could not be read from the file.");
  if (!sheetName) missing.push(tab.isExpression ? "Tab is chosen dynamically (expression); pick it in Outcom." : "Tab name could not be read (the file only has its numeric id).");
  if (!keyColumn) missing.push("No obvious key column (like Email or ID). Pick the column that identifies each row.");

  const reasons = [`The last step that writes data is "${n.name}" (Google Sheets: ${op}).`];
  if (matching[0]) reasons.push(`It matches rows by "${matching[0]}", so that is the key.`);
  else if (keyColumn) reasons.push(`"${keyColumn}" looks like the column that identifies a row.`);
  if (p.operation === undefined) reasons.push("The file does not state the operation; n8n treats that as 'append'.");

  const confidence: Confidence = !missing.length && matching[0] ? "high" : spreadsheetId && sheetName && keyColumn ? "medium" : "low";
  const where = `${tab.label ?? sheetName ?? "the sheet"}${doc.label ? ` in "${doc.label}"` : ""}`;
  const verb = op === "update" ? "updated" : op === "appendOrUpdate" ? "added or updated" : "added";
  return {
    nodeName: n.name, nodeType: n.type,
    title: `A row is ${verb} in Google Sheets`,
    question: `After every run, should a row ${keyColumn ? `with a matching "${keyColumn}" ` : ""}be ${verb} in ${where}?`,
    confidence, supported: true,
    contract: {
      type: "record_exists", system: "google_sheets", entity: "row",
      label: `Row ${verb} in ${tab.label ?? sheetName ?? "Google Sheet"}`,
      valueFrom: "event.data.target_record_id",
      ...(spreadsheetId && sheetName && keyColumn ? { target: { spreadsheetId, spreadsheetName: doc.label ?? undefined, sheetName, keyColumn } } : {}),
    },
    recordId: {
      field: keyExpr.field, expression: keyExpr.expression,
      explanation: keyExpr.expression
        ? `Add an HTTP Request step at the end that POSTs {"data":{"target_record_id":"${keyExpr.expression}"}} to your Outcom URL. That value is what you write into "${keyColumn}".`
        : `Send the value of your key column${keyColumn ? ` "${keyColumn}"` : ""} as data.target_record_id.`,
    },
    reasons, missing,
  };
}

function suggestionFor(n: N8nNode): Suggestion | null {
  const t = shortType(n.type);
  const p = n.parameters;
  if (t === "googleSheets") {
    if (p.resource === "spreadsheet") return null;
    const op = typeof p.operation === "string" ? p.operation : "append";
    return SHEET_WRITE_OPS.has(op) ? sheetsSuggestion(n) : null;
  }
  if (t === "highLevel") {
    const op = String(p.operation || "");
    if (/^(get|getAll|lookup)$/i.test(op)) return null;
    return {
      nodeName: n.name, nodeType: n.type, title: "A contact exists in HighLevel",
      question: "After every run, should the contact exist in HighLevel?", confidence: "medium", supported: true,
      contract: { type: "record_exists", system: "ghl", entity: "contact", label: "Contact exists in HighLevel", valueFrom: "event.data.target_record_id" },
      recordId: { field: null, expression: null, explanation: "Send the HighLevel contact id (or the value your workflow used to find it) as data.target_record_id." },
      reasons: [`The last step that writes data is "${n.name}" (HighLevel${op ? `: ${op}` : ""}).`], missing: [],
    };
  }
  if (PLANNED_TARGETS[t]) {
    const label = PLANNED_TARGETS[t];
    return {
      nodeName: n.name, nodeType: n.type, title: `A record is written in ${label}`,
      question: `After every run, should a record exist in ${label}?`, confidence: "low", supported: false, contract: null,
      recordId: { field: null, expression: null, explanation: "Send the record id as data.target_record_id." },
      reasons: [`The last step that writes data is "${n.name}" (${label}).`, `Outcom cannot check ${label} yet. For now it can only check that the run succeeded and produced output.`],
      missing: [`${label} checks are not built yet.`],
    };
  }
  if (t === "httpRequest") {
    const method = String(p.method || "GET").toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;
    const url = typeof p.url === "string" ? p.url : "";
    if (/outcom/i.test(url)) return null; // that is our own report step, not business work
    return {
      nodeName: n.name, nodeType: n.type, title: "An external system was changed through an API call",
      question: "After this API call, what should be true in the other system?", confidence: "low", supported: false, contract: null,
      recordId: { field: null, expression: null, explanation: "Send the id of the created or updated record as data.target_record_id." },
      reasons: [`"${n.name}" sends ${method} ${url ? `to ${url.replace(/^=/, "").slice(0, 60)}` : "to an external API"}, but Outcom cannot tell what it changed.`],
      missing: ["Generic API checks are not built yet."],
    };
  }
  if (NOTIFY.has(t)) {
    return {
      nodeName: n.name, nodeType: n.type, title: "A message was sent", question: "Should every run end with this message being sent?", confidence: "low", supported: true,
      contract: { type: "output_count", system: "event", entity: "output", label: "Run produced output", valueFrom: "event.data.output_count", operator: "greater_than", expectedCount: 0 },
      recordId: { field: null, expression: null, explanation: "Optional: send data.output_count so Outcom can confirm the run produced something." },
      reasons: [`The last step is "${n.name}" (${t}). Outcom cannot confirm delivery, only that the run produced output.`], missing: [],
    };
  }
  return null;
}

export function suggestChecks(input: unknown): SuggestedChecksResult {
  const wf = pickWorkflow(input);
  if (!wf) return { ok: false, error: "This does not look like an n8n workflow export. In n8n, open the workflow, select all (Ctrl+A), copy (Ctrl+C) and paste here, or use ⋯ → Download." };
  if (wf.nodes.length > MAX_NODES) return { ok: false, error: `This workflow has more than ${MAX_NODES} steps; Outcom does not read workflows that large yet.` };

  const nodes = (wf.nodes as unknown[]).map(asNode).filter((n): n is N8nNode => Boolean(n));
  if (!nodes.length) return { ok: false, error: "The workflow has no readable steps." };
  const byName = new Map(nodes.map(n => [n.name, n]));

  // Longest-path depth from each trigger over connections (cycle-safe).
  const next = (name: string): string[] => {
    const out: string[] = [];
    const conn = wf.connections?.[name];
    if (conn && typeof conn === "object") for (const branches of Object.values(conn) as any[]) for (const list of Array.isArray(branches) ? branches : []) for (const c of Array.isArray(list) ? list : []) if (c && typeof c.node === "string" && byName.has(c.node)) out.push(c.node);
    return out;
  };
  const triggers = nodes.filter(n => isTrigger(n) && !n.disabled);
  const depth = new Map<string, number>();
  const walk = (name: string, d: number, path: Set<string>) => {
    if (path.has(name) || (depth.get(name) ?? -1) >= d) return;
    depth.set(name, d);
    path.add(name);
    for (const c of next(name)) walk(c, d + 1, path);
    path.delete(name);
  };
  for (const t of triggers) walk(t.name, 0, new Set());

  const reachable = nodes.filter(n => depth.has(n.name) && !n.disabled);
  const candidates = reachable
    .map(n => ({ n, s: suggestionFor(n) }))
    .filter((x): x is { n: N8nNode; s: Suggestion } => x.s !== null)
    // data writers outrank "message sent" steps (a confirmation email is not the business result);
    // then furthest from the trigger; on ties the one placed further right on the canvas
    .sort((a, b) => (Number(NOTIFY.has(shortType(a.n.type))) - Number(NOTIFY.has(shortType(b.n.type)))) || (depth.get(b.n.name)! - depth.get(a.n.name)!) || (b.n.position[0] - a.n.position[0]));

  const risks: Risk[] = [];
  for (const n of nodes) {
    if (n.disabled && suggestionFor({ ...n, disabled: false })) risks.push({ nodeName: n.name, kind: "disabled_step", message: `"${n.name}" is switched off, so it never writes anything.` });
    if (!n.disabled && (n.onError === "continueRegularOutput" || n.onError === "continueErrorOutput" || n.continueOnFail) && suggestionFor(n))
      risks.push({ nodeName: n.name, kind: "continues_on_error", message: `"${n.name}" is set to continue when it fails, so the run can look green while nothing was written. This is exactly what Outcom is for.` });
  }

  const trig = triggers[0];
  return {
    ok: true,
    workflowName: typeof wf.name === "string" && wf.name.trim() ? wf.name.trim() : "Untitled workflow",
    trigger: trig ? { name: trig.name, type: trig.type } : null,
    stepCount: nodes.length,
    suggestions: candidates.map(c => c.s),
    risks,
  };
}
