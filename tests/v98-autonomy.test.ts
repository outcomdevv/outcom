import { describe, expect, it } from "vitest";
import { evaluateAutonomy, normalizeAutonomyPolicy } from "@/lib/autonomy";
const base = normalizeAutonomyPolicy({ mode: "rule_based", enabled: true, allowedActions: ["retry_workflow"], allowedWorkflowIds: ["wf_1"], maxRisk: "low", maxExecutionsPerHour: 4, cooldownSeconds: 120, requireIndependentReadback: false });
const eligible = { policy: base, action: "retry_workflow", workflowId: "wf_1", risk: "low" as const, adapterAvailable: true, hasIndependentReadback: true, withinRateLimit: true, cooldownElapsed: true };
describe("V98 autonomy governance", () => {
  it("defaults to human approval", () => { const p = normalizeAutonomyPolicy(null); expect(p.mode).toBe("human_approved"); expect(p.enabled).toBe(false); });
  it("allows only allowlisted and verified low-risk actions", () => expect(evaluateAutonomy(eligible).state).toBe("eligible_for_automatic_execution"));
  it("blocks actions outside the allowlist", () => expect(evaluateAutonomy({ ...eligible, action: "resend_message" }).state).toBe("blocked"));
  it("blocks high-risk actions", () => expect(evaluateAutonomy({ ...eligible, risk: "high" }).state).toBe("blocked"));
  it("requires a provider executor", () => expect(evaluateAutonomy({ ...eligible, adapterAvailable: false }).state).toBe("blocked"));
  it("cannot disable independent read-back", () => { expect(base.requireIndependentReadback).toBe(true); expect(evaluateAutonomy({ ...eligible, hasIndependentReadback: false }).state).toBe("blocked"); });
  it("blocks rate-limit and cooldown violations", () => { expect(evaluateAutonomy({ ...eligible, withinRateLimit: false }).state).toBe("blocked"); expect(evaluateAutonomy({ ...eligible, cooldownElapsed: false }).state).toBe("blocked"); });
  it("clamps execution limits", () => { const p = normalizeAutonomyPolicy({ mode: "bounded_autonomous", enabled: true, maxExecutionsPerHour: 999, cooldownSeconds: 1 }); expect(p.maxExecutionsPerHour).toBe(60); expect(p.cooldownSeconds).toBe(30); });
});