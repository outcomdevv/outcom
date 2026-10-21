import { notFound } from "next/navigation";
import { getWorkspaceStore } from "@/lib/db";
import { resolveShare } from "@/lib/report-shares";
import { buildProofReport } from "@/lib/proof-report";
import ReportView from "@/app/proof/report-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outcome Proof Report", robots: { index: false, follow: false } };

export default async function PublicReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await resolveShare(token);
  if (!share) notFound();
  const store = await getWorkspaceStore(share.workspaceId);
  const [workflows, events, contracts, incidents] = await Promise.all([store.workflows.list(), store.events.list(), store.contracts.list(), store.incidents.list()]);
  const report = buildProofReport({ workflows, events, contracts, incidents, days: share.days, workflowIds: share.workflowIds });
  return <div className="proof-public"><ReportView report={report} title={share.title} preparedBy={share.preparedBy} printable /></div>;
}
