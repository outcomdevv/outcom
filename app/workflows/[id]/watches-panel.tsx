"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Watch = { id: string; name: string; enabled: boolean; lastCheckedAt: string | null; lastState: string | null; lastObserved: string | null };
type Other = { id: string; name: string };
type Mode = "watch_heartbeat" | "watch_volume" | "watch_reconcile";

const STATE_TEXT: Record<string, string> = { ok: "OK", failed: "FINDING", pending: "Warming up" };

export default function WatchesPanel({ workflowId, watches, others }: { workflowId: string; watches: Watch[]; others: Other[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("watch_heartbeat");
  const [hours, setHours] = useState("24");
  const [minRuns, setMinRuns] = useState("1");
  const [metric, setMetric] = useState("runs");
  const [minimum, setMinimum] = useState("");
  const [drop, setDrop] = useState("50");
  const [other, setOther] = useState("");
  const [gap, setGap] = useState("5");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Something went wrong.");
    return json;
  }
  async function add() {
    setBusy(true); setMsg(null);
    try {
      await call("/api/watches", "POST", { workflowId, mode, windowHours: hours, minRuns, metric, minimum, dropPercent: mode === "watch_volume" ? drop : undefined, otherWorkflowId: other, maxGapPercent: gap });
      setMsg("Watch added. It starts judging after one full period.");
      router.refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not add the watch."); }
    finally { setBusy(false); }
  }
  async function runNow() {
    setBusy(true); setMsg(null);
    try { const j = await call("/api/watches/run", "POST", { workflowId }); setMsg(`Checked ${j.runs.length} watch${j.runs.length === 1 ? "" : "es"}.`); router.refresh(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not run the watches."); }
    finally { setBusy(false); }
  }
  async function toggle(w: Watch) {
    try { await call("/api/watches", "PATCH", { id: w.id, enabled: !w.enabled }); router.refresh(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not change the watch."); }
  }

  return (
    <section className="section watches-panel">
      <div className="section-heading"><span>WATCHES</span><h2>Catch what never arrives</h2></div>
      <p className="proof-hint">Watches look at the workflow over time. They catch a trigger that stopped firing, a drop in volume, or two workflows that no longer match. No failed run exists in those cases, so the platform stays quiet. A watch is checked about every 5 minutes by Outcom&apos;s scheduler.</p>
      {watches.length > 0 && (
        <ul className="proof-links">
          {watches.map((w) => (
            <li key={w.id}>
              <span><b>{w.name}</b><small>{w.enabled ? (w.lastCheckedAt ? `${STATE_TEXT[w.lastState ?? ""] ?? "Checked"} · ${w.lastObserved ?? ""}` : "Not checked yet. The scheduler has not run it.") : "Paused"}</small></span>
              <button type="button" onClick={() => toggle(w)}>{w.enabled ? "Pause" : "Resume"}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="proof-form">
        <label>What to watch
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="watch_heartbeat">No runs arrived for a while</option>
            <option value="watch_volume">Volume dropped</option>
            <option value="watch_reconcile">Counts do not match another workflow</option>
          </select>
        </label>
        <label>Period (hours)<input inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
        {mode === "watch_heartbeat" && <label>Expect at least this many runs per period<input inputMode="numeric" value={minRuns} onChange={(e) => setMinRuns(e.target.value)} /></label>}
        {mode === "watch_volume" && <>
          <label>Count<select value={metric} onChange={(e) => setMetric(e.target.value)}><option value="runs">Runs</option><option value="outputs">Outputs</option></select></label>
          <label>Minimum per period <small>(optional)</small><input inputMode="numeric" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="e.g. 10" /></label>
          <label>Alert if it falls more than this % below the previous period <small>(optional)</small><input inputMode="numeric" value={drop} onChange={(e) => setDrop(e.target.value)} /></label>
        </>}
        {mode === "watch_reconcile" && <>
          <label>Compare with<select value={other} onChange={(e) => setOther(e.target.value)}><option value="">Choose a workflow…</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label>Allowed gap (%)<input inputMode="numeric" value={gap} onChange={(e) => setGap(e.target.value)} /></label>
        </>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={busy} onClick={add}>Add watch</button>
          {watches.length > 0 && <button type="button" disabled={busy} onClick={runNow}>Check now</button>}
        </div>
      </div>
      {msg && <p className="proof-msg" role="status">{msg}</p>}
    </section>
  );
}
