import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  ["workspace-aware OAuth", "lib/oauth.ts", "getValidAccessToken(provider:OAuthProvider, workspaceId?:string)"],
  ["workspace-aware GHL adapter", "lib/adapters/ghl.ts", "ghlAdapter(workspaceId?: string)"],
  ["workspace-aware checker", "lib/outcome-checker/index.ts", "evaluateEvent(event: WorkflowEvent, workspaceId?: string)"],
  ["public webhook workspace context", "app/api/inbound/[token]/route.ts", "workspace_id: endpoint.workspace_id"],
  ["manual verification route", "app/api/events/[id]/verify/route.ts", "evaluateEvent(event, store.workspaceId)"],
  ["event store get", "lib/db/index.ts", "async get(eventId: string)"],
  ["incident reopen", "lib/db/index.ts", "async reopen(incidentId: string"],
  ["retry UI", "app/workflows/[id]/event-verify-button.tsx", "Verify again"],
];
let failed = false;
for (const [label, relative, needle] of required) {
  const file = path.join(root, relative);
  const ok = fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("PASS · V72 structural milestone checks");
