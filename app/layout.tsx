import Link from "next/link";
import type { ReactNode } from "react";
import { IntegrationLogo } from "@/app/integrations";
import { getWorkspaceStore } from "@/lib/db";
import { getUser, ensureWorkspace } from "@/lib/auth";
import "./globals.css";
import "./final.css";
import OperatorAssistant from "@/app/assistant";

export const metadata = { title: "Outcom — Business Outcome Assurance", description: "Verify what your automation actually accomplished." };
const nav = [
  { href: "/", label: "Command Center", icon: "⌂" },
  { href: "/workflows", label: "Protected Workflows", icon: "◇" },
  { href: "/incidents", label: "Findings", icon: "!" },
  { href: "/contracts", label: "Outcome Contracts", icon: "≡" },
  { href: "/connect", label: "Integrations", icon: "◎" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getUser();
  if (!user) return <html lang="en"><body>{children}</body></html>;
  const workspace = await ensureWorkspace();
  const store = workspace ? await getWorkspaceStore(workspace.workspaceId) : null;
  const connections = store ? await store.connections.list() : [];
  const workflows = store ? await store.workflows.list() : [];
  const open = store ? (await store.incidents.list()).filter(i => i.status === "open") : [];
  const connected = (p: string) => connections.some(c => c.provider === p);
  return (
    <html lang="en"><body>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand"><img className="outcom-logo" src="/outcom-logo.png" alt="Outcom" /></div>
          <div className="workspace-switcher"><span className="workspace-avatar">{(workspace?.workspace?.name || "O").slice(0,1).toUpperCase()}</span><div><b>{workspace?.workspace?.name || "Outcom Workspace"}</b><small>{user.email}</small></div><span>⌄</span></div>
          <div className="sidebar-section-label">Workspace</div>
          <nav className="sidebar-nav">{nav.map(item => <Link href={item.href} className="sidebar-link" key={item.href}><span className="sidebar-icon">{item.icon}</span><span>{item.label}</span>{item.label === "Findings" && open.length > 0 && <em className="nav-count">{open.length}</em>}</Link>)}</nav>
          <div className="sidebar-section-label integration-label">Connected stack</div>
          <div className="sidebar-integrations">{(["ghl","n8n","make","zapier"] as const).map(p => <span key={p}><IntegrationLogo name={p} size={17}/>{p === "ghl" ? "HighLevel" : p}<i className={`connection-dot ${connected(p) ? "on" : ""}`}/></span>)}</div>
          <div className="sidebar-spacer" />
          <div className="sidebar-health"><div><span className="live-dot"/><b>Verification engine</b></div><small>{workflows.length} protected · {open.length} open findings</small></div>
          <Link className="sidebar-connect" href="/connect">+ Connect stack</Link>
          <form action="/api/auth/signout" method="post"><button className="sidebar-signout">Sign out</button></form>
        </aside>
        <div className="app-main">
          <header className="topbar"><div className="mobile-brand"><img className="outcom-logo outcom-logo-mobile" src="/outcom-logo.png" alt="Outcom" /></div><div className="topbar-breadcrumb">{workspace?.workspace?.name || "Workspace"}<span>/</span><strong>Business outcome assurance</strong></div><div className="topbar-status"><span className="live-dot"/>{open.length ? `${open.length} finding${open.length===1?"":"s"} need attention` : "All protected outcomes healthy"}</div><Link className="topbar-connect" href="/connect">Connect stack <b>↗</b></Link></header>
          <main className="page">{children}</main>
        </div>
      </div>
      <OperatorAssistant />
    </body></html>
  );
}
