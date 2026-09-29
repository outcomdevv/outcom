import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const checks = [
  ["Reliability page", "app/reliability/page.tsx", "historical first-check result"],
  ["Reliability metrics", "app/reliability/page.tsx", "Outcome Reliability"],
  ["Seven-day trend", "app/reliability/page.tsx", "Reliability trend"],
  ["Workflow reliability table", "app/reliability/page.tsx", "Reliability by workflow"],
  ["Failure history", "app/reliability/page.tsx", "Recent failures"],
  ["Resolution metric", "app/reliability/page.tsx", "AVERAGE TIME TO RESOLUTION"],
  ["Reliability styling", "app/reliability/reliability.module.css", ".metrics"],
  ["Reliability navigation", "app/layout.tsx", 'href: "/reliability"'],
  ["No new migration required", "V75-OUTCOME-RELIABILITY.md", "No new database migration"],
];
let passed = 0;
for (const [name, file, needle] of checks) {
  const full = path.join(root, file);
  const ok = fs.existsSync(full) && fs.readFileSync(full, "utf8").includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${checks.length} V75 structural checks passed`);
if (passed !== checks.length) process.exit(1);
