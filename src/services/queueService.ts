import { getConfidenceLabel } from "../lib/signalEngine";
import { rankOpportunities } from "../lib/opportunityEngine";
import { signalLibrary } from "../lib/signalLibrary";
import { supabase } from "../lib/supabase";
import type { Prospect } from "../types/Prospect";

type QueueContactRow = {
  id: string | number;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  relevant_context: string | null;
  why_today: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  companies:
    | {
        name: string | null;
        industry: string | null;
        state: string | null;
        is_target_account: boolean | null;
      }
    | null;
  signals:
    | {
        id: number | string;
        signal_type: string | null;
        headline: string | null;
        details: string | null;
        occurred_at: string | null;
        score_points: number | null;
        is_active: boolean | null;
      }[]
    | null;
};

type ContactGroup = {
  contactId: string | number;
  firstName: string;
  lastName: string;
  title: string;
  companyName: string;
  industry: string;
  state: string;
  phone: string;
  mobile: string;
  email: string;
  relevantContext: string;
  whyToday: string;
  targetAccount: boolean;
  activeSignals: Array<{
    id: number;
    signalType: string;
    headline: string;
    details: string | null;
    occurredAt: string | null;
    scorePoints: number;
  }>;
};

type QueueItem = {
  primarySignalId: number | null;
  signalType: string;
  signalHeadline: string;
  signalDetails: string;
  signalOccurredAt: string;
  signalScorePoints: number;
  secondarySignals: Prospect["signals"];
};

