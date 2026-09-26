# Outcom V65 — Zapier observer onboarding

## What changed

- Renamed the Zapier webhook action in the UI to an **Outcom observer** so the product does not imply that Outcom creates or edits a Zap.
- Added a clearer four-step mental model: create observer → add one final POST step → run the Zap → verify the first execution.
- Added a webhook status endpoint at `/api/webhooks/status`.
- Added “Check for execution” plus a short polling flow so users do not need to refresh the page after running a Zap.
- Added a live observer status strip showing whether an execution has reached Outcom.
- Kept the existing private URL + Webhooks by Zapier architecture intact.

## Current product boundary

Outcom can generate and receive the observer endpoint, but the current generic webhook path does not automatically edit a customer's Zap. The customer still adds the final POST action in the Zap editor.

The next deeper integration is a native Zapier app/connection path. V65 intentionally focuses on making the current real webhook path understandable and reliable before adding provider-specific provisioning.
