// Apps where a workflow's result usually lands. Outcom has no direct connector for these: the automation looks the
// result up with the connection it already has and reports what it found ("Any other app"). This list only tells
// the user WHAT to look up, so the read-back step is easy to build. Pure data.

export type DestinationApp = { id: string; label: string; group: string; lookup: string };

export const DESTINATION_APPS: readonly DestinationApp[] = [
  { id: "salesforce", label: "Salesforce", group: "CRM and sales", lookup: "the Lead, Contact or Opportunity (a Get, or a query by email or id)" },
  { id: "pipedrive", label: "Pipedrive", group: "CRM and sales", lookup: "the person or deal" },
  { id: "intercom", label: "Intercom", group: "CRM and sales", lookup: "the contact or conversation" },
  { id: "notion", label: "Notion", group: "Notes and docs", lookup: "the database page (search the database by title or a property)" },
  { id: "coda", label: "Coda", group: "Notes and docs", lookup: "the row in the table" },
  { id: "postgres", label: "Supabase / PostgreSQL / MySQL", group: "Databases", lookup: "the row (a SELECT … WHERE id = …). To catch duplicates, send COUNT(*) as count" },
  { id: "mongodb", label: "MongoDB", group: "Databases", lookup: "the document (a find by id)" },
  { id: "google_drive", label: "Google Drive", group: "Files", lookup: "the file (search by name or id in the folder)" },
  { id: "dropbox", label: "Dropbox", group: "Files", lookup: "the file (search by name or path)" },
  { id: "slack", label: "Slack", group: "Messaging", lookup: "the message or its id (the send step usually returns it)" },
  { id: "teams", label: "Microsoft Teams", group: "Messaging", lookup: "the message in the channel or chat" },
  { id: "stripe", label: "Stripe", group: "Payments", lookup: "the customer, invoice or payment (retrieve it by id)" },
  { id: "other", label: "Another app", group: "Other", lookup: "the record your automation just wrote" },
];

const byId = new Map(DESTINATION_APPS.map((a) => [a.id, a]));
export const destinationApp = (id: unknown): DestinationApp | null => (typeof id === "string" ? byId.get(id) ?? null : null);
/** Only known ids are stored, so the label that appears in evidence is never free text. */
export const cleanApp = (id: unknown): string | null => destinationApp(id)?.id ?? null;
export const DESTINATION_GROUPS = [...new Set(DESTINATION_APPS.map((a) => a.group))];
