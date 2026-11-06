-- Outcom V97: explicit human-approved remediation and business intelligence evidence.
create table if not exists public.remediation_proposals (
  id text primary key default ('repair_' || gen_random_uuid()::text),
  workspace_id uuid not null,
  incident_id text not null,
  workflow_id text not null,
  action text not null check (action in ('retry_workflow','update_record_field','create_missing_record','resend_message','manual_review')),
  title text not null,
  explanation text not null,
  preview jsonb not null default '{}'::jsonb,
  risk text not null check (risk in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','approved','declined','dispatched','verified','failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  approved_at timestamptz,
  dispatched_at timestamptz,
  result jsonb not null default '{}'::jsonb
);
create index if not exists remediation_proposals_workspace_status_idx on public.remediation_proposals(workspace_id,status,created_at desc);
create index if not exists remediation_proposals_incident_idx on public.remediation_proposals(workspace_id,incident_id);
create table if not exists public.business_assessments (
  id text primary key default ('bia_' || gen_random_uuid()::text),
  workspace_id uuid not null,
  workflow_id text not null,
  event_id text,
  entity_key text,
  policy jsonb not null default '{}'::jsonb,
  facts jsonb not null default '{}'::jsonb,
  assessment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists business_assessments_workspace_created_idx on public.business_assessments(workspace_id,created_at desc);
create index if not exists business_assessments_entity_idx on public.business_assessments(workspace_id,entity_key,created_at desc);
