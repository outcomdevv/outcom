import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = ["app/evidence/page.tsx","app/evidence/evidence.module.css","V76-EVIDENCE-GRAPH.md"];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`);
const page = fs.readFileSync(path.join(root,"app/evidence/page.tsx"),"utf8");
for (const marker of ["EXECUTION","EXPECTATION","EVIDENCE","VERIFICATION","BUSINESS OUTCOME","store.incidents.list()","store.events.list()","store.contracts.list()"])
  if (!page.includes(marker)) throw new Error(`Evidence Graph marker missing: ${marker}`);
const layout = fs.readFileSync(path.join(root,"app/layout.tsx"),"utf8");
if (!layout.includes('href: "/evidence"') || !layout.includes('Evidence Graph')) throw new Error("Evidence Graph navigation missing");
console.log("V76 CHECK: PASS");
console.log(`Validated ${required.length} required files.`);
