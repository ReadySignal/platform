import { supabase } from "../lib/supabase";
import { getCallOutcomesForContactsBetween } from "./callOutcomeService";
import { getCompanyIntelligence } from "./companyIntelligenceService";
import { getResearchJobs } from "./researchService";
import { createSalesInsight } from "./salesInsightService";
import type { RankedCompanyContact } from "../types/CompanyIntelligence";
import type { Evidence } from "../types/Evidence";

const researchedOpportunitySignalType = "researched-opportunity";
const maxResearchedOpportunitiesPerCompany = 3;
const minimumContactPriorityScore = 60;

export type OpportunityPromotionSkipReason =
  | "No active evidence"
  | "No eligible contacts"
  | "No usable title"
  | "No reachable contact"
  | "Already represented"
  | "Completed today"
  | "Below priority threshold"
  | "Company opportunity limit reached";

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

export type OpportunityReconciliationAudit = {
  companyName: string;
  researchStatus: string;
  eligibleContactCount: number;
  existingResearchedOpportunityCount: number;
  contactsCreated: number;
  skipReasons: OpportunityPromotionSkipReason[];
};

export type OpportunityReconciliationResult = OpportunityPromotionResult & {
  audits: OpportunityReconciliationAudit[];
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

function getRoleFamily(contact: RankedCompanyContact) {
  const title = contact.title.toLowerCase();

  if (/\b(reliability|maintenance|asset)\b/.test(title)) {
    return "Reliability / Maintenance";
  }

  if (/\b(operations|plant|production|manufacturing|site|general manager)\b/.test(title)) {
    return "Operations / Plant Leadership";
  }

  if (/\b(engineer|engineering|facility|facilities|project)\b/.test(title)) {
    return "Engineering / Facilities";
  }

  if (/\b(supply chain|procurement|purchasing|logistics)\b/.test(title)) {
    return "Supply Chain / Procurement";
  }

  if (/\b(quality|continuous improvement|process)\b/.test(title)) {
    return "Quality / Continuous Improvement";
  }

  if (/\b(chief|president|vp|vice president|director|head|owner)\b/.test(title)) {
    return "Executive / Senior Leadership";
  }

  return title.replace(/\s+/g, " ").trim() || "Other";
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLocation(location: string | null | undefined) {
  return location?.toLowerCase().replace(/\s+/g, " ").trim() || "";
}

async function getContactCompletedTodaySet(contactIds: number[]) {
  if (contactIds.length === 0) {
    return new Set<number>();
  }

  const { startIso, endIso } = getLocalTodayRange();
  const outcomes = await getCallOutcomesForContactsBetween(contactIds, startIso, endIso);
  return new Set(outcomes.map((outcome) => outcome.contactId));
}

function isDuplicateSignal(contact: RankedCompanyContact, existingSignals: ExistingSignalRow[]) {
  return existingSignals.some((signal) => Number(signal.contact_id) === contact.id);
}

function getExistingOpportunityCount(companyId: number, existingSignals: ExistingSignalRow[]) {
  const contactIds = new Set(
    existingSignals
      .filter((signal) => Number(signal.company_id) === companyId)
      .map((signal) => Number(signal.contact_id))
      .filter(Number.isFinite),
  );

  return contactIds.size;
}

function getEligibleContactsForResearchedOpportunityPromotion(
  contacts: RankedCompanyContact[],
  options: {
    completedToday: Set<number>;
    existingSignals: ExistingSignalRow[];
    minimumScore?: number;
  },
) {
  const minimumScore = options.minimumScore ?? minimumContactPriorityScore;
  return contacts
    .filter((contact) => contact.overallScore >= minimumScore)
    .filter(hasUsableTitle)
    .filter(hasUsableContactMethod)
    .filter((contact) => !options.completedToday.has(contact.id))
    .filter((contact) => !isDuplicateSignal(contact, options.existingSignals))
    .sort((a, b) => {
      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }

      return a.name.localeCompare(b.name);
    });
}

export function selectContactsForResearchedOpportunityPromotion(
  contacts: RankedCompanyContact[],
  options: {
    completedToday: Set<number>;
    existingSignals: ExistingSignalRow[];
    maxContacts?: number;
    minimumScore?: number;
  },
) {
  const maxContacts = options.maxContacts ?? maxResearchedOpportunitiesPerCompany;
  const eligibleContacts = getEligibleContactsForResearchedOpportunityPromotion(contacts, options);

  const selected: RankedCompanyContact[] = [];
  const selectedFamilies = new Set<string>();
  const selectedLocations = new Set<string>();
  const selectedTitles = new Set<string>();

  while (selected.length < maxContacts && eligibleContacts.length > 0) {
    const [bestCandidate] = eligibleContacts
      .map((contact) => {
        const family = getRoleFamily(contact);
        const location = normalizeLocation(contact.location);
        const title = normalizeTitle(contact.title);
        const diversityBonus = (selectedFamilies.has(family) ? 0 : 8) + (location && !selectedLocations.has(location) ? 3 : 0);
        const duplicateTitlePenalty = selectedTitles.has(title) ? 6 : 0;

        return {
          contact,
          selectionScore: contact.overallScore + diversityBonus - duplicateTitlePenalty,
        };
      })
      .sort((a, b) => {
        if (b.selectionScore !== a.selectionScore) {
          return b.selectionScore - a.selectionScore;
        }

        if (b.contact.overallScore !== a.contact.overallScore) {
          return b.contact.overallScore - a.contact.overallScore;
        }

        return a.contact.name.localeCompare(b.contact.name);
      });

    if (!bestCandidate) {
      break;
    }

    selected.push(bestCandidate.contact);
    selectedFamilies.add(getRoleFamily(bestCandidate.contact));
    const location = normalizeLocation(bestCandidate.contact.location);
    if (location) {
      selectedLocations.add(location);
    }
    selectedTitles.add(normalizeTitle(bestCandidate.contact.title));

    const selectedIndex = eligibleContacts.findIndex((contact) => contact.id === bestCandidate.contact.id);
    if (selectedIndex >= 0) {
      eligibleContacts.splice(selectedIndex, 1);
    }
  }

  return selected;
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

async function getExistingResearchedOpportunitySignals() {
  const { data: existingSignalRows, error: existingSignalError } = await supabase
    .from("signals")
    .select("company_id, contact_id, source_url, headline")
    .eq("signal_type", researchedOpportunitySignalType)
    .eq("is_active", true);

  if (existingSignalError) {
    throw new Error(`Failed to check existing researched opportunities: ${existingSignalError.message}`);
  }

  return ((existingSignalRows as ExistingSignalRow[] | null) || []);
}

export async function promoteResearchedCompanyContacts(
  companyId: number,
  existingSignalsOverride?: ExistingSignalRow[],
): Promise<OpportunityPromotionResult> {
  const skippedCompanies: OpportunityPromotionSkippedCompany[] = [];
  let contactsAdded = 0;
  const intelligence = await getCompanyIntelligence(String(companyId));
  const strongestEvidence = getStrongestEvidence(intelligence.evidence);

  if (!strongestEvidence) {
    skip(skippedCompanies, companyId, intelligence.company.name, "No active evidence");
    return { companiesEvaluated: 1, contactsAdded, skippedCompanies };
  }

  const existingSignals = existingSignalsOverride ?? (await getExistingResearchedOpportunitySignals());
  const availableSlots = Math.max(0, maxResearchedOpportunitiesPerCompany - getExistingOpportunityCount(companyId, existingSignals));

  if (availableSlots === 0) {
    skip(skippedCompanies, companyId, intelligence.company.name, "Company opportunity limit reached");
    return { companiesEvaluated: 1, contactsAdded, skippedCompanies };
  }

  if (intelligence.rankedContacts.length === 0) {
    skip(skippedCompanies, companyId, intelligence.company.name, "No eligible contacts");
    return { companiesEvaluated: 1, contactsAdded, skippedCompanies };
  }

  const contactIds = intelligence.rankedContacts.map((contact) => contact.id);
  const completedToday = await getContactCompletedTodaySet(contactIds);
  const selectedContacts = selectContactsForResearchedOpportunityPromotion(intelligence.rankedContacts, {
    completedToday,
    existingSignals,
    maxContacts: availableSlots,
    minimumScore: minimumContactPriorityScore,
  });

  if (selectedContacts.length === 0) {
    const scoreCandidates = intelligence.rankedContacts.filter((contact) => contact.overallScore >= minimumContactPriorityScore);
    const reachableCandidates = scoreCandidates.filter(hasUsableContactMethod);
    const titleCandidates = reachableCandidates.filter(hasUsableTitle);
    const incompleteCandidates = titleCandidates.filter((contact) => !completedToday.has(contact.id));

    if (scoreCandidates.length === 0) {
      skip(skippedCompanies, companyId, intelligence.company.name, "Below priority threshold");
    } else if (reachableCandidates.length === 0) {
      skip(skippedCompanies, companyId, intelligence.company.name, "No reachable contact");
    } else if (titleCandidates.length === 0) {
      skip(skippedCompanies, companyId, intelligence.company.name, "No usable title");
    } else if (incompleteCandidates.length === 0) {
      skip(skippedCompanies, companyId, intelligence.company.name, "Completed today");
    } else {
      skip(skippedCompanies, companyId, intelligence.company.name, "Already represented");
    }

    return { companiesEvaluated: 1, contactsAdded, skippedCompanies };
  }

  for (const selectedContact of selectedContacts) {
    if (isDuplicateSignal(selectedContact, existingSignals)) {
      skip(skippedCompanies, companyId, intelligence.company.name, "Already represented");
      continue;
    }

    const salesInsight = createSalesInsight({
      company: intelligence.company,
      rankedContact: selectedContact,
      evidence: intelligence.evidence,
    });

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

  return { companiesEvaluated: 1, contactsAdded, skippedCompanies };
}

export async function promoteSingleResearchedContact(
  companyId: number,
  contactId: number,
): Promise<OpportunityPromotionResult> {
  const skippedCompanies: OpportunityPromotionSkippedCompany[] = [];
  const intelligence = await getCompanyIntelligence(String(companyId));
  const strongestEvidence = getStrongestEvidence(intelligence.evidence);

  if (!strongestEvidence) {
    skip(skippedCompanies, companyId, intelligence.company.name, "No active evidence");
    return { companiesEvaluated: 1, contactsAdded: 0, skippedCompanies };
  }

  const existingSignals = await getExistingResearchedOpportunitySignals();
  if (getExistingOpportunityCount(companyId, existingSignals) >= maxResearchedOpportunitiesPerCompany) {
    skip(skippedCompanies, companyId, intelligence.company.name, "Company opportunity limit reached");
    return { companiesEvaluated: 1, contactsAdded: 0, skippedCompanies };
  }

  const contact = intelligence.rankedContacts.find((item) => item.id === contactId);
  if (!contact) {
    skip(skippedCompanies, companyId, intelligence.company.name, "No eligible contacts");
    return { companiesEvaluated: 1, contactsAdded: 0, skippedCompanies };
  }

  const completedToday = await getContactCompletedTodaySet([contact.id]);
  const [selectedContact] = selectContactsForResearchedOpportunityPromotion([contact], {
    completedToday,
    existingSignals,
    maxContacts: 1,
    minimumScore: minimumContactPriorityScore,
  });

  if (!selectedContact) {
    const reason =
      contact.overallScore < minimumContactPriorityScore
        ? "Below priority threshold"
        : !hasUsableContactMethod(contact)
          ? "No reachable contact"
          : !hasUsableTitle(contact)
            ? "No usable title"
            : completedToday.has(contact.id)
              ? "Completed today"
              : "Already represented";
    skip(skippedCompanies, companyId, intelligence.company.name, reason);
    return { companiesEvaluated: 1, contactsAdded: 0, skippedCompanies };
  }

  const salesInsight = createSalesInsight({
    company: intelligence.company,
    rankedContact: selectedContact,
    evidence: intelligence.evidence,
  });

  const { error } = await supabase.from("signals").insert(
    toSignalInsert(
      companyId,
      selectedContact,
      strongestEvidence,
      salesInsight?.whyThisContact ?? selectedContact.whyThisContact,
    ),
  );

  if (error) {
    throw new Error(`Failed to create researched opportunity: ${error.message}`);
  }

  return { companiesEvaluated: 1, contactsAdded: 1, skippedCompanies };
}

export async function promoteResearchedContactsToToday(): Promise<OpportunityPromotionResult> {
  const completedJobs = (await getResearchJobs()).filter((job) => job.status === "Complete");
  const companyIds = Array.from(new Set(completedJobs.map((job) => job.companyId)));
  const skippedCompanies: OpportunityPromotionSkippedCompany[] = [];
  let contactsAdded = 0;

  if (companyIds.length === 0) {
    return { companiesEvaluated: 0, contactsAdded, skippedCompanies };
  }

  const existingSignals = await getExistingResearchedOpportunitySignals();

  for (const companyId of companyIds) {
    const result = await promoteResearchedCompanyContacts(companyId, existingSignals);
    contactsAdded += result.contactsAdded;
    skippedCompanies.push(...result.skippedCompanies);
  }

  return {
    companiesEvaluated: companyIds.length,
    contactsAdded,
    skippedCompanies,
  };
}

export async function reconcileResearchedOpportunities(
  auditCompanyNames: string[] = [],
): Promise<OpportunityReconciliationResult> {
  const jobs = await getResearchJobs();
  const completedJobs = jobs.filter((job) => job.status === "Complete");
  const companyIds = Array.from(new Set(completedJobs.map((job) => job.companyId)));
  const auditNameSet = new Set(auditCompanyNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const skippedCompanies: OpportunityPromotionSkippedCompany[] = [];
  const audits: OpportunityReconciliationAudit[] = [];
  let contactsAdded = 0;

  if (companyIds.length === 0) {
    return { companiesEvaluated: 0, contactsAdded, skippedCompanies, audits };
  }

  const existingSignals = await getExistingResearchedOpportunitySignals();

  for (const companyId of companyIds) {
    const intelligence = await getCompanyIntelligence(String(companyId));
    const matchingJob = completedJobs.find((job) => job.companyId === companyId);
    const shouldAudit = auditNameSet.has(intelligence.company.name.toLowerCase());
    const existingCountBefore = getExistingOpportunityCount(companyId, existingSignals);
    let eligibleContactCount = 0;

    if (shouldAudit) {
      const completedToday = await getContactCompletedTodaySet(intelligence.rankedContacts.map((contact) => contact.id));
      eligibleContactCount = getEligibleContactsForResearchedOpportunityPromotion(intelligence.rankedContacts, {
        completedToday,
        existingSignals,
        minimumScore: minimumContactPriorityScore,
      }).length;
    }

    const result = await promoteResearchedCompanyContacts(companyId, existingSignals);
    contactsAdded += result.contactsAdded;
    skippedCompanies.push(...result.skippedCompanies);

    if (shouldAudit) {
      audits.push({
        companyName: intelligence.company.name,
        researchStatus: matchingJob?.status || "Not queued",
        eligibleContactCount,
        existingResearchedOpportunityCount: existingCountBefore,
        contactsCreated: result.contactsAdded,
        skipReasons: result.skippedCompanies.map((company) => company.reason),
      });
    }
  }

  return {
    companiesEvaluated: companyIds.length,
    contactsAdded,
    skippedCompanies,
    audits,
  };
}
