import type { RemediationAction } from "@/lib/remediation";

export type ExecutionMode = "simulation" | "live";
export type ExecutionState = "succeeded" | "failed" | "blocked" | "verification_failed";
export type ExecutionRequest = {
  workspaceId: string;
  proposalId: string;
  workflowId: string;
  action: RemediationAction;
  preview: Record<string, unknown>;
  idempotencyKey: string;
};
export type ExecutionEvidence = {
  provider: string;
  operationId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};
export type ExecutionResult = {
  mode: ExecutionMode;
  state: ExecutionState;
  message: string;
  evidence: ExecutionEvidence;
};
export interface ExecutionProvider {
  readonly id: string;
  readonly mode: ExecutionMode;
  supports(action: RemediationAction): boolean;
  execute(request: ExecutionRequest): Promise<{ operationId: string; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }>;
  verify(request: ExecutionRequest, operationId: string): Promise<{ passed: boolean; detail: string; observed?: Record<string, unknown> | null }>;
}
