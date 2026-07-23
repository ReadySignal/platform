-- Manual human review becomes a hard requirement for call-ready, on top of
-- the field-completeness constraint already enforced. reviewed_at/reviewed_by
-- are set exclusively by POST /api/queue-cards/[cardId]/review - the generic
-- PATCH route can no longer set readiness_status to call-ready directly.

alter table public.queue_cards
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text;

alter table public.queue_cards
  add constraint queue_cards_call_ready_requires_review_check
  check (
    readiness_status <> 'call-ready'
    or reviewed_at is not null
  );

create index if not exists queue_cards_reviewed_at_idx
  on public.queue_cards(reviewed_at);
