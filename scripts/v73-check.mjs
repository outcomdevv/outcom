import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = [
  ["demo UI", "app/demo/page.tsx", "Simulate silent failure"],
  ["demo API", "app/api/demo/route.ts", "silent_failure"],
  ["mock CRM adapter", "lib/adapters/mock-crm.ts", "MockCRMAdapter"],
  ["mock CRM outcome path", "lib/adapters/registry.ts", '["mock_crm"'],
  ["real verifier reused", "app/api/demo/route.ts", "evaluateEvent(event, store.workspaceId)"],
  ["repair path", "app/api/demo/route.ts", 'action === "repair"'],
  ["dashboard entry", "app/page.tsx", "/demo"],
];
let failed = false;
for (const [label, relative, needle] of required) {
  const file = path.join(root, relative);
  const ok = fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("PASS · V73 structural milestone checks");
