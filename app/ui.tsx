import Link from "next/link";
import type { Incident } from "@/lib/contracts/types";

function readable(value: unknown) { return typeof value === "string" ? value : JSON.stringify(value); }

export function IncidentCard({ incident, workflow }: { incident: Incident; workflow?: string }) {
  const verification = incident.type === "verification_error";
  const technical = incident.type === "technical_failure";
  return <article className={`finding-card ${verification ? "finding-unknown" : "finding-failure"}`}>
    <div className="finding-card-top"><span className="finding-label">{workflow ?? "Workflow"}</span><span className="finding-time">{new Date(incident.detectedAt).toLocaleString()}</span></div>
    <div className="finding-card-title-row"><div><h3>{technical ? "Automation execution failed" : verification ? "Outcome could not be verified" : incident.title}</h3><p>{technical ? "The automation reported a failed execution before business-state verification." : verification ? "The downstream system could not be checked." : "Execution succeeded, but the expected business state was not preserved."}</p></div><span className="finding-status">{technical ? "FAILED" : verification ? "UNKNOWN" : "FAILED"}</span></div>
    <div className="finding-proof-grid"><div><span>EXECUTION</span><strong className={technical ? "proof-bad" : "proof-good"}>{technical ? "× Failed" : "✓ Succeeded"}</strong></div><div><span>BUSINESS OUTCOME</span><strong className={verification ? "proof-warn" : "proof-bad"}>{technical ? "? Not checked" : verification ? "? Unknown" : "× Failed"}</strong></div></div>
    <div className="finding-detail-grid"><div><span>EXPECTED</span><p>{readable(incident.expected)}</p></div><div><span>OBSERVED</span><p>{readable(incident.observed)}</p></div></div>
    <div className="finding-footer"><span className="impact-mini">Impact: {incident.impact}</span><Link href={`/incidents/${incident.id}`}>Investigate finding <b>→</b></Link></div>
  </article>;
}

export function EmptyState({ title, children }: { title: string; children: string }) { return <div className="empty-state"><h2>{title}</h2><p>{children}</p></div>; }
