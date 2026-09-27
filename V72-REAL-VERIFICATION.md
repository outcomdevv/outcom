# Outcom V72 — Real Verification Foundation

## Milestone
Turn the existing Zapier/Make inbound event path into a real downstream verification loop that works for public webhook events and can be retried after a business-state failure.

## Delivered
- HighLevel adapter/token lookup is workspace-aware. Public webhook verification no longer depends on an authenticated browser session to find the correct HighLevel connection.
- Inbound webhook events carry the owning workspace context into verification.
- `evaluateEvent(event, workspaceId)` explicitly scopes downstream adapters.
- Added `POST /api/events/:id/verify` for authenticated manual re-verification.
- Existing open incidents resolve automatically when a later verification passes.
- Resolved incidents reopen if a later verification fails again.
- Workflow execution rows now expose a `Verify again` action.
- Execution status distinguishes current open findings from verified executions.

## Real verification flow

Zapier/Make → Outcom webhook → event → Outcome Contract → HighLevel GET contact → PASS/FAIL → incident → retry → resolve/reopen

## HighLevel basis
The verifier uses the official v3 `GET /contacts/:contactId` endpoint with read-only `contacts.readonly` access. HighLevel documents this endpoint for OAuth and Private Integration authentication.

## Remaining external prerequisite
The production deployment still needs a real HighLevel connection and a real automation run to prove the end-to-end path against customer data. This code milestone is ready for that test; credentials are intentionally not embedded in the repository.
