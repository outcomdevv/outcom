# Outcom V98 — Autonomy Governance Foundation

V98 introduces workspace-scoped autonomy policy and a fail-closed authorization gate.

## Three operating modes

- **Human-approved:** default. Every proposed repair requires explicit approval.
- **Rule-based:** a repair may become eligible for automatic execution only when its action and workflow are explicitly allowlisted by a workspace owner/admin and all runtime safety gates pass.
- **Bounded autonomous:** an AI may diagnose and propose within the same fixed policy boundary. It cannot add actions, workflows, risk levels, or permissions to that boundary.

## Non-negotiable gates

- High-risk actions are never eligible for automatic execution.
- Unknown actions and manual review are never auto-executed.
- A provider-specific executor must exist; no generic arbitrary HTTP or LLM-generated command execution.
- Independent destination read-back is mandatory and cannot be disabled by workspace policy.
- Rate limits and cooldowns are enforced by the execution gate.
- Human approval remains the default when autonomy is disabled or a policy does not match.
- Workspace owner/admin only may update policy.

## Current implementation boundary

V98 adds the policy model, workspace policy endpoint, database persistence, audit foundation, and fail-closed unit tests. It does **not** yet dispatch external repairs. Current HubSpot and Airtable adapters are read-only, and the current n8n integration is an observation/discovery adapter. Therefore no action currently qualifies for automatic execution until a provider-specific write adapter, idempotency, execution persistence, and independent read-back are implemented and tested.

Apply supabase/migrations/007_v98_autonomy_governance.sql before deploying this branch. Run npm run typecheck, npm test, and npm run test:unit.