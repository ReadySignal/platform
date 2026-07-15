import type { Company } from "../types/Company";
import type { RankedCompanyContact, SalesInsight } from "../types/CompanyIntelligence";
import type { Evidence } from "../types/Evidence";

type SalesInsightInput = {
  company: Company;
  rankedContact: RankedCompanyContact | null;
  evidence: Evidence[];
};

const confidenceOrder = { High: 3, Medium: 2, Low: 1 };

function sortEvidenceForInsight(evidence: Evidence[]) {
  return [...evidence]
    .filter((item) => item.isActive !== false)
    .sort((a, b) => {
      const confidenceDelta = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });
}

function getRoleFit(contact: RankedCompanyContact) {
  if (contact.scoreBreakdown.titleRelevance >= 24) {
    return "their role appears close to operational decision-making";
  }

  if (contact.scoreBreakdown.titleRelevance >= 14) {
    return "their role is a plausible path into the account";
  }

  return "they are the strongest available contact from the imported list";
}

function getEvidenceTopic(evidence: Evidence) {
  return evidence.evidenceType.replace(/\s+/g, " ").trim() || "recent company evidence";
}

function getRoleArea(contact: RankedCompanyContact) {
  const title = contact.title.toLowerCase();

  if (title.includes("operations") || title.includes("plant") || title.includes("facility")) {
    return "operations";
  }

  if (title.includes("engineering") || title.includes("maintenance") || title.includes("reliability")) {
    return "reliability";
  }

  if (title.includes("supply") || title.includes("procurement")) {
    return "supply chain";
  }

  if (title.includes("quality")) {
    return "quality";
  }

  return "their team";
}

function getNoEvidenceInsight(company: Company, rankedContact: RankedCompanyContact): SalesInsight {
  const roleArea = getRoleArea(rankedContact);

  return {
    hasSufficientEvidence: false,
    whyThisContact: `${rankedContact.name} is prioritized because ${getRoleFit(rankedContact)} and the record has usable contact context.`,
    conversationAngle: `No timely evidence-backed conversation angle is available for ${company.name} yet.`,
    discoveryQuestions: [
      `What is most important for ${roleArea} right now?`,
      "Where is the team seeing the most friction this quarter?",
      "Who else is involved when that becomes a priority?",
    ],
  };
}

export function createSalesInsight({ company, rankedContact, evidence }: SalesInsightInput): SalesInsight | null {
  if (!rankedContact) {
    return null;
  }

  const primaryEvidence = sortEvidenceForInsight(evidence)[0];

  if (!primaryEvidence) {
    return getNoEvidenceInsight(company, rankedContact);
  }

  const evidenceTopic = getEvidenceTopic(primaryEvidence);
  const roleArea = getRoleArea(rankedContact);

  return {
    hasSufficientEvidence: true,
    whyThisContact: `${rankedContact.name} is prioritized because ${getRoleFit(rankedContact)} and stored evidence points to ${evidenceTopic}.`,
    conversationAngle: `Explore how ${evidenceTopic} may be affecting ${roleArea} priorities.`,
    discoveryQuestions: [
      `How is ${evidenceTopic} affecting ${roleArea}?`,
      "What has become harder or more urgent as a result?",
      "Who else is involved if this becomes an active project?",
    ],
  };
}
