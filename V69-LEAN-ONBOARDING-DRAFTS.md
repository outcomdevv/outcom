# V69 — Lean Onboarding, Custom Outcomes, Draft Persistence

- Reduced Step 1 copy so webhook implementation details are deferred until the observer is actually created.
- Added custom outcome creation to Step 2. Custom outcomes use the existing state-invariant verifier path and can be configured in Step 3.
- Supports up to 10 outcome checks per protection.
- Added local draft persistence for non-secret onboarding state: platform, step, automation names, workflow id, selected outcomes, outcome configurations, and safe connection metadata.
- API keys, PITs, and Make tokens are intentionally not stored in localStorage.
