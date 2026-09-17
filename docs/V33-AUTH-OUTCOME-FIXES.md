# V33 — Auth recovery and outcome observer hardening

- Email confirmation now redirects to `/auth/confirmed` and exchanges the confirmation session in the browser before the user enters the app.
- Added mascot-led success screen: `EMAIL CONFIRMED` → `You're in. Let's prove outcomes.`
- Added route-level and global production error recovery screens.
- Signup/login routes now redirect friendly errors instead of exposing a generic server failure.
- Workspace provisioning uses idempotent membership/settings upserts.
- Existing n8n native observer remains read-only and external to the workflow.
- Existing HighLevel adapter verifies downstream records/tags read-only.
- Make API support is documented and wired for scenario discovery; Make exposes scenario logs and execution details through its read-only API, so the next observer can consume native run data without adding an HTTP node.
- Zapier connection/discovery remains account-level; do not claim downstream outcome verification until the required run-history access is available through the selected Zapier product/API path.

## Native Make observer

Make now has a native observer path: Outcom can read scenario metadata, the live blueprint, recent scenario logs and execution details using Make's read scopes, then infer a conservative HighLevel contact write when the blueprint supports it. Successful executions are correlated to returned entity IDs and passed through the existing read-only HighLevel outcome checker. If no deterministic entity can be established, the result remains unknown rather than being fabricated.
