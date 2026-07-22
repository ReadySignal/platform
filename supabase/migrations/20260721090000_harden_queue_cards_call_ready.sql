-- The application-level call-ready gate (lib/queue/readiness.ts) now also
-- requires a source for the person and the route, plus at least one labeled
-- assumption. Add that as its own check constraint rather than editing the
-- original queue_cards migration, since it may already be applied. The two
-- constraints are ANDed together, so this only tightens what "call-ready"
-- means at the database level - it doesn't change or duplicate the original.

alter table public.queue_cards
  add constraint queue_cards_call_ready_person_route_assumptions_check
  check (
    readiness_status <> 'call-ready'
    or (
      person_source_url is not null and length(trim(person_source_url)) > 0
      and route_source is not null and length(trim(route_source)) > 0
      and cardinality(assumptions) > 0
    )
  );
