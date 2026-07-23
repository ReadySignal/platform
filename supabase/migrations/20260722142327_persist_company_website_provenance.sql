alter table public.companies
  add column if not exists website_source_url text,
  add column if not exists website_confidence text,
  add column if not exists website_verified_at timestamptz;

alter table public.companies
  drop constraint if exists companies_website_confidence_check,
  add constraint companies_website_confidence_check
    check (website_confidence is null or website_confidence in ('High', 'Medium', 'Low')),
  drop constraint if exists companies_website_provenance_check,
  add constraint companies_website_provenance_check
    check (
      (website_source_url is null and website_confidence is null and website_verified_at is null)
      or (
        website is not null
        and website_source_url is not null
        and website_confidence is not null
        and website_verified_at is not null
      )
    );
