alter table public.queue_cards
  add column if not exists company_url_source text,
  add column if not exists company_url_confidence text,
  add column if not exists target_person_confidence text,
  add column if not exists target_person_validation_status text,
  add column if not exists target_person_confidence_reasons text[] not null default '{}';

alter table public.queue_cards
  drop constraint if exists queue_cards_company_url_confidence_check,
  add constraint queue_cards_company_url_confidence_check
    check (company_url_confidence is null or company_url_confidence in ('High', 'Medium', 'Low')),
  drop constraint if exists queue_cards_target_person_confidence_check,
  add constraint queue_cards_target_person_confidence_check
    check (target_person_confidence is null or target_person_confidence in ('High', 'Medium', 'Low')),
  drop constraint if exists queue_cards_target_person_validation_status_check,
  add constraint queue_cards_target_person_validation_status_check
    check (
      target_person_validation_status is null
      or target_person_validation_status in ('Not Validated', 'Validating', 'Validated', 'Failed')
    ),
  drop constraint if exists queue_cards_call_ready_person_validation_check,
  add constraint queue_cards_call_ready_person_validation_check
    check (
      readiness_status <> 'call-ready'
      or (
        target_person_confidence = 'High'
        and target_person_validation_status = 'Validated'
      )
    );
