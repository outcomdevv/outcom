import type { ProofReport } from "@/lib/proof-report";
import PrintButton from "./print-button";

const day = (iso: string) => iso.slice(0, 10);
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/** Presentational and safe to show publicly: counts, workflow names and finding titles only. No record values, no evidence lines. */
export default function ReportView({ report, title, preparedBy, printable = false }: { report: ProofReport; title: string; preparedBy?: string; printable?: boolean }) {
  const t = report.totals;
  const reportedShare = t.checks ? Math.round((t.reportedChecks / t.checks) * 100) : 0;
  return (
    <article className="proof-report">
      <header className="proof-head">
        <small>OUTCOME PROOF REPORT</small>
        <h1>{title}</h1>
        <p>{day(report.period.from)} → {day(report.period.to)} · last {report.period.days} days{preparedBy ? ` · prepared by ${preparedBy}` : ""}</p>
        {printable && <PrintButton />}
      </header>

      <section className="proof-tiles">
        <div><span>Runs checked</span><strong>{t.runs}</strong></div>
        <div><span>Results verified</span><strong>{t.verified}<em> / {t.checks}</em></strong><small>{pct(t.rate)}</small></div>
        <div><span>Silent failures caught</span><strong>{t.failed}</strong></div>
        <div><span>Could not confirm</span><strong>{t.unknown}</strong></div>
        <div><span>Closed · still open</span><strong>{t.fixed}<em> · {t.open}</em></strong></div>
      </section>

      <section>
        <h2>By workflow</h2>
        {report.workflows.length === 0 ? <p className="proof-empty">No workflows in this report.</p> : (
          <div className="proof-table" role="table">
            <div className="proof-row proof-th" role="row"><span>Workflow</span><span>Runs</span><span>Verified</span><span>Failed</span><span>Unknown</span></div>
            {report.workflows.map((w) => (
              <div className="proof-row" role="row" key={w.id}><span><b>{w.name}</b><small>{w.platform}</small></span><span>{w.runs}</span><span>{w.verified}/{w.checks} · {pct(w.rate)}</span><span>{w.failed}</span><span>{w.unknown}</span></div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>What was found</h2>
        {report.findings.length === 0 ? <p className="proof-empty">Nothing went wrong in this period.</p> : (
          <ul className="proof-findings">
            {report.findings.map((f) => (
              <li key={f.id}>
                <i className={f.kind}>{f.kind === "failed" ? "FAIL" : "UNKNOWN"}</i>
                <span><b>{f.title}</b><small>{f.workflow} · found {day(f.detectedAt)}{f.status === "resolved" && f.resolvedAt ? ` · closed ${day(f.resolvedAt)}` : " · still open"}</small></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="proof-foot">
        <p>A result counts as <b>verified</b> only when Outcom checked it and it matched what was expected. <b>Unknown</b> means Outcom could not confirm the result either way.</p>
        {t.reportedChecks > 0 && <p>{reportedShare}% of checks rest on evidence the workflow itself reported, which Outcom has not independently verified.</p>}
        <p>Checks cover whether results landed and values matched, not whether the result was the best business decision.</p>
      </footer>
    </article>
  );
}
