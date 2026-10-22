import { adapterFor } from "@/lib/adapters/registry";
import { ciGet } from "@/lib/google-sheets";
import { getWorkspaceStore } from "@/lib/db";
import { ReportedAdapter, evidenceFor } from "@/lib/evidence";
import { perRunContracts } from "@/lib/watches";
import type { CheckResult, OutcomeContract, WorkflowEvent } from "@/lib/contracts/types";

const value = (event: WorkflowEvent, path: string) =>
  path.replace(/^event\.data\./, "").split(".").reduce<any>((v, k) => v?.[k], event.data);

const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
/** Accepts ISO text, epoch seconds or epoch milliseconds. */
const toTime = (v: unknown): number => {
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  const n = Number(v);
  if (typeof v === "string" && v.trim() && Number.isFinite(n) && /^\d+(\.\d+)?$/.test(v.trim())) return n < 1e12 ? n * 1000 : n;
  return Date.parse(String(v));
};
const pass = (c: OutcomeContract, event: WorkflowEvent, title: string, expected: string, observed: string, source: string): CheckResult => ({ state: "passed", type: c.type, severity: c.severity, title, expected, observed, evidence: [`Execution ${event.executionId} · status SUCCESS`, source, `Observed: ${observed}`], summary: "Outcome Contract passed.", impact: "", recommendedAction: "" });

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

