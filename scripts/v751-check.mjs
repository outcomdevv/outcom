import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const checks = [
  ["Records API uses workspace store", "app/api/records/route.ts", "store.contacts.list"],
  ["Records list fallback", "lib/db/index.ts", "async list()"],
  ["Records timestamps", "app/records/records-client.tsx", "created_at"],
  ["Protected Outcomes language", "app/contracts/contracts-client.tsx", "PROTECTED OUTCOMES"],
  ["Business result explanation", "app/contracts/contracts-client.tsx", "What should actually happen?"],
  ["Business system logos", "app/contracts/contracts-client.tsx", "SystemLogo"],
  ["Contract timestamps", "app/contracts/contracts-client.tsx", "Protected ${new Date(c.createdAt)"],
  ["Protected Outcomes navigation", "app/layout.tsx", 'label: "Protected Outcomes"'],
  ["Reliability explanation", "app/reliability/page.tsx", "How reliability is calculated"],
  ["Reliability outcome checks", "app/reliability/page.tsx", "OUTCOME CHECKS"],
  ["Reliability historical failures", "app/reliability/page.tsx", "historical outcome failures"],
];
let passed = 0;
for (const [name, file, needle] of checks) {
  const full = path.join(root, file);
  const ok = fs.existsSync(full) && fs.readFileSync(full, "utf8").includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${checks.length} V75.1 structural checks passed`);
if (passed !== checks.length) process.exit(1);
