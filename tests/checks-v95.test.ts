import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ getWorkspaceStore: vi.fn() }));
vi.mock("@/lib/adapters/registry", () => ({ adapterFor: vi.fn(async () => { throw new Error("not used"); }) }));
import { checkOutcome } from "@/lib/outcome-checker";
import { normalizeEvidence } from "@/lib/evidence";
import { evaluateWatch, parseWatch, perRunContracts, watchLabel } from "@/lib/watches";
import { autoLabel, newCheck, toPayload, updateCheck, validateCheck, splitFields } from "@/lib/connect-checks";

const NOW = new Date("2026-10-22T12:00:00Z");
const contract = (configuration: any, over: any = {}): any => ({ id: "c1", workflowId: "w", name: "x", type: "state_invariant", system: "reported", entity: "evidence", severity: "high", enabled: true, createdAt: "2026-10-01T00:00:00Z", updatedAt: "", configuration: { target: { step: "crm" }, lookup: { valueFrom: "event.data.target_record_id" }, ...configuration }, ...over });
const event = (evidence: any, data: any = {}, timestamp = NOW.toISOString()): any => ({ id: "e1", workflowId: "w", executionId: "r1", timestamp, platform: "n8n", status: "success", metadata: {}, data: { target_record_id: "a@b.com", evidence: { crm: { step: "crm", ...evidence } }, ...data } });

describe("value compared with the run's own input", () => {
  const cfg = { mode: "field_condition", field: "Email", operator: "equals", expectedFrom: "event.data.email" };
  it("passes when the destination matches what the run carried, ignoring case and spaces", async () => {
    const r = await checkOutcome(event({ found: true, fields: { Email: " A@B.com " } }, { email: "a@b.com" }), contract(cfg));
    expect(r.state).toBe("passed");
  });
  it("fails when they differ and names both values", async () => {
    const r = await checkOutcome(event({ found: true, fields: { Email: "other@x.com" } }, { email: "a@b.com" }), contract(cfg));
    expect(r.state).toBe("failed");
    expect(r.expected).toMatch(/a@b\.com/);
  });
  it("is UNKNOWN when the run did not send the field", async () => {
    const r = await checkOutcome(event({ found: true, fields: { Email: "a@b.com" } }), contract(cfg));
    expect(r.state).toBe("verification_error");
    expect(r.evidence.join(" ")).toMatch(/did not send “email”/);
  });
  it("still compares typed values exactly, as before", async () => {
    const c = contract({ mode: "field_condition", field: "Status", operator: "equals", expectedValue: "Qualified" });
    expect((await checkOutcome(event({ found: true, fields: { Status: "qualified" } }), c)).state).toBe("failed");
  });
});

describe("required fields", () => {
  const c = contract({ mode: "required_fields", fields: ["email", "owner"] });
  it("passes when every field is filled", async () => {
    expect((await checkOutcome(event({ found: true, fields: { Email: "a@b.com", Owner: "Sam" } }), c)).state).toBe("passed");
  });
  it("fails and lists the blank ones, including whitespace-only values", async () => {
    const r = await checkOutcome(event({ found: true, fields: { Email: "a@b.com", Owner: "  " } }), c);
    expect(r.state).toBe("failed");
    expect(r.observed).toBe("Empty: owner");
  });
  it("fails when the record itself is missing", async () => {
    expect((await checkOutcome(event({ found: false, fields: {} }), c)).state).toBe("failed");
  });
});

describe("record count (duplicates)", () => {
  const c = contract({ mode: "record_count", operator: "equals", expectedCount: 1 });
  it("passes on exactly one, fails on two, and on zero", async () => {
    expect((await checkOutcome(event({ found: true, count: 1, fields: {} }), c)).state).toBe("passed");
    const dup = await checkOutcome(event({ found: true, count: 2, fields: {} }), c);
    expect(dup.state).toBe("failed");
    expect(dup.title).toMatch(/duplicates/);
    expect((await checkOutcome(event({ found: false, count: 0, fields: {} }), c)).state).toBe("failed");
  });
  it("is UNKNOWN when the workflow did not report a count, and for non-reported systems", async () => {
    expect((await checkOutcome(event({ found: true, fields: {} }), c)).state).toBe("verification_error");
    expect((await checkOutcome(event({ found: true, count: 1, fields: {} }), contract({ mode: "record_count", operator: "equals", expectedCount: 1 }, { system: "airtable" }))).state).toBe("verification_error");
  });
  it("supports at least and at most", async () => {
    expect((await checkOutcome(event({ found: true, count: 3, fields: {} }), contract({ mode: "record_count", operator: "at_least", expectedCount: 2 }))).state).toBe("passed");
    expect((await checkOutcome(event({ found: true, count: 3, fields: {} }), contract({ mode: "record_count", operator: "at_most", expectedCount: 2 }))).state).toBe("failed");
  });
  it("evidence keeps count and derives found from it", () => {
    expect(normalizeEvidence({ evidence: [{ step: "a", count: 2 }] }).a).toMatchObject({ count: 2, found: true });
    expect(normalizeEvidence({ evidence: [{ step: "a", count: "x", found: true }] }).a.count).toBeUndefined();
  });
});

