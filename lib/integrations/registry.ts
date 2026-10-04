// Single source of truth for every system Outcom can observe or verify against.
// Two roles, deliberately separate:
//   "source"  = where the automation RUNS (we observe executions)
//   "target"  = where the business outcome LIVES (we verify state; the system of truth)
// Status is honest: "live" = code exists and has run against the real service,
// "code_complete" = implemented but not yet proven with real credentials, "webhook" = works through the universal
// inbound webhook only, "planned" = not built.

export type IntegrationRole = "source" | "target";
export type IntegrationStatus = "live" | "code_complete" | "webhook" | "planned";
export type IntegrationAuth = "oauth" | "api_key" | "private_token" | "webhook_url" | "none";
export type ObservationMode = "native_api" | "inbound_webhook";

export type IntegrationDef = {
  id: string;
  label: string;
  roles: IntegrationRole[];
  category: "automation" | "crm" | "data" | "payments" | "support" | "comms" | "generic";
  status: IntegrationStatus;
  auth: IntegrationAuth[];
  observe?: ObservationMode[];
  /** Entities Outcom can check in a target ("contact", "row", "payment"...). */
  verifies?: string[];
  note?: string;
};

export const INTEGRATIONS: readonly IntegrationDef[] = [
  // ── Execution sources (automation platforms) ──
  { id: "zapier", label: "Zapier", roles: ["source"], category: "automation", status: "code_complete", auth: ["oauth", "webhook_url"], observe: ["inbound_webhook"], note: "OAuth Zap discovery awaits Zapier public-app credentials; webhook observation works today." },
  { id: "make", label: "Make", roles: ["source"], category: "automation", status: "code_complete", auth: ["oauth", "api_key", "webhook_url"], observe: ["native_api", "inbound_webhook"] },
  { id: "n8n", label: "n8n", roles: ["source"], category: "automation", status: "live", auth: ["api_key", "webhook_url"], observe: ["native_api", "inbound_webhook"], note: "Native API needs a HighLevel write node; use webhook mode for any other target." },
  { id: "pipedream", label: "Pipedream", roles: ["source"], category: "automation", status: "webhook", auth: ["webhook_url"], observe: ["inbound_webhook"], note: "Add an HTTP POST step at the end of the workflow." },
  { id: "activepieces", label: "Activepieces", roles: ["source"], category: "automation", status: "webhook", auth: ["webhook_url"], observe: ["inbound_webhook"] },
  { id: "power_automate", label: "Microsoft Power Automate", roles: ["source"], category: "automation", status: "webhook", auth: ["webhook_url"], observe: ["inbound_webhook"] },
  { id: "workato", label: "Workato", roles: ["source"], category: "automation", status: "webhook", auth: ["webhook_url"], observe: ["inbound_webhook"] },
  { id: "ghl_workflows", label: "HighLevel Workflows", roles: ["source"], category: "automation", status: "webhook", auth: ["webhook_url"], observe: ["inbound_webhook"], note: "Use the Custom Webhook action at the end of a HighLevel workflow." },
  { id: "custom", label: "Custom code / any HTTP sender", roles: ["source"], category: "generic", status: "webhook", auth: ["webhook_url"], observe: ["inbound_webhook"], note: "Anything that can POST JSON: scripts, cron jobs, AI agents, Cloudflare Workers." },
  // ── Systems of truth (verification targets) ──
  { id: "ghl", label: "HighLevel", roles: ["target"], category: "crm", status: "code_complete", auth: ["private_token", "oauth"], verifies: ["contact"], note: "Read-only. Real-account testing pending (signup required a card)." },
  { id: "google_sheets", label: "Google Sheets", roles: ["target"], category: "data", status: "code_complete", auth: ["oauth"], verifies: ["row"], note: "Free for everyone. Read-only. Verifies a row exists / a column value. Real-account test pending." },
  { id: "airtable", label: "Airtable", roles: ["target"], category: "data", status: "planned", auth: ["oauth", "private_token"], verifies: ["record"] },
  { id: "hubspot", label: "HubSpot", roles: ["target"], category: "crm", status: "planned", auth: ["oauth", "private_token"], verifies: ["contact", "deal"] },
  { id: "stripe", label: "Stripe", roles: ["target"], category: "payments", status: "planned", auth: ["api_key"], verifies: ["customer", "payment", "invoice"], note: "Restricted read-only key." },
  { id: "pipedrive", label: "Pipedrive", roles: ["target"], category: "crm", status: "planned", auth: ["oauth"], verifies: ["person", "deal"] },
  { id: "notion", label: "Notion", roles: ["target"], category: "data", status: "planned", auth: ["oauth"], verifies: ["page"] },
  { id: "http_check", label: "Any REST API (read-only check)", roles: ["target"], category: "generic", status: "planned", auth: ["api_key", "none"], verifies: ["http_resource"], note: "Generic GET + JSON-path assertion: one adapter that unlocks long-tail systems." },
] as const;

const byId = new Map(INTEGRATIONS.map(i => [i.id, i]));

export const getIntegration = (id: string) => byId.get(id) ?? null;
export const isInboundSource = (id: string): boolean => Boolean(byId.get(id)?.roles.includes("source") && byId.get(id)?.observe?.includes("inbound_webhook"));
export const inboundSourceIds = (): string[] => INTEGRATIONS.filter(i => isInboundSource(i.id)).map(i => i.id);
export const targetIds = (): string[] => INTEGRATIONS.filter(i => i.roles.includes("target")).map(i => i.id);
