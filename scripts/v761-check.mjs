import fs from "node:fs";
const oauth = fs.readFileSync("lib/oauth.ts", "utf8");
if (!/export type OAuthProvider[^\n]*google_sheets/.test(oauth)) throw new Error("FAIL: OAuthProvider missing google_sheets");
if (!/google_sheets:\s*\{/.test(oauth)) throw new Error("FAIL: Google provider config missing");
if (!/accounts\.google\.com\/o\/oauth2\/v2\/auth/.test(oauth)) throw new Error("FAIL: Google authorize endpoint missing");
if (!/oauth2\.googleapis\.com\/token/.test(oauth)) throw new Error("FAIL: Google token endpoint missing");
if (!/provider===\"google_sheets\"/.test(oauth)) throw new Error("FAIL: Google profile handling missing");
if (!/access_type.*offline/.test(oauth)) throw new Error("FAIL: Google offline access missing");
const evidence = fs.readFileSync("app/evidence/page.tsx", "utf8");
for (const marker of ["EXECUTION","EXPECTATION","EVIDENCE","VERIFICATION","BUSINESS OUTCOME","store.incidents.list()","store.events.list()","store.contracts.list()"]) {
  if (!evidence.includes(marker)) throw new Error(`FAIL: Evidence Graph marker missing: ${marker}`);
}
console.log("V76.1 CHECK: PASS");
console.log("Google OAuth provider restored and Evidence Graph retained.");
