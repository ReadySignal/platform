-- Product Iteration 24: store imported company intelligence from enriched CSV sources.

alter table public.companies
  alter column employee_count drop not null,
  add column if not exists website text,
  add column if not exists linkedin_url text,
  add column if not exists primary_industry text,
  add column if not exists sub_industry text,
  add column if not exists annual_revenue numeric,
  add column if not exists ownership_type text,
  add column if not exists ticker text,
  add column if not exists hq_city text,
  add column if not exists hq_state text,
  add column if not exists hq_country text,
  add column if not exists location_count integer,
  add column if not exists naics_code text,
  add column if not exists sic_code text;

create index if not exists companies_website_idx
  on public.companies(website);

create index if not exists companies_linkedin_url_idx
  on public.companies(linkedin_url);

create index if not exists companies_primary_industry_idx
  on public.companies(primary_industry);

drop policy if exists "Allow prototype CSV import company intelligence updates"
  on public.companies;

create policy "Allow prototype CSV import company intelligence updates"
  on public.companies
  for update
  to anon
  using (true)
  with check (true);
