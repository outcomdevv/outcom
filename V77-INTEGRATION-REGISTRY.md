# V77 — Integration registry + universal webhook sources

- lib/integrations/registry.ts: one honest catalog of sources (where automations run) and targets (systems of truth), with status live/code_complete/webhook/planned.
- lib/adapters/registry.ts: downstream adapter registry; outcome-checker no longer hard-codes systems. Add a system = write adapter + registerAdapter.
- Inbound webhooks now accept any registered source (Pipedream, Activepieces, Power Automate, Workato, HighLevel Workflows, custom code). Requires migration 004.
- GET /api/integrations/catalog: catalog + per-workspace connection state (no secrets).
- Run supabase/migrations/004_generic_webhook_sources.sql in Supabase BEFORE using non-Zapier/Make webhook sources.
