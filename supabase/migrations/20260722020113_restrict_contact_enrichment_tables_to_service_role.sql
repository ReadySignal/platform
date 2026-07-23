-- These operational enrichment tables contain provider configuration,
-- verification results, usage accounting, and internal run diagnostics.
-- They are server-owned and must not be reachable through anon or
-- authenticated Data API roles.

do $$
declare
  target_table text;
  existing_policy record;
  target_tables constant text[] := array[
    'phone_verifications',
    'contact_enrichment_runs',
    'contact_enrichment_attempts',
    'provider_connections',
    'enrichment_credit_policies',
    'provider_usage_events'
  ];
begin
  foreach target_table in array target_tables
  loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    execute format(
      'alter table public.%I enable row level security',
      target_table
    );

    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        existing_policy.policyname,
        target_table
      );
    end loop;

    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      target_table
    );
    execute format(
      'grant all privileges on table public.%I to service_role',
      target_table
    );
  end loop;
end
$$;
