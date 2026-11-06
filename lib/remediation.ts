/** Human-approved repair orchestration. Outcom never executes arbitrary code or an LLM-generated command. */
export const REMEDIATION_ACTIONS = ["retry_workflow", "update_record_field", "create_missing_record", "resend_message", "manual_review"] as const;
export type RemediationAction = typeof REMEDIATION_ACTIONS[number];
export type RepairProposal = { id: string; workspace_id: string; incident_id: string; workflow_id: string; action: RemediationAction; title: string; explanation: string; preview: Record<string, unknown>; risk: "low" | "medium" | "high"; status: "pending" | "approved" | "declined" | "dispatched" | "verified" | "failed"; created_at: string; expires_at: string; approved_at?: string | null; dispatched_at?: string | null; result?: Record<string, unknown> };
const obj = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
export type NewRepairProposal = { incident_id: string; action: RemediationAction; title: string; explanation: string; preview: Record<string, unknown>; risk: "low" | "medium" | "high" };
export function validateProposalInput(v: unknown): { ok: true; value: NewRepairProposal } | { ok: false; error: string } {
  if (!obj(v) || typeof v.incidentId !== "string" || !v.incidentId.trim()) return { ok:false,error:"incidentId is required." };
  const action = typeof v.action === "string" && REMEDIATION_ACTIONS.some(x => x === v.action) ? v.action as RemediationAction : null;
  if (!action) return { ok:false,error:"Unsupported repair action." };
  if (typeof v.title !== "string" || !v.title.trim() || typeof v.explanation !== "string" || !v.explanation.trim()) return { ok:false,error:"A clear title and explanation are required." };
  if (!obj(v.preview)) return { ok:false,error:"A structured preview is required." };
  const risk: "low" | "medium" | "high" = v.risk === "low" || v.risk === "high" || v.risk === "medium" ? v.risk : "medium";
  return { ok:true,value:{ incident_id:v.incidentId,action,title:v.title.slice(0,180),explanation:v.explanation.slice(0,2000),preview:v.preview,risk } };
}
export function isProposalExpired(p: Pick<RepairProposal,"expires_at">, now = Date.now()) { return new Date(p.expires_at).getTime() <= now; }
export function approvalRequiredRisk(risk: RepairProposal["risk"]) { return risk === "low" || risk === "medium" || risk === "high"; }
