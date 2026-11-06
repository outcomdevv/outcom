-- V98: workspace-scoped autonomy governance. No provider writes are enabled by this migration.
create table if not exists public.remediation_policies (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  policy jsonb not null default '{"mode":"human_approved","enabled":false,"allowedActions":[],"allowedWorkflowIds":[],"maxRisk":"low","maxExecutionsPerHour":5,"cooldownSeconds":300,"requireIndependentReadback":true}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint remediation_policy_mode_check check (policy->>'mode' in ('human_approved','rule_based','bounded_autonomous')),
  constraint remediation_policy_readback_check check (policy->>'requireIndependentReadback' = 'true')
);
create table if not exists public.remediation_audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  proposal_id text,
  event_type text not null check (event_type in ('policy_updated','proposal_created','approval_recorded','execution_started','execution_blocked','execution_succeeded','execution_failed','verification_passed','verification_failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists remediation_audit_workspace_created_idx on public.remediation_audit_log(workspace_id,created_at desc);
create index if not exists remediation_audit_proposal_idx on public.remediation_audit_log(workspace_id,proposal_id,created_at desc);
alter table public.remediation_policies enable row level security;
alter table public.remediation_audit_log enable row level security;
create policy "members read autonomy policy" on public.remediation_policies for select using (public.is_workspace_member(workspace_id));
create policy "members read remediation audit" on public.remediation_audit_log for select using (public.is_workspace_member(workspace_id));
-- Writes are performed by the server-side service role after requireWorkspace authorization.