describe("freshness", () => {
  const c = contract({ mode: "fresh_within", field: "created_at", maxMinutes: 5 });
  it("passes when the record time is close to the run and fails when it is stale", async () => {
    expect((await checkOutcome(event({ found: true, fields: { created_at: "2026-10-22T11:58:00Z" } }), c)).state).toBe("passed");
    expect((await checkOutcome(event({ found: true, fields: { created_at: "2026-10-20T11:58:00Z" } }), c)).state).toBe("failed");
  });
  it("understands epoch seconds and is UNKNOWN for unreadable dates", async () => {
    expect((await checkOutcome(event({ found: true, fields: { created_at: String(Math.floor(NOW.getTime() / 1000)) } }), c)).state).toBe("passed");
    expect((await checkOutcome(event({ found: true, fields: { created_at: "yesterday" } }), c)).state).toBe("verification_error");
  });
});

describe("watches", () => {
  const w = (configuration: any): any => contract(configuration, { system: "event", entity: "watch", createdAt: "2026-10-01T00:00:00Z" });
  const ev = (hoursAgo: number, output = 1): any => ({ id: `e${hoursAgo}${output}`, workflowId: "w", executionId: String(Math.random()), timestamp: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(), platform: "n8n", status: "success", metadata: {}, data: { output_count: output } });

  it("heartbeat: ok with a recent run, finding when the trigger went quiet", () => {
    const c = w({ mode: "watch_heartbeat", windowHours: 24, minRuns: 1 });
    expect(evaluateWatch({ contract: c, events: [ev(2)], now: NOW }).state).toBe("ok");
    const quiet = evaluateWatch({ contract: c, events: [ev(40)], now: NOW });
    expect(quiet.state).toBe("failed");
    expect(quiet.observed).toMatch(/0 runs/);
    expect(evaluateWatch({ contract: c, events: [], now: NOW }).observed).toMatch(/no run found in the last 48 hours/);
  });
  it("a new watch stays pending instead of raising a false alarm", () => {
    const c = w({ mode: "watch_heartbeat", windowHours: 24 });
    c.createdAt = new Date(NOW.getTime() - 3_600_000).toISOString();
    expect(evaluateWatch({ contract: c, events: [], now: NOW }).state).toBe("pending");
  });
  it("volume: minimum and relative drop, only against a meaningful baseline", () => {
    const c = w({ mode: "watch_volume", windowHours: 24, metric: "runs", dropPercent: 50 });
    const prev = Array.from({ length: 10 }, (_, i) => ev(30 + i * 0.1));
    expect(evaluateWatch({ contract: c, events: [...prev, ev(1)], now: NOW }).state).toBe("failed");
    expect(evaluateWatch({ contract: c, events: [...prev, ...Array.from({ length: 8 }, () => ev(1))], now: NOW }).state).toBe("ok");
    expect(evaluateWatch({ contract: c, events: [ev(30), ev(1)], now: NOW }).state).toBe("ok"); // baseline too small
    expect(evaluateWatch({ contract: w({ mode: "watch_volume", windowHours: 24, minimum: 3 }), events: [ev(1)], now: NOW }).state).toBe("failed");
  });
  it("volume can count outputs instead of runs", () => {
    const c = w({ mode: "watch_volume", windowHours: 24, metric: "outputs", minimum: 10 });
    expect(evaluateWatch({ contract: c, events: [ev(1, 0), ev(2, 0)], now: NOW }).state).toBe("failed");
    expect(evaluateWatch({ contract: c, events: [ev(1, 6), ev(2, 6)], now: NOW }).state).toBe("ok");
  });
  it("reconcile: 100 in, 90 out is a finding at a 5% allowance, fine at 10%", () => {
    const a = Array.from({ length: 100 }, () => ev(1)), b = Array.from({ length: 90 }, () => ev(1));
    const base = { mode: "watch_reconcile", windowHours: 24, otherWorkflowId: "o" };
    const bad = evaluateWatch({ contract: w({ ...base, maxGapPercent: 5 }), events: a, otherEvents: b, otherName: "CRM", now: NOW });
    expect(bad.state).toBe("failed");
    expect(bad.impact).toMatch(/10 items/);
    expect(evaluateWatch({ contract: w({ ...base, maxGapPercent: 10 }), events: a, otherEvents: b, now: NOW }).state).toBe("ok");
    expect(evaluateWatch({ contract: w({ ...base, maxGapPercent: 0 }), events: [], otherEvents: b, now: NOW }).state).toBe("ok");
  });
  it("watches never count as per-run checks", () => {
    expect(perRunContracts([w({ mode: "watch_heartbeat" }), contract({ mode: "field_condition" })])).toHaveLength(1);
  });
  it("parseWatch validates and names the watch", () => {
    expect(parseWatch({ mode: "nope", windowHours: 24 }).ok).toBe(false);
    expect(parseWatch({ mode: "watch_heartbeat", windowHours: 0 }).ok).toBe(false);
    expect(parseWatch({ mode: "watch_volume", windowHours: 24 }).ok).toBe(false);
    expect(parseWatch({ mode: "watch_reconcile", windowHours: 24 }).ok).toBe(false);
    const ok = parseWatch({ mode: "watch_heartbeat", windowHours: "6", minRuns: "2" });
    expect(ok.ok && ok.configuration).toMatchObject({ mode: "watch_heartbeat", windowHours: 6, everyHours: 6, minRuns: 2 });
    expect(watchLabel("watch_heartbeat", { windowHours: 6 })).toBe("Runs arrive at least every 6 hours");
  });
});

