-- Outcom V77: allow any registered automation platform to send inbound webhook events (Pipedream, Activepieces, Power Automate, custom code...).
-- Provider ids are validated in application code against lib/integrations/registry.ts; the DB only enforces a safe identifier shape.
alter table public.webhook_endpoints drop constraint if exists webhook_endpoints_provider_check;
alter table public.webhook_endpoints add constraint webhook_endpoints_provider_check check (provider ~ '^[a-z][a-z0-9_]{1,31}$');
