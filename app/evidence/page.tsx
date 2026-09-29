import Link from "next/link";
import { getWorkspaceStore } from "@/lib/db";
import styles from "./evidence.module.css";

export const dynamic = "force-dynamic";

function shortId(value: string) {
  return value.length > 24 ? `${value.slice(0, 11)}…${value.slice(-8)}` : value;
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown time";
  return new Date(value).toLocaleString();
}

export default async function EvidenceGraph() {
  const store = await getWorkspaceStore();
  const [workflows, contracts, events, incidents] = await Promise.all([
    store.workflows.list(),
    store.contracts.list(),
    store.events.list(),
    store.incidents.list(),
  ]);

  const workflowMap = new Map(workflows.map((w) => [w.id, w]));
  const contractMap = new Map(contracts.map((c) => [c.id, c]));
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const chains = incidents.map((incident) => ({
    incident,
    workflow: workflowMap.get(incident.workflowId),
    contract: contractMap.get(incident.contractId),
    event: eventMap.get(incident.eventId),
  }));
  const latest = chains[0];
  const evidencePoints = incidents.reduce((sum, item) => sum + item.evidence.length, 0);
  const resolved = incidents.filter((item) => item.status === "resolved").length;
  const open = incidents.filter((item) => item.status === "open").length;

  return <div className={styles.page}>
    <div className={styles.hero}>
      <div>
        <span className={styles.kicker}>EVIDENCE GRAPH</span>
        <h1>See how Outcom<br /><em>proved the finding.</em></h1>
        <p>Outcom connects the execution, the expected business result, the observed evidence, and the verification decision into one traceable chain.</p>
      </div>
      <div className={styles.heroCard}>
        <span>THE ASSURANCE CHAIN</span>
        <div className={styles.miniChain}><b>EXECUTION</b><i>→</i><b>EXPECTATION</b><i>→</i><b>EVIDENCE</b><i>→</i><strong>VERIFICATION</strong></div>
        <small>Read-only evidence. No automation mutation.</small>
      </div>
    </div>

    <div className={styles.metrics}>
      <div><span>CHAINS</span><strong>{chains.length}</strong><small>stored finding chains</small></div>
      <div><span>EVIDENCE POINTS</span><strong>{evidencePoints}</strong><small>read-only proof items</small></div>
      <div><span>RESOLVED</span><strong>{resolved}</strong><small>chains closed after verification</small></div>
      <div><span>OPEN</span><strong className={open ? styles.bad : ""}>{open}</strong><small>chains needing attention</small></div>
    </div>

    {latest ? <>
      <section className={styles.sectionHead}><div><span className={styles.kicker}>01 / LATEST CHAIN</span><h2>From execution to business-state verdict</h2><p>The graph below is assembled from the same persisted evidence Outcom uses for the finding.</p></div><Link href={`/incidents/${latest.incident.id}`} className={styles.link}>Open finding ↗</Link></section>
      <EvidenceChain chain={latest} />
    </> : <section className={styles.empty}>
      <span className={styles.kicker}>NO EVIDENCE CHAINS YET</span>
      <h2>Run a protected workflow first.</h2>
      <p>Once Outcom detects a mismatch between execution and business state, its evidence chain will appear here.</p>
      <Link href="/demo" className={styles.primary}>Run the safe demo ↗</Link>
    </section>}

    {chains.length > 1 && <section className={styles.section}>
      <div className={styles.sectionHead}><div><span className={styles.kicker}>02 / EVIDENCE LEDGER</span><h2>Every stored chain</h2><p>Each row preserves the relationship between the execution, contract, and finding.</p></div></div>
      <div className={styles.ledger}>
        {chains.map(({ incident, workflow, contract, event }) => <Link href={`/incidents/${incident.id}`} className={styles.ledgerRow} key={incident.id}>
          <div><span className={styles.rowLabel}>WORKFLOW</span><strong>{workflow?.name || "Unknown workflow"}</strong><small>{workflow?.platform || "Unknown platform"}</small></div>
          <div><span className={styles.rowLabel}>EXECUTION</span><strong>{shortId(event?.executionId || incident.eventId)}</strong><small>{formatDate(event?.timestamp || incident.detectedAt)}</small></div>
          <div><span className={styles.rowLabel}>OUTCOME</span><strong>{contract?.name || incident.expected}</strong><small>{contract?.system || "Business system"}</small></div>
          <div><span className={styles.rowLabel}>VERDICT</span><b className={incident.status === "resolved" ? styles.passPill : styles.failPill}>{incident.status === "resolved" ? "Resolved" : "Open finding"}</b></div>
        </Link>)}
      </div>
    </section>}

    <footer className={styles.footer}><span>V76 · Evidence Graph</span><span>EXECUTION → EXPECTATION → EVIDENCE → VERIFICATION → BUSINESS OUTCOME</span></footer>
  </div>;
}

