// "Watches" are checks that look at a workflow over time instead of at one run: a trigger that stopped firing,
// a drop in volume, or two streams that should match. Pure evaluation; the cron route does the I/O.
import type { OutcomeContract, WorkflowEvent } from "@/lib/contracts/types";

export type WatchMode = "watch_heartbeat" | "watch_volume" | "watch_reconcile";
export const WATCH_MODES: WatchMode[] = ["watch_heartbeat", "watch_volume", "watch_reconcile"];

export const watchMode = (c: Pick<OutcomeContract, "configuration">): WatchMode | null => {
  const m = (c.configuration as any)?.mode;
  return WATCH_MODES.includes(m) ? m : null;
};
/** Per-run checks only. Watches never run against a single event. */
export const isWatch = (c: Pick<OutcomeContract, "configuration">) => watchMode(c) !== null;
export const perRunContracts = <T>(list: T[]): T[] => list.filter((c) => !isWatch(c as unknown as Pick<OutcomeContract, "configuration">));

export type WatchState = "ok" | "failed" | "pending";
export type WatchResult = { state: WatchState; title: string; expected: string; observed: string; impact: string; recommendedAction: string; evidence: string[] };

const HOUR = 3_600_000;
const inWindow = (events: WorkflowEvent[], from: number, to: number) => events.filter((e) => { const t = new Date(e.timestamp).getTime(); return t >= from && t < to; });
const outputsOf = (events: WorkflowEvent[]) => events.reduce((s, e) => s + (Number((e.data as any)?.output_count) || 0), 0);
const measure = (events: WorkflowEvent[], metric: string) => (metric === "outputs" ? outputsOf(events) : events.length);
const hours = (n: number) => (n === 1 ? "1 hour" : `${n} hours`);

export type WatchInput = { contract: OutcomeContract; events: WorkflowEvent[]; otherEvents?: WorkflowEvent[]; otherName?: string; now?: Date };

export function evaluateWatch({ contract, events, otherEvents = [], otherName = "the other workflow", now = new Date() }: WatchInput): WatchResult {
  const cfg: any = contract.configuration ?? {};
  const mode = watchMode(contract);
  const t = now.getTime();
  const created = new Date(contract.createdAt).getTime();
  const window = Math.max(1, Number(cfg.windowHours ?? cfg.everyHours) || 24);
  const ok = (title: string, observed: string): WatchResult => ({ state: "ok", title, expected: "", observed, impact: "", recommendedAction: "", evidence: [observed] });
  // A new watch has not had a full window to prove anything yet, so it must not raise a false alarm.
  if (Number.isFinite(created) && t - created < window * HOUR && mode !== null) return { state: "pending", title: "Watch is warming up", expected: "", observed: `Needs a full ${hours(window)} of history first.`, impact: "", recommendedAction: "", evidence: [] };

  if (mode === "watch_heartbeat") {
    const min = Math.max(1, Number(cfg.minRuns) || 1);
    const runs = inWindow(events, t - window * HOUR, t + 1).length;
    if (runs >= min) return ok("Runs are arriving", `${runs} run${runs === 1 ? "" : "s"} in the last ${hours(window)}`);
    const last = events.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => b - a)[0];
    return { state: "failed", title: "No runs arrived on time", expected: `At least ${min} run${min === 1 ? "" : "s"} every ${hours(window)}`, observed: `${runs} run${runs === 1 ? "" : "s"} in the last ${hours(window)}${last ? `; last run at ${new Date(last).toISOString()}` : `; no run found in the last ${hours(window * 2)}`}`, impact: "The automation may have stopped firing. No failed run exists, so the platform would not alert you.", recommendedAction: "Check that the trigger, schedule or webhook is still active and that the automation is switched on.", evidence: [`Window: last ${hours(window)} (ends ${now.toISOString()})`, `Runs seen: ${runs}`, last ? `Last run: ${new Date(last).toISOString()}` : `No run found in the last ${hours(window * 2)}.`] };
  }

  if (mode === "watch_volume") {
    const metric = cfg.metric === "outputs" ? "outputs" : "runs";
    const current = measure(inWindow(events, t - window * HOUR, t + 1), metric);
    const previous = measure(inWindow(events, t - 2 * window * HOUR, t - window * HOUR), metric);
    const min = cfg.minimum === undefined || cfg.minimum === "" ? null : Number(cfg.minimum);
    const drop = cfg.dropPercent === undefined || cfg.dropPercent === "" ? null : Number(cfg.dropPercent);
    const problems: string[] = [];
    if (min !== null && Number.isFinite(min) && current < min) problems.push(`${current} ${metric} is below the minimum of ${min}`);
    // A relative drop only means something when there was enough before it to compare against.
    if (drop !== null && Number.isFinite(drop) && previous >= 5 && current < previous * (1 - drop / 100)) problems.push(`${metric} fell from ${previous} to ${current} (more than ${drop}% lower)`);
    if (!problems.length) return ok("Volume is normal", `${current} ${metric} in the last ${hours(window)} (previous ${hours(window)}: ${previous})`);
    return { state: "failed", title: "Volume dropped", expected: [min !== null && Number.isFinite(min) ? `At least ${min} ${metric} per ${hours(window)}` : "", drop !== null && Number.isFinite(drop) ? `No more than ${drop}% below the previous ${hours(window)}` : ""].filter(Boolean).join("; "), observed: problems.join("; "), impact: "Fewer results than usual are coming through, which often means part of the automation is silently skipping work.", recommendedAction: "Compare this period with the previous one and look for a changed field, a paused step or an API that now returns nothing.", evidence: [`Window: last ${hours(window)}`, `Current ${metric}: ${current}`, `Previous ${metric}: ${previous}`] };
  }

  if (mode === "watch_reconcile") {
    const max = Math.max(0, Number(cfg.maxGapPercent) || 0);
    const a = inWindow(events, t - window * HOUR, t + 1).length;
    const b = inWindow(otherEvents, t - window * HOUR, t + 1).length;
    if (a === 0) return ok("Nothing to compare", `No runs here in the last ${hours(window)}`);
    const gap = Math.max(0, ((a - b) / a) * 100);
    if (gap <= max) return ok("Both sides match", `${a} here, ${b} in ${otherName} (gap ${gap.toFixed(1)}%)`);
    return { state: "failed", title: "Counts do not match", expected: `${otherName} should have at least ${(100 - max).toFixed(0)}% as many runs as this workflow`, observed: `${a} here, ${b} in ${otherName} (gap ${gap.toFixed(1)}%)`, impact: `About ${a - b} item${a - b === 1 ? "" : "s"} did not make it to ${otherName}.`, recommendedAction: "Find the step between the two where items are dropped: a paused connector, a filter, a quota or a rejected record.", evidence: [`Window: last ${hours(window)}`, `This workflow: ${a} runs`, `${otherName}: ${b} runs`, `Gap: ${gap.toFixed(1)}% (allowed ${max}%)`] };
  }

  return { state: "pending", title: "Unknown watch", expected: "", observed: "", impact: "", recommendedAction: "", evidence: [] };
}