export async function checkOutcome(event: WorkflowEvent, c: OutcomeContract, workspaceId?: string): Promise<CheckResult> {
  try {
    const cfg: any = c.configuration;

    if (c.type === "output_count") {
      const actual = Number(value(event, cfg.valueFrom ?? "event.data.output_count") ?? 0);
      const op = cfg.expected?.operator ?? "greater_than";
      const n = Number(cfg.expected?.value ?? 0);
      const passed = op === "greater_than" ? actual > n : actual === n;
      return passed
        ? { state: "passed", type: c.type, severity: c.severity, title: "Output count satisfied", expected: `Output count ${op} ${n}`, observed: `Output count: ${actual}`, evidence: [`Execution ${event.executionId} · status SUCCESS`, `Observed output count: ${actual}`], summary: "Outcome Contract passed.", impact: "", recommendedAction: "" }
        : fail(c, "Workflow succeeded but produced too few outputs", `Expected output count ${op} ${n}`, `Observed output count: ${actual}`, "Expected downstream work was not produced.", event);
    }

    // "reported": the automation read the destination itself and sent what it saw. Outcom judges that evidence.
    const reported = c.system === "reported";
    const step = reported ? String(cfg.target?.step ?? "") : "";
    const evidence = reported ? evidenceFor(event.data, step) : null;
    if (reported && !evidence) throw new Error(`No evidence has been reported for step "${step}" yet.`);
    const lookup = reported
      ? String(evidence?.key ?? value(event, cfg.lookup?.valueFrom ?? "event.data.target_record_id") ?? "")
      : String(value(event, cfg.lookup?.valueFrom ?? "event.data.contact_id") ?? "");
    const adapter = reported && evidence ? new ReportedAdapter(evidence) : await adapterFor(c.system, workspaceId ?? event.metadata.workspace_id as string | undefined, cfg.target);
    const record = await adapter.getRecord(lookup);
    const source = reported
      ? `Evidence reported by the workflow · step "${step}"${lookup ? ` · record ${lookup}` : ""} · not independently verified`
      : `Downstream: ${c.system} · record ${lookup}`;

    if (c.type === "record_exists") {
      return record
        ? { state: "passed", type: c.type, severity: c.severity, title: "Expected downstream record exists", expected: `Record ${lookup} exists`, observed: `Record ${lookup} found`, evidence: [`Execution ${event.executionId} · status SUCCESS`, source, "Read-only verification returned a matching record."], summary: "Outcome Contract passed.", impact: "", recommendedAction: "" }
        : fail(c, "Workflow succeeded but the downstream record is missing", `Record ${lookup} exists`, `No matching record ${lookup} found`, "The downstream customer record was not created or cannot be found.", event, [source, "Read-only verification returned no matching record."]);
    }

    const field = String(cfg.field || "tags");
    const actual = record ? ciGet(record, field) : undefined;

    if (cfg.mode === "required_fields") {
      const names: string[] = Array.isArray(cfg.fields) ? cfg.fields.map(String).filter(Boolean) : [];
      if (!names.length) throw new Error("No required fields were set for this check.");
      if (!record) return fail(c, "Workflow succeeded but the downstream record is missing", `Record ${lookup} exists with ${names.join(", ")} filled in`, `No matching record ${lookup} found`, "The record was not created, so its required fields cannot be filled.", event, [source]);
      const empty = names.filter((n) => blank(ciGet(record, n)));
      return empty.length
        ? fail(c, "Workflow succeeded but required fields are empty", `${names.join(", ")} filled in`, `Empty: ${empty.join(", ")}`, "The record exists but is missing information the business depends on. A renamed or unmapped field often causes this.", event, [source, `Checked fields: ${names.join(", ")}`])
        : pass(c, event, "Required fields are filled in", `${names.join(", ")} filled in`, `All ${names.length} field${names.length === 1 ? "" : "s"} filled in`, source);
    }

    if (cfg.mode === "record_count") {
      if (!reported) throw new Error("Counting records needs “Any other app” evidence. Send count with the read-back step.");
      const n = evidence?.count;
      if (n === undefined) throw new Error("The workflow did not report how many records it found. Add count to the evidence.");
      const op = cfg.operator === "at_least" || cfg.operator === "at_most" ? cfg.operator : "equals";
      const want = Number(cfg.expectedCount ?? 1);
      const good = op === "equals" ? n === want : op === "at_least" ? n >= want : n <= want;
      const words = op === "equals" ? `exactly ${want}` : op === "at_least" ? `at least ${want}` : `at most ${want}`;
      return good
        ? pass(c, event, "Record count is right", `Found ${words}`, `Found ${n}`, source)
        : fail(c, n > want ? "Workflow succeeded but created duplicates" : "Workflow succeeded but too few records exist", `Found ${words} record${want === 1 ? "" : "s"}`, `Found ${n}`, n > want ? "The same item was written more than once, or another automation wrote it too." : "Fewer records exist than the business expects.", event, [source]);
    }

    if (cfg.mode === "fresh_within") {
      const minutes = Number(cfg.maxMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("No time limit was set for this check.");
      const name = String(cfg.field || "");
      if (!record) return fail(c, "Workflow succeeded but the downstream record is missing", `Record ${lookup} written within ${minutes} minutes of the run`, `No matching record ${lookup} found`, "Nothing was written.", event, [source]);
      const raw = ciGet(record, name);
      const at = toTime(raw);
      if (blank(raw) || !Number.isFinite(at)) throw new Error(`The field “${name}” does not hold a readable date or time.`);
      const diff = Math.abs(at - new Date(event.timestamp).getTime()) / 60000;
      return diff <= minutes
        ? pass(c, event, "Record was written on time", `${name} within ${minutes} minutes of the run`, `${name} is ${diff.toFixed(1)} minutes from the run`, source)
        : fail(c, "Workflow succeeded but the record was not written on time", `${name} within ${minutes} minutes of the run`, `${name} is ${diff.toFixed(1)} minutes from the run (${new Date(at).toISOString()})`, "The record is stale or arrived late, so the run may not have written it.", event, [source, `Run time: ${new Date(event.timestamp).toISOString()}`]);
    }

    if (cfg.mode === "preserve_tags") {
      const current = Array.isArray(actual) ? actual.filter((x): x is string => typeof x === "string") : [];
      const store = await getWorkspaceStore(workspaceId ?? workspaceOf(event));
      const prior = await store.snapshots.get(c.id, lookup);
      if (!prior) {
        await store.snapshots.upsert({ contractId: c.id, entityId: lookup, snapshot: { [field]: current } });
        return { state: "passed", type: c.type, severity: c.severity, title: "Baseline captured", expected: "Existing business tags are preserved over time", observed: `Baseline captured: ${JSON.stringify(current)}`, evidence: [`Execution ${event.executionId} · status SUCCESS`, source, `Outcom captured the first known ${field} state for this record.`, "Future successful runs will be checked for state regressions."], summary: "Outcom established a read-only business-state baseline.", impact: "", recommendedAction: "" };
      }
      const previous = Array.isArray(prior.snapshot[field]) ? prior.snapshot[field].filter((x: unknown): x is string => typeof x === "string") : [];
      const disappeared = previous.filter((tag: string) => !current.includes(tag));
      if (disappeared.length) {
        return fail(c, "Workflow succeeded but business state regressed", `Existing tags must be preserved: ${disappeared.join(", ")}`, `Current tags: ${JSON.stringify(current)}`, "A previously observed customer state disappeared after a successful automation run.", event, [source, `Previous baseline: ${JSON.stringify(previous)}`, `Current state: ${JSON.stringify(current)}`, `Regression detected: ${disappeared.join(", ")}`]);
      }
      await store.snapshots.upsert({ contractId: c.id, entityId: lookup, snapshot: { [field]: current } });
      return { state: "passed", type: c.type, severity: c.severity, title: "Business state preserved", expected: "Previously observed tags remain present", observed: `Current tags: ${JSON.stringify(current)}`, evidence: [`Execution ${event.executionId} · status SUCCESS`, source, `Compared current ${field} against Outcom's previous read-only baseline.`], summary: "Outcom found no business-state regression.", impact: "", recommendedAction: "" };
    }

    // "expectedFrom" compares the destination with something the run itself carried, for example the email typed in the form.
    const fromRun = typeof cfg.expectedFrom === "string" && cfg.expectedFrom.trim() ? cfg.expectedFrom.trim() : null;
    let expected = cfg.expectedValue;
    if (fromRun) {
      expected = value(event, fromRun);
      if (blank(expected)) throw new Error(`The run did not send “${fromRun.replace(/^event\.data\./, "")}”, so Outcom has nothing to compare ${field} with.`);
    }
    const op = cfg.operator;
    const list = Array.isArray(actual) ? actual : [];
    const same = (a: unknown, b: unknown) => (fromRun ? norm(a) === norm(b) : a === b);
    const passed = op === "equals" ? same(actual, expected) : op === "not_equals" ? !same(actual, expected) : op === "contains" ? list.some((x) => same(x, expected)) : op === "not_contains" ? !list.some((x) => same(x, expected)) : op === "exists" ? actual != null : actual == null;
    const observed = `${field} = ${JSON.stringify(actual)}`;
    const expectedText = `Expected ${field} ${op} ${fromRun ? `the run's “${fromRun.replace(/^event\.data\./, "")}” (${String(expected)})` : String(expected)}`;

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
      summary: "Outcom cannot determine the business outcome.",
      impact: "Business outcome is unknown until verification succeeds.",
      recommendedAction: c.system === "reported"
        ? "Make sure the read-back step ran and sent its evidence to Outcom. Turn on “Always Output Data” on the search step so an empty result still reports."
        : "Check the downstream connection, permissions, API health and retry verification.",
    };
  }
}

