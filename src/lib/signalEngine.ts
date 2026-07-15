import type { Prospect } from "../types/Prospect";
import { getSignalCategory } from "./signalLibrary";

export type SignalBreakdownItem = {
  label: string;
  points: number;
};

export function getConfidenceLabel(score: number) {
  if (score >= 80) {
    return "High Confidence";
  }

  if (score >= 60) {
    return "Medium Confidence";
  }

  return "Low Confidence";
}

export function calculateSignalScore(prospect: Prospect) {
  const signal = getSignalCategory(prospect.signalId);

  const rules = [
    {
      label: "Title Match",
      points: 25,
      applied: Boolean(prospect.titleMatch),
    },
    {
      label: "Target Industry",
      points: 20,
      applied: Boolean(prospect.targetIndustry),
    },
    {
      label: "Target State",
      points: 15,
      applied: Boolean(prospect.targetState),
    },
    {
      label: "Company Size Match",
      points: 15,
      applied: Boolean(prospect.companySizeMatch),
    },
    {
      label: "Timing Signal",
      points: signal.defaultPoints,
      applied: Boolean(prospect.signalId),
    },
    {
      label: "Verified Contact",
      points: 10,
      applied: Boolean(prospect.verifiedContact),
    },
    {
      label: "Relevant Context",
      points: 10,
      applied: Boolean(prospect.relevantContext),
    },
    {
      label: "No Previous Outreach",
      points: 10,
      applied: Boolean(prospect.noPreviousOutreach),
    },
  ];

  const totalPossiblePoints = rules.reduce((total, rule) => total + rule.points, 0);
  const earnedPoints = rules.reduce((total, rule) => total + (rule.applied ? rule.points : 0), 0);
  const score = Math.min(100, Math.max(0, Math.round((earnedPoints / totalPossiblePoints) * 100)));

  return {
    score,
    breakdown: rules.map((rule) => ({
      label: rule.label,
      points: rule.applied ? rule.points : 0,
    })),
  };
}
