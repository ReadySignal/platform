create extension if not exists "pgcrypto";

create table if not exists public.queue_cards (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null,
  company_id uuid,
  company_name text not null,
  company_url text,
  icp_fit_summary text not null default '',
  contact_id bigint,
  target_person_name text,
  target_person_role text,
  person_source_url text,
  route_status text not null default 'missing',
  route_source text,
  reason_to_call text not null default '',
  evidence_urls text[] not null default '{}',
  assumptions text[] not null default '{}',
  readiness_status text not null default 'research-qualified',
  decision_reason text,
  delivery_wave text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint queue_cards_route_status_check
    check (route_status in ('missing', 'unverified', 'verified', 'not-approved')),

  constraint queue_cards_readiness_status_check
    check (readiness_status in ('research-qualified', 'person-verified', 'route-verified', 'call-ready', 'held', 'rejected')),

  constraint queue_cards_delivery_wave_check
    check (delivery_wave is null or delivery_wave in ('day-3', 'day-6', 'day-10')),

  constraint queue_cards_held_rejected_reason_check
    check (
      readiness_status not in ('held', 'rejected')
      or nullif(btrim(coalesce(decision_reason, '')), '') is not null
    ),

  constraint queue_cards_call_ready_required_fields_check
    check (
      readiness_status <> 'call-ready'
      or (
        nullif(btrim(icp_fit_summary), '') is not null
        and nullif(btrim(coalesce(target_person_name, '')), '') is not null
        and nullif(btrim(coalesce(target_person_role, '')), '') is not null
        and nullif(btrim(coalesce(person_source_url, '')), '') is not null
        and route_status = 'verified'
        and nullif(btrim(coalesce(route_source, '')), '') is not null
        and nullif(btrim(reason_to_call), '') is not null
        and cardinality(evidence_urls) > 0
        and cardinality(assumptions) > 0
      )
    )
);

alter table public.queue_cards enable row level security;

create index if not exists queue_cards_pilot_id_idx on public.queue_cards (pilot_id);
create index if not exists queue_cards_readiness_status_idx on public.queue_cards (readiness_status);
create index if not exists queue_cards_delivery_wave_idx on public.queue_cards (delivery_wave);
create unique index if not exists queue_cards_pilot_company_unique_idx
  on public.queue_cards (pilot_id, lower(company_name));

create or replace function public.set_queue_cards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists queue_cards_set_updated_at on public.queue_cards;

create trigger queue_cards_set_updated_at
before update on public.queue_cards
for each row
execute function public.set_queue_cards_updated_at();
