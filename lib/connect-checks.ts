// The checks a user builds on the Connect page. Pure and testable.
// Rule: every check is a structured rule (column + condition + value). Its name is generated from the rule,
// so a custom check can never be a sentence that Outcom does not actually evaluate.

export type CheckKind = "exists" | "value" | "output" | "tags" | "required" | "count" | "fresh";
export type CountOperator = "equals" | "at_least" | "at_most";
export const COUNT_OPERATORS: Array<{ id: CountOperator; text: string }> = [{ id: "equals", text: "exactly" }, { id: "at_least", text: "at least" }, { id: "at_most", text: "at most" }];
export type OutcomeType = "record_exists" | "state_invariant" | "output_count";
export type TargetKind = "google_sheets" | "airtable" | "hubspot" | "ghl" | "reported" | "none";

/** Systems where Outcom looks up one record by a key and reads named columns / properties. */
export const hasNamedFields = (s: TargetKind) => s === "google_sheets" || s === "airtable" || s === "hubspot";

export type Operator = "equals" | "not_equals" | "contains" | "not_contains" | "exists";

export const OPERATORS: Array<{ id: Operator; text: string }> = [
  { id: "equals", text: "is" },
  { id: "not_equals", text: "is not" },
  { id: "contains", text: "contains" },
  { id: "not_contains", text: "does not contain" },
  { id: "exists", text: "is filled in" },
];

export type CheckDraft = {
  id: string;
  kind: CheckKind;
  /** Set when the user typed their own name; otherwise the name follows the rule. */
  customLabel: boolean;
  label: string;
  field: string;
  operator: Operator;
  expectedValue: string;
  expectedCount: number;
  /** Where the record id sits in the webhook payload. Advanced, rarely changed. */
  valueFrom: string;
  /** Value checks only: name of a field the run itself carries. When set, the column is compared with it instead of a typed value. */
  expectedFrom: string;
  /** Count checks only. */
  countOp: CountOperator;
};

/** "email, owner ," -> ["email","owner"] */
export const splitFields = (text: string): string[] => [...new Set(text.split(",").map(x => x.trim()).filter(Boolean))].slice(0, 20);

export const MAX_CHECKS = 10;

export const outcomeTypeOf = (kind: CheckKind): OutcomeType =>
  kind === "exists" ? "record_exists" : kind === "output" ? "output_count" : "state_invariant";

export const modeOf = (kind: CheckKind): "required_fields" | "record_count" | "fresh_within" | null =>
  kind === "required" ? "required_fields" : kind === "count" ? "record_count" : kind === "fresh" ? "fresh_within" : null;

export const needsBusinessSystem = (checks: CheckDraft[]) => checks.some(c => c.kind !== "output");

const quote = (v: string) => `"${v.trim()}"`;

export function autoLabel(c: Pick<CheckDraft, "kind" | "field" | "operator" | "expectedValue" | "expectedCount"> & Partial<Pick<CheckDraft, "expectedFrom" | "countOp">>, ctx: { system: TargetKind; tab?: string | null }): string {
  switch (c.kind) {
    case "exists":
      return ctx.system === "google_sheets" ? `A row exists${ctx.tab ? ` in ${ctx.tab}` : ""}`
        : ctx.system === "airtable" ? `A record exists${ctx.tab ? ` in ${ctx.tab}` : ""}`
        : ctx.system === "hubspot" ? "The contact exists in HubSpot"
        : ctx.system === "reported" ? `The record exists${ctx.tab ? ` (step “${ctx.tab}”)` : ""}` : "The contact exists";
    case "output":
      return "The run produced output";
    case "tags":
      return "Existing tags are kept";
    case "required": {
      const names = splitFields(c.field);
      return names.length ? `${names.join(", ")} ${names.length === 1 ? "is" : "are"} filled in` : "Required fields are filled in";
    }
    case "count": {
      const op = COUNT_OPERATORS.find(o => o.id === (c.countOp ?? "equals")) ?? COUNT_OPERATORS[0];
      return (c.countOp ?? "equals") === "equals" && c.expectedCount === 1 ? "Exactly one record exists (no duplicates)" : `${op.text[0].toUpperCase()}${op.text.slice(1)} ${c.expectedCount} record${c.expectedCount === 1 ? "" : "s"} exist`;
    }
    case "fresh":
      return c.field.trim() ? `${c.field.trim()} is within ${c.expectedCount} min of the run` : "The record was written on time";
    case "value": {
      const field = c.field.trim();
      if (!field) return "Value check";
      if ((c.expectedFrom ?? "").trim()) return `${field} ${(OPERATORS.find(o => o.id === c.operator) ?? OPERATORS[0]).text} the run's “${(c.expectedFrom ?? "").trim()}”`;
      const op = OPERATORS.find(o => o.id === c.operator) ?? OPERATORS[0];
      return c.operator === "exists" ? `${field} ${op.text}` : c.expectedValue.trim() ? `${field} ${op.text} ${quote(c.expectedValue)}` : `${field} ${op.text} …`;
    }
  }
}

