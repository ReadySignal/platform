import type { Prospect } from "../types/Prospect";
import { calculateSignalScore, getConfidenceLabel } from "../lib/signalEngine";

type ConfidenceScoreProps = {
  prospect: Prospect;
};

export function ConfidenceScore({ prospect }: ConfidenceScoreProps) {
  const signal = calculateSignalScore(prospect);
  const confidenceLabel = getConfidenceLabel(signal.score);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
        Confidence Score
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
            confidenceLabel === "High Confidence"
              ? "bg-emerald-50 text-emerald-700"
              : confidenceLabel === "Medium Confidence"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {confidenceLabel}
        </span>
        <span className="text-sm font-semibold text-slate-900">{signal.score}%</span>
      </div>
    </div>
  );
}
