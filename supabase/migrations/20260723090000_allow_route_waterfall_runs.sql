alter table public.research_runs
  drop constraint if exists research_runs_mode_check;

alter table public.research_runs
  add constraint research_runs_mode_check
  check (mode in ('public', 'platform', 'contacts', 'validation', 'route-waterfall'));
