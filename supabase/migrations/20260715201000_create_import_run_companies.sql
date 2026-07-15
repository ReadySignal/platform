-- Product Iteration 24 audit: link company-only imports to companies without creating contacts.

create table if not exists public.import_run_companies (
  import_run_id bigint not null references public.import_runs(id) on delete cascade,
  company_id bigint not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (import_run_id, company_id)
);

create index if not exists import_run_companies_company_id_idx
  on public.import_run_companies(company_id);

alter table public.import_run_companies enable row level security;

drop policy if exists "Allow prototype read access to import run companies"
  on public.import_run_companies;

create policy "Allow prototype read access to import run companies"
  on public.import_run_companies
  for select
  to anon
  using (true);

drop policy if exists "Allow prototype insert access to import run companies"
  on public.import_run_companies;

create policy "Allow prototype insert access to import run companies"
  on public.import_run_companies
  for insert
  to anon
  with check (true);
