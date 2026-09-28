import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const checks = [
  ["Outcome Contracts page", "app/contracts/contracts-client.tsx", "What should happen?"],
  ["Outcom Records page", "app/records/records-client.tsx", "OUTCOM RECORDS"],
  ["Contracts API", "app/api/contracts/route.ts", "store.contracts.create"],
  ["Records API", "app/api/records/route.ts", "store.contacts.upsert"],
  ["Google OAuth provider", "lib/oauth.ts", "google_sheets"],
  ["Google Sheets adapter", "lib/adapters/google-sheets.ts", "class GoogleSheetsAdapter"],
  ["Google Sheets files API", "app/api/google-sheets/files/route.ts", "drive/v3/files"],
  ["Google Sheets configuration API", "app/api/google-sheets/configure/route.ts", "updateMetadata"],
  ["Google Sheets configuration UI", "app/contracts/contracts-client.tsx", "Load my spreadsheets"],
  ["Native records verifier adapter", "lib/outcome-checker/index.ts", 'system === "outcom_records"'],
  ["Google Sheets verifier adapter", "lib/outcome-checker/index.ts", 'system === "google_sheets"'],
  ["Sidebar contract navigation", "app/layout.tsx", 'href: "/contracts"'],
];
let passed = 0;
for (const [name, file, needle] of checks) {
  const full = path.join(root, file);
  const ok = fs.existsSync(full) && fs.readFileSync(full, "utf8").includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${checks.length} V74 structural checks passed`);
if (passed !== checks.length) process.exit(1);
