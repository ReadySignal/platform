-- Product Iteration 27: allow prototype promotion of researched contacts into Today's Opportunities.

drop policy if exists "Allow prototype researched opportunity signal inserts" on public.signals;

create policy "Allow prototype researched opportunity signal inserts"
  on public.signals
  for insert
  to anon
  with check (signal_type = 'researched-opportunity');
