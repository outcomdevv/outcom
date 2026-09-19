import { NextResponse } from "next/server";
import { getWorkspaceStore } from "@/lib/db";
import { decryptSecret } from "@/lib/oauth";

export const dynamic = "force-dynamic";

type AssistantResult = { message: string; action: string; path: string | null };

function fallback(message: string, context: any): AssistantResult {
  const q = message.toLowerCase();
  const open = context.incidents.filter((i: any) => i.status === "open");
  const connected = context.connections.map((c: any) => c.provider).join(", ") || "none";

  if (/^(hi|hello|hey|halo|test|tes|ping|yo)\b/.test(q))
    return { message: "Hey — I’m Operator. I can inspect your workspace, explain findings, guide a first connection, or help you decide what to do next. Try “what should I do first?”", action: "none", path: null };
  if (/what should i do first|next step|mulai dari mana|harus.*dulu|priorit/.test(q))
    return { message: `Start with one real workflow, not every integration. This workspace currently has ${context.workflows.length} protected workflow${context.workflows.length === 1 ? "" : "s"}, ${open.length} open finding${open.length === 1 ? "" : "s"}, and ${connected === "none" ? "no connected providers" : `these connected providers: ${connected}`}. The practical next step is to connect one automation source, define one expected business outcome, and verify one real case.`, action: "connect", path: "/connect" };
  if (/summar|overview|workspace status|status/.test(q))
    return { message: `Workspace snapshot: ${context.workflows.length} protected workflow${context.workflows.length === 1 ? "" : "s"}, ${context.contracts.length} outcome contract${context.contracts.length === 1 ? "" : "s"}, ${open.length} open finding${open.length === 1 ? "" : "s"}, and ${connected === "none" ? "no connected providers" : connected + " connected"}. I can open the relevant area for a closer look.`, action: "none", path: null };
  if (/connect|hubungkan|integrat|setup.*(ghl|highlevel|n8n|make|zapier)/.test(q))
    return { message: "Opening Integrations. You can start with one automation source—n8n, Make, or Zapier—and connect HighLevel only if it stores the business state you want to verify.", action: "connect", path: "/connect" };
  if (/finding|incident|masalah|error|attention|perlu.*perhatian|needs.*attention/.test(q))
    return open[0] ? { message: `I found ${open.length} open finding${open.length === 1 ? "" : "s"}. Opening the first evidence chain.`, action: "open_incident", path: `/incidents/${open[0].id}` } : { message: "There are no open findings in this workspace. Opening Findings so you can review the current state.", action: "navigate", path: "/incidents" };
  if (/workflow|automation|zap|scenario|protected/.test(q))
    return { message: `This workspace has ${context.workflows.length} protected workflow${context.workflows.length === 1 ? "" : "s"}. Opening the workflow list.`, action: "navigate", path: "/workflows" };
  if (/contract|protect|outcome rule|assertion/.test(q))
    return { message: `There are ${context.contracts.length} outcome contract${context.contracts.length === 1 ? "" : "s"}. Opening Outcome Contracts.`, action: "navigate", path: "/contracts" };
  if (/setting|groq|operator.*config|model/.test(q))
    return { message: "Opening Settings, where you can configure Operator's AI provider and model.", action: "navigate", path: "/settings" };
  if (/refresh|sync|reload|update/.test(q))
    return { message: "Refreshing the command center.", action: "refresh", path: null };
  if (/what.*(can|do).*check|help|capabilit|how.*work/.test(q))
    return { message: `I can inspect this workspace without changing your integrations: ${context.workflows.length} workflows, ${context.contracts.length} contracts, ${open.length} open findings, and ${connected} connected provider(s). I can open the relevant page or explain what the data means.`, action: "none", path: null };
  return { message: "I can inspect your Outcom workspace, summarize findings, open workflows or contracts, guide integrations, and refresh the command center. Try: “what needs attention?”, “show my workflows”, or “how do I connect Make?”.", action: "none", path: null };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || "").trim();
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    const store = await getWorkspaceStore();
    const [workflows, incidents, connections, contracts, settings] = await Promise.all([
      store.workflows.list(), store.incidents.list(), store.connections.list(), store.contracts.list(), store.settings.get(),
    ]);
    const context = {
      workflows: workflows.map((w: any) => ({ id: w.id, name: w.name, platform: w.platform, status: w.status })),
      incidents: incidents.slice(0, 30).map((i: any) => ({ id: i.id, workflowId: i.workflowId, type: i.type, status: i.status, title: i.title, severity: i.severity, detectedAt: i.detectedAt })),
      connections: connections.map((c: any) => ({ provider: c.provider, accountName: c.accountName, status: c.status })),
      contracts: contracts.slice(0, 40).map((c: any) => ({ id: c.id, workflowId: c.workflowId, name: c.name, type: c.type, system: c.system, enabled: c.enabled })),
    };

    const settingsKey = settings.groqApiKeyEncrypted ? decryptSecret(settings.groqApiKeyEncrypted) : null;
    if (!settingsKey) return NextResponse.json({ ...fallback(message, context), mode: "local" });

    const history = (body.history || []).slice(-10).map((x: any) => `${String(x.role).toUpperCase()}: ${x.content}`).join("\n");
    const schema = { type: "object", properties: { message: { type: "string" }, action: { type: "string", enum: ["navigate", "open_incident", "open_workflow", "connect", "refresh", "none"] }, path: { type: ["string", "null"] } }, required: ["message", "action", "path"], additionalProperties: false };
    const prompt = `You are Outcom Operator, a careful enterprise workspace copilot. Answer the user's request using ONLY the workspace context below. Never invent records, statuses, integrations, or capabilities. You are read-only: never claim to create, delete, connect, repair, or change anything. If the user asks for an action that requires a human or external provider, explain that briefly and navigate to the relevant safe page when appropriate. Prefer a direct answer with concrete counts or names from context. Use concise, natural language. Treat Outcom as an exception-investigation copilot, not a generic analytics dashboard. Prioritize: what is wrong, which business entity is affected, evidence, impact, owner, and next action. Never invent evidence or claim that an integration is connected when it is not.\n\nAllowed navigation: /, /workflows, /incidents, /contracts, /connect, /settings. For a specific incident use /incidents/<id>; for a specific workflow use /workflows/<id>.\n\nWorkspace context:\n${JSON.stringify(context, null, 2)}\n\nRecent conversation:\n${history || "none"}\n\nUser request: ${message}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${settingsKey}` },
      body: JSON.stringify({ model: settings.groqModel || "openai/gpt-oss-120b", messages: [{ role: "system", content: "Return only the requested JSON object." }, { role: "user", content: prompt }], temperature: 0.1, reasoning_effort: "medium", response_format: { type: "json_schema", json_schema: { name: "outcom_operator", strict: true, schema } } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("AI provider request failed");
    const data = await response.json();
    let parsed: AssistantResult = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const allowed = new Set(["/", "/workflows", "/incidents", "/contracts", "/connect", "/settings"]);
    if (parsed.action === "navigate" && (!parsed.path || !allowed.has(parsed.path))) parsed = { ...parsed, action: "none", path: null };
    if (parsed.action === "connect") parsed = { ...parsed, path: "/connect" };
    if (parsed.action === "refresh") parsed = { ...parsed, path: null };
    if (parsed.action === "open_incident" && !parsed.path?.startsWith("/incidents/")) parsed = { ...parsed, action: "none", path: null };
    if (parsed.action === "open_workflow" && !parsed.path?.startsWith("/workflows/")) parsed = { ...parsed, action: "none", path: null };
    return NextResponse.json({ ...parsed, mode: "groq", model: settings.groqModel });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Assistant failed." }, { status: 500 });
  }
}
