// Minimal MCP (Model Context Protocol) server over Streamable HTTP, stateless. One tool: verify_outcome.
// An AI agent reads the result back from its own destination, reports what it saw, and gets Outcom's verdict.
export const MCP_PROTOCOL = "2025-03-26";

export const VERIFY_TOOL = {
  name: "verify_outcome",
  description:
    "Ask Outcom to verify that a task really produced its business result. Call it after you finish a task: first read the result back from the destination system (the CRM contact, the sheet row, the invoice, the sent message) with your own tools, then report what you saw. Outcom returns PASS, FAIL or UNKNOWN. Do not tell the user the task is done unless the verdict is PASS. Use the same run_id for every step of one task.",
  inputSchema: {
    type: "object",
    properties: {
      step: { type: "string", description: "Short name of what you checked, e.g. 'crm-contact' or 'invoice-sent'. Reuse the same name every time for the same kind of check." },
      found: { type: "boolean", description: "true if you found the result in the destination system, false if it is missing." },
      key: { type: "string", description: "Identifier of the record you looked for, e.g. an email address or record id." },
      fields: { type: "object", description: "Only the field values needed to judge the result, e.g. {\"status\":\"qualified\"}. Do not send secrets or whole records.", additionalProperties: true },
      run_id: { type: "string", description: "Identifier of this task run. Use one value per task so several steps are judged together." },
    },
    required: ["step", "found"],
  },
} as const;

type Json = Record<string, unknown>;
export type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Json };

export function validateVerifyArgs(args: unknown): { ok: true; body: Json } | { ok: false; error: string } {
  const a = args && typeof args === "object" && !Array.isArray(args) ? (args as Json) : {};
  const step = typeof a.step === "string" ? a.step.trim() : "";
  if (!step) return { ok: false, error: "step is required (a short name for what you checked)." };
  if (typeof a.found !== "boolean") return { ok: false, error: "found is required and must be true or false." };
  if (a.fields !== undefined && (typeof a.fields !== "object" || a.fields === null || Array.isArray(a.fields))) return { ok: false, error: "fields must be an object." };
  const key = typeof a.key === "string" && a.key.trim() ? a.key.trim() : undefined;
  const runId = typeof a.run_id === "string" && a.run_id.trim() ? a.run_id.trim().slice(0, 200) : `mcp-${crypto.randomUUID()}`;
  return { ok: true, body: { run_id: runId, status: "success", ...(key ? { target_record_id: key } : {}), evidence: [{ step, found: a.found, ...(key ? { key } : {}), fields: (a.fields as Json) ?? {} }] } };
}

type CheckLike = { state: string; title?: string; expected?: string; observed?: string; recommendedAction?: string };

/** Turns Outcom's per-check results into one plain verdict an agent can act on. */
export function verdictText(results: CheckLike[] | undefined): { verdict: "PASS" | "FAIL" | "UNKNOWN" | "NO_CHECKS"; text: string } {
  const list = Array.isArray(results) ? results : [];
  if (!list.length) return { verdict: "NO_CHECKS", text: "NO CHECKS: Outcom stored your evidence, but this workflow has no enabled checks yet, so nothing was verified. Do not report the task as verified." };
  const failed = list.filter((r) => r.state === "failed");
  if (failed.length) return { verdict: "FAIL", text: `FAIL: ${failed.map((r) => `${r.title ?? "Check failed"} (expected: ${r.expected ?? "?"}; observed: ${r.observed ?? "?"})`).join(" | ")}. The task did not produce the expected result. Do not report it as done; fix it or tell the user.` };
  const unknown = list.filter((r) => r.state !== "passed");
  if (unknown.length) return { verdict: "UNKNOWN", text: `UNKNOWN: Outcom could not confirm ${unknown.length} of ${list.length} checks. ${unknown[0].recommendedAction ?? ""} Another step may still need to report. Do not report the task as verified yet.`.trim() };
  return { verdict: "PASS", text: `PASS: ${list.length} of ${list.length} checks verified.` };
}
