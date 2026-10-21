import { NextResponse } from "next/server";
import { POST as inboundPost } from "@/app/api/inbound/[token]/route";
import { MCP_PROTOCOL, VERIFY_TOOL, validateVerifyArgs, verdictText, type RpcMessage } from "@/lib/mcp";

export const dynamic = "force-dynamic";

const ok = (id: RpcMessage["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const err = (id: RpcMessage["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], isError });

async function handle(msg: RpcMessage, token: string): Promise<unknown | null> {
  const { id, method, params } = msg;
  if (msg.jsonrpc !== "2.0" || typeof method !== "string") return err(id, -32600, "Invalid request.");
  if (id === undefined) return null; // notification: no reply
  if (method === "initialize") {
    const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : MCP_PROTOCOL;
    return ok(id, { protocolVersion: requested, capabilities: { tools: {} }, serverInfo: { name: "outcom", version: "1.0.0" }, instructions: "Use verify_outcome after finishing a task to get independent proof that the business result exists." });
  }
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") return ok(id, { tools: [VERIFY_TOOL] });
  if (method === "tools/call") {
    if (params?.name !== VERIFY_TOOL.name) return err(id, -32602, `Unknown tool: ${String(params?.name)}`);
    const v = validateVerifyArgs(params.arguments);
    if (!v.ok) return ok(id, text(v.error, true));
    const res = await inboundPost(new Request("http://internal/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v.body) }), { params: Promise.resolve({ token }) });
    const json = await res.json().catch(() => ({}));
    if (res.status === 404 || res.status === 410) return ok(id, text("This Outcom address is invalid or was rotated. Ask the owner for the current address.", true));
    if (!res.ok) return ok(id, text(`Outcom could not process the evidence: ${String((json as any).error ?? res.status)}`, true));
    const { text: t, verdict } = verdictText((json as any).results);
    return ok(id, { ...text(t), structuredContent: { verdict, run_id: (v.body as any).run_id } });
  }
  return err(id, -32601, `Method not found: ${method}`);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 32) return NextResponse.json(err(null, -32001, "Invalid address."), { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json(err(null, -32700, "Parse error."), { status: 400 }); }
  try {
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map((m) => handle(m as RpcMessage, token)))).filter((r) => r !== null);
      return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
    }
    const reply = await handle(body as RpcMessage, token);
    return reply === null ? new NextResponse(null, { status: 202 }) : NextResponse.json(reply);
  } catch (e) {
    return NextResponse.json(err((body as RpcMessage)?.id, -32603, e instanceof Error ? e.message : "Internal error."));
  }
}

export async function GET() {
  return NextResponse.json({ error: "This is an MCP endpoint. Connect an MCP client to this URL (Streamable HTTP)." }, { status: 405 });
}
