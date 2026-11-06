/** Deterministic business-semantic checks. UNKNOWN is a first-class result: missing evidence never becomes PASS. */
export type AssessmentState = "pass" | "fail" | "unknown";
export type BusinessDimension = "identity" | "eligibility" | "commercial_sense" | "recipient" | "objective";
export type Fact = { value: unknown; source: "native_readback" | "reported" | "event"; observedAt?: string; reference?: string };
export type BusinessPolicy = {
  customerEmailPath?: string; expectedCustomerEmailPath?: string;
  eligibilityPath?: string; eligibleValues?: unknown[];
  amountPath?: string; minAmount?: number; maxAmount?: number; currencyPath?: string; allowedCurrencies?: string[];
  recipientEmailPath?: string; expectedRecipientEmailPath?: string;
  objectivePath?: string; objectiveExpected?: unknown;
};
export type DimensionResult = { dimension: BusinessDimension; state: AssessmentState; title: string; explanation: string; expected: string; observed: string; evidence: string[]; confidence: "high" | "medium" | "low" };
const get = (obj: any, path?: string): unknown => { if (!path) return undefined; const value = path.split(".").reduce((v, k) => v == null ? undefined : v[k], obj); return value && typeof value === "object" && "value" in value ? (value as Fact).value : value; };
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const result = (dimension: BusinessDimension, state: AssessmentState, title: string, explanation: string, expected: string, observed: string, evidence: string[], confidence: DimensionResult["confidence"] = "high"): DimensionResult => ({ dimension, state, title, explanation, expected, observed, evidence, confidence });
function compareIdentity(policy: BusinessPolicy, facts: Record<string, Fact>): DimensionResult {
  const actual = get(facts, policy.customerEmailPath); const expected = get(facts, policy.expectedCustomerEmailPath);
  if (actual == null || expected == null) return result("identity", "unknown", "Customer identity not proven", "Outcom needs both the customer email read from the destination and the expected email from the original request.", "Destination customer matches original customer", "Missing customer email evidence", [], "low");
  const a = norm(actual), e = norm(expected);
  return result("identity", a === e ? "pass" : "fail", a === e ? "Correct customer matched" : "Possible customer mismatch", a === e ? "The destination record belongs to the expected customer." : "The destination record email differs from the customer identity supplied by the originating event.", e, a, [`Expected identity: ${e}`, `Observed destination identity: ${a}`]);
}
function eligibility(policy: BusinessPolicy, facts: Record<string, Fact>): DimensionResult {
  const actual = get(facts, policy.eligibilityPath);
  if (actual == null || !policy.eligibleValues?.length) return result("eligibility", "unknown", "Eligibility not established", "Configure eligible values and provide the customer's eligibility status from an authoritative source.", `One of: ${(policy.eligibleValues ?? []).join(", ") || "configured eligible values"}`, String(actual ?? "No eligibility evidence"), [], "low");
  const ok = policy.eligibleValues.some(v => norm(v) === norm(actual));
  return result("eligibility", ok ? "pass" : "fail", ok ? "Customer is eligible" : "Customer is not eligible", ok ? "The observed eligibility status matches the configured policy." : "The observed status is not in the allowed eligibility values. Do not continue a restricted transaction.", policy.eligibleValues.join(" | "), String(actual), [`Eligibility source value: ${String(actual)}`]);
}
function commercial(policy: BusinessPolicy, facts: Record<string, Fact>): DimensionResult {
  const amount = get(facts, policy.amountPath); const currency = get(facts, policy.currencyPath);
  if (typeof amount !== "number" || !Number.isFinite(amount) || !policy.amountPath) return result("commercial_sense", "unknown", "Commercial validity not established", "Provide a numeric transaction amount and configure acceptable bounds.", "Amount within configured commercial limits", String(amount ?? "No amount evidence"), [], "low");
  const issues: string[] = [];
  if (policy.minAmount != null && amount < policy.minAmount) issues.push(`below minimum ${policy.minAmount}`);
  if (policy.maxAmount != null && amount > policy.maxAmount) issues.push(`above maximum ${policy.maxAmount}`);
  if (policy.allowedCurrencies?.length && (typeof currency !== "string" || !policy.allowedCurrencies.map(norm).includes(norm(currency)))) issues.push(`currency ${String(currency ?? "missing")} is not allowed`);
  const configured = policy.minAmount != null || policy.maxAmount != null || Boolean(policy.allowedCurrencies?.length);
  if (!configured) return result("commercial_sense", "unknown", "Commercial policy incomplete", "Set at least one amount bound or an allowed-currency list; Outcom will not invent what makes a transaction commercially sensible.", "Configured amount/currency policy", `Amount ${amount}; currency ${String(currency ?? "unknown")}`, [], "low");
  return result("commercial_sense", issues.length ? "fail" : "pass", issues.length ? "Transaction outside commercial policy" : "Transaction within configured commercial policy", issues.length ? `Transaction flagged: ${issues.join("; ")}.` : "Amount and configured currency checks passed. This is a policy check, not a profitability forecast.", `${policy.minAmount ?? "-∞"} ≤ amount ≤ ${policy.maxAmount ?? "+∞"}; currencies: ${(policy.allowedCurrencies ?? ["any"]).join(", ")}`, `${amount} ${String(currency ?? "")}`, [`Amount: ${amount}`, `Currency: ${String(currency ?? "not supplied")}`]);
}
function recipient(policy: BusinessPolicy, facts: Record<string, Fact>): DimensionResult {
  const actual = get(facts, policy.recipientEmailPath); const expected = get(facts, policy.expectedRecipientEmailPath);
  if (actual == null || expected == null) return result("recipient", "unknown", "Message recipient not proven", "Provide the recipient reported by the delivery provider and the intended recipient from the business request.", "Actual recipient equals intended recipient", "Missing recipient evidence", [], "low");
  const a = norm(actual), e = norm(expected); const ok = a === e;
  return result("recipient", ok ? "pass" : "fail", ok ? "Correct recipient confirmed" : "Wrong recipient detected", ok ? "The delivery evidence matches the intended recipient." : "The actual recipient differs from the intended recipient. Treat this as a potential privacy incident.", e, a, [`Intended recipient: ${e}`, `Reported delivered recipient: ${a}`]);
}
function objective(policy: BusinessPolicy, facts: Record<string, Fact>): DimensionResult {
  const actual = get(facts, policy.objectivePath);
  if (actual == null || policy.objectiveExpected === undefined) return result("objective", "unknown", "Business objective not proven", "Configure a measurable objective and supply evidence from the system of record (for example paid, qualified, booked, or fulfilled). A successful workflow is not proof of business impact.", String(policy.objectiveExpected ?? "Configured business outcome"), String(actual ?? "No outcome evidence"), [], "low");
  const ok = norm(actual) === norm(policy.objectiveExpected);
  return result("objective", ok ? "pass" : "fail", ok ? "Business objective achieved" : "Business objective not achieved", ok ? "The observed business state matches the configured objective." : "The workflow ran, but the observed business state does not match the objective.", String(policy.objectiveExpected), String(actual), [`Objective evidence: ${String(actual)}`]);
}
export function assessBusinessOutcome(policy: BusinessPolicy, facts: Record<string, Fact>) {
  const dimensions = [compareIdentity(policy, facts), eligibility(policy, facts), commercial(policy, facts), recipient(policy, facts), objective(policy, facts)];
  const failed = dimensions.filter(x => x.state === "fail").length;
  const unknown = dimensions.filter(x => x.state === "unknown").length;
  return { verdict: failed ? "FAIL" as const : unknown ? "INCOMPLETE" as const : "PASS" as const, dimensions, summary: `${dimensions.length - failed - unknown}/${dimensions.length} business dimensions passed; ${failed} failed; ${unknown} need evidence or policy.` };
}
