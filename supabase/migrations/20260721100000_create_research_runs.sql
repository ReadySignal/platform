create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid,
  queue_card_id uuid not null,
  status text not null default 'queued',
  mode text not null default 'public',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  input_snapshot jsonb,
  output_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint research_runs_status_check
    check (status in ('queued', 'running', 'needs-review', 'complete', 'failed')),

  constraint research_runs_mode_check
    check (mode in ('public', 'platform'))
);

alter table public.research_runs enable row level security;

create index if not exists research_runs_pilot_id_idx on public.research_runs (pilot_id);
create index if not exists research_runs_queue_card_id_idx on public.research_runs (queue_card_id);
create index if not exists research_runs_status_idx on public.research_runs (status);

create or replace function public.set_research_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists research_runs_set_updated_at on public.research_runs;

create trigger research_runs_set_updated_at
before update on public.research_runs
for each row
execute function public.set_research_runs_updated_at();