/** Webhook and cron callers have no login session, so the workspace must come from the caller or from the stored event. */
const workspaceOf = (event: WorkflowEvent): string | undefined => {
  const id = event.data?.workspace_id ?? event.metadata?.workspace_id;
  return typeof id === "string" && id ? id : undefined;
};

export async function evaluateEvent(event: WorkflowEvent, workspaceId?: string) {
  workspaceId = workspaceId ?? workspaceOf(event);
  const store = await getWorkspaceStore(workspaceId);
  const contracts = perRunContracts<OutcomeContract>((await store.contracts.list(event.workflowId)).filter((c) => c.enabled));
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
        summary: "The automation itself failed before Outcom could prove the business outcome.",
        impact: "The expected business outcome is at risk.",
        recommendedAction: "Open the automation execution, fix the failed step, then re-run and verify the downstream state.",
      };
    } else {
      r = await checkOutcome(event, c, workspaceId);
    }
    results.push(r);
    const existingIncident = await store.incidents.getFor(event.id, c.id);
    if (r.state !== "passed") {
      const incidentType = event.status !== "success" ? "technical_failure" : r.state === "failed" ? "silent_failure" : "verification_error";
      if (!existingIncident) {
        await store.incidents.create({ workflowId: event.workflowId, eventId: event.id, contractId: c.id, type: incidentType, severity: r.severity, title: r.title, summary: r.summary, expected: r.expected, observed: r.observed, evidence: r.evidence, impact: r.impact, recommendedAction: r.recommendedAction });
      } else if (existingIncident.status === "resolved") {
        await store.incidents.reopen(existingIncident.id, { title: r.title, summary: r.summary, expected: r.expected, observed: r.observed, evidence: r.evidence, impact: r.impact, recommendedAction: r.recommendedAction });
      }
    } else if (existingIncident?.status === "open") {
      await store.incidents.resolve(existingIncident.id);
    }
  }
  return results;
}
