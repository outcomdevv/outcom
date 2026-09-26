import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceStore } from "@/lib/db";
import { IntegrationLogo } from "@/app/integrations";

export const dynamic = "force-dynamic";

function workflowIdCandidates(rawId: string) {
  const decoded = decodeURIComponent(rawId);
  const candidates = [decoded];

  // Older/manual workflow URLs may use provider.id while the database uses provider:id.
  const dotToColon = decoded.replace(/^([^.:/]+)\.(.+)$/, "$1:$2");
  const colonToDot = decoded.replace(/^([^.:/]+):(.+)$/, "$1.$2");

  if (dotToColon !== decoded) candidates.push(dotToColon);
  if (colonToDot !== decoded) candidates.push(colonToDot);

  return [...new Set(candidates)];
}

async function resolveWorkflow(store: Awaited<ReturnType<typeof getWorkspaceStore>>, rawId: string) {
  for (const candidate of workflowIdCandidates(rawId)) {
    const found = await store.workflows.get(candidate);
    if (found) return found;
  }
  return null;
}

export default async function WorkflowDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getWorkspaceStore();
  const workflow = await resolveWorkflow(store, id);

  if (!workflow) return notFound();

  const contracts = await store.contracts.list(workflow.id);
  const events = await store.events.list(workflow.id);
  const incidents = await store.incidents.list(workflow.id);
  const open = incidents.filter((i) => i.status === "open");

  return (
    <div className="detail-page">
      <Link className="back-link" href="/workflows">
        â† Protected workflows
      </Link>

      <div className="workflow-detail-hero">
        <div className="workflow-primary">
          <span className="workflow-platform-dot large">
            <IntegrationLogo name={workflow.platform as any} size={28} />
          </span>
          <div>
            <span className="section-kicker">PROTECTED WORKFLOW</span>
            <h1>{workflow.name}</h1>
            <p>{workflow.description}</p>
          </div>
        </div>

        <Link
          className="secondary-cta boxed"
          href={`/contracts/new?workflow=${encodeURIComponent(workflow.id)}`}
        >
          + Add outcome check
        </Link>
      </div>

      <section className="detail-stats">
        <div>
          <span>OUTCOME CHECKS</span>
          <strong>{contracts.length}</strong>
        </div>
        <div>
          <span>OBSERVATIONS</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>OPEN FINDINGS</span>
          <strong className={open.length ? "metric-red" : "metric-green"}>
            {open.length}
          </strong>
        </div>
        <div>
          <span>PLATFORM</span>
          <strong>{workflow.platform}</strong>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span>OUTCOME COVERAGE</span>
          <h2>What Outcom expects</h2>
        </div>

        {contracts.length ? (
          <div className="data-list">
            {contracts.map((c) => (
              <div className="data-row" key={c.id}>
                <div>
                  <div className="workflow-name">{c.name}</div>
                  <div className="workflow-sub">
                    {c.type.replaceAll("_", " ")}
                  </div>
                </div>
                <div>
                  <span className="row-label">System</span>
                  <span className="row-value">{c.system}</span>
                </div>
                <div>
                  <span className="row-label">Severity</span>
                  <span className="row-value">{c.severity}</span>
                </div>
                <span className="badge healthy">
                  {c.enabled ? "Active" : "Paused"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface empty-inline">
            No outcome contract has been inferred yet.
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <span>OBSERVATION LOG</span>
          <h2>Latest executions</h2>
        </div>

        {events.length ? (
          <div className="event-table">
            {events.slice(0, 12).map((e) => (
              <div className="event-row" key={e.id}>
                <span>{new Date(e.timestamp).toLocaleString()}</span>
                <b>{e.executionId}</b>
                <span>{e.status}</span>
                <span>
                  {incidents.some((i) => i.eventId === e.id)
                    ? "Finding"
                    : "Verified"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface empty-inline">
            Waiting for the observer to collect the first execution.
          </div>
        )}
      </section>
    </div>
  );
}
