export const MIN_PASSWORD = 8;

/** Why a new password is not acceptable, or null. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password !== confirm) return "The two passwords do not match.";
  return null;
}
