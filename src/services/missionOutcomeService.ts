import { supabase } from "../lib/supabase";
import type { MissionOutcome } from "../types/MissionOutcome";

type MissionOutcomeRow = {
  id: string | number;
  mission_id: string;
  company_id: string | number;
  contact_id: string | number | null;
  business_profile_id: string | number | null;
  occurred_at: string;
  connected: boolean;
  outcome: MissionOutcome["outcome"];
  follow_up_date: string | null;
  recommended_next_action: string | null;
  reason: string | null;
  learned_signal: string | null;
  notes: string | null;
  client_submission_id: string;
  created_at: string;
};

const missionOutcomeSelect = `
  id,
  mission_id,
  company_id,
  contact_id,
  business_profile_id,
  occurred_at,
  connected,
  outcome,
  follow_up_date,
  recommended_next_action,
  reason,
  learned_signal,
  notes,
  client_submission_id,
  created_at
`;

export function toMissionOutcome(row: MissionOutcomeRow): MissionOutcome {
  return {
    id: Number(row.id),
    missionId: row.mission_id,
    companyId: Number(row.company_id),
    contactId: row.contact_id === null ? null : Number(row.contact_id),
    businessProfileId: row.business_profile_id === null ? null : Number(row.business_profile_id),
    occurredAt: row.occurred_at,
    connected: row.connected,
    outcome: row.outcome,
    followUpDate: row.follow_up_date,
    recommendedNextAction: row.recommended_next_action,
    reason: row.reason,
    learnedSignal: row.learned_signal,
    notes: row.notes,
    clientSubmissionId: row.client_submission_id,
    createdAt: row.created_at,
  };
}

export { missionOutcomeSelect };
export type { MissionOutcomeRow };

export async function getMissionOutcomesForContacts(contactIds: number[]): Promise<MissionOutcome[]> {
  if (contactIds.length === 0) return [];

  const { data, error } = await supabase
    .from("mission_outcomes")
    .select(missionOutcomeSelect)
    .in("contact_id", contactIds)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch mission outcomes: ${error.message}`);
  }

  return ((data as MissionOutcomeRow[] | null) || []).map(toMissionOutcome);
}

export async function getMissionOutcomesForContactsBetween(
  contactIds: number[],
  startIso: string,
  endIso: string,
): Promise<MissionOutcome[]> {
  if (contactIds.length === 0) return [];

  const { data, error } = await supabase
    .from("mission_outcomes")
    .select(missionOutcomeSelect)
    .in("contact_id", contactIds)
    .gte("occurred_at", startIso)
    .lt("occurred_at", endIso)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch today's mission outcomes: ${error.message}`);
  }

  return ((data as MissionOutcomeRow[] | null) || []).map(toMissionOutcome);
}
