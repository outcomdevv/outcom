import { afterEach, describe, expect, it } from "vitest";
import { normalizeAutonomyPolicy } from "@/lib/autonomy";
import { registerExecutionProvider, unregisterExecutionProvider, runNativeExecution } from "@/lib/execution/engine";
import { MockExecutionProvider } from "@/lib/execution/mock-provider";
import type { ExecutionRequest } from "@/lib/execution/types";

const request: ExecutionRequest = { workspaceId: "ws_1", proposalId: "p_1", workflowId: "wf_1", action: "retry_workflow", preview: {}, idempotencyKey: "key_1" };
const policy = normalizeAutonomyPolicy({ mode: "rule_based", enabled: true, allowedActions: ["retry_workflow"], allowedWorkflowIds: ["wf_1"], maxRisk: "low" });
afterEach(() => { unregisterExecutionProvider("mock_simulator"); unregisterExecutionProvider("test_live"); });

describe("V98 mock and native execution foundation", () => {
  it("runs a simulation and labels its evidence as simulated", async () => {
    registerExecutionProvider(new MockExecutionProvider());
    const result = await runNativeExecution({ request, policy, providerId: "mock_simulator", risk: "low", approved: false, withinRateLimit: true, cooldownElapsed: true });
    expect(result.mode).toBe("simulation");
    expect(result.state).toBe("succeeded");
    expect(result.evidence.after?.simulated).toBe(true);
  });
  it("is idempotent for repeated mock requests", async () => {
    const provider = new MockExecutionProvider();
    const first = await provider.execute(request), second = await provider.execute(request);
    expect(second.operationId).toBe(first.operationId);
  });
  it("blocks unknown providers", async () => {
    const result = await runNativeExecution({ request, policy, providerId: "missing", risk: "low", approved: true, withinRateLimit: true, cooldownElapsed: true });
    expect(result.state).toBe("blocked");
  });
  it("reports read-back failure separately", async () => {
    registerExecutionProvider(new MockExecutionProvider({ failVerification: true }));
    const result = await runNativeExecution({ request, policy, providerId: "mock_simulator", risk: "low", approved: false, withinRateLimit: true, cooldownElapsed: true });
    expect(result.state).toBe("verification_failed");
    expect(result.mode).toBe("simulation");
  });
  it("does not report success when simulated execution throws", async () => {
    registerExecutionProvider(new MockExecutionProvider({ failExecution: true }));
    const result = await runNativeExecution({ request, policy, providerId: "mock_simulator", risk: "low", approved: false, withinRateLimit: true, cooldownElapsed: true });
    expect(result.state).toBe("failed");
  });
});
