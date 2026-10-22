// Starting points for the most common client workflows. Each one is a list of checks the user can edit afterwards.
import type { CheckDraft, CheckKind } from "@/lib/connect-checks";

export type TemplateItem = { kind: CheckKind; patch?: Partial<CheckDraft> };
export type CheckTemplate = { id: string; title: string; text: string; items: TemplateItem[] };

const one: Partial<CheckDraft> = { countOp: "equals", expectedCount: 1 };

export const CHECK_TEMPLATES: CheckTemplate[] = [
  { id: "lead", title: "New lead goes to the CRM", text: "Saved once, with an email and an owner.", items: [{ kind: "exists" }, { kind: "required", patch: { field: "email, owner" } }, { kind: "count", patch: one }] },
  { id: "owner", title: "Lead has a real owner", text: "Not left in the default queue.", items: [{ kind: "exists" }, { kind: "required", patch: { field: "owner" } }, { kind: "value", patch: { field: "owner", operator: "not_equals", expectedValue: "Unassigned" } }] },
  { id: "invoice", title: "Invoice or payment created", text: "Created once, with an amount and a status.", items: [{ kind: "exists" }, { kind: "required", patch: { field: "amount, status" } }, { kind: "count", patch: one }] },
  { id: "message", title: "Email or SMS was sent", text: "The sent log shows it as sent.", items: [{ kind: "exists" }, { kind: "value", patch: { field: "status", operator: "equals", expectedValue: "sent" } }] },
  { id: "booking", title: "Booking created", text: "Booked once, with a date.", items: [{ kind: "exists" }, { kind: "required", patch: { field: "date" } }, { kind: "count", patch: one }] },
];
