# Outcom V97 — Business Intelligence + Human-approved Repair Foundation

This is an incremental overlay for the existing Outcom repository, not a complete standalone app. Apply it over the full repository that already contains V96.3.

## Included
- Five-dimension deterministic business assessment engine (identity, eligibility, commercial policy, recipient, objective). Missing facts return UNKNOWN/INCOMPLETE, never PASS.
- Workspace-scoped assessment API, history endpoint, and Business Intelligence page at `/business-intelligence`.
- Chat-style `RemediationChat` approval component plus human decision workflow for repair proposals: create, preview, approve or decline, seven-day expiry, workspace isolation, concurrency-safe status transition.
- Database migration for proposal and business-assessment history.
- Unit tests for semantic checks and proposal expiry.

## Apply
1. Copy this patch over the full Outcom repository.
2. Apply `supabase/migrations/006_v97_remediation_bi.sql` in the Supabase SQL editor or migration pipeline.
3. Run `npm run typecheck` and `npm test` in the full repository.
4. Deploy and test using a non-production workspace first.

## Important implementation boundary
The approval endpoint records a user's explicit approval; it intentionally does not yet mutate external systems. V97 establishes the safe proposal/consent/audit foundation, but a real repair executor must be added per provider/action (n8n retry, HubSpot property update, Airtable update, Sheets row correction, message resend, etc.). The executor must use stored workspace connections, enforce action allowlists, use idempotency keys, and independently read back the destination after the change. Until that exists, the API response explicitly says no external change has been executed.

## Universal destinations
The assessment engine is destination-neutral once evidence is normalized into the documented Fact shape. It does not magically create native connectors for every SaaS product. Native adapters, generic REST/SQL read-only adapters, and externally reported evidence must remain separately labeled by provenance and verification strength. Never label reported evidence as independent verification.

## API shape
`POST /api/business-intelligence/assess` with `{workflowId,eventId?,entityKey?,policy,facts}`. Each fact is `{value,source:"native_readback"|"reported"|"event",observedAt?,reference?}`.

`GET /api/business-intelligence` returns recent assessments and verdict totals.

`POST /api/remediation/proposals` with `{incidentId,action,title,explanation,preview,risk}`.

`POST /api/remediation/:id/decision` with `{decision:"approve"|"decline",note?}`. Approval is consent only, not execution.
