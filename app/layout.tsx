import Link from "next/link";
import type { ReactNode } from "react";
import { getWorkspaceStore } from "@/lib/db";
import { getUser, ensureWorkspace } from "@/lib/auth";
import "./globals.css";
import "./final.css";
import OperatorAssistant from "@/app/assistant";
import ThemeToggle from "@/app/theme-toggle";
import NavigationLoading from "@/app/navigation-loading";
import SignOutButton from "@/app/signout-button";
import OpenFindings from "@/app/open-findings";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Outcom — Business Outcome Assurance", description: "Verify what your automation actually accomplished.", icons: { icon: "/outcom-favicon-v71.png", apple: "/outcom-apple-v71.png" } };
const nav = [
  { href: "/", label: "Overview", icon: "⌂" },
  { href: "/workflows", label: "Workflows", icon: "◇" },
  { href: "/incidents", label: "Findings", icon: "!" },
  { href: "/reliability", label: "Reports", icon: "◒" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];
const mobileNav = [...nav.slice(0, 4), { href: "/connect", label: "Connect", icon: "◎" }, nav[4]];
type WorkspaceStore = Awaited<ReturnType<typeof getWorkspaceStore>>;
type Workflow = Awaited<ReturnType<WorkspaceStore["workflows"]["list"]>>[number];
type Incident = Awaited<ReturnType<WorkspaceStore["incidents"]["list"]>>[number];
function BootstrapRecovery() { return <html lang="en"><body><div className="outcom-error-page"><div className="outcom-error-card"><img src="/outcom-mascot.png" className="outcom-error-mascot" alt="Outcom mascot"/><span className="auth-confirm-badge error">OUTCOM RECOVERY</span><h1>Outcom needs a reload.<br/><em>Your data is not being reset.</em></h1><p>Outcom could not load the workspace. This is usually caused by a missing or invalid Supabase environment variable, database migration, or expired session.</p><div className="outcom-error-actions"><a className="auth-submit" href="/">Reload Outcom ↻</a><a className="auth-secondary" href="/auth/login">Sign in again</a></div></div></div></body></html>; }
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  let user; try { user = await getUser(); } catch (error) { console.error("Outcom auth bootstrap failed", error); return <BootstrapRecovery/>; }
  if (!user) return <html lang="en"><body><NavigationLoading/>{children}</body></html>;
  let workspace: Awaited<ReturnType<typeof ensureWorkspace>>; let store: WorkspaceStore | null = null; let workflows: Workflow[] = []; let open: Incident[] = [];
  try { workspace = await ensureWorkspace(); store = workspace ? await getWorkspaceStore(workspace.workspaceId) : null; workflows = store ? await store.workflows.list() : []; open = store ? (await store.incidents.list()).filter(i => i.status === "open") : []; } catch (error) { console.error("Outcom workspace bootstrap failed", error); return <BootstrapRecovery/>; }
  return <html lang="en"><body><NavigationLoading/><div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><a className="outcom-wordmark" href="/"><img src="/outcom-mark.png" alt=""/><span>OUTCOM</span></a></div><div className="workspace-switcher"><span className="workspace-avatar">{(workspace?.workspace?.name || "O").slice(0,1).toUpperCase()}</span><div><b>{workspace?.workspace?.name || "Outcom Workspace"}</b><small>{user.email}</small></div><span>⌄</span></div><div className="sidebar-section-label">Workspace</div><nav className="sidebar-nav">{nav.map(item => <Link href={item.href} className="sidebar-link" key={item.href}><span className="sidebar-icon">{item.icon}</span><span>{item.label}</span>{item.label === "Findings" && <OpenFindings initial={open.length} variant="badge"/>}</Link>)}</nav><div className="sidebar-spacer"/><SignOutButton/></aside><div className="app-main"><header className="topbar"><div className="mobile-brand"><a className="outcom-wordmark mobile-wordmark" href="/"><img src="/outcom-mark.png" alt=""/><span>OUTCOM</span></a></div><div className="topbar-breadcrumb">{workspace?.workspace?.name || "Workspace"}<span>/</span><strong>Business outcome assurance</strong></div><div className="topbar-status"><ThemeToggle/><span className="live-dot"/><OpenFindings initial={open.length} variant="status"/></div><Link className="topbar-connect" href="/connect">Connect stack <b>↗</b></Link></header><nav className="mobile-nav" aria-label="Menu">{mobileNav.map(item => <Link href={item.href} key={item.href}>{item.label}{item.label === "Findings" && <OpenFindings initial={open.length} variant="badge"/>}</Link>)}</nav><main className="page">{children}</main></div></div><OperatorAssistant/></body></html>;
}
