import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = [
  "app/demo/page.tsx",
  "app/contracts/contracts-client.tsx",
  "app/contracts/contracts.module.css",
  "public/brands/google-sheets.svg",
  "public/brands/highlevel.svg",
  "public/brands/hubspot.svg",
  "public/brands/shopify.svg",
  "public/brands/stripe.svg",
  "V75.2-POLISH.md",
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
const demo = fs.readFileSync(path.join(root, "app/demo/page.tsx"), "utf8");
if (!demo.includes("Repair demo state + verify") || !demo.includes("does not modify or rerun a live")) throw new Error("Demo scope copy missing");
const contracts = fs.readFileSync(path.join(root, "app/contracts/contracts-client.tsx"), "utf8");
if (!contracts.includes("/brands/google-sheets.svg") || !contracts.includes("/brands/highlevel.svg") || contracts.includes('>HL</span>')) throw new Error("Brand logo replacement incomplete");
console.log("V75.2 CHECK: PASS");
console.log(`Validated ${required.length} required files.`);
