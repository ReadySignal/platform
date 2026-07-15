import { supabase } from "../lib/supabase";
import { getCallOutcomesForContact } from "./callOutcomeService";
import type {
  CompanyActivityItem,
  CompanyContact,
  CompanyIntelligence,
  CompanySignal,
} from "../types/CompanyIntelligence";

type CompanyDetailRow = {
  id: string | number;
  name: string | null;
  industry: string | null;
  state: string | null;
  employee_count: number | null;
  is_target_account: boolean | null;
  created_at: string | null;
  contacts:
    | Array<{
        id: string | number;
        first_name: string | null;
        last_name: string | null;
        title: string | null;
        phone: string | null;
        mobile: string | null;
        email: string | null;
        relevant_context: string | null;
        why_today: string | null;
        signals:
          | Array<{
              id: string | number;
              signal_type: string | null;
              headline: string | null;
              details: string | null;
              occurred_at: string | null;
              score_points: number | null;
              is_active: boolean | null;
            }>
          | null;
      }>
    | null;
};

function toComparableTime(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function sortByDateDescending<T extends { date?: string | null; occurredAt?: string | null; createdAt?: string | null }>(
  a: T,
  b: T,
) {
  return toComparableTime(b.date ?? b.occurredAt ?? b.createdAt ?? null) - toComparableTime(a.date ?? a.occurredAt ?? a.createdAt ?? null);
}

function toSignal(signal: NonNullable<NonNullable<CompanyDetailRow["contacts"]>[number]["signals"]>[number]): CompanySignal {
  return {
    id: Number(signal.id),
    signalType: signal.signal_type || "industry-news",
    headline: signal.headline || "Live signal",
    details: signal.details,
    occurredAt: signal.occurred_at,
    scorePoints: Math.max(0, Math.min(100, signal.score_points ?? 0)),
  };
}

export async function getCompanyIntelligence(companyId: string): Promise<CompanyIntelligence> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      `
        id,
        name,
        industry,
        state,
        employee_count,
        is_target_account,
        created_at,
        contacts (
          id,
          first_name,
          last_name,
          title,
          phone,
          mobile,
          email,
          relevant_context,
          why_today,
          signals (
            id,
            signal_type,
            headline,
            details,
            occurred_at,
            score_points,
            is_active
          )
        )
      `,
    )
    .eq("id", companyId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch company intelligence: ${error.message}`);
  }

  const row = data as CompanyDetailRow;
  const contacts = await Promise.all(
    (row.contacts || []).map(async (contact): Promise<CompanyContact> => {
      const contactId = Number(contact.id);
      const activeSignals = (contact.signals || [])
        .filter((signal) => signal.is_active !== false)
        .map(toSignal)
        .sort(sortByDateDescending);

      let callOutcomes: CompanyContact["callOutcomes"] = [];

      try {
        callOutcomes = await getCallOutcomesForContact(contactId);
      } catch (error) {
        console.warn(`Call outcomes are not available for contact ${contactId}:`, error);
      }

      return {
        id: contactId,
        name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown Contact",
        title: contact.title || "Unknown Title",
        phone: contact.phone,
        mobile: contact.mobile,
        email: contact.email,
        relevantContext: contact.relevant_context,
        whyToday: contact.why_today,
        activeSignals,
        callOutcomes,
      };
    }),
  );

  const activityTimeline = contacts
    .flatMap<CompanyActivityItem>((contact) => [
      ...contact.activeSignals.map((signal) => ({
        id: `signal-${signal.id}`,
        type: "signal" as const,
        contactName: contact.name,
        label: signal.headline,
        detail: signal.details,
        date: signal.occurredAt,
        scorePoints: signal.scorePoints,
      })),
      ...contact.callOutcomes.map((outcome) => ({
        id: `outcome-${outcome.id}`,
        type: "outcome" as const,
        contactName: contact.name,
        label: outcome.disposition,
        detail: outcome.notes,
        date: outcome.createdAt,
      })),
    ])
    .sort(sortByDateDescending);

  return {
    company: {
      id: String(row.id),
      name: row.name || "Unknown Company",
      industry: row.industry || "Unknown Industry",
      state: row.state || "Unknown",
      employee_count: row.employee_count ?? 0,
      is_target_account: Boolean(row.is_target_account),
      created_at: row.created_at || "",
    },
    contacts,
    activityTimeline,
  };
}
