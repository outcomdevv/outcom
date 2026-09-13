create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workflows (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  platform text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table if not exists public.contracts (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id text not null,
  name text not null,
  type text not null,
  system text not null,
  entity text not null,
  configuration jsonb not null default '{}'::jsonb,
  severity text not null default 'medium',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, workflow_id) references public.workflows(workspace_id, id) on delete cascade
);

create table if not exists public.events (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id text not null,
  execution_id text not null,
  timestamp timestamptz not null,
  platform text not null,
  status text not null,
  data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, workflow_id, execution_id),
  foreign key (workspace_id, workflow_id) references public.workflows(workspace_id, id) on delete cascade
);

create table if not exists public.incidents (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id text not null,
  event_id text not null,
  contract_id text not null,
  type text not null,
  severity text not null,
  status text not null default 'open',
  title text not null,
  summary text not null,
  expected text not null,
  observed text not null,
  evidence jsonb not null default '[]'::jsonb,
  impact text not null,
  recommended_action text not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, event_id, contract_id),
  foreign key (workspace_id, workflow_id) references public.workflows(workspace_id, id) on delete cascade
);

create table if not exists public.connections (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  account_id text not null,
  account_name text not null,
  email text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, provider, account_id)
);

create table if not exists public.contacts (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null default 'Unknown',
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  primary key (workspace_id, id)
);

create table if not exists public.oauth_states (
  state text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.monitors (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id text not null,
  provider text not null,
  external_id text not null,
  mode text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, workflow_id),
  foreign key (workspace_id, workflow_id) references public.workflows(workspace_id, id) on delete cascade
);

create table if not exists public.state_snapshots (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contract_id text not null,
  entity_id text not null,
  snapshot jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  primary key (workspace_id, contract_id, entity_id)
);

create table if not exists public.webhooks (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  webhook_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (workspace_id, webhook_id)
);

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  groq_api_key_encrypted text,
  groq_model text not null default 'openai/gpt-oss-120b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflows_workspace_idx on public.workflows(workspace_id);
create index if not exists incidents_workspace_status_idx on public.incidents(workspace_id, status, detected_at desc);
create index if not exists events_workspace_time_idx on public.events(workspace_id, timestamp desc);
create index if not exists connections_workspace_provider_idx on public.connections(workspace_id, provider);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workflows enable row level security;
alter table public.contracts enable row level security;
alter table public.events enable row level security;
alter table public.incidents enable row level security;
alter table public.connections enable row level security;
alter table public.contacts enable row level security;
alter table public.oauth_states enable row level security;
alter table public.monitors enable row level security;
alter table public.state_snapshots enable row level security;
alter table public.webhooks enable row level security;
alter table public.workspace_settings enable row level security;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.workspace_members m where m.workspace_id = target_workspace and m.user_id = auth.uid());
$$;

create policy "workspace members can read workspaces" on public.workspaces for select using (public.is_workspace_member(id));
create policy "members can read workspace members" on public.workspace_members for select using (public.is_workspace_member(workspace_id));

create policy "members access workflows" on public.workflows for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access contracts" on public.contracts for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access events" on public.events for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access incidents" on public.incidents for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access connections" on public.connections for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access contacts" on public.contacts for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access oauth states" on public.oauth_states for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access monitors" on public.monitors for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access snapshots" on public.state_snapshots for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access webhooks" on public.webhooks for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members access settings" on public.workspace_settings for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
