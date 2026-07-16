import "server-only";

import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import {
  missionOutcomeSelect,
  toMissionOutcome,
  type MissionOutcomeRow,
} from "./missionOutcomeService";
import type { MissionOutcome, NewMissionOutcome } from "../types/MissionOutcome";

function normalizeShortText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function validateMissionOutcomeShape(outcome: Pick<NewMissionOutcome, "connected" | "outcome" | "followUpDate">) {
  const noConnectOutcomes = ["Voicemail", "No Answer"];
  const needsFollowUpOutcomes = ["Follow Up", "Timing"];

  if (!outcome.connected && !noConnectOutcomes.includes(outcome.outcome)) {
    throw new Error("Disconnected mission outcomes must be Voicemail or No Answer.");
  }

  if (outcome.connected && noConnectOutcomes.includes(outcome.outcome)) {
    throw new Error("Voicemail and No Answer require disconnected status.");
  }

  if (outcome.followUpDate && !needsFollowUpOutcomes.includes(outcome.outcome)) {
    throw new Error("Follow-up dates are only allowed for Follow Up or Timing outcomes.");
  }

  if (outcome.followUpDate && Number.isNaN(new Date(outcome.followUpDate).getTime())) {
    throw new Error("Follow-up date is invalid.");
  }
}

export async function createMissionOutcomeAdmin(outcome: NewMissionOutcome): Promise<MissionOutcome> {
  validateMissionOutcomeShape(outcome);
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("mission_outcomes")
    .insert({
      mission_id: outcome.missionId,
      company_id: outcome.companyId,
      contact_id: outcome.contactId ?? null,
      business_profile_id: outcome.businessProfileId ?? null,
      connected: outcome.connected,
      outcome: outcome.outcome,
      follow_up_date: outcome.followUpDate ?? null,
      recommended_next_action: normalizeShortText(outcome.recommendedNextAction, 160),
      reason: normalizeShortText(outcome.reason, 80),
      learned_signal: normalizeShortText(outcome.learnedSignal, 120),
      notes: normalizeShortText(outcome.notes, 200),
      client_submission_id: outcome.clientSubmissionId,
    })
    .select(missionOutcomeSelect)
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("mission_outcomes")
        .select(missionOutcomeSelect)
        .eq("client_submission_id", outcome.clientSubmissionId)
        .single();

      if (!existingError && existing) {
        return toMissionOutcome(existing as MissionOutcomeRow);
      }
    }

    throw new Error(`Failed to save mission outcome: ${error.message}`);
  }

  return toMissionOutcome(data as MissionOutcomeRow);
}

export async function updateMissionOutcomeAdmin(
  outcomeId: number,
  outcome: Partial<Pick<NewMissionOutcome, "connected" | "outcome" | "followUpDate" | "recommendedNextAction" | "reason" | "learnedSignal" | "notes">>,
): Promise<MissionOutcome> {
  if (
    typeof outcome.connected === "boolean" &&
    outcome.outcome
  ) {
    validateMissionOutcomeShape({
      connected: outcome.connected,
      outcome: outcome.outcome,
      followUpDate: outcome.followUpDate,
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("mission_outcomes")
    .update({
      connected: outcome.connected,
      outcome: outcome.outcome,
      follow_up_date: outcome.followUpDate ?? null,
      recommended_next_action: normalizeShortText(outcome.recommendedNextAction, 160),
      reason: normalizeShortText(outcome.reason, 80),
      learned_signal: normalizeShortText(outcome.learnedSignal, 120),
      notes: normalizeShortText(outcome.notes, 200),
    })
    .eq("id", outcomeId)
    .select(missionOutcomeSelect)
    .single();

  if (error) {
    throw new Error(`Failed to update mission outcome: ${error.message}`);
  }

  return toMissionOutcome(data as MissionOutcomeRow);
}
