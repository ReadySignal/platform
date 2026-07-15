-- Product Iteration 18: link imported contacts to their CSV import run and allow analysis signals.

alter table public.contacts
  add column if not exists import_run_id bigint references public.import_runs(id) on delete set null;

create index if not exists contacts_import_run_id_idx
  on public.contacts(import_run_id);

drop policy if exists "Allow prototype import analysis signal inserts" on public.signals;
create policy "Allow prototype import analysis signal inserts"
  on public.signals
  for insert
  to anon
  with check (signal_type = 'import-analysis');