export function newCheck(kind: CheckKind, id: string): CheckDraft {
  return {
    id, kind, customLabel: false, label: "",
    field: kind === "tags" ? "tags" : "",
    operator: kind === "tags" ? "contains" : "equals",
    expectedValue: "", expectedCount: kind === "count" ? 1 : kind === "fresh" ? 10 : 0,
    expectedFrom: "", countOp: "equals",
    valueFrom: kind === "output" ? "event.data.output_count" : "event.data.target_record_id",
  };
}

/** Applies a patch and keeps the generated name in sync with the rule unless the user renamed it. */
export function updateCheck(c: CheckDraft, patch: Partial<CheckDraft>, ctx: { system: TargetKind; tab?: string | null }): CheckDraft {
  const next = { ...c, ...patch };
  if (patch.label !== undefined && patch.customLabel === undefined) next.customLabel = true;
  if (!next.customLabel) next.label = autoLabel(next, ctx);
  return next;
}

/** Returns a plain-language problem, or null when the check is ready. */
export function validateCheck(c: CheckDraft, ctx: { system: TargetKind }): string | null {
  if (c.kind === "output") return null;
  if (ctx.system === "none") return "Choose where Outcom should look (Google Sheets, Airtable, HubSpot, HighLevel or any other app), or keep only “The run produced output”.";
  if (c.kind === "exists") return c.valueFrom.trim() ? null : "Say which field of your webhook holds the record id.";
  if (c.kind === "tags") return null;
  if (c.kind === "required") return splitFields(c.field).length ? null : "Type the field names that must be filled in, separated by commas.";
  if (c.kind === "count") return ctx.system === "reported" ? (Number.isFinite(c.expectedCount) && c.expectedCount >= 0 ? null : "Type how many records you expect.") : "Counting records works with “Any other app”: your workflow sends how many it found.";
  if (c.kind === "fresh") return !c.field.trim() ? "Name the date or time field, for example created_at." : !(c.expectedCount > 0) ? "Type how many minutes after the run the record may be written." : null;
  if (c.kind === "value" && (c.expectedFrom ?? "").trim()) return c.field.trim() ? null : "Pick the column to check.";
  if (!c.field.trim()) return ctx.system === "google_sheets" || ctx.system === "airtable" ? "Pick the column to check." : ctx.system === "hubspot" ? "Pick the HubSpot property to check." : "Say which field to check.";
  if (c.operator !== "exists" && !c.expectedValue.trim()) return `Type the value that “${c.field.trim()}” should have.`;
  return null;
}

export type CheckPayload = {
  id: string; label: string; type: OutcomeType; system: string; entity: string;
  field: string; operator: string; expectedValue: string; expectedCount: number; valueFrom: string;
  mode?: "required_fields" | "record_count" | "fresh_within";
  fields?: string[]; expectedFrom?: string; maxMinutes?: number;
  target: unknown;
};

export function toPayload(c: CheckDraft, system: TargetKind, target: unknown, tab?: string | null): CheckPayload {
  const type = outcomeTypeOf(c.kind);
  const label = c.label.trim() || autoLabel(c, { system, tab });
  const out = c.kind === "output";
  return {
    id: c.id, label, type,
    system: out ? "event" : system,
    entity: out ? "output" : system === "google_sheets" ? "row" : system === "airtable" ? "record" : system === "reported" ? "evidence" : "contact",
    field: c.kind === "required" ? "" : c.field.trim() || "tags",
    operator: out ? "greater_than" : c.kind === "count" ? (c.countOp ?? "equals") : c.operator,
    expectedValue: c.operator === "exists" || (c.expectedFrom ?? "").trim() ? "" : c.expectedValue.trim(),
    ...(modeOf(c.kind) ? { mode: modeOf(c.kind)! } : {}),
    ...(c.kind === "required" ? { fields: splitFields(c.field) } : {}),
    ...(c.kind === "value" && (c.expectedFrom ?? "").trim() ? { expectedFrom: c.expectedFrom.trim() } : {}),
    ...(c.kind === "fresh" ? { maxMinutes: c.expectedCount } : {}),
    expectedCount: Number.isFinite(c.expectedCount) ? c.expectedCount : 0,
    valueFrom: c.valueFrom.trim() || (out ? "event.data.output_count" : "event.data.target_record_id"),
    target: !out && (hasNamedFields(system) || system === "reported") ? target : null,
  };
}
