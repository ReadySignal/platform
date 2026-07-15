type MissionBarProps = {
  opportunitiesRemaining: number;
  callsCompleted: number;
  conversations: number;
  meetings: number;
};

export function MissionBar({
  opportunitiesRemaining,
  callsCompleted,
  conversations,
  meetings,
}: MissionBarProps) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-5 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)] backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            Today&apos;s Mission
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-slate-950">
            Today&apos;s Mission
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Opportunities Remaining: {opportunitiesRemaining}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Calls Completed: {callsCompleted}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Conversations: {conversations}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Meetings: {meetings}
          </div>
        </div>
      </div>
    </section>
  );
}