function toComparableTime(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function compareSignalsByPriority(
  a: { scorePoints: number; occurredAt: string | null },
  b: { scorePoints: number; occurredAt: string | null },
) {
  if (b.scorePoints !== a.scorePoints) {
    return b.scorePoints - a.scorePoints;
  }

  return toComparableTime(b.occurredAt) - toComparableTime(a.occurredAt);
}

function toSignalId(signalType: string) {
  const normalized = signalType.trim().toLowerCase().replaceAll("_", "-").replace(/\s+/g, "-");
  const exact = signalLibrary.find((signal) => signal.id === normalized);

  if (exact) {
    return exact.id;
  }

  if (normalized.includes("promotion")) {
    return "promotion";
  }

  if (normalized.includes("expand")) {
    return "expansion";
  }

  if (normalized.includes("hire")) {
    return "hiring";
  }

  if (normalized.includes("invest")) {
    return "capital-investment";
  }

  if (normalized.includes("leader")) {
    return "leadership-change";
  }

  return "industry-news";
}

function toConfidence(scorePoints: number): Prospect["confidence"] {
  const label = getConfidenceLabel(scorePoints);
  return label === "High Confidence" ? "High Confidence" : "Medium Confidence";
}

function toProspect(item: ContactGroup & QueueItem, id: number): Prospect {
  const signalId = toSignalId(item.signalType);
  const name = `${item.firstName} ${item.lastName}`.trim();
  const reason = item.signalHeadline || item.whyToday || "Live signal indicates timely outreach potential.";

  return {
    id,
    contactId: Number(item.contactId),
    name: name || "Unknown Contact",
    title: item.title || "Unknown Title",
    company: item.companyName || "Unknown Company",
    location: item.state || "Unknown",
    reason,
    directPhone: item.phone || "Not available",
    mobilePhone: item.mobile || "Not available",
    email: item.email || "Not available",
    notes: item.relevantContext || item.signalDetails || "No additional context available.",
    callOpener: `Hi ${item.firstName || "there"}, this is Alex from ReadySignal. I noticed ${reason.toLowerCase()} and wanted to share a quick idea that could help your team right now.`,
    confidence: toConfidence(item.signalScorePoints),
    confidenceScore: item.signalScorePoints,
    whyTodayCategory: item.signalType || "Signal",
    whyTodayReason: item.whyToday || reason,
    signalId,
    signalDatabaseId: item.primarySignalId,
    signalOccurredAt: item.signalOccurredAt || null,
    targetAccount: item.targetAccount,
    signals: item.secondarySignals,
    titleMatch: Boolean(item.title),
    targetIndustry: Boolean(item.industry),
    targetState: Boolean(item.state),
    companySizeMatch: Boolean(item.companyName),
    recentPromotion: signalId === "promotion",
    verifiedContact: Boolean(item.phone || item.mobile || item.email),
    relevantContext: Boolean(item.relevantContext || item.signalDetails),
    noPreviousOutreach: true,
    breakdown: {
      titleMatch: item.title
        ? `The title ${item.title} aligns with operational outreach.`
        : "Title information is limited.",
      companyFit: item.industry
        ? `${item.companyName || "This company"} operates in ${item.industry}.`
        : "Industry details are limited.",
      timingSignals: item.signalHeadline || item.signalDetails || "A live timing signal is available.",
      contactQuality:
        item.phone || item.mobile || item.email
          ? "At least one contact channel is available."
          : "Contact channels are incomplete.",
      relevantContext: item.relevantContext || "No relevant context provided.",
    },
  };
}

export async function getQueue(): Promise<Prospect[]> {
  try {
    const { data, error } = await supabase
      .from("contacts")
      .select(
        `
          id,
          first_name,
          last_name,
          title,
          relevant_context,
          why_today,
          phone,
          mobile,
          email,
          companies:company_id (
            name,
            industry,
            state,
            is_target_account
          ),
          signals (
            id,
            signal_type,
            headline,
            details,
            occurred_at,
            score_points,
            is_active
          )
        `,
      )
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch queue: ${error.message}`);
    }

    const contacts = (((data as unknown) as QueueContactRow[]) || []).map((contact) => ({
      ...contact,
      signals: contact.signals || [],
    }));

    const groupedByContact = new Map<string, ContactGroup>();

    for (const contact of contacts) {
      const company = contact.companies;
      const contactIdKey = String(contact.id);
      const activeSignals = (contact.signals || [])
        .filter((signal) => signal.is_active !== false)
        .map((signal, index) => ({
          id: Number(signal.id) || index + 1,
          signalType: signal.signal_type || "industry-news",
          headline: signal.headline || "Live signal",
          details: signal.details,
          occurredAt: signal.occurred_at,
          scorePoints: Math.max(0, Math.min(100, signal.score_points ?? 60)),
        }))
        .sort(compareSignalsByPriority);

      groupedByContact.set(contactIdKey, {
        contactId: contact.id,
        firstName: contact.first_name || "",
        lastName: contact.last_name || "",
        title: contact.title || "",
        companyName: company?.name || "",
        industry: company?.industry || "",
        state: company?.state || "",
        phone: contact.phone || "",
        mobile: contact.mobile || "",
        email: contact.email || "",
        relevantContext: contact.relevant_context || "",
        whyToday: contact.why_today || "",
        targetAccount: Boolean(company?.is_target_account),
        activeSignals,
      });
    }

    const queueItems = Array.from(groupedByContact.values()).map((contactGroup) => {
      const primarySignal =
        contactGroup.activeSignals[0] ||
        {
          id: Number(contactGroup.contactId) || 1,
          signalType: "industry-news",
          headline: "Live contact loaded",
          details: "No active signal was attached to this contact.",
          occurredAt: null,
          scorePoints: 60,
        };

      return {
        ...contactGroup,
        primarySignalId: primarySignal.id,
        signalType: primarySignal.signalType,
        signalHeadline: primarySignal.headline,
        signalDetails: primarySignal.details || "",
        signalOccurredAt: primarySignal.occurredAt || "",
        signalScorePoints: primarySignal.scorePoints,
        secondarySignals: contactGroup.activeSignals.slice(1),
      };
    });

    const prospects = queueItems.map((item, index) => toProspect(item, index + 1));
    return rankOpportunities(prospects);
  } catch (error) {
    console.error("getQueue error:", error);
    throw error;
  }
}
