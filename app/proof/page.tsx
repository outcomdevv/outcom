import Link from "next/link";
import ReportsTabs from "@/app/reports-tabs";
import { getWorkspaceStore } from "@/lib/db";
import { listShares } from "@/lib/report-shares";
import { buildProofReport } from "@/lib/proof-report";
import ReportView from "./report-view";
import ShareManager from "./share-manager";

export const dynamic = "force-dynamic";
const PERIODS = [7, 30, 90];

export default async function ProofPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const days = PERIODS.includes(Number(raw)) ? Number(raw) : 30;
  const store = await getWorkspaceStore();
  const [workflows, events, contracts, incidents, shares] = await Promise.all([store.workflows.list(), store.events.list(), store.contracts.list(), store.incidents.list(), listShares(store.workspaceId).catch(() => [])]);
  const report = buildProofReport({ workflows, events, contracts, incidents, days });
  return (
    <div className="proof-page">
      <ReportsTabs />
      <div className="proof-periods">{PERIODS.map((p) => <Link key={p} href={`/proof?days=${p}`} className={p === days ? "active" : ""}>{p} days</Link>)}</div>
      <ReportView report={report} title="Outcome Proof Report" />
      <ShareManager workflows={workflows.map((w) => ({ id: w.id, name: w.name }))} initial={shares} />
    </div>
  );
}
