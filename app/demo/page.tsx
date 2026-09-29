"use client";

import Link from "next/link";
import { useState } from "react";

interface DemoState {
  eventId: string;
  executionId: string;
  verified: boolean;
  title: string;
  summary: string;
  expected: string;
  observed: string;
  evidence: string[];
  incidentOpen: boolean;
}

export default function DemoPage() {
  const [loading, setLoading] = useState("");
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState("");

  async function run(action: "silent_failure" | "success" | "repair") {
    if (action === "repair" && !state) return;
    setLoading(action);
    setError("");
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(state ? { eventId: state.eventId } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Demo failed.");
      const result = body.results?.[0];
      setState({
        eventId: body.event?.id || state?.eventId || "",
        executionId: body.event?.executionId || state?.executionId || "",
        verified: Boolean(body.verified),
        title: result?.title || (body.verified ? "Business outcome verified" : "Verification complete"),
        summary: result?.summary || "",
        expected: result?.expected || "",
        observed: result?.observed || "",
        evidence: Array.isArray(result?.evidence) ? result.evidence : [],
        incidentOpen: Array.isArray(body.incidents) && body.incidents.some((x: { status: string }) => x.status === "open"),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo failed.");
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="demo-page">
      <div className="demo-topline">
        <Link href="/">← Command center</Link>
        <span>SAFE SIMULATION · NO CRM REQUIRED</span>
      </div>

      <section className="demo-hero">
        <div>
          <span className="section-kicker"><i /> OUTCOM DEMO MODE</span>
          <h1>See the failure<br /><em>automation logs miss.</em></h1>
          <p>Simulate a Zapier execution that reports SUCCESS while the downstream customer record is missing. No HighLevel account, credit card, or external API is required.</p>
        </div>
        <div className="demo-architecture">
          <div><small>01 · AUTOMATION</small><strong>Zapier</strong><span>SUCCESS ✓</span></div>
          <b>→</b>
          <div><small>02 · OUTCOM</small><strong>Verify</strong><span>READ-ONLY</span></div>
          <b>→</b>
          <div className="demo-architecture-alert"><small>03 · BUSINESS STATE</small><strong>CRM contact</strong><span>MISSING ✕</span></div>
        </div>
      </section>

      <section className="demo-actions surface">
        <div className="section-heading"><span>RUN A SCENARIO</span><h2>What should Outcom see?</h2><p>These actions only touch your Outcom demo workspace. The repair step changes mock business state — not a live automation.</p></div>
        <div className="demo-action-grid">
          <button type="button" onClick={() => run("silent_failure")} disabled={Boolean(loading)}>
            <span>01</span><strong>{loading === "silent_failure" ? "Running…" : "Simulate silent failure"}</strong><small>Zapier says SUCCESS · CRM record is missing</small>
          </button>
          <button type="button" onClick={() => run("success")} disabled={Boolean(loading)}>
            <span>02</span><strong>{loading === "success" ? "Running…" : "Simulate verified success"}</strong><small>Zapier says SUCCESS · CRM record exists</small>
          </button>
          <button type="button" onClick={() => run("repair")} disabled={Boolean(loading) || !state || state.verified}>
            <span>03</span><strong>{loading === "repair" ? <><i className="demo-spinner" /> Repairing &amp; verifying…</> : "Repair demo state + verify"}</strong><small>{loading === "repair" ? "Updating the mock business record, then checking evidence…" : "Create the missing demo record, then re-check the same execution"}</small>
          </button>
        </div>
        {error && <div className="demo-error">{error}</div>}
      </section>

      {state && <section className={`demo-result ${state.verified ? "is-pass" : "is-fail"}`}>
        <div className="demo-verdict">
          <span>{state.verified ? "VERIFIED" : "SILENT FAILURE DETECTED"}</span>
          <strong>{state.verified ? "The business outcome actually happened." : "Technical success is not proof."}</strong>
          <p>{state.summary}</p>
        </div>
        <div className="demo-proof-grid">
          <div><span>EXECUTION</span><strong>{state.executionId}</strong><small>Zapier · SUCCESS</small></div>
          <div><span>EXPECTED</span><strong>{state.expected}</strong><small>Outcome Contract</small></div>
          <div><span>OBSERVED</span><strong>{state.observed}</strong><small>{state.incidentOpen ? "Finding open" : "No open finding"}</small></div>
        </div>
        <div className="demo-evidence">
          <span>EVIDENCE</span>
          {state.evidence.map((line) => <p key={line}>• {line}</p>)}
        </div>
        {!state.verified && <div className="demo-next-step"><strong>Next:</strong> click <b>Repair demo state + verify</b>. This demo creates the missing mock business record and re-checks the same execution. <span className="demo-scope-note">It does not modify or rerun a live Zapier, Make, or n8n workflow.</span></div>}
        {state.verified && <div className="demo-next-step success"><strong>Proof:</strong> the same verification engine can now move from <b>FAIL → VERIFIED</b> after the demo business state is repaired. <span className="demo-scope-note">No live automation was changed.</span></div>}
      </section>}

      <section className="demo-principle">
        <span>THE PRODUCT PRINCIPLE</span>
        <h2>Automation platforms prove that a workflow ran.<br /><em>Outcom proves what the workflow caused.</em></h2>
      </section>
    </main>
  );
}
