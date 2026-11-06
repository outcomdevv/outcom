import type { AutonomyPolicy } from "@/lib/autonomy";
import { evaluateAutonomy } from "@/lib/autonomy";
import type { ExecutionProvider, ExecutionRequest, ExecutionResult } from "./types";

const providers = new Map<string, ExecutionProvider>();

export function registerExecutionProvider(provider: ExecutionProvider) { providers.set(provider.id, provider); }
export function unregisterExecutionProvider(id: string) { providers.delete(id); }
export function executionProviderAvailable(id: string) { return providers.has(id); }

export async function runNativeExecution(input: {
  request: ExecutionRequest;
  policy: AutonomyPolicy;
  providerId: string;
  risk: "low" | "medium" | "high";
  approved: boolean;
  withinRateLimit: boolean;
  cooldownElapsed: boolean;
}): Promise<ExecutionResult> {
  const provider = providers.get(input.providerId);
  if (!provider || !provider.supports(input.request.action)) return blocked(input.providerId, "No registered provider supports this action.", "simulation");
  if (provider.mode === "live") {
    if (!input.approved) return blocked(provider.id, "A recorded human approval is required before dispatch.");
    const gate = evaluateAutonomy({
      policy: input.policy, action: input.request.action, workflowId: input.request.workflowId, risk: input.risk,
      adapterAvailable: true, hasIndependentReadback: true,
      withinRateLimit: input.withinRateLimit, cooldownElapsed: input.cooldownElapsed,
    });
    if (gate.state === "blocked") return blocked(provider.id, gate.reason);
    if (gate.state === "approval_required" && !input.approved) return blocked(provider.id, gate.reason);
  }
  try {
    const execution = await provider.execute(input.request);
    const verification = await provider.verify(input.request, execution.operationId);
    return {
      mode: provider.mode,
      state: verification.passed ? "succeeded" : "verification_failed",
      message: verification.passed ? (provider.mode === "simulation" ? "Simulation and simulated read-back passed; no external system was changed." : "Provider execution and independent read-back passed.") : "Execution returned, but read-back verification failed.",
      evidence: {
        provider: provider.id, operationId: execution.operationId,
        before: execution.before ?? null, after: verification.observed ?? execution.after ?? null,
        checks: [{ name: provider.mode === "simulation" ? "simulated_readback" : "independent_readback", passed: verification.passed, detail: verification.detail }],
      },
    };
  } catch (error) {
    return {
      mode: provider.mode, state: "failed",
      message: error instanceof Error ? error.message : "Provider execution failed.",
      evidence: { provider: provider.id, operationId: "not_created", checks: [{ name: "provider_execution", passed: false, detail: "Provider failed before returning an operation result." }] },
    };
  }
}
function blocked(provider: string, message: string, mode: "simulation" | "live" = "live"): ExecutionResult {
  return { mode, state: "blocked", message, evidence: { provider, operationId: "not_started", checks: [{ name: "dispatch_gate", passed: false, detail: message }] } };
}
