import type { RemediationAction } from "@/lib/remediation";
import type { ExecutionProvider, ExecutionRequest } from "./types";

/** In-memory simulator only. No external writes. */
export class MockExecutionProvider implements ExecutionProvider {
  readonly id = "mock_simulator";\n  readonly mode = "simulation" as const;
  private readonly cache = new Map<string, { operationId: string; before: Record<string, unknown>; after: Record<string, unknown> }>();
  constructor(private readonly options: { failExecution?: boolean; failVerification?: boolean } = {}) {}
  supports(action: RemediationAction) { return action !== "manual_review"; }
  async execute(request: ExecutionRequest) {
    if (this.options.failExecution) throw new Error("Simulated execution failure.");
    const cached = this.cache.get(request.idempotencyKey);
    if (cached) return cached;
    const result = { operationId: "mock_" + request.idempotencyKey, before: { simulated: true, status: "failed" }, after: { simulated: true, status: "recovered", action: request.action } };
    this.cache.set(request.idempotencyKey, result);
    return result;
  }
  async verify(_request: ExecutionRequest, operationId: string) {
    if (this.options.failVerification) return { passed: false, detail: "Simulated read-back failed." };
    return { passed: true, detail: "Simulated read-back passed.", observed: { operationId, simulated: true, status: "recovered" } };
  }
}