describe("wizard check model", () => {
  const ctx = { system: "reported" as const, tab: "crm" };
  it("builds payloads the protect route understands", () => {
    const req = updateCheck(newCheck("required", "r"), { field: "email, owner , email" }, ctx);
    expect(req.label).toBe("email, owner are filled in");
    expect(toPayload(req, "reported", { step: "crm" }, "crm")).toMatchObject({ type: "state_invariant", mode: "required_fields", fields: ["email", "owner"] });
    const cnt = updateCheck(newCheck("count", "c"), {}, ctx);
    expect(cnt.label).toBe("Exactly one record exists (no duplicates)");
    expect(toPayload(cnt, "reported", { step: "crm" }, "crm")).toMatchObject({ mode: "record_count", operator: "equals", expectedCount: 1 });
    const fresh = updateCheck(newCheck("fresh", "f"), { field: "created_at" }, ctx);
    expect(toPayload(fresh, "reported", { step: "crm" }, "crm")).toMatchObject({ mode: "fresh_within", maxMinutes: 10, field: "created_at" });
    const fromRun = updateCheck(newCheck("value", "v"), { field: "Email", operator: "equals", expectedFrom: "email" }, ctx);
    expect(fromRun.label).toBe("Email is the run's “email”");
    expect(toPayload(fromRun, "reported", { step: "crm" }, "crm")).toMatchObject({ expectedFrom: "email", expectedValue: "" });
    expect(splitFields("a, b,, a")).toEqual(["a", "b"]);
  });
  it("refuses incomplete new checks and counting outside reported evidence", () => {
    expect(validateCheck(newCheck("required", "r"), { system: "reported" })).toMatch(/field names/);
    expect(validateCheck(newCheck("count", "c"), { system: "airtable" })).toMatch(/Any other app/);
    expect(validateCheck(newCheck("count", "c"), { system: "reported" })).toBeNull();
    expect(validateCheck(newCheck("fresh", "f"), { system: "reported" })).toMatch(/date or time field|Name the date/);
    expect(validateCheck({ ...newCheck("value", "v"), field: "Email", expectedFrom: "email" }, { system: "reported" })).toBeNull();
    expect(autoLabel({ ...newCheck("value", "v"), field: "Status", expectedValue: "x" }, ctx)).toBe('Status is "x"');
  });
});
