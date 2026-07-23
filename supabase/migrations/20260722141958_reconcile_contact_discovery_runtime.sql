-- Restore the canonical contact discovery schema and keep it server-owned.

create table if not exists public.contact_discovery_runs (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies(id) on delete cascade,
  business_profile_id bigint not null references public.business_profiles(id) on delete cascade,
  status text not null default 'Waiting' check (status in ('Waiting', 'Running', 'Complete', 'Failed')),
  requested_count integer not null default 3 check (requested_count in (3, 5, 10)),
  candidates_found integer not null default 0 check (candidates_found >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_discovery_candidates (
  id bigint generated always as identity primary key,
  contact_discovery_run_id bigint not null references public.contact_discovery_runs(id) on delete cascade,
  company_id bigint not null references public.companies(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  current_title text not null check (length(trim(current_title)) > 0),
  department text,
  management_level text,
  location text,
  professional_profile_url text,
  responsibility_summary text,
  matched_persona_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(matched_persona_rules) = 'array'),
  evidence_connections jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_connections) = 'array'),
  source_name text not null check (length(trim(source_name)) > 0),
  source_url text not null check (length(trim(source_url)) > 0),
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  employment_status text not null default 'Unclear' check (employment_status in ('Current', 'Unclear', 'Former')),
  employment_verified_at timestamptz,
  company_association_evidence text check (company_association_evidence is null or length(trim(company_association_evidence)) > 0),
  role_fit_score integer check (role_fit_score between 0 and 100),
  role_fit_level text check (role_fit_level is null or role_fit_level in ('Strong', 'Possible', 'Weak')),
  contributing_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(contributing_rules) = 'array'),
  conflicting_signals jsonb not null default '[]'::jsonb check (jsonb_typeof(conflicting_signals) = 'array'),
  missing_information jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_information) = 'array'),
  validation_warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_warnings) = 'array'),
  review_status text not null default 'Pending' check (review_status in ('Pending', 'Approved', 'Rejected', 'Duplicate')),
  contact_id bigint references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  relevance_summary text not null,
  validation_status text not null default 'Not Validated' check (validation_status in ('Not Validated', 'Validating', 'Validated', 'Failed')),
  validated_at timestamptz,
  responsibility_evidence text,
  validation_source_name text,
  validation_source_url text,
  validation_confidence text check (validation_confidence is null or validation_confidence in ('High', 'Medium', 'Low'))
);

create index if not exists contact_discovery_runs_company_id_idx on public.contact_discovery_runs(company_id);
create index if not exists contact_discovery_runs_business_profile_id_idx on public.contact_discovery_runs(business_profile_id);
create index if not exists contact_discovery_runs_status_idx on public.contact_discovery_runs(status);
create unique index if not exists contact_discovery_runs_one_active_per_company_profile_idx
  on public.contact_discovery_runs(company_id, business_profile_id)
  where status in ('Waiting', 'Running');

create index if not exists contact_discovery_candidates_run_id_idx on public.contact_discovery_candidates(contact_discovery_run_id);
create index if not exists contact_discovery_candidates_company_id_idx on public.contact_discovery_candidates(company_id);
create index if not exists contact_discovery_candidates_review_status_idx on public.contact_discovery_candidates(review_status);
create unique index if not exists contact_discovery_candidates_unique_name_per_run_idx
  on public.contact_discovery_candidates(contact_discovery_run_id, lower(full_name));
create unique index if not exists contact_discovery_candidates_unique_profile_per_run_idx
  on public.contact_discovery_candidates(contact_discovery_run_id, lower(professional_profile_url))
  where professional_profile_url is not null and length(trim(professional_profile_url)) > 0;

alter table public.contact_discovery_runs enable row level security;
alter table public.contact_discovery_candidates enable row level security;

do $$
declare
  target_table text;
  existing_policy record;
begin
  foreach target_table in array array['contact_discovery_runs', 'contact_discovery_candidates']
  loop
    for existing_policy in
      select policyname from pg_policies where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', existing_policy.policyname, target_table);
    end loop;
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', target_table);
    execute format('grant all privileges on table public.%I to service_role', target_table);
  end loop;
end
$$;

grant usage, select on sequence public.contact_discovery_runs_id_seq to service_role;
grant usage, select on sequence public.contact_discovery_candidates_id_seq to service_role;
