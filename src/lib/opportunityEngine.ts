import { getSignalCategory } from "./signalLibrary";
import type { Prospect } from "../types/Prospect";

type OpportunityBreakdownItem = {
  label: string;
  points: number;
};

function getSignalScorePoints(prospect: Prospect) {
  const signalScore = Math.max(0, Math.min(100, prospect.confidenceScore || 0));
  return Math.round((signalScore / 100) * 35);
}

function getSignalPriorityPoints(prospect: Prospect) {
  const signal = getSignalCategory(prospect.signalId);

  if (signal.priority === "high") {
    return 15;
  }

  if (signal.priority === "medium") {
    return 10;
  }

  return 5;
}

function getSignalRecencyPoints(occurredAt: string | null | undefined) {
  if (!occurredAt) {
    return 0;
  }

  const occurredTime = new Date(occurredAt).getTime();
  if (Number.isNaN(occurredTime)) {
    return 0;
  }

  const daysOld = Math.max(0, Math.floor((Date.now() - occurredTime) / (1000 * 60 * 60 * 24)));

  if (daysOld <= 7) {
    return 12;
  }

  if (daysOld <= 30) {
    return 8;
  }

  if (daysOld <= 90) {
    return 4;
  }

  return 1;
}

function scoreProspect(prospect: Prospect) {
  if (prospect.whyTodayCategory === "researched-opportunity") {
    // The Contact Intelligence score is the single source of truth.
    // It must never be recalculated downstream.
    const contactPriorityScore = prospect.confidenceScore || 0;

    return {
      ...prospect,
      opportunityScore: contactPriorityScore,
      opportunityBreakdown: [
        {
          label: "Contact Intelligence Score",
          points: contactPriorityScore,
        },
      ],
    };
  }

  const breakdown: OpportunityBreakdownItem[] = [
    { label: "Signal Score", points: getSignalScorePoints(prospect) },
    { label: "Signal Priority", points: getSignalPriorityPoints(prospect) },
    { label: "Recent Signal", points: getSignalRecencyPoints(prospect.signalOccurredAt) },
    { label: "Verified Contact", points: prospect.verifiedContact ? 10 : 0 },
    { label: "No Previous Outreach", points: prospect.noPreviousOutreach ? 8 : 0 },
    { label: "Target Account", points: prospect.targetAccount ? 20 : 0 },
    { label: "Title Match", points: prospect.titleMatch ? 10 : 0 },
  ];

  const rawScore = breakdown.reduce((sum, item) => sum + item.points, 0);
  const opportunityScore = Math.min(100, rawScore);

  return {
    ...prospect,
    opportunityScore,
    opportunityBreakdown: breakdown,
  };
}

export function rankOpportunities(prospects: Prospect[]) {
  return prospects
    .map(scoreProspect)
    .sort((a, b) => {
      if ((b.opportunityScore || 0) !== (a.opportunityScore || 0)) {
        return (b.opportunityScore || 0) - (a.opportunityScore || 0);
      }

      if (b.confidenceScore !== a.confidenceScore) {
        return b.confidenceScore - a.confidenceScore;
      }

      return a.name.localeCompare(b.name);
    });
}
