import { supabase } from "../lib/supabase";
import { getCallOutcomesForContactsBetween } from "./callOutcomeService";
import { getCompanyIntelligence } from "./companyIntelligenceService";
import { getResearchJobs } from "./researchService";
import { createSalesInsight } from "./salesInsightService";
import type { RankedCompanyContact } from "../types/CompanyIntelligence";
import type { Evidence } from "../types/Evidence";

const researchedOpportunitySignalType = "researched-opportunity";

export type OpportunityPromotionSkipReason =
  | "No active evidence"
  | "No eligible contacts"
  | "No usable title"
  | "No reachable contact"
  | "Already represented"
  | "Completed today";

export type OpportunityPromotionSkippedCompany = {
  companyId: number;
  companyName: string;
  reason: OpportunityPromotionSkipReason;
};

export type OpportunityPromotionResult = {
  companiesEvaluated: number;
  contactsAdded: number;
  skippedCompanies: OpportunityPromotionSkippedCompany[];
};

type ExistingSignalRow = {
  company_id: string | number;
  contact_id: string | number;
  source_url: string | null;
  headline: string | null;
};

function getLocalTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function toComparableTime(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function getStrongestEvidence(evidence: Evidence[]) {
  const confidenceOrder = { High: 3, Medium: 2, Low: 1 };

  return [...evidence]
    .filter((item) => item.isActive !== false)
    .sort((a, b) => {
      const confidenceDelta = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      return toComparableTime(b.publishedAt ?? b.discoveredAt) - toComparableTime(a.publishedAt ?? a.discoveredAt);
    })[0];
}

function hasUsableTitle(contact: RankedCompanyContact) {
  const title = contact.title.trim().toLowerCase();
  return Boolean(title && title !== "unknown title");
}

function hasUsableContactMethod(contact: RankedCompanyContact) {
  return Boolean(contact.phone || contact.mobile || contact.email);
}

async function getContactCompletedTodaySet(contactIds: number[]) {
  if (contactIds.length === 0) {
    return new Set<number>();
  }

  const { startIso, endIso } = getLocalTodayRange();
  const outcomes = await getCallOutcomesForContactsBetween(contactIds, startIso, endIso);
  return new Set(outcomes.map((outcome) => outcome.contactId));
}

function isDuplicateSignal(
  companyId: number,
  contact: RankedCompanyContact,
  evidence: Evidence,
  existingSignals: ExistingSignalRow[],
) {
  return existingSignals.some(
    (signal) =>
      Number(signal.company_id) === companyId ||
      Number(signal.contact_id) === contact.id ||
      (Number(signal.contact_id) === contact.id &&
        signal.source_url === evidence.sourceUrl &&
        signal.headline === evidence.headline),
  );
}

function toEvidenceSignalHeadline(evidence: Evidence) {
  const evidenceType = evidence.evidenceType.trim();
  return evidenceType ? `${evidenceType}: ${evidence.headline}` : evidence.headline;
}

function toSignalInsert(companyId: number, contact: RankedCompanyContact, evidence: Evidence, details: string) {
  return {
    company_id: companyId,
    contact_id: contact.id,
    signal_type: researchedOpportunitySignalType,
    headline: toEvidenceSignalHeadline(evidence),
    details,
    source_url: evidence.sourceUrl,
    occurred_at: evidence.publishedAt ?? evidence.discoveredAt,
    // The Contact Intelligence score is the single source of truth.
    // It must never be recalculated downstream.
    score_points: contact.overallScore,
    is_active: true,
  };
}

function skip(
  skippedCompanies: OpportunityPromotionSkippedCompany[],
  companyId: number,
  companyName: string,
  reason: OpportunityPromotionSkipReason,
) {
  skippedCompanies.push({ companyId, companyName, reason });
}

export async function promoteResearchedContactsToToday(): Promise<OpportunityPromotionResult> {
  const completedJobs = (await getResearchJobs()).filter((job) => job.status === "Complete");
  const companyIds = Array.from(new Set(completedJobs.map((job) => job.companyId)));
  const skippedCompanies: OpportunityPromotionSkippedCompany[] = [];
  let contactsAdded = 0;

  if (companyIds.length === 0) {
    return {
      companiesEvaluated: 0,
      contactsAdded,
      skippedCompanies,
    };
  }

  const { data: existingSignalRows, error: existingSignalError } = await supabase
    .from("signals")
    .select("company_id, contact_id, source_url, headline")
    .eq("signal_type", researchedOpportunitySignalType)
    .eq("is_active", true);

  if (existingSignalError) {
    throw new Error(`Failed to check existing researched opportunities: ${existingSignalError.message}`);
  }

  const existingSignals = ((existingSignalRows as ExistingSignalRow[] | null) || []);

  for (const companyId of companyIds) {
    const intelligence = await getCompanyIntelligence(String(companyId));

    if (intelligence.rankedContacts.length === 0) {
      skip(skippedCompanies, companyId, intelligence.company.name, "No eligible contacts");
      continue;
    }

    const strongestEvidence = getStrongestEvidence(intelligence.evidence);

    if (!strongestEvidence) {
      skip(skippedCompanies, companyId, intelligence.company.name, "No active evidence");
      continue;
    }

    const contactIds = intelligence.rankedContacts.map((contact) => contact.id);
    const completedToday = await getContactCompletedTodaySet(contactIds);
    const reachableCandidates = intelligence.rankedContacts.filter(hasUsableContactMethod);

    if (reachableCandidates.length === 0) {
      skip(skippedCompanies, companyId, intelligence.company.name, "No reachable contact");
      continue;
    }

    const titleCandidates = reachableCandidates.filter(hasUsableTitle);

    if (titleCandidates.length === 0) {
      skip(skippedCompanies, companyId, intelligence.company.name, "No usable title");
      continue;
    }

    const incompleteCandidates = titleCandidates.filter((contact) => !completedToday.has(contact.id));

    if (incompleteCandidates.length === 0) {
      skip(skippedCompanies, companyId, intelligence.company.name, "Completed today");
      continue;
    }

    const selectedContact = incompleteCandidates[0];
    const salesInsight = createSalesInsight({
      company: intelligence.company,
      rankedContact: selectedContact,
      evidence: intelligence.evidence,
    });

    if (isDuplicateSignal(companyId, selectedContact, strongestEvidence, existingSignals)) {
      skip(skippedCompanies, companyId, intelligence.company.name, "Already represented");
      continue;
    }

    const { data: insertedSignal, error: insertError } = await supabase
      .from("signals")
      .insert(toSignalInsert(companyId, selectedContact, strongestEvidence, salesInsight?.whyThisContact ?? selectedContact.whyThisContact))
      .select("company_id, contact_id, source_url, headline")
      .single();

    if (insertError) {
      throw new Error(`Failed to create researched opportunity: ${insertError.message}`);
    }

    existingSignals.push(insertedSignal as ExistingSignalRow);
    contactsAdded += 1;
  }

  return {
    companiesEvaluated: companyIds.length,
    contactsAdded,
    skippedCompanies,
  };
}
