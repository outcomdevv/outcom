# Outcom V59 — Real Integrations

## Goal

V59 replaces the previous "integration UX" gap with actual connection/observation paths for n8n, Make, Zapier, and HighLevel.

## n8n

- Connection: instance URL + API key.
- Authentication: `X-N8N-API-KEY`.
- Discovery: `/api/v1/workflows`.
- Observation: `/api/v1/executions` and execution detail.
- Protection: workflow topology is analyzed and local Outcome Contracts are created for supported HighLevel write nodes.
- Source: n8n public REST API authentication and endpoint documentation.

## HighLevel

- Design-partner/internal path: Location ID + scoped Private Integration Token.
- Public path: OAuth 2.0 can be configured through the existing OAuth routes.
- Verification: read-only contact lookup through HighLevel API v3.
- Source: HighLevel Private Integrations and OAuth 2.0 documentation.

## Make

Two paths are implemented:

1. Native API: API token + Team ID, scenario discovery, blueprint inspection, execution logs.
2. Webhook mode: Outcom creates a unique private POST URL; the Make scenario uses `HTTP → Make a request` to send its final result to Outcom.

The Make API uses `Authorization: Token <token>`. Make documents API tokens/scopes and OAuth 2.0 as authentication options.

## Zapier

Two paths are implemented:

1. OAuth: existing OAuth routes can connect a configured Zapier app and discover Zaps.
2. Webhook mode: Outcom creates a unique private POST URL for a protected Zap. The Zap uses `Webhooks by Zapier → POST` to send the final execution result to Outcom.

This avoids asking users to paste a Zapier password or API key into Outcom.

## Inbound webhook security

- Each protected Make/Zapier workflow receives a 256-bit random URL token.
- Raw tokens are encrypted at rest with `OUTCOM_TOKEN_ENCRYPTION_KEY`.
- Lookup uses SHA-256 token hashes.
- Duplicate `execution_id` values are deduplicated by the existing event uniqueness constraint.
- `{ "test": true }` requests validate reachability without creating an execution finding.

## Event normalization

Accepted aliases include:

- `execution_id`, `executionId`, `run_id`, `runId`, `event_id`, `eventId`, `id`
- `timestamp`, `occurred_at`, `occurredAt`, `created_at`, `createdAt`
- `status` or `success`
- `target_record_id`, `targetRecordId`, `contact_id`, `contactId`

Outcom stores the normalized event, evaluates the workflow's Outcome Contract, and creates a finding when the automation reports success but the downstream business state is not satisfied.
