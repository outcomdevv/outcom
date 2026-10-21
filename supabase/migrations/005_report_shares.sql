-- Outcom V92: shareable Proof Reports. The link token is the credential (stored hashed + encrypted, like webhook tokens).
-- Run once in the Supabase SQL Editor.
create table if not exists public.report_shares (
  id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  prepared_by text not null default '',
  workflow_ids text[] not null default '{}',   -- empty = every workflow in the workspace
  days integer not null default 30 check (days in (7, 30, 90)),
  token_hash text not null,
  token_encrypted text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  unique (token_hash)
);
create index if not exists report_shares_workspace_idx on public.report_shares(workspace_id, created_at desc);
alter table public.report_shares enable row level security;
create policy "members access report shares" on public.report_shares
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
grant select, insert, update, delete on public.report_shares to service_role;
