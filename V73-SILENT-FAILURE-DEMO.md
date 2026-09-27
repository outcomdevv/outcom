# V73 — Silent Failure Demo

## Goal
Prove the core Outcom thesis without requiring a paid HighLevel account:

> Automation says SUCCESS → downstream business state is wrong → Outcom detects the silent failure → repair → re-verify → VERIFIED.

## Demo mode
`/demo` uses the workspace's existing `contacts` table through `MockCRMAdapter`. No external API, OAuth credential, or credit card is required.

## Scenarios
- **Simulate silent failure**: creates a successful Zapier execution pointing to a deliberately missing CRM contact. The `record_exists` contract fails and creates an open `silent_failure` incident.
- **Simulate verified success**: creates the downstream demo contact before evaluating the execution; the same contract passes.
- **Repair + verify again**: creates the missing contact for the selected failed execution and calls the real verification engine again. The open incident resolves.

## Product proof
The demo uses the same `evaluateEvent()` path as real webhook verification. Only the downstream adapter changes from HighLevel to `MockCRMAdapter`.
