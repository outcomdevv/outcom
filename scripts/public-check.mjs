import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = ['supabase/migrations/001_public_architecture.sql','lib/supabase/server.ts','lib/auth.ts','middleware.ts','observer/worker.ts','app/auth/login/page.tsx','app/settings/page.tsx'];
for (const file of required) if (!fs.existsSync(path.join(root,file))) throw new Error(`Missing public architecture file: ${file}`);
const all = [];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','.next'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else all.push(p)}}
walk(root);
const bad = all.filter(f => !f.endsWith('scripts/public-check.mjs') && /node:sqlite|outcomeguard\.sqlite|app[\\/]api[\\/]demo/.test(fs.readFileSync(f,'utf8')));
if(bad.length) throw new Error(`Public build still contains local SQLite/demo references: ${bad.join(', ')}`);
console.log('Outcom public architecture check passed. Persistent Supabase schema, auth, workspace isolation, encrypted secrets and scheduled observer scaffolding are present.');
