import { ghlAdapter } from "@/lib/adapters/ghl";
import { MockCRMAdapter } from "@/lib/adapters/mock-crm";
import type { DownstreamAdapter } from "@/lib/adapters/types";
import { getWorkspaceStore } from "@/lib/db";
import type { CheckResult, OutcomeContract, WorkflowEvent } from "@/lib/contracts/types";

const value = (event: WorkflowEvent, path: string) =>
  path.replace(/^event\.data\./, "").split(".").reduce<any>((v, k) => v?.[k], event.data);

const adapterFor = async (system: string): Promise<DownstreamAdapter> => {
  if (system === "mock_crm") return new MockCRMAdapter();
  if (system === "ghl") return ghlAdapter();
  throw new Error(`Unsupported downstream system: ${system}`);
};

const fail = (
  c: OutcomeContract,
  title: string,
  expected: string,
  observed: string,
  impact: string,
  event: WorkflowEvent,
  extra: string[] = [],
): CheckResult => ({
  state: "failed",
  type: c.type,
  severity: c.severity,
  title,
  summary: "The workflow execution reported SUCCESS, but downstream business state did not satisfy its Outcome Contract.",
  expected,
  observed,
  evidence: [
    `Execution ${event.executionId} · ${new Date(event.timestamp).toISOString()} · status SUCCESS`,
    `Expected: ${expected}`,
    `Observed: ${observed}`,
    ...extra,
    "Conclusion: Business outcome failed despite successful workflow execution.",
  ],
  impact,
  recommendedAction: "Inspect the downstream write step, compare the execution input/output with the expected state, then retry or repair the affected record.",
});

