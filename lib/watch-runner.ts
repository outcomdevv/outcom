import { getWorkspaceStore } from "@/lib/db";
import { evaluateWatch, watchMode } from "@/lib/watches";

export type WatchRun = { contractId: string; workflowId: string; name: string; state: "ok" | "failed" | "pending" };

/** Evaluates every enabled watch of a workspace and opens, keeps or closes its finding. Safe to call as often as every few minutes. */
export async function runWatches(workspaceId?: string, onlyWorkflowId?: string): Promise<WatchRun[]> {
  const store = await getWorkspaceStore(workspaceId);
  const now = new Date();
  const contracts = (await store.contracts.list(onlyWorkflowId)).filter((c) => c.enabled && watchMode(c));
  if (!contracts.length) return [];
  const names = new Map<string, string>((await store.workflows.list()).map((w) => [w.id as string, w.name as string]));
  const runs: WatchRun[] = [];
  for (const c of contracts) {
    const cfg: any = c.configuration ?? {};
    const window = Math.max(1, Number(cfg.windowHours ?? cfg.everyHours) || 24);
    const from = new Date(now.getTime() - 2 * window * 3_600_000).toISOString();
    try {
      const events = await store.events.since(c.workflowId, from);
      const otherId = typeof cfg.otherWorkflowId === "string" ? cfg.otherWorkflowId : "";
      const otherEvents = otherId ? await store.events.since(otherId, from) : [];
      const r = evaluateWatch({ contract: c, events, otherEvents, otherName: names.get(otherId), now });
      await store.contracts.patchConfiguration(c.id, { lastCheckedAt: now.toISOString(), lastState: r.state, lastObserved: r.observed });
      const key = `watch:${c.id}`;
      const existing = await store.incidents.getFor(key, c.id);
      const detail = { title: r.title, summary: "A scheduled watch found that the automation is not behaving as expected, even though no run failed.", expected: r.expected, observed: r.observed, evidence: r.evidence, impact: r.impact, recommendedAction: r.recommendedAction };
      if (r.state === "failed") {
        if (!existing) await store.incidents.create({ workflowId: c.workflowId, eventId: key, contractId: c.id, type: "silent_failure", severity: c.severity, ...detail });
        else if (existing.status === "resolved") await store.incidents.reopen(existing.id, detail);
      } else if (r.state === "ok" && existing?.status === "open") {
        await store.incidents.resolve(existing.id);
      }
      runs.push({ contractId: c.id, workflowId: c.workflowId, name: c.name, state: r.state });
    } catch {
      runs.push({ contractId: c.id, workflowId: c.workflowId, name: c.name, state: "pending" });
    }
  }
  return runs;
}
