import { getCallOutcomesForContactsBetween } from "./callOutcomeService";
import {
  getMissionOutcomesForContacts,
  getMissionOutcomesForContactsBetween,
} from "./missionOutcomeService";
import { getQueue } from "./queueService";
import type { CallOutcome } from "../types/CallOutcome";
import type { Mission, MissionProgress, TodaysMission } from "../types/Mission";
import type { MissionOutcome } from "../types/MissionOutcome";
import type { Prospect } from "../types/Prospect";

function getLocalTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getLatestOutcomesByProspectId(prospects: Prospect[], outcomes: CallOutcome[]) {
  const prospectIdByContactId = new Map<number, number>();

  for (const prospect of prospects) {
    if (typeof prospect.contactId === "number") {
      prospectIdByContactId.set(prospect.contactId, prospect.id);
    }
  }

  return outcomes.reduce<Record<number, CallOutcome>>((acc, outcome) => {
    const prospectId = prospectIdByContactId.get(outcome.contactId);

    if (typeof prospectId !== "number") {
      return acc;
    }

    const current = acc[prospectId];
    if (!current || new Date(outcome.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      acc[prospectId] = outcome;
    }

    return acc;
  }, {});
}

export function calculateMissionProgress(
  missions: Mission[],
  outcomesByProspectId: Record<number, CallOutcome>,
  missionOutcomesByProspectId: Record<number, MissionOutcome> = {},
): MissionProgress {
  const completedIds = Array.from(
    new Set([...Object.keys(outcomesByProspectId).map(Number), ...Object.keys(missionOutcomesByProspectId).map(Number)]),
  );
  const conversations = completedIds.filter((prospectId) => {
    const missionOutcome = missionOutcomesByProspectId[prospectId];
    if (missionOutcome) return missionOutcome.connected;
    const callOutcome = outcomesByProspectId[prospectId];
    return callOutcome?.disposition === "Conversation" || callOutcome?.disposition === "Meeting Booked";
  }).length;
  const meetings = completedIds.filter((prospectId) => {
    const missionOutcome = missionOutcomesByProspectId[prospectId];
    if (missionOutcome) return missionOutcome.outcome === "Meeting Booked";
    return outcomesByProspectId[prospectId]?.disposition === "Meeting Booked";
  }).length;

  return {
    completedIds,
    opportunitiesRemaining: Math.max(0, missions.length - completedIds.length),
    callsCompleted: completedIds.length,
    conversations,
    meetings,
  };
}

function getPreviousInteractionSummary(prospect: Prospect, latestOutcome?: CallOutcome, latestMissionOutcome?: MissionOutcome) {
  if (latestMissionOutcome) {
    return `Latest mission outcome: ${latestMissionOutcome.outcome}`;
  }

  if (latestOutcome) {
    return `Latest outcome today: ${latestOutcome.disposition}`;
  }

  return prospect.noPreviousOutreach ? "No previous outreach recorded." : "Previous outreach should be reviewed.";
}

function getEstimatedValue(prospect: Prospect): Mission["estimatedValue"] {
  if (prospect.confidenceScore >= 80 && prospect.targetAccount) {
    return "High";
  }

  if (prospect.confidenceScore >= 60) {
    return "Medium";
  }

  return "Unknown";
}

function getDecisionExplanation(prospect: Prospect, latestMissionOutcome?: MissionOutcome) {
  const reasons: string[] = [];

  if (latestMissionOutcome?.followUpDate) {
    reasons.push("a follow-up is due from a previous conversation");
  }

  if (prospect.targetState || prospect.targetAccount) {
    reasons.push("the account appears assigned to this SDR");
  }

  if (prospect.whyTodayReason) {
    reasons.push("verified or active intelligence creates a reason to call");
  }

  if (prospect.verifiedContact) {
    reasons.push("the contact has usable contact information");
  }

  if (prospect.noPreviousOutreach) {
    reasons.push("no recent outreach is recorded");
  }

  return reasons.length > 0
    ? `Recommended because ${reasons.join(", ")}.`
    : "Recommended as the best available mission based on the current intelligence set.";
}

function toMission(prospect: Prospect, latestOutcome?: CallOutcome, latestMissionOutcome?: MissionOutcome): Mission {
  const isFollowUpMission = Boolean(latestMissionOutcome?.followUpDate);
  const decisionExplanation = getDecisionExplanation(prospect, latestMissionOutcome);

  return {
    id: prospect.id,
    company: {
      id: prospect.companyId,
      name: prospect.company,
      location: prospect.location,
      targetAccount: Boolean(prospect.targetAccount),
    },
    primaryContact: {
      id: prospect.contactId,
      name: prospect.name,
      title: prospect.title,
      directPhone: prospect.directPhone,
      mobilePhone: prospect.mobilePhone,
      email: prospect.email,
    },
    missionScore: prospect.confidenceScore,
    confidence: prospect.confidence,
    whyToday: {
      category: prospect.whyTodayCategory,
      label: prospect.whyTodayLabel,
      reason: prospect.whyTodayReason || prospect.reason,
      occurredAt: prospect.signalOccurredAt || null,
    },
    callBrief: prospect.callBrief,
    supportingEvidence: prospect.signals,
    previousInteractionSummary: getPreviousInteractionSummary(prospect, latestOutcome, latestMissionOutcome),
    recommendedNextAction: isFollowUpMission
      ? latestMissionOutcome?.recommendedNextAction || "Follow up from prior conversation."
      : latestOutcome
        ? "Review saved outcome or log another attempt."
        : "Start conversation.",
    estimatedValue: getEstimatedValue(prospect),
    decisionExplanation,
    prospect: {
      ...prospect,
      reason: isFollowUpMission
        ? latestMissionOutcome?.recommendedNextAction || prospect.whyTodayReason || prospect.reason
        : prospect.whyTodayReason || prospect.reason,
      notes: prospect.notes || decisionExplanation,
      confidenceScore: prospect.confidenceScore,
    },
  };
}

function getLatestMissionOutcomesByProspectId(prospects: Prospect[], outcomes: MissionOutcome[]) {
  const prospectIdByContactId = new Map<number, number>();

  for (const prospect of prospects) {
    if (typeof prospect.contactId === "number") {
      prospectIdByContactId.set(prospect.contactId, prospect.id);
    }
  }

  return outcomes.reduce<Record<number, MissionOutcome>>((acc, outcome) => {
    if (typeof outcome.contactId !== "number") return acc;
    const prospectId = prospectIdByContactId.get(outcome.contactId);
    if (typeof prospectId !== "number") return acc;

    const current = acc[prospectId];
    if (!current || new Date(outcome.occurredAt).getTime() > new Date(current.occurredAt).getTime()) {
      acc[prospectId] = outcome;
    }

    return acc;
  }, {});
}

function getDueFollowUpsByProspectId(prospects: Prospect[], outcomes: MissionOutcome[], now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dueOutcomes = outcomes.filter((outcome) => {
    if (!outcome.followUpDate) return false;
    const followUpDate = new Date(outcome.followUpDate);
    return followUpDate >= start && followUpDate < end;
  });

  return getLatestMissionOutcomesByProspectId(prospects, dueOutcomes);
}

function shouldExcludeFromMissions(outcome?: MissionOutcome) {
  return outcome?.outcome === "Meeting Booked" || outcome?.outcome === "Already Customer" || outcome?.outcome === "Disqualified";
}

function adjustProspectForMissionOutcome(prospect: Prospect, latestOutcome?: MissionOutcome) {
  if (latestOutcome?.outcome !== "Wrong Person") return prospect;

  return {
    ...prospect,
    confidenceScore: Math.max(0, prospect.confidenceScore - 20),
    notes: `${prospect.notes || ""} Recent outcome: wrong person. Temporarily lowered priority.`.trim(),
  };
}

export async function getTodaysMission(options: { includeDemo?: boolean } = {}): Promise<TodaysMission> {
  const prospects = await getQueue({ includeDemo: options.includeDemo });
  const contactIds = prospects
    .map((prospect) => prospect.contactId)
    .filter((contactId): contactId is number => typeof contactId === "number");
  const { startIso, endIso } = getLocalTodayRange();
  const todayOutcomes = contactIds.length > 0 ? await getCallOutcomesForContactsBetween(contactIds, startIso, endIso) : [];
  const allMissionOutcomes = contactIds.length > 0 ? await getMissionOutcomesForContacts(contactIds) : [];
  const todayMissionOutcomes =
    contactIds.length > 0 ? await getMissionOutcomesForContactsBetween(contactIds, startIso, endIso) : [];
  const outcomesByProspectId = getLatestOutcomesByProspectId(prospects, todayOutcomes);
  const latestMissionOutcomesByProspectId = getLatestMissionOutcomesByProspectId(prospects, allMissionOutcomes);
  const todayMissionOutcomesByProspectId = getLatestMissionOutcomesByProspectId(prospects, todayMissionOutcomes);
  const dueFollowUpsByProspectId = getDueFollowUpsByProspectId(prospects, allMissionOutcomes);
  const eligibleProspects = prospects
    .filter(
      (prospect) =>
        todayMissionOutcomesByProspectId[prospect.id] ||
        !shouldExcludeFromMissions(latestMissionOutcomesByProspectId[prospect.id]),
    )
    .map((prospect) => adjustProspectForMissionOutcome(prospect, latestMissionOutcomesByProspectId[prospect.id]));
  const missions = eligibleProspects
    .map((prospect) => toMission(prospect, outcomesByProspectId[prospect.id], dueFollowUpsByProspectId[prospect.id]))
    .sort((a, b) => {
      const aFollowUp = dueFollowUpsByProspectId[a.id] ? 1 : 0;
      const bFollowUp = dueFollowUpsByProspectId[b.id] ? 1 : 0;
      if (aFollowUp !== bFollowUp) return bFollowUp - aFollowUp;
      return b.missionScore - a.missionScore;
    });
  const progress = calculateMissionProgress(missions, outcomesByProspectId, todayMissionOutcomesByProspectId);

  return {
    missions,
    outcomesByProspectId,
    missionOutcomesByProspectId: todayMissionOutcomesByProspectId,
    progress,
    nextMissionId: missions.find((mission) => !progress.completedIds.includes(mission.id))?.id ?? null,
  };
}
