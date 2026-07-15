import { supabase } from "../lib/supabase";
import type { BusinessProfile, BusinessProfileInput, TerritoryRules } from "../types/BusinessProfile";

type BusinessProfileRow = {
  id: number;
  profile_name: string;
  company_name: string;
  product_name: string;
  product_description: string;
  value_propositions: unknown;
  customer_problems: unknown;
  target_industries: unknown;
  target_sub_industries: unknown;
  employee_min: number | null;
  employee_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  target_geographies: unknown;
  ownership_preferences: unknown;
  excluded_industries: unknown;
  excluded_company_types: unknown;
  priority_titles: unknown;
  secondary_titles: unknown;
  relevant_departments: unknown;
  management_levels: unknown;
  excluded_titles: unknown;
  high_priority_signals: unknown;
  medium_priority_signals: unknown;
  low_priority_signals: unknown;
  ignored_signals: unknown;
  signal_recency_days: number | null;
  call_objective: string | null;
  meeting_outcome: string | null;
  common_objections: unknown;
  approved_themes: unknown;
  territory_rules: unknown;
  source_restrictions: unknown;
  historical_success_notes: string | null;
  profile_version: number;
  last_user_confirmed_at: string | null;
  learning_enabled: boolean;
  minimum_outcomes_before_recommendations: number;
  learned_recommendations: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const businessProfileSelect = `
  id,
  profile_name,
  company_name,
  product_name,
  product_description,
  value_propositions,
  customer_problems,
  target_industries,
  target_sub_industries,
  employee_min,
  employee_max,
  revenue_min,
  revenue_max,
  target_geographies,
  ownership_preferences,
  excluded_industries,
  excluded_company_types,
  priority_titles,
  secondary_titles,
  relevant_departments,
  management_levels,
  excluded_titles,
  high_priority_signals,
  medium_priority_signals,
  low_priority_signals,
  ignored_signals,
  signal_recency_days,
  call_objective,
  meeting_outcome,
  common_objections,
  approved_themes,
  territory_rules,
  source_restrictions,
  historical_success_notes,
  profile_version,
  last_user_confirmed_at,
  learning_enabled,
  minimum_outcomes_before_recommendations,
  learned_recommendations,
  is_active,
  created_at,
  updated_at
`;

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toTerritoryRules(value: unknown): TerritoryRules {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<TerritoryRules>) : {};

  return {
    namedStatesOrRegions: toStringArray(record.namedStatesOrRegions),
    namedAccountsToInclude: toStringArray(record.namedAccountsToInclude),
    namedAccountsToExclude: toStringArray(record.namedAccountsToExclude),
    employeeLimitNotes: typeof record.employeeLimitNotes === "string" ? record.employeeLimitNotes : "",
    revenueLimitNotes: typeof record.revenueLimitNotes === "string" ? record.revenueLimitNotes : "",
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toBusinessProfile(row: BusinessProfileRow): BusinessProfile {
  return {
    id: row.id,
    profileName: row.profile_name,
    companyName: row.company_name,
    productName: row.product_name,
    productDescription: row.product_description,
    valuePropositions: toStringArray(row.value_propositions),
    customerProblems: toStringArray(row.customer_problems),
    targetIndustries: toStringArray(row.target_industries),
    targetSubIndustries: toStringArray(row.target_sub_industries),
    employeeMin: row.employee_min,
    employeeMax: row.employee_max,
    revenueMin: row.revenue_min,
    revenueMax: row.revenue_max,
    targetGeographies: toStringArray(row.target_geographies),
    ownershipPreferences: toStringArray(row.ownership_preferences),
    excludedIndustries: toStringArray(row.excluded_industries),
    excludedCompanyTypes: toStringArray(row.excluded_company_types),
    priorityTitles: toStringArray(row.priority_titles),
    secondaryTitles: toStringArray(row.secondary_titles),
    relevantDepartments: toStringArray(row.relevant_departments),
    managementLevels: toStringArray(row.management_levels),
    excludedTitles: toStringArray(row.excluded_titles),
    highPrioritySignals: toStringArray(row.high_priority_signals),
    mediumPrioritySignals: toStringArray(row.medium_priority_signals),
    lowPrioritySignals: toStringArray(row.low_priority_signals),
    ignoredSignals: toStringArray(row.ignored_signals),
    signalRecencyDays: row.signal_recency_days,
    callObjective: row.call_objective,
    meetingOutcome: row.meeting_outcome,
    commonObjections: toStringArray(row.common_objections),
    approvedThemes: toStringArray(row.approved_themes),
    territoryRules: toTerritoryRules(row.territory_rules),
    sourceRestrictions: toStringArray(row.source_restrictions),
    historicalSuccessNotes: row.historical_success_notes || "",
    profileVersion: row.profile_version,
    lastUserConfirmedAt: row.last_user_confirmed_at,
    learningEnabled: row.learning_enabled,
    minimumOutcomesBeforeRecommendations: row.minimum_outcomes_before_recommendations,
    learnedRecommendations: toRecord(row.learned_recommendations),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPayload(profile: BusinessProfileInput) {
  return {
    profile_name: profile.profileName,
    company_name: profile.companyName.trim(),
    product_name: profile.productName.trim(),
    product_description: profile.productDescription.trim(),
    value_propositions: profile.valuePropositions,
    customer_problems: profile.customerProblems,
    target_industries: profile.targetIndustries,
    target_sub_industries: profile.targetSubIndustries,
    employee_min: profile.employeeMin,
    employee_max: profile.employeeMax,
    revenue_min: profile.revenueMin,
    revenue_max: profile.revenueMax,
    target_geographies: profile.targetGeographies,
    ownership_preferences: profile.ownershipPreferences,
    excluded_industries: profile.excludedIndustries,
    excluded_company_types: profile.excludedCompanyTypes,
    priority_titles: profile.priorityTitles,
    secondary_titles: profile.secondaryTitles,
    relevant_departments: profile.relevantDepartments,
    management_levels: profile.managementLevels,
    excluded_titles: profile.excludedTitles,
    high_priority_signals: profile.highPrioritySignals,
    medium_priority_signals: profile.mediumPrioritySignals,
    low_priority_signals: profile.lowPrioritySignals,
    ignored_signals: profile.ignoredSignals,
    signal_recency_days: profile.signalRecencyDays,
    call_objective: profile.callObjective?.trim() || null,
    meeting_outcome: profile.meetingOutcome?.trim() || null,
    common_objections: profile.commonObjections,
    approved_themes: profile.approvedThemes,
    territory_rules: profile.territoryRules,
    source_restrictions: profile.sourceRestrictions,
    historical_success_notes: profile.historicalSuccessNotes.trim() || null,
    profile_version: profile.profileVersion,
    last_user_confirmed_at: new Date().toISOString(),
    learning_enabled: profile.learningEnabled,
    minimum_outcomes_before_recommendations: profile.minimumOutcomesBeforeRecommendations,
    learned_recommendations: profile.learnedRecommendations,
    is_active: profile.isActive,
    updated_at: new Date().toISOString(),
  };
}

async function deactivateOtherActiveProfiles(profileId?: number) {
  let query = supabase.from("business_profiles").update({ is_active: false }).eq("is_active", true);

  if (typeof profileId === "number") {
    query = query.neq("id", profileId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to deactivate previous active profile: ${error.message}`);
  }
}

export async function getActiveBusinessProfile(): Promise<BusinessProfile | null> {
  const { data, error } = await supabase
    .from("business_profiles")
    .select(businessProfileSelect)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(2);

  if (error) {
    throw new Error(`Failed to load business profile: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  if (data.length > 1) {
    throw new Error("More than one active business profile exists. Please deactivate duplicates before continuing.");
  }

  return toBusinessProfile(data[0] as BusinessProfileRow);
}

export async function createBusinessProfile(profile: BusinessProfileInput): Promise<BusinessProfile> {
  if (profile.isActive) {
    await deactivateOtherActiveProfiles();
  }

  const { data, error } = await supabase
    .from("business_profiles")
    .insert(toPayload(profile))
    .select(businessProfileSelect)
    .single();

  if (error) {
    throw new Error(`Failed to create business profile: ${error.message}`);
  }

  return toBusinessProfile(data as BusinessProfileRow);
}

export async function updateBusinessProfile(profileId: number, profile: BusinessProfileInput): Promise<BusinessProfile> {
  if (profile.isActive) {
    await deactivateOtherActiveProfiles(profileId);
  }

  const { data, error } = await supabase
    .from("business_profiles")
    .update(toPayload(profile))
    .eq("id", profileId)
    .select(businessProfileSelect)
    .single();

  if (error) {
    throw new Error(`Failed to update business profile: ${error.message}`);
  }

  return toBusinessProfile(data as BusinessProfileRow);
}
