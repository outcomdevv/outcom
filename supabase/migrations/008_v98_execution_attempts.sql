-- V98: durable execution-attempt ledger. This migration does not enable or dispatch live providers.
create table if not exists public.remediation_execution_attempts (
  id text primary key default ('exec_' || gen_random_uuid()::text),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id text not null references public.remediation_proposals(id) on delete cascade,
  idempotency_key text not null,
  provider_id text not null,
  execution_mode text not null check (execution_mode in ('simulation','live')),
  state text not null default 'queued' check (state in ('queued','running','succeeded','failed','blocked','verification_failed')),
  request_fingerprint text not null,
  evidence jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint remediation_execution_idempotency_unique unique (workspace_id, idempotency_key)
);
create index if not exists remediation_execution_workspace_created_idx
  on public.remediation_execution_attempts(workspace_id, created_at desc);
create index if not exists remediation_execution_proposal_idx
  on public.remediation_execution_attempts(workspace_id, proposal_id, created_at desc);
create index if not exists remediation_execution_state_idx
  on public.remediation_execution_attempts(workspace_id, state, created_at desc);
alter table public.remediation_execution_attempts enable row level security;
create policy "members read remediation execution attempts"
  on public.remediation_execution_attempts for select
  using (public.is_workspace_member(workspace_id));
-- Writes are server-side only after workspace authorization; service-role access bypasses RLS.
