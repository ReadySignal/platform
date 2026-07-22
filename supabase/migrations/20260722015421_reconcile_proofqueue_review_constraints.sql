-- Reconcile the live ProofQueue schema with the application review gate.
-- Earlier queue migrations were applied under different remote migration
-- versions, so this migration is intentionally idempotent.

alter table public.queue_cards
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text;

alter table public.queue_cards
  drop constraint if exists queue_cards_call_ready_person_route_assumptions_check;

alter table public.queue_cards
  add constraint queue_cards_call_ready_person_route_assumptions_check
  check (
    readiness_status <> 'call-ready'
    or (
      person_source_url is not null
      and length(trim(person_source_url)) > 0
      and route_source is not null
      and length(trim(route_source)) > 0
      and cardinality(assumptions) > 0
    )
  );

alter table public.queue_cards
  drop constraint if exists queue_cards_call_ready_requires_review_check;

alter table public.queue_cards
  add constraint queue_cards_call_ready_requires_review_check
  check (
    readiness_status <> 'call-ready'
    or (
      reviewed_at is not null
      and reviewed_by is not null
      and length(trim(reviewed_by)) > 0
    )
  );

create index if not exists queue_cards_reviewed_at_idx
  on public.queue_cards(reviewed_at);

alter function public.set_queue_cards_updated_at()
  set search_path = '';

alter function public.set_research_runs_updated_at()
  set search_path = '';
