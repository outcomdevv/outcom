// The checks a user builds on the Connect page. Pure and testable.
// Rule: every check is a structured rule (column + condition + value). Its name is generated from the rule,
// so a custom check can never be a sentence that Outcom does not actually evaluate.

export type CheckKind = "exists" | "value" | "output" | "tags";
export type OutcomeType = "record_exists" | "state_invariant" | "output_count";
export type TargetKind = "google_sheets" | "ghl" | "none";

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
};

export const MAX_CHECKS = 10;

export const outcomeTypeOf = (kind: CheckKind): OutcomeType =>
  kind === "exists" ? "record_exists" : kind === "output" ? "output_count" : "state_invariant";

export const needsBusinessSystem = (checks: CheckDraft[]) => checks.some(c => c.kind !== "output");

const quote = (v: string) => `"${v.trim()}"`;

export function autoLabel(c: Pick<CheckDraft, "kind" | "field" | "operator" | "expectedValue" | "expectedCount">, ctx: { system: TargetKind; tab?: string | null }): string {
  switch (c.kind) {
    case "exists":
      return ctx.system === "google_sheets" ? `A row exists${ctx.tab ? ` in ${ctx.tab}` : ""}` : "The contact exists";
    case "output":
      return "The run produced output";
    case "tags":
      return "Existing tags are kept";
    case "value": {
      const field = c.field.trim();
      if (!field) return "Value check";
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
    expectedValue: "", expectedCount: 0,
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
  if (ctx.system === "none") return "Choose where Outcom should look (Google Sheets or HighLevel), or keep only “The run produced output”.";
  if (c.kind === "exists") return c.valueFrom.trim() ? null : "Say which field of your webhook holds the record id.";
  if (c.kind === "tags") return null;
  if (!c.field.trim()) return ctx.system === "google_sheets" ? "Pick the column to check." : "Say which field to check.";
  if (c.operator !== "exists" && !c.expectedValue.trim()) return `Type the value that “${c.field.trim()}” should have.`;
  return null;
}

export type CheckPayload = {
  id: string; label: string; type: OutcomeType; system: string; entity: string;
  field: string; operator: string; expectedValue: string; expectedCount: number; valueFrom: string;
  target: unknown;
};

export function toPayload(c: CheckDraft, system: TargetKind, target: unknown, tab?: string | null): CheckPayload {
  const type = outcomeTypeOf(c.kind);
  const label = c.label.trim() || autoLabel(c, { system, tab });
  const out = c.kind === "output";
  return {
    id: c.id, label, type,
    system: out ? "event" : system,
    entity: out ? "output" : system === "google_sheets" ? "row" : "contact",
    field: c.field.trim() || "tags",
    operator: out ? "greater_than" : c.operator,
    expectedValue: c.operator === "exists" ? "" : c.expectedValue.trim(),
    expectedCount: Number.isFinite(c.expectedCount) ? c.expectedCount : 0,
    valueFrom: c.valueFrom.trim() || (out ? "event.data.output_count" : "event.data.target_record_id"),
    target: !out && system === "google_sheets" ? target : null,
  };
}
