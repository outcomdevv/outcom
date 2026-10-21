// Proof Report: a client-ready summary of what Outcom verified. Pure and testable; no I/O.
import type { Incident, OutcomeContract, Workflow, WorkflowEvent } from "@/lib/contracts/types";

export type ProofTotals = { runs: number; checks: number; verified: number; failed: number; unknown: number; fixed: number; open: number; reportedChecks: number; rate: number | null };
export type ProofWorkflowRow = { id: string; name: string; platform: string; runs: number; checks: number; verified: number; failed: number; unknown: number; open: number; rate: number | null };
export type ProofFinding = { id: string; workflow: string; title: string; kind: "failed" | "unknown"; status: "open" | "resolved"; detectedAt: string; resolvedAt: string | null };
export type ProofReport = { period: { from: string; to: string; days: number }; totals: ProofTotals; workflows: ProofWorkflowRow[]; findings: ProofFinding[] };

export type ProofInput = { workflows: Workflow[]; events: WorkflowEvent[]; contracts: OutcomeContract[]; incidents: Incident[]; days: number; now?: Date; workflowIds?: string[] };

const MAX_FINDINGS = 25;
const rate = (verified: number, checks: number) => (checks ? Math.round((verified / checks) * 1000) / 10 : null);

export function buildProofReport(input: ProofInput): ProofReport {
  const to = input.now ?? new Date();
  const from = new Date(to.getTime() - input.days * 86_400_000);
  const scope = input.workflowIds?.length ? new Set(input.workflowIds) : null;
  const workflows = input.workflows.filter((w) => !scope || scope.has(w.id));
  const byId = new Map(workflows.map((w) => [w.id, w]));

  const events = input.events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return byId.has(e.workflowId) && t >= from.getTime() && t <= to.getTime();
  });
  const eventIds = new Set(events.map((e) => e.id));
  const enabled = input.contracts.filter((c) => c.enabled);
  const contractsOf = (workflowId: string) => enabled.filter((c) => c.workflowId === workflowId);
  const incidents = input.incidents.filter((i) => eventIds.has(i.eventId));

  const rows = new Map<string, ProofWorkflowRow>(workflows.map((w) => [w.id, { id: w.id, name: w.name, platform: w.platform, runs: 0, checks: 0, verified: 0, failed: 0, unknown: 0, open: 0, rate: null }]));
  let reportedChecks = 0;
  for (const e of events) {
    const row = rows.get(e.workflowId)!;
    const cs = contractsOf(e.workflowId);
    row.runs += 1;
    row.checks += cs.length;
    reportedChecks += cs.filter((c) => c.system === "reported").length;
  }
  for (const i of incidents) {
    const row = rows.get(i.workflowId);
    if (!row) continue;
    if (i.type === "verification_error") row.unknown += 1; else row.failed += 1;
    if (i.status === "open") row.open += 1;
  }
  for (const row of rows.values()) {
    row.verified = Math.max(row.checks - row.failed - row.unknown, 0);
    row.rate = rate(row.verified, row.checks);
  }

  const list = [...rows.values()].sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || b.runs - a.runs);
  const sum = (f: (r: ProofWorkflowRow) => number) => list.reduce((s, r) => s + f(r), 0);
  const checks = sum((r) => r.checks);
  const verified = sum((r) => r.verified);

  const findings = [...incidents]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, MAX_FINDINGS)
    .map<ProofFinding>((i) => ({ id: i.id, workflow: byId.get(i.workflowId)?.name ?? "Workflow", title: i.title, kind: i.type === "verification_error" ? "unknown" : "failed", status: i.status, detectedAt: i.detectedAt, resolvedAt: i.resolvedAt }));

  return {
    period: { from: from.toISOString(), to: to.toISOString(), days: input.days },
    totals: { runs: sum((r) => r.runs), checks, verified, failed: sum((r) => r.failed), unknown: sum((r) => r.unknown), fixed: incidents.filter((i) => i.status === "resolved").length, open: incidents.filter((i) => i.status === "open").length, reportedChecks, rate: rate(verified, checks) },
    workflows: list,
    findings,
  };
}
