export interface Company {
  id: string;
  name: string;
  industry: string;
  state: string;
  employee_count: number;
  is_target_account: boolean;
  created_at: string;
  website: string | null;
  linkedin_url: string | null;
  primary_industry: string | null;
  sub_industry: string | null;
  annual_revenue: number | null;
  ownership_type: string | null;
  ticker: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  location_count: number | null;
  naics_code: string | null;
  sic_code: string | null;
}
