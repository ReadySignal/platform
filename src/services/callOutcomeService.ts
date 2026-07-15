import { supabase } from "../lib/supabase";
import type { CallOutcome, NewCallOutcome } from "../types/CallOutcome";

type CallOutcomeRow = {
  id: number;
  contact_id: number;
  signal_id: number | null;
  disposition: string;
  notes: string | null;
  created_at: string;
};

function toCallOutcome(row: CallOutcomeRow): CallOutcome {
  return {
    id: row.id,
    contactId: row.contact_id,
    signalId: row.signal_id,
    disposition: row.disposition,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function saveCallOutcome(outcome: NewCallOutcome): Promise<CallOutcome> {
  const { data, error } = await supabase
    .from("call_outcomes")
    .insert({
      contact_id: outcome.contactId,
      signal_id: outcome.signalId ?? null,
      disposition: outcome.disposition,
      notes: outcome.notes?.trim() || null,
    })
    .select("id, contact_id, signal_id, disposition, notes, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to save call outcome: ${error.message}`);
  }

  return toCallOutcome(data as CallOutcomeRow);
}

export async function getCallOutcomesForContact(contactId: number): Promise<CallOutcome[]> {
  const { data, error } = await supabase
    .from("call_outcomes")
    .select("id, contact_id, signal_id, disposition, notes, created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch call outcomes: ${error.message}`);
  }

  return ((data as CallOutcomeRow[]) || []).map(toCallOutcome);
}

export async function getCallOutcomesForContactsBetween(
  contactIds: number[],
  startIso: string,
  endIso: string,
): Promise<CallOutcome[]> {
  if (contactIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("call_outcomes")
    .select("id, contact_id, signal_id, disposition, notes, created_at")
    .in("contact_id", contactIds)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch call outcomes: ${error.message}`);
  }

  return ((data as CallOutcomeRow[]) || []).map(toCallOutcome);
}
