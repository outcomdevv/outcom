export type ContractType = "record_exists" | "state_invariant" | "output_count";
export type CheckState = "passed" | "failed" | "verification_error";
export type Severity = "low" | "medium" | "high";
export type EventStatus = "success" | "failed";
export interface Workflow { id:string; name:string; platform:string; description:string; createdAt:string; updatedAt:string }
export interface OutcomeContract { id:string; workflowId:string; name:string; type:ContractType; system:string; entity:string; configuration:Record<string,unknown>; severity:Severity; enabled:boolean; createdAt:string; updatedAt:string }
export interface WorkflowEvent { id:string; workflowId:string; executionId:string; timestamp:string; platform:string; status:EventStatus; data:Record<string,unknown>; metadata:Record<string,unknown>; createdAt:string }
export interface Incident { id:string; workflowId:string; eventId:string; contractId:string; type:"silent_failure"|"technical_failure"|"outcome_mismatch"|"verification_error"; severity:Severity; status:"open"|"resolved"; title:string; summary:string; expected:string; observed:string; evidence:string[]; impact:string; recommendedAction:string; detectedAt:string; resolvedAt:string|null; createdAt:string }
export interface CheckResult { state:CheckState; type:ContractType; expected:string; observed:string; evidence:string[]; severity:Severity; title:string; summary:string; impact:string; recommendedAction:string }
