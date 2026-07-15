-- Iteration 16.1: allow prototype edits to saved call outcomes by id.

drop policy if exists "Allow prototype update access to call outcomes" on public.call_outcomes;
create policy "Allow prototype update access to call outcomes"
  on public.call_outcomes
  for update
  to anon
  using (true)
  with check (true);
