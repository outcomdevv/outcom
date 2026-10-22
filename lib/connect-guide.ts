// Plain-language "last step" instructions per platform for the Connect page. Pure, no UI.
// Every platform sends ONE field called target_record_id. The inbound webhook reads it at the top level
// (and also under data.), so non-technical users fill a name/value pair instead of writing JSON.

/** Tools that only need an HTTP POST. They share one guide; only the wording of the first step differs. */
export const HTTP_TOOLS = {
  pipedream: { group: "No-code and enterprise", label: "Pipedream", first: "At the end of the workflow add a step: search for “HTTP” and choose the action that sends an HTTP request." },
  activepieces: { group: "No-code and enterprise", label: "Activepieces", first: "At the end of the flow add the HTTP piece and choose its “Send HTTP request” action." },
  power_automate: { group: "No-code and enterprise", label: "Power Automate", first: "At the end of the flow add the HTTP action (it is a premium connector in Power Automate)." },
  workato: { group: "No-code and enterprise", label: "Workato", first: "At the end of the recipe add an HTTP action that sends a POST request." },
  uipath: { group: "No-code and enterprise", label: "UiPath", first: "At the end of the process add an HTTP request activity set to POST." },
  airtable_automations: { group: "No-code and enterprise", label: "Airtable Automations", first: "At the end of the automation add a “Run a script” action and send the JSON below with fetch()." },
  ghl_workflows: { group: "No-code and enterprise", label: "HighLevel Workflows", first: "At the end of the workflow add the Custom Webhook action." },
  gumloop: { group: "AI agent builders", label: "Gumloop", first: "At the end of the flow add the node that sends an HTTP or API request (search the node list for “HTTP” or “API request”)." },
  relevance_ai: { group: "AI agent builders", label: "Relevance AI", first: "At the end of the agent or tool add a step that sends an API request (search for “API” or “HTTP”)." },
  lindy: { group: "AI agent builders", label: "Lindy", first: "At the end of the agent add an action that sends an HTTP or webhook request (search for “HTTP” or “webhook”)." },
  stack_ai: { group: "AI agent builders", label: "Stack AI", first: "At the end of the flow add a node that calls an API (search for “API” or “HTTP”)." },
  vellum: { group: "AI agent builders", label: "Vellum", first: "At the end of the workflow add an API or code node that sends an HTTP POST." },
} satisfies Record<string, { group: string; label: string; first: string }>;

export type HttpToolId = keyof typeof HTTP_TOOLS;
export type GuidePlatform = "n8n" | "zapier" | "make" | "custom" | HttpToolId;

export const FIELD_NAME = "target_record_id";

export type Guide = {
  tool: string;
  /** Short clicks, in order. {url} and {field} are shown as copy boxes by the UI, not inline. */
  steps: string[];
  /** The value to give the field, in words the user can find on screen. */
  valueHelp: (keyColumn: string | null, expression?: string | null) => string;
  /** Only shown under "Show as JSON" for tools that need a raw body. */
  json: (keyColumn: string | null, expression?: string | null) => string;
};

