-- Product Iteration 17: allow prototype CSV imports to create companies and contacts.

drop policy if exists "Allow prototype CSV import insert access to companies" on public.companies;
create policy "Allow prototype CSV import insert access to companies"
  on public.companies
  for insert
  to anon
  with check (true);

drop policy if exists "Allow prototype CSV import insert access to contacts" on public.contacts;
create policy "Allow prototype CSV import insert access to contacts"
  on public.contacts
  for insert
  to anon
  with check (true);
