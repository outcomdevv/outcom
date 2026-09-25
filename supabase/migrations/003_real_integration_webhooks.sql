-- Outcom V59: durable inbound webhook endpoints for Zapier/Make workflow observation.
-- The URL token is the credential. The raw token is encrypted at rest; lookup uses SHA-256.
create table if not exists public.webhook_endpoints (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id text not null,
  provider text not null check (provider in ('zapier','make')),
  token_hash text not null,
  token_encrypted text not null,
  enabled boolean not null default true,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, workflow_id, provider),
  unique (token_hash),
  foreign key (workspace_id, workflow_id) references public.workflows(workspace_id, id) on delete cascade
);

create index if not exists webhook_endpoints_token_idx on public.webhook_endpoints(token_hash) where enabled = true;
create index if not exists webhook_endpoints_workspace_idx on public.webhook_endpoints(workspace_id, provider, updated_at desc);

alter table public.webhook_endpoints enable row level security;
create policy "members access webhook endpoints" on public.webhook_endpoints
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
