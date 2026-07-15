import type {
  CompanyContact,
  ContactScoreBreakdown,
  RankedCompanyContact,
} from "../types/CompanyIntelligence";
import type { Evidence } from "../types/Evidence";

const seniorTitleTerms = [
  "chief",
  "ceo",
  "cfo",
  "coo",
  "cio",
  "cto",
  "ciso",
  "president",
  "vp",
  "vice president",
  "director",
  "head",
  "principal",
  "manager",
  "owner",
];

const operationsTitleTerms = [
  "operations",
  "manufacturing",
  "facility",
  "facilities",
  "plant",
  "maintenance",
  "engineering",
  "reliability",
  "supply chain",
  "procurement",
  "quality",
  "production",
];

const evidenceKeywords = [
  "expansion",
  "facility",
  "investment",
  "hiring",
  "acquisition",
  "leadership",
  "product",
  "modernization",
  "reliability",
  "plant",
  "operations",
  "manufacturing",
];

function clampScore(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function getTitleRelevance(contact: CompanyContact) {
  const title = contact.title.toLowerCase();
  let score = 0;

  if (includesAny(title, seniorTitleTerms)) {
    score += 18;
  }

  if (includesAny(title, operationsTitleTerms)) {
    score += 14;
  }

  if (title && title !== "unknown title") {
    score += 4;
  }

  return clampScore(score, 35);
}

function getEvidenceRelevance(contact: CompanyContact, evidence: Evidence[]) {
  const title = contact.title.toLowerCase();
  const evidenceText = evidence
    .map((item) => `${item.evidenceType} ${item.headline} ${item.summary}`.toLowerCase())
    .join(" ");
  const matchingKeywordCount = evidenceKeywords.filter(
    (keyword) => title.includes(keyword) && evidenceText.includes(keyword),
  ).length;

  if (contact.activeSignals.length > 0) {
    return clampScore(12 + matchingKeywordCount * 4 + Math.min(contact.activeSignals.length, 2) * 3, 25);
  }

  if (evidence.length > 0) {
    return clampScore(8 + matchingKeywordCount * 4, 25);
  }

  return 0;
}

function getPreviousOutreachScore(contact: CompanyContact) {
  if (contact.noPreviousOutreach) {
    return 15;
  }

  if (contact.callOutcomes.length === 0) {
    return 10;
  }

  return 4;
}

function getVerifiedContactInformationScore(contact: CompanyContact) {
  let score = 0;

  if (contact.verifiedContact) {
    score += 8;
  }

  if (contact.mobile) {
    score += 5;
  } else if (contact.phone) {
    score += 4;
  }

  if (contact.email) {
    score += 2;
  }

  return clampScore(score, 15);
}

function getImportedContextScore(contact: CompanyContact) {
  let score = 0;

  if (contact.relevantContext) {
    score += 6;
  }

  if (contact.whyToday) {
    score += 4;
  }

  return clampScore(score, 10);
}

function getPrimaryEvidence(evidence: Evidence[]) {
  const confidenceOrder = { High: 3, Medium: 2, Low: 1 };

  return [...evidence].sort((a, b) => {
    const confidenceDelta = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function getWhyThisContact(contact: CompanyContact, breakdown: ContactScoreBreakdown, evidence: Evidence[]) {
  const reasons: string[] = [];
  const primaryEvidence = getPrimaryEvidence(evidence);

  if (breakdown.titleRelevance >= 24) {
    reasons.push(`${contact.title} appears aligned to the operational topic at this account`);
  } else if (breakdown.titleRelevance >= 14) {
    reasons.push(`${contact.title} gives this person useful account context`);
  }

  if (primaryEvidence) {
    reasons.push(`stored evidence points to ${primaryEvidence.evidenceType}`);
  }

  if (contact.noPreviousOutreach || contact.callOutcomes.length === 0) {
    reasons.push("there is no prior outreach recorded");
  }

  return reasons.length > 0
    ? reasons.join(", ") + "."
    : "This contact has the strongest available fit based on imported data.";
}

function getPreviousOutreachStatus(contact: CompanyContact) {
  if (contact.noPreviousOutreach) {
    return "No previous outreach recorded";
  }

  const latestOutcome = contact.callOutcomes[0];
  if (latestOutcome) {
    return `Latest outcome: ${latestOutcome.disposition}`;
  }

  return "Previous outreach status unknown";
}

export function rankContactsForCompany(contacts: CompanyContact[], evidence: Evidence[]): RankedCompanyContact[] {
  const scoredContacts = contacts
    .map((contact) => {
      const scoreBreakdown: ContactScoreBreakdown = {
        titleRelevance: getTitleRelevance(contact),
        evidenceRelevance: getEvidenceRelevance(contact, evidence),
        previousOutreach: getPreviousOutreachScore(contact),
        verifiedContactInformation: getVerifiedContactInformationScore(contact),
        importedContext: getImportedContextScore(contact),
      };
      const overallScore = Object.values(scoreBreakdown).reduce((total, score) => total + score, 0);

      return {
        ...contact,
        overallScore,
        scoreBreakdown,
        companyRank: 0,
        recommended: false,
        whyThisContact: getWhyThisContact(contact, scoreBreakdown, evidence),
        previousOutreachStatus: getPreviousOutreachStatus(contact),
      };
    })
    .sort((a, b) => {
      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }

      return a.name.localeCompare(b.name);
    });

  return scoredContacts.map((contact, index) => ({
    ...contact,
    companyRank: index + 1,
    recommended: index < 3 && contact.overallScore >= 45,
  }));
}