export async function checkOutcome(event: WorkflowEvent, c: OutcomeContract): Promise<CheckResult> {
  try {
    const cfg: any = c.configuration;

    if (c.type === "output_count") {
      const actual = Number(event.data.output_count ?? 0);
      const op = cfg.expected?.operator ?? "greater_than";
      const n = Number(cfg.expected?.value ?? 0);
      const passed = op === "greater_than" ? actual > n : actual === n;
      return passed
        ? { state: "passed", type: c.type, severity: c.severity, title: "Output count satisfied", expected: `Output count ${op} ${n}`, observed: `Output count: ${actual}`, evidence: [`Execution ${event.executionId} · status SUCCESS`, `Observed output count: ${actual}`], summary: "Outcome Contract passed.", impact: "", recommendedAction: "" }
        : fail(c, "Workflow succeeded but produced too few outputs", `Expected output count ${op} ${n}`, `Observed output count: ${actual}`, "Expected downstream work was not produced.", event);
    }

    const lookup = String(value(event, cfg.lookup?.valueFrom ?? "event.data.contact_id") ?? "");
    const adapter = await adapterFor(c.system);
    const record = await adapter.getRecord(lookup);
    const source = `Downstream: ${c.system} · record ${lookup}`;

    if (c.type === "record_exists") {
      return record
        ? { state: "passed", type: c.type, severity: c.severity, title: "Expected downstream record exists", expected: `Record ${lookup} exists`, observed: `Record ${lookup} found`, evidence: [`Execution ${event.executionId} · status SUCCESS`, source, "Read-only verification returned a matching record."], summary: "Outcome Contract passed.", impact: "", recommendedAction: "" }
        : fail(c, "Workflow succeeded but the downstream record is missing", `Record ${lookup} exists`, `No matching record ${lookup} found`, "The downstream customer record was not created or cannot be found.", event, [source, "Read-only verification returned no matching record."]);
    }

    const field = String(cfg.field || "tags");
    const actual = record?.[field];

    if (cfg.mode === "preserve_tags") {
      const current = Array.isArray(actual) ? actual.filter((x): x is string => typeof x === "string") : [];
      const store = await getWorkspaceStore();
      const prior = await store.snapshots.get(c.id, lookup);
      if (!prior) {
        await store.snapshots.upsert({ contractId: c.id, entityId: lookup, snapshot: { [field]: current } });
        return { state: "passed", type: c.type, severity: c.severity, title: "Baseline captured", expected: "Existing business tags are preserved over time", observed: `Baseline captured: ${JSON.stringify(current)}`, evidence: [`Execution ${event.executionId} · status SUCCESS`, source, `OutcomeGuard captured the first known ${field} state for this record.`, "Future successful runs will be checked for state regressions."], summary: "OutcomeGuard established a read-only business-state baseline.", impact: "", recommendedAction: "" };
      }
      const previous = Array.isArray(prior.snapshot[field]) ? prior.snapshot[field].filter((x: unknown): x is string => typeof x === "string") : [];
      const disappeared = previous.filter((tag: string) => !current.includes(tag));
      if (disappeared.length) {
        return fail(c, "Workflow succeeded but business state regressed", `Existing tags must be preserved: ${disappeared.join(", ")}`, `Current tags: ${JSON.stringify(current)}`, "A previously observed customer state disappeared after a successful automation run.", event, [source, `Previous baseline: ${JSON.stringify(previous)}`, `Current state: ${JSON.stringify(current)}`, `Regression detected: ${disappeared.join(", ")}`]);
      }
      await store.snapshots.upsert({ contractId: c.id, entityId: lookup, snapshot: { [field]: current } });
      return { state: "passed", type: c.type, severity: c.severity, title: "Business state preserved", expected: "Previously observed tags remain present", observed: `Current tags: ${JSON.stringify(current)}`, evidence: [`Execution ${event.executionId} · status SUCCESS`, source, `Compared current ${field} against OutcomeGuard's previous read-only baseline.`], summary: "OutcomeGuard found no business-state regression.", impact: "", recommendedAction: "" };
    }

    const expected = cfg.expectedValue;
    const op = cfg.operator;
    const list = Array.isArray(actual) ? actual : [];
    const passed = op === "equals" ? actual === expected : op === "not_equals" ? actual !== expected : op === "contains" ? list.includes(expected) : op === "not_contains" ? !list.includes(expected) : op === "exists" ? actual != null : actual == null;
    const observed = `${field} = ${JSON.stringify(actual)}`;
    const expectedText = `Expected ${field} ${op} ${String(expected)}`;

    return passed
      ? { state: "passed", type: c.type, severity: c.severity, title: "Business state preserved", expected: expectedText, observed, evidence: [`Execution ${event.executionId} · status SUCCESS`, source, `Read-only verification returned ${observed}.`], summary: "Outcome Contract passed.", impact: "", recommendedAction: "" }
      : fail(c, "Workflow succeeded but required business state was not preserved", expectedText, `Observed ${observed}`, "The customer may be routed incorrectly because the required downstream state is absent.", event, [source, `Read-only verification returned ${observed}.`]);
  } catch (error) {
    return {
      state: "verification_error",
      type: c.type,
      severity: c.severity,
      title: "Outcome verification could not complete",
      expected: "Verification of downstream state",
      observed: "Verification error",
      evidence: [`Execution ${event.executionId} · status SUCCESS`, `Verification failed: ${error instanceof Error ? error.message : "Unknown adapter error"}`],
      summary: "OutcomeGuard cannot determine the business outcome.",
      impact: "Business outcome is unknown until verification succeeds.",
      recommendedAction: "Check the downstream connection, permissions, API health and retry verification.",
    };
  }
}

export async function evaluateEvent(event: WorkflowEvent) {
  const store = await getWorkspaceStore();
  const contracts = (await store.contracts.list(event.workflowId)).filter((c) => c.enabled);
  const results: CheckResult[] = [];
  for (const c of contracts) {
    let r: CheckResult;
    if (event.status !== "success") {
      r = {
        state: "verification_error",
        type: c.type,
        severity: c.severity,
        title: "Workflow execution failed",
        expected: "Successful execution before business-state verification",
        observed: `Execution ${event.executionId} reported FAILED`,
        evidence: [`Execution ${event.executionId} · ${new Date(event.timestamp).toISOString()}`, "Automation platform reported FAILED; downstream business outcome was not evaluated."],
        summary: "The automation itself failed before OutcomeGuard could prove the business outcome.",
        impact: "The expected business outcome is at risk.",
        recommendedAction: "Open the automation execution, fix the failed step, then re-run and verify the downstream state.",
      };
    } else {
      r = await checkOutcome(event, c);
    }
    results.push(r);
    if (r.state !== "passed" && !(await store.incidents.getFor(event.id, c.id))) {
      await store.incidents.create({ workflowId: event.workflowId, eventId: event.id, contractId: c.id, type: event.status !== "success" ? "technical_failure" : r.state === "failed" ? "silent_failure" : "verification_error", severity: r.severity, title: r.title, summary: r.summary, expected: r.expected, observed: r.observed, evidence: r.evidence, impact: r.impact, recommendedAction: r.recommendedAction });
    }
  }
  return results;
}
