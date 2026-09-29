import fs from "node:fs";
const oauth = fs.readFileSync("lib/oauth.ts", "utf8");
const required = [
  ["OAuthProvider includes google_sheets", /export type OAuthProvider[^\n]*google_sheets/],
  ["Google provider config", /google_sheets:\s*\{/],
  ["Google OAuth authorize endpoint", /accounts\.google\.com\/o\/oauth2\/v2\/auth/],
  ["Google OAuth token endpoint", /oauth2\.googleapis\.com\/token/],
  ["Google profile handling", /provider===\"google_sheets\"/],
  ["Offline refresh token request", /access_type.*offline/],
];
for (const [label, re] of required) if (!re.test(oauth)) throw new Error(`FAIL: ${label}`);
console.log(`V75.2.1 CHECK: ${required.length}/${required.length} PASS`);