/** Plain-language name for a watch, used as the check name. */
export function watchLabel(mode: WatchMode, cfg: Record<string, any>, otherName?: string): string {
  const w = Math.max(1, Number(cfg.windowHours ?? cfg.everyHours) || 24);
  if (mode === "watch_heartbeat") return `Runs arrive at least every ${hours(w)}`;
  if (mode === "watch_volume") return `Volume stays up (${cfg.metric === "outputs" ? "outputs" : "runs"} per ${hours(w)})`;
  return `Matches ${otherName ?? "the other workflow"} within ${Number(cfg.maxGapPercent) || 0}% (per ${hours(w)})`;
}

/** Validates the form values for a new watch. Returns the clean configuration or a plain-language problem. */
export function parseWatch(body: any): { ok: true; mode: WatchMode; configuration: Record<string, unknown> } | { ok: false; error: string } {
  const mode = body?.mode as WatchMode;
  if (!WATCH_MODES.includes(mode)) return { ok: false, error: "Choose what to watch." };
  const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
  const windowHours = num(body.windowHours);
  if (windowHours === null || !Number.isFinite(windowHours) || windowHours < 1 || windowHours > 720) return { ok: false, error: "Hours must be between 1 and 720." };
  const base = { mode, watch: true, windowHours: Math.round(windowHours) };
  if (mode === "watch_heartbeat") {
    const minRuns = num(body.minRuns) ?? 1;
    if (!Number.isFinite(minRuns) || minRuns < 1 || minRuns > 100000) return { ok: false, error: "Minimum runs must be 1 or more." };
    return { ok: true, mode, configuration: { ...base, everyHours: base.windowHours, minRuns: Math.floor(minRuns) } };
  }
  if (mode === "watch_volume") {
    const minimum = num(body.minimum), drop = num(body.dropPercent);
    if (minimum === null && drop === null) return { ok: false, error: "Set a minimum, a maximum drop, or both." };
    if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) return { ok: false, error: "Minimum must be 0 or more." };
    if (drop !== null && (!Number.isFinite(drop) || drop <= 0 || drop > 100)) return { ok: false, error: "Drop must be between 1 and 100 percent." };
    return { ok: true, mode, configuration: { ...base, metric: body.metric === "outputs" ? "outputs" : "runs", ...(minimum !== null ? { minimum } : {}), ...(drop !== null ? { dropPercent: drop } : {}) } };
  }
  const other = String(body.otherWorkflowId ?? "").trim();
  const gap = num(body.maxGapPercent) ?? 5;
  if (!other) return { ok: false, error: "Choose the workflow to compare with." };
  if (!Number.isFinite(gap) || gap < 0 || gap > 100) return { ok: false, error: "Allowed gap must be between 0 and 100 percent." };
  return { ok: true, mode, configuration: { ...base, otherWorkflowId: other, maxGapPercent: gap } };
}
