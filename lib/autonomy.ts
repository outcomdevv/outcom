export const AUTONOMY_MODES = ["human_approved", "rule_based", "bounded_autonomous"] as const;
export type AutonomyMode = typeof AUTONOMY_MODES[number];
export type AutonomyPolicy = {
  mode: AutonomyMode; enabled: boolean; allowedActions: string[]; allowedWorkflowIds: string[];
  maxRisk: "low" | "medium"; maxExecutionsPerHour: number; cooldownSeconds: number; requireIndependentReadback: true;
};
export type AutonomyDecision =
  | { state: "approval_required"; reason: string }
  | { state: "eligible_for_automatic_execution"; reason: string; mode: "rule_based" | "bounded_autonomous" }
  | { state: "blocked"; reason: string };
const ACTIONS = new Set(["retry_workflow", "update_record_field", "create_missing_record", "resend_message", "manual_review"]);
const uniqueStrings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim()).slice(0, 100))] : [];
export function normalizeAutonomyPolicy(input: unknown): AutonomyPolicy {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const mode = AUTONOMY_MODES.includes(value.mode as AutonomyMode) ? value.mode as AutonomyMode : "human_approved";
  const hourly = Number(value.maxExecutionsPerHour), cooldown = Number(value.cooldownSeconds);
  return {
    mode, enabled: value.enabled === true && mode !== "human_approved",
    allowedActions: uniqueStrings(value.allowedActions).filter(x => ACTIONS.has(x)),
    allowedWorkflowIds: uniqueStrings(value.allowedWorkflowIds),
    maxRisk: value.maxRisk === "medium" ? "medium" : "low",
    maxExecutionsPerHour: Number.isFinite(hourly) ? Math.max(1, Math.min(60, Math.floor(hourly))) : 5,
    cooldownSeconds: Number.isFinite(cooldown) ? Math.max(30, Math.min(86400, Math.floor(cooldown))) : 300,
    requireIndependentReadback: true,
  };
}
/** Fail-closed gate. It never grants permissions from an AI plan or proposal payload. */
export function evaluateAutonomy(input: {
  policy: AutonomyPolicy; action: string; workflowId: string; risk: "low" | "medium" | "high";
  adapterAvailable: boolean; hasIndependentReadback: boolean; withinRateLimit: boolean; cooldownElapsed: boolean;
}): AutonomyDecision {
  const { policy, action, workflowId, risk } = input;
  if (policy.mode === "human_approved" || !policy.enabled) return { state: "approval_required", reason: "This workspace requires explicit human approval." };
  if (!ACTIONS.has(action) || action === "manual_review") return { state: "blocked", reason: "This action is not eligible for automatic execution." };
  if (!policy.allowedActions.includes(action)) return { state: "blocked", reason: "Action is not on the workspace allowlist." };
  if (!policy.allowedWorkflowIds.includes(workflowId)) return { state: "blocked", reason: "Workflow is not on the workspace allowlist." };
  if (risk === "high" || (risk === "medium" && policy.maxRisk !== "medium")) return { state: "blocked", reason: "Action risk exceeds the configured policy." };
  if (!input.adapterAvailable) return { state: "blocked", reason: "No verified provider-specific executor is available." };
  if (policy.requireIndependentReadback && !input.hasIndependentReadback) return { state: "blocked", reason: "Independent post-action read-back is required." };
  if (!input.withinRateLimit) return { state: "blocked", reason: "Workspace execution rate limit reached." };
  if (!input.cooldownElapsed) return { state: "blocked", reason: "Action cooldown has not elapsed." };
  return { state: "eligible_for_automatic_execution", reason: "All workspace policy and safety gates passed.", mode: policy.mode };
}