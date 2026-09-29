import Link from "next/link";
import { getWorkspaceStore } from "@/lib/db";
import { IntegrationLogo } from "@/app/integrations";
import styles from "./reliability.module.css";

export const dynamic = "force-dynamic";

function pct(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function duration(ms: number) {
  if (!ms || ms < 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

export default async function ReliabilityPage() {
  const store = await getWorkspaceStore();
  const [workflows, incidents, events, contracts] = await Promise.all([
    store.workflows.list(),
    store.incidents.list(),
    store.events.list(),
    store.contracts.list(),
  ]);

  const enabledContracts = contracts.filter((c) => c.enabled);
  const incidentByEvent = new Map<string, typeof incidents>();
  for (const incident of incidents) {
    const list = incidentByEvent.get(incident.eventId) ?? [];
    list.push(incident);
    incidentByEvent.set(incident.eventId, list);
  }

  const evaluations = workflows.reduce((sum, workflow) => {
    const count = enabledContracts.filter((c) => c.workflowId === workflow.id).length;
    return sum + events.filter((e) => e.workflowId === workflow.id).length * count;
  }, 0);
  const historicalFailures = incidents.length;
  const verified = Math.max(evaluations - historicalFailures, 0);
  const reliability = evaluations ? (verified / evaluations) * 100 : null;
  const openFindings = incidents.filter((i) => i.status === "open").length;
  const resolved = incidents.filter((i) => i.status === "resolved" && i.resolvedAt);
  const averageResolution = resolved.length
    ? resolved.reduce((sum, i) => sum + (new Date(i.resolvedAt!).getTime() - new Date(i.detectedAt).getTime()), 0) / resolved.length
    : 0;

  const workflowRows = workflows.map((workflow) => {
    const workflowEvents = events.filter((e) => e.workflowId === workflow.id);
    const workflowContracts = enabledContracts.filter((c) => c.workflowId === workflow.id);
    const checks = workflowEvents.length * workflowContracts.length;
    const workflowIncidents = incidents.filter((i) => i.workflowId === workflow.id);
    const failures = workflowIncidents.length;
    const verifiedChecks = Math.max(checks - failures, 0);
    const rate = checks ? (verifiedChecks / checks) * 100 : null;
    const lastEvent = workflowEvents[0];
    return { workflow, workflowEvents, checks, failures, rate, open: workflowIncidents.filter((i) => i.status === "open").length, lastEvent };
  }).sort((a, b) => {
    if ((a.rate ?? 101) !== (b.rate ?? 101)) return (a.rate ?? 101) - (b.rate ?? 101);
    return b.failures - a.failures;
  });

  const recentFailures = [...incidents]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, 6);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const trend = days.map((day) => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const dayEvents = events.filter((event) => {
      const t = new Date(event.timestamp).getTime();
      return t >= day.getTime() && t < next.getTime();
    });
    const dayEvaluations = dayEvents.reduce((sum, event) => sum + enabledContracts.filter((c) => c.workflowId === event.workflowId).length, 0);
    const dayFailures = dayEvents.reduce((sum, event) => sum + (incidentByEvent.get(event.id)?.length ?? 0), 0);
    const rate = dayEvaluations ? Math.max(0, ((dayEvaluations - dayFailures) / dayEvaluations) * 100) : null;
    return { label: day.toLocaleDateString(undefined, { weekday: "short" }), date: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }), rate, evaluations: dayEvaluations };
  });

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div>
        <span className={styles.kicker}><i /> OUTCOME RELIABILITY</span>
        <h1>Did the automation<br /><em>actually deliver?</em></h1>
        <p>Reliability answers one simple question: after the automation ran, did the business result actually happen?</p>
      </div>
      <div className={styles.heroBadge}><span>FIRST-CHECK RELIABILITY</span><strong>{reliability === null ? "—" : pct(reliability)}</strong><small>{evaluations ? `${evaluations.toLocaleString()} outcome checks observed` : "Awaiting verified executions"}</small></div>
    </header>

    <section className={styles.metrics}>
      <div className={`${styles.metric} ${styles.featured}`}><span>OUTCOME RELIABILITY</span><strong>{reliability === null ? "—" : pct(reliability)}</strong><small>historical first-check result</small></div>
      <div className={styles.metric}><span>OUTCOME CHECKS</span><strong>{evaluations.toLocaleString()}</strong><small>{events.length.toLocaleString()} executions × protected outcomes</small></div>
      <div className={styles.metric}><span>VERIFIED</span><strong className={styles.good}>{verified.toLocaleString()}</strong><small>business outcomes proven</small></div>
      <div className={styles.metric}><span>OPEN FINDINGS</span><strong className={openFindings ? styles.bad : styles.good}>{openFindings}</strong><small>{openFindings ? "need attention" : "nothing open"}</small></div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.number}>01</span><h2>Reliability trend</h2><p>Outcome checks observed during the last seven calendar days.</p></div><span className={styles.readonly}>READ-ONLY EVIDENCE</span></div>
      <div className={styles.trend}>
        {trend.map((day) => <div className={styles.day} key={day.date}><div className={styles.barTrack}><div className={styles.bar} style={{ height: `${Math.max(day.rate ?? 0, day.evaluations ? 8 : 0)}%` }} /></div><strong>{day.rate === null ? "—" : pct(day.rate)}</strong><span>{day.label}</span><small>{day.date}</small></div>)}
      </div>
    </section>

    <section className={styles.panel}>
      <div className={styles.panelHead}><div><span className={styles.number}>02</span><h2>Reliability by workflow</h2><p>Each workflow is measured by how often its protected business outcomes are proven.</p></div><Link href="/workflows" className={styles.panelLink}>View fleet →</Link></div>
      {workflowRows.length ? <div className={styles.table}><div className={styles.tableHead}><span>WORKFLOW</span><span>CHECKS</span><span>VERIFIED</span><span>RELIABILITY</span><span>FINDINGS</span></div>{workflowRows.map((row) => <Link className={styles.row} href={`/workflows/${row.workflow.id}`} key={row.workflow.id}><div className={styles.workflow}><span className={styles.logo}><IntegrationLogo name={row.workflow.platform as any} size={18} /></span><div><strong>{row.workflow.name}</strong><small>{row.workflow.platform}</small></div></div><span>{row.checks.toLocaleString()}</span><span>{Math.max(row.checks - row.failures, 0).toLocaleString()}</span><strong className={row.rate !== null && row.rate < 95 ? styles.badText : styles.goodText}>{row.rate === null ? "—" : pct(row.rate)}</strong><span className={row.open ? styles.badPill : styles.goodPill}>{row.open ? `${row.open} open` : "Clean"}</span></Link>)}</div> : <div className={styles.empty}>No protected workflows have enough evidence to measure yet. Protect a workflow and send its first execution.</div>}
    </section>

    <section className={styles.lowerGrid}>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span className={styles.number}>03</span><h2>Recent failures</h2><p>These are historical outcome failures, even when they were later repaired.</p></div><Link href="/incidents" className={styles.panelLink}>All findings →</Link></div>
        {recentFailures.length ? <div className={styles.failures}>{recentFailures.map((incident) => <Link href={`/incidents/${incident.id}`} className={styles.failureRow} key={incident.id}><div><span className={incident.status === "open" ? styles.badPill : styles.resolvedPill}>{incident.status === "open" ? "OPEN" : "RESOLVED"}</span><strong>{incident.title}</strong><small>{workflows.find((w) => w.id === incident.workflowId)?.name ?? "Workflow"} · {new Date(incident.detectedAt).toLocaleString()}</small></div><span>→</span></Link>)}</div> : <div className={styles.empty}>No outcome failures recorded yet.</div>}
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span className={styles.number}>04</span><h2>Resolution</h2><p>How quickly a detected business-outcome failure was repaired.</p></div></div>
        <div className={styles.resolution}><span>AVERAGE TIME TO RESOLUTION</span><strong>{duration(averageResolution)}</strong><small>{resolved.length ? `${resolved.length} resolved finding${resolved.length === 1 ? "" : "s"}` : "No resolved findings yet"}</small></div><div className={styles.explainer}><b>How reliability is calculated</b><p>Verified outcome checks ÷ total outcome checks. A failure remains part of history after repair, so reliability measures what actually happened over time.</p></div>
        <div className={styles.explainer}><b>What this means</b><p>A workflow can report SUCCESS and still count as a failed outcome. V75 keeps that historical signal instead of replacing it when the issue is repaired.</p></div>
      </div>
    </section>

    <footer className={styles.footer}><span>V75 · Outcome Reliability Engine</span><span>EXECUTION → EXPECTATION → EVIDENCE → VERIFICATION → RELIABILITY</span></footer>
  </div>;
}