function EvidenceChain({ chain }: { chain: { incident: any; workflow: any; contract: any; event: any } }) {
  const { incident, workflow, contract, event } = chain;
  const evidence = incident.evidence.length ? incident.evidence : ["No textual evidence was stored for this finding."];
  const verified = incident.status === "resolved";
  return <section className={styles.graphCard}>
    <div className={styles.graphMeta}>
      <div><span>WORKFLOW</span><strong>{workflow?.name || "Unknown workflow"}</strong><small>{workflow?.platform || event?.platform || "Unknown platform"}</small></div>
      <div><span>DETECTED</span><strong>{formatDate(incident.detectedAt)}</strong><small>{verified ? `Resolved ${formatDate(incident.resolvedAt)}` : "Finding remains open"}</small></div>
      <div><span>FINDING</span><strong>{incident.title}</strong><small>{incident.type.replaceAll("_", " ")}</small></div>
    </div>

    <div className={styles.graph}>
      <GraphNode step="01" label="EXECUTION" title={event?.executionId || incident.eventId} detail={`${event?.platform || workflow?.platform || "Automation"} · ${event?.status || "observed"}`} />
      <span className={styles.connector} aria-hidden="true">→</span>
      <GraphNode step="02" label="EXPECTATION" title={contract?.name || incident.expected} detail={contract ? `${contract.system} · ${contract.entity}` : "Protected outcome"} />
      <span className={styles.connector} aria-hidden="true">→</span>
      <div className={styles.evidenceNode}>
        <span className={styles.nodeStep}>03</span><span className={styles.nodeLabel}>EVIDENCE</span>
        <strong>{evidence.length} proof {evidence.length === 1 ? "point" : "points"}</strong>
        <div className={styles.evidenceList}>{evidence.map((line: string, index: number) => <div key={`${line}-${index}`}><i>✓</i><span>{line}</span></div>)}</div>
      </div>
      <span className={styles.connector} aria-hidden="true">→</span>
      <GraphNode step="04" label="VERIFICATION" title={verified ? "Outcome re-verified" : "Outcome mismatch"} detail={verified ? "Finding resolved after downstream state changed" : incident.observed} state={verified ? "pass" : "fail"} />
    </div>

    <div className={styles.outcomeBar}>
      <div><span>BUSINESS OUTCOME</span><strong>{incident.expected}</strong><small>{incident.observed}</small></div>
      <div className={verified ? styles.outcomePass : styles.outcomeFail}><span>FINAL STATE</span><strong>{verified ? "VERIFIED" : "FINDING OPEN"}</strong><small>{verified ? "Evidence now supports the protected outcome." : "Evidence does not yet support the protected outcome."}</small></div>
    </div>
  </section>;
}

function GraphNode({ step, label, title, detail, state }: { step: string; label: string; title: string; detail: string; state?: "pass" | "fail" }) {
  return <div className={`${styles.node} ${state === "pass" ? styles.nodePass : state === "fail" ? styles.nodeFail : ""}`}>
    <span className={styles.nodeStep}>{step}</span><span className={styles.nodeLabel}>{label}</span><strong>{title}</strong><small>{detail}</small>
  </div>;
}