export const guideFor = (platform: string): Guide => {
  const http = (HTTP_TOOLS as Record<string, { label: string; first: string }>)[platform];
  if (http) {
    return {
      tool: http.label,
      steps: [http.first, "Method: POST. URL: paste your address.", "Body: JSON, with one field named target_record_id.", "Run the automation once."],
      valueHelp: k => `Its value is the “${k || "id"}” of the record your automation just handled. Pick it from an earlier step.`,
      json: () => `{"target_record_id": "<value>"}`,
    };
  }
  switch (platform) {
    case "n8n":
      return {
        tool: "n8n",
        steps: [
          "Click the + after your last node and add HTTP Request.",
          "Method: POST. URL: paste your address.",
          "Turn on Send Body. Body Content Type: JSON. Specify Body: Using Fields Below.",
          "Add one field. Name: target_record_id.",
          "For Value, drag the field from the left panel (see below).",
          "Publish, then run the workflow once.",
        ],
        valueHelp: k => `Drag “${k || "the id"}” from the input panel on the left into Value. Use the step that still has the original data, for example the one before Google Sheets.`,
        json: k => `{"target_record_id": "{{ $('Your earlier node').item.json.${k || "email"} }}"}`,
      };
    case "zapier":
      return {
        tool: "Zapier",
        steps: [
          "Add an action: Webhooks by Zapier.",
          "Event: POST. URL: paste your address.",
          "Payload Type: Json.",
          "In Data, add one row. Key: target_record_id.",
          "For the value, click and pick the field from an earlier step.",
          "Test the step, then turn the Zap on.",
        ],
        valueHelp: k => `Pick “${k || "the id"}” from an earlier step in the list that opens.`,
        json: () => `{"target_record_id": "<pick the field>"}`,
      };
    case "make":
      return {
        tool: "Make",
        steps: [
          "Add a module: HTTP → Make a request.",
          "URL: paste your address. Method: POST.",
          "Body type: Raw. Content type: JSON (application/json).",
          "In Request content, paste the JSON below.",
          "Only if the message is empty between the quotes: click there and pick the field from the list.",
          "Run the scenario once.",
        ],
        valueHelp: (k, e) => e ? `Already filled in: ${e} is the same value your scenario saved as “${k || "the id"}”. Paste the message below as it is.` : `Between the quotes, pick “${k || "the id"}” from the list that opens.`,
        json: (_k, e) => `{"target_record_id": "${e ?? ""}"}`,
      };
    default:
      return {
        tool: "your tool",
        steps: [
          "Add a step that sends an HTTP POST.",
          "URL: paste your address.",
          "Send JSON with one field named target_record_id.",
          "Run your automation once.",
        ],
        valueHelp: k => `Its value is the “${k || "id"}” of the record your automation just handled.`,
        json: () => `{"target_record_id": "<value>"}`,
      };
  }
};

/**
 * A ready-made n8n node. n8n accepts pasted JSON on the canvas ({nodes, connections}), so the user does
 * Copy → Ctrl+V → connect it after the Google Sheets step. Placed right after that step, the row it just wrote
 * has the sheet's own column names, so {{ $json['Email'] }} is the value Outcom must find in the sheet.
 */
export function n8nPasteNode(url: string, keyColumn: string | null, fill = true): string {
  const key = (keyColumn || "id").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return JSON.stringify({
    nodes: [{
      parameters: {
        method: "POST",
        url,
        sendBody: true,
        specifyBody: "json",
        jsonBody: fill ? `={\n  "target_record_id": "{{ $json['${key}'] }}"\n}` : `={\n  "target_record_id": ""\n}`,
        options: {},
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [0, 0],
      name: "Tell Outcom",
    }],
    connections: {},
  });
}

/** What the read-back step sends. `found` must be true when the search step returned a record. */
export function evidenceJson(step: string): string {
  return JSON.stringify({ run_id: "<id of this run>", evidence: [{ step: step || "crm", found: true, count: 1, key: "<the email or id you searched for>", fields: { Email: "<optional values to check>" } }] }, null, 2);
}

/**
 * A ready-made n8n node for the read-back step. Put it right after the step that searches the destination
 * (Airtable "Search", HubSpot "Get contact", Salesforce "Get record", and so on). Turn on "Always Output Data" on that
 * search step, otherwise an empty result sends nothing and Outcom can only say UNKNOWN instead of FAIL.
 * `run_id` is the n8n execution id, so every step of one run reports into the same run.
 */
export function n8nEvidenceNode(url: string, step: string): string {
  const name = (step || "crm").replace(/\\/g, "\\\\").replace(/"/g, "'");
  return JSON.stringify({
    nodes: [{
      parameters: {
        method: "POST",
        url,
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={\n  "run_id": "{{ $execution.id }}",\n  "evidence": [{\n    "step": "${name}",\n    "found": {{ $input.all().filter(i => Object.keys(i.json || {}).length > 0).length > 0 }},\n    "count": {{ $input.all().filter(i => Object.keys(i.json || {}).length > 0).length }},\n    "fields": {{ JSON.stringify($input.first()?.json ?? {}) }}\n  }]\n}`,
        options: {},
      },
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [0, 0],
      name: "Tell Outcom what was found",
    }],
    connections: {},
  });
}

/** The MCP address for a workflow: same secret as the webhook address, different path. */
export const mcpUrl = (webhookUrl: string) => webhookUrl.replace("/api/inbound/", "/api/mcp/");

/** Config for MCP clients that take a JSON server list (Cursor, Claude Desktop via mcp-remote, and similar). */
export function mcpConfigJson(webhookUrl: string): string {
  return JSON.stringify({ mcpServers: { outcom: { url: mcpUrl(webhookUrl) } } }, null, 2);
